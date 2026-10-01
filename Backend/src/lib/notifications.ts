import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from './db'
import { friendMessage, user, userDevice, userProfile } from './db/schema'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const TOKEN_PATTERN = /^Expo(nent)?PushToken\[[^\]\s]+\]$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const UNREAD = ['sent', 'pending', 'delivered']
const CHUNK_SIZE = 100
const REQUEST_TIMEOUT_MS = 8000

type PushMessage = { to: string; data: Record<string, unknown>; priority: 'high'; ttl: number }
type PushTicket = { status: string; details?: { error?: string } }

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

function previewOf(row: { body: string; messageType: string }) {
  if (row.messageType === 'image') return 'Photo'
  if (row.messageType === 'audio') return 'Voice message'
  if (row.messageType !== 'text') return 'Attachment'
  return row.body.length > 120 ? `${row.body.slice(0, 117)}...` : row.body
}

async function sendChunk(chunk: PushMessage[]) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  console.log(`[CHAT_DEBUG][PUSH] Expo push request started chunkCount=${chunk.length}`)
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
    console.log(`[CHAT_DEBUG][PUSH] Expo HTTP status=${res.status}`)
    if (!res.ok) {
      const text = await res.text().catch(() => 'No response body')
      console.error(`[CHAT_DEBUG][PUSH] Expo HTTP error status=${res.status} body=${text.slice(0, 300)}`)
      return
    }
    const json = (await res.json()) as { data?: PushTicket[]; errors?: unknown[] }
    if (json.errors) {
      console.error('[CHAT_DEBUG][PUSH] Expo API errors:', JSON.stringify(json.errors).slice(0, 300))
    }
    const dead: string[] = []
    json.data?.forEach((ticket, index) => {
      console.log(`[CHAT_DEBUG][PUSH] Expo ticket status=${ticket.status}${ticket.details?.error ? ` error=${ticket.details.error}` : ''}`)
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        dead.push(chunk[index].to)
      }
    })
    if (dead.length > 0) {
      console.log(`[CHAT_DEBUG][PUSH] Removing ${dead.length} dead push tokens`)
      await db.delete(userDevice).where(inArray(userDevice.pushToken, dead))
    }
  } catch (err) {
    console.error('[CHAT_DEBUG][PUSH] Expo push request failed:', err instanceof Error ? err.message : err)
  } finally {
    clearTimeout(timeout)
  }
}

export async function notifyNewMessage(input: { senderUserId: string; recipientUserId: string; friendRequestId: string }) {
  try {
    const devices = await db
      .select({ pushToken: userDevice.pushToken })
      .from(userDevice)
      .where(eq(userDevice.userId, input.recipientUserId))
    console.log(`[CHAT_DEBUG][PUSH] recipient device lookup count=${devices.length} recipientUserId=${input.recipientUserId}`)
    if (devices.length === 0) return

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

    const data = {
      type: 'chat_message',
      conversationId: input.friendRequestId,
      friendUserId: input.senderUserId,
      senderName: sender?.username || sender?.fallback || sender?.name || 'Someone',
      senderPhotoUrl: sender?.photoUrl ?? null,
      unreadCount: countRow?.count ?? recentRows.length,
      recent: recentRows.map(previewOf).reverse(),
    }
    const messages: PushMessage[] = devices.map((device) => ({ to: device.pushToken, data, priority: 'high', ttl: 86400 }))
    for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
      await sendChunk(messages.slice(i, i + CHUNK_SIZE))
    }
  } catch (err) {
    console.error('[CHAT_DEBUG][PUSH] notifyNewMessage failed:', err instanceof Error ? err.message : err)
  }
}

