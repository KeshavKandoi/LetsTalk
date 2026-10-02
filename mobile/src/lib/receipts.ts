import { apiFetch } from './api'
import { subscribeToUserChannel } from './realtime'

const FLUSH_MS = 250
const CHUNK = 200

let unsubscribe: (() => void) | null = null
let subscribedUserId: string | null = null
let pending = new Set<string>()
let timer: ReturnType<typeof setTimeout> | null = null

async function flush() {
  timer = null
  const ids = Array.from(pending)
  pending = new Set()
  for (let i = 0; i < ids.length; i += CHUNK) {
    try {
      await apiFetch('/api/friends/message-status', { action: 'delivered', messageIds: ids.slice(i, i + CHUNK) })
    } catch (e) { console.warn('[RECEIPTS] delivered ack failed:', e instanceof Error ? e.message : e) }
  }
}

export function ackDelivered(ids: string[]) {
  for (const id of ids) pending.add(id)
  if (!timer && pending.size > 0) timer = setTimeout(() => { void flush() }, FLUSH_MS)
}

export async function ackRead(friendUserId: string, messageIds?: string[]) {
  try {
    await apiFetch('/api/friends/message-status', { action: 'read', friendUserId, ...(messageIds ? { messageIds } : {}) })
  } catch (e) { console.warn('[RECEIPTS] read ack failed:', e instanceof Error ? e.message : e) }
}

export function startReceipts(userId: string) {
  if (subscribedUserId === userId && unsubscribe) return
  stopReceipts()
  subscribedUserId = userId
  unsubscribe = subscribeToUserChannel(userId, {
    onNewMessage: (message) => {
      if (message.senderUserId !== userId) ackDelivered([message.id])
    },
  })
}

export function stopReceipts() {
  unsubscribe?.()
  unsubscribe = null
  subscribedUserId = null
}
