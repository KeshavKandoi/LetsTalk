import { apiFetch } from './api'
import { subscribeToUserChannel } from './realtime'
import { AppState } from 'react-native'

const FLUSH_MS = 250
const CHUNK = 200

let unsubscribe: (() => void) | null = null
let subscribedUserId: string | null = null
let pending = new Set<string>()
let timer: ReturnType<typeof setTimeout> | null = null
let flushing = false
let presenceTimer: ReturnType<typeof setInterval> | null = null
let appStateSubscription: { remove: () => void } | null = null

async function flush() {
  timer = null
  if (flushing) return
  flushing = true
  const ids = Array.from(pending)
  ids.forEach((id) => pending.delete(id))
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    try {
      await apiFetch('/api/friends/message-status', { action: 'delivered', messageIds: chunk })
    } catch (e) {
      chunk.forEach((id) => pending.add(id))
      console.warn('[RECEIPTS] delivered ack failed:', e instanceof Error ? e.message : e)
    }
  }
  flushing = false
  if (pending.size > 0 && !timer) timer = setTimeout(() => { void flush() }, 5000)
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
  const setOnline = (isOnline: boolean) => {
    void apiFetch('/api/friends/online-status', { isOnline }).catch(() => {})
  }
  setOnline(AppState.currentState === 'active')
  presenceTimer = setInterval(() => {
    if (AppState.currentState === 'active') setOnline(true)
  }, 15000)
  appStateSubscription = AppState.addEventListener('change', (state) => {
    setOnline(state === 'active')
    if (state === 'active' && pending.size > 0 && !timer) timer = setTimeout(() => { void flush() }, FLUSH_MS)
  })
}

export function stopReceipts() {
  if (subscribedUserId) void apiFetch('/api/friends/online-status', { isOnline: false }).catch(() => {})
  if (presenceTimer) clearInterval(presenceTimer)
  presenceTimer = null
  appStateSubscription?.remove()
  appStateSubscription = null
  unsubscribe?.()
  unsubscribe = null
  subscribedUserId = null
}
