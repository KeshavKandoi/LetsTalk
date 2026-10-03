import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from './db'
import { friendMessage, user, userDevice, userProfile } from './db/schema'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const TOKEN_PATTERN = /^Expo(nent)?PushToken\[[^\]\s]+\]$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TOKEN_IN_TEXT = /Expo(nent)?PushToken\[[^\]]*\]/g
const UNREAD = ['sent', 'pending', 'delivered']
const CHUNK_SIZE = 100
const REQUEST_TIMEOUT_MS = 8000
const ANDROID_CHANNEL_ID = 'messages'
const PUSH_TTL_SECONDS = 86400

export type PushMessage = {
  to: string
  title: string
  body: string
  data: Record<string, unknown>
  sound: 'default'
  channelId: string
  priority: 'high'
  ttl: number
}
type PushTicket = { status: string; message?: string; details?: { error?: string } }
export type PushChunkResult = { httpStatus: number | null; sent: number; failed: number; deadTokens: string[]; errors: string[] }
export type PushSummary = { devices: number; sent: number; failed: number; errors: string[] }

function redact(text: string) {
  return text.replace(TOKEN_IN_TEXT, 'EXPO_TOKEN').slice(0, 200)
}

export function isValidPushToken(token: unknown): token is string {
  return typeof token === 'string' && token.length > 0 && token.length <= 200 && (TOKEN_PATTERN.test(token) || UUID_PATTERN.test(token))
}

export async function registerDevice(input: { userId: string; pushToken: string; platform?: string }) {
  const now = new Date()
  const platform = input.platform ?? 'android'
  await db
    .insert(userDevice)
    .values({ id: crypto.randomUUID(), userId: input.userId, pushToken: input.pushToken, platform, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: userDevice.pushToken,
      set: { userId: input.userId, platform, updatedAt: now },
    })
}

export async function unregisterDevice(input: { userId: string; pushToken: string }) {
  await db.delete(userDevice).where(and(eq(userDevice.userId, input.userId), eq(userDevice.pushToken, input.pushToken)))
}

export async function getRecipientTokens(userId: string) {
  const rows = (await db.select({ pushToken: userDevice.pushToken }).from(userDevice).where(eq(userDevice.userId, userId))) as { pushToken: string }[]
  return rows.map((row) => row.pushToken)
}

export async function removeDeadTokens(tokens: string[]) {
  if (tokens.length === 0) return
  await db.delete(userDevice).where(inArray(userDevice.pushToken, tokens))
}

export function buildPushMessages(tokens: string[], content: { title: string; body: string; data: Record<string, unknown> }): PushMessage[] {
  return tokens.map((to) => ({
    to,
    title: content.title,
    body: content.body,
    data: content.data,
    sound: 'default',
    channelId: ANDROID_CHANNEL_ID,
    priority: 'high',
    ttl: PUSH_TTL_SECONDS,
  }))
}

function previewOf(row: { body: string; messageType: string }) {
  if (row.messageType === 'image') return 'Photo'
  if (row.messageType === 'audio') return 'Voice message'
  if (row.messageType !== 'text') return 'Attachment'
  return row.body.length > 120 ? `${row.body.slice(0, 117)}...` : row.body
}

export async function sendPushChunk(chunk: PushMessage[]): Promise<PushChunkResult> {
  const result: PushChunkResult = { httpStatus: null, sent: 0, failed: 0, deadTokens: [], errors: [] }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
      },
      body: JSON.stringify(chunk),
      signal: controller.signal,
    })
    result.httpStatus = res.status
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      result.failed = chunk.length
      result.errors.push(redact(`http_${res.status}:${text}`))
      return result
    }
    const json = (await res.json()) as { data?: PushTicket[]; errors?: { code?: string; message?: string }[] }
    if (json.errors && json.errors.length > 0) {
      result.failed = chunk.length
      for (const e of json.errors) result.errors.push(redact(`api_${e.code ?? 'error'}:${e.message ?? ''}`))
      return result
    }
    const tickets = json.data ?? []
    if (tickets.length !== chunk.length) result.errors.push(`ticket_count_mismatch:${tickets.length}/${chunk.length}`)
    tickets.forEach((ticket, index) => {
      if (ticket.status === 'ok') {
        result.sent++
        return
      }
      result.failed++
      const code = ticket.details?.error ?? 'unknown'
      result.errors.push(redact(`${code}:${ticket.message ?? ''}`))
      if (code === 'DeviceNotRegistered' && chunk[index]) result.deadTokens.push(chunk[index].to)
    })
  } catch (err) {
    result.failed = chunk.length
    result.errors.push(redact(`request_failed:${err instanceof Error ? err.message : String(err)}`))
  } finally {
    clearTimeout(timeout)
  }
  return result
}

export async function notifyNewMessage(input: { senderUserId: string; recipientUserId: string; friendRequestId: string }): Promise<PushSummary> {
  const summary: PushSummary = { devices: 0, sent: 0, failed: 0, errors: [] }
  try {
    const tokens = await getRecipientTokens(input.recipientUserId)
    summary.devices = tokens.length
    if (tokens.length === 0) {
      console.log(`[CHAT_FLOW][PUSH] no registered devices recipient=${input.recipientUserId}`)
      return summary
    }

    const unread = and(
      eq(friendMessage.friendRequestId, input.friendRequestId),
      eq(friendMessage.senderUserId, input.senderUserId),
      eq(friendMessage.recipientUserId, input.recipientUserId),
      inArray(friendMessage.status, UNREAD),
    )
    const [countRow] = await db.select({ count: sql<number>`count(*)::int` }).from(friendMessage).where(unread)
    const recentRows = await db
      .select({ body: friendMessage.body, messageType: friendMessage.messageType })
      .from(friendMessage)
      .where(unread)
      .orderBy(desc(friendMessage.createdAt))
      .limit(5)
    const [sender] = await db
      .select({ username: user.displayUsername, fallback: user.username, name: user.name, photoUrl: userProfile.photoUrl })
      .from(user)
      .leftJoin(userProfile, eq(userProfile.userId, user.id))
      .where(eq(user.id, input.senderUserId))
      .limit(1)

    const senderName = sender?.username || sender?.fallback || sender?.name || 'Someone'
    const count = countRow?.count ?? recentRows.length
    const recent = recentRows.map(previewOf).reverse()
    const data = {
      type: 'chat_message',
      conversationId: input.friendRequestId,
      friendUserId: input.senderUserId,
      senderName,
      senderPhotoUrl: sender?.photoUrl ?? null,
      unreadCount: count,
      recent,
    }
    const messages = buildPushMessages(tokens, {
      title: count > 1 ? `${senderName} — ${count} new messages` : senderName,
      body: count > 1 ? recent.join('\n') : (recent[0] ?? 'New message'),
      data,
    })

    const dead: string[] = []
    for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
      const r = await sendPushChunk(messages.slice(i, i + CHUNK_SIZE))
      summary.sent += r.sent
      summary.failed += r.failed
      summary.errors.push(...r.errors)
      dead.push(...r.deadTokens)
    }
    await removeDeadTokens(dead)
    console.log(`[CHAT_FLOW][PUSH] recipient=${input.recipientUserId} devices=${summary.devices} sent=${summary.sent} failed=${summary.failed} removed=${dead.length}${summary.errors.length ? ` errors=${summary.errors.join(' | ')}` : ''}`)
  } catch (err) {
    summary.errors.push(redact(`notify_failed:${err instanceof Error ? err.message : String(err)}`))
    console.error(`[CHAT_FLOW][PUSH] notify failed ${summary.errors[summary.errors.length - 1]}`)
  }
  return summary
}
