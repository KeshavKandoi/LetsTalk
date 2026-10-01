import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from './db'
import { friendMessage } from './db/schema'
import { ChatMediaError } from './chat-media'
import { publishUserEvent } from './realtime-publish'

const MAX_IDS = 200
const UNDELIVERED = ['sent', 'pending']
const UNREAD = ['sent', 'pending', 'delivered']

type StatusRow = { id: string; senderUserId: string; friendRequestId: string }

function cleanIds(ids: string[]) {
  const unique = [...new Set(ids)].filter((id) => typeof id === 'string' && id.length > 0 && id.length <= 100)
  if (unique.length === 0) throw new ChatMediaError(400, 'Invalid request.')
  if (unique.length > MAX_IDS) throw new ChatMediaError(400, 'Too many messages.')
  return unique
}

async function assertRecipient(viewerUserId: string, ids: string[]) {
  const owned = await db
    .select({ id: friendMessage.id })
    .from(friendMessage)
    .where(and(inArray(friendMessage.id, ids), eq(friendMessage.recipientUserId, viewerUserId)))
  if (owned.length !== ids.length) throw new ChatMediaError(403, 'Not allowed.')
}

async function publishStatus(rows: StatusRow[], status: 'delivered' | 'read', recipientUserId: string, at: Date) {
  const grouped = new Map<string, { senderUserId: string; conversationId: string; messageIds: string[] }>()
  for (const row of rows) {
    const key = `${row.senderUserId}:${row.friendRequestId}`
    const entry = grouped.get(key) ?? { senderUserId: row.senderUserId, conversationId: row.friendRequestId, messageIds: [] }
    entry.messageIds.push(row.id)
    grouped.set(key, entry)
  }
  await Promise.all(
    Array.from(grouped.values()).map((entry) =>
      publishUserEvent(entry.senderUserId, 'message_status', {
        status,
        conversationId: entry.conversationId,
        messageIds: entry.messageIds,
        recipientUserId,
        at: at.toISOString(),
      }),
    ),
  )
}

export async function markMessagesDelivered(input: { viewerUserId: string; messageIds: string[] }) {
  const ids = cleanIds(input.messageIds)
  await assertRecipient(input.viewerUserId, ids)
  const now = new Date()
  const rows = await db
    .update(friendMessage)
    .set({ status: 'delivered', deliveredAt: now, updatedAt: now })
    .where(
      and(
        inArray(friendMessage.id, ids),
        eq(friendMessage.recipientUserId, input.viewerUserId),
        inArray(friendMessage.status, UNDELIVERED),
      ),
    )
    .returning({ id: friendMessage.id, senderUserId: friendMessage.senderUserId, friendRequestId: friendMessage.friendRequestId })
  if (rows.length > 0) await publishStatus(rows, 'delivered', input.viewerUserId, now)
  return { success: true, updated: rows.map((row) => row.id) }
}

export async function markMessagesRead(input: { viewerUserId: string; friendUserId?: string; messageIds?: string[] }) {
  const ids = input.messageIds ? cleanIds(input.messageIds) : null
  if (!ids && !input.friendUserId) throw new ChatMediaError(400, 'Invalid request.')
  if (ids) await assertRecipient(input.viewerUserId, ids)
  const now = new Date()
  const conditions = [
    eq(friendMessage.recipientUserId, input.viewerUserId),
    inArray(friendMessage.status, UNREAD),
  ]
  if (input.friendUserId) conditions.push(eq(friendMessage.senderUserId, input.friendUserId))
  if (ids) conditions.push(inArray(friendMessage.id, ids))
  const rows = await db
    .update(friendMessage)
    .set({
      status: 'read',
      readAt: now,
      deliveredAt: sql`coalesce(${friendMessage.deliveredAt}, ${now.toISOString()}::timestamp)`,
      updatedAt: now,
    })
    .where(and(...conditions))
    .returning({ id: friendMessage.id, senderUserId: friendMessage.senderUserId, friendRequestId: friendMessage.friendRequestId })
  if (rows.length > 0) await publishStatus(rows, 'read', input.viewerUserId, now)
  return { success: true, updated: rows.map((row) => row.id) }
}
