import { createClient, type RealtimeChannel } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
const MAX_RETRY_MS = 30000

export type ChatMessage = {
  id: string
  senderUserId: string
  recipientUserId?: string
  body: string
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
  createdAt: string
  messageType?: 'text' | 'image' | 'audio'
  media?: { url: string | null; mimeType?: string | null; fileName?: string | null; fileSize?: number | null; durationMs?: number | null } | null
}

export type MessageStatusEvent = {
  status: 'delivered' | 'read'
  conversationId: string
  messageIds: string[]
  recipientUserId: string
  at: string
}

export type RealtimeHandlers = {
  onNewMessage?: (message: ChatMessage) => void
  onMessageStatus?: (event: MessageStatusEvent) => void
  onReconnect?: () => void
}

type Subscription = {
  channel: RealtimeChannel | null
  handlers: Set<RealtimeHandlers>
  retryTimer: ReturnType<typeof setTimeout> | null
  attempts: number
  closing: boolean
  wasSubscribed: boolean
}

const subscriptions = new Map<string, Subscription>()
let client: ReturnType<typeof createClient> | null = null

function getClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return client
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isChatMessage(value: unknown): value is ChatMessage {
  return isRecord(value) && typeof value.id === 'string' && typeof value.senderUserId === 'string' && typeof value.body === 'string' && typeof value.createdAt === 'string'
}

export function isStatusEvent(value: unknown): value is MessageStatusEvent {
  return (
    isRecord(value) &&
    (value.status === 'delivered' || value.status === 'read') &&
    typeof value.conversationId === 'string' &&
    typeof value.recipientUserId === 'string' &&
    Array.isArray(value.messageIds) &&
    value.messageIds.every((id) => typeof id === 'string')
  )
}

function dispatch(entry: Subscription, call: (handlers: RealtimeHandlers) => void) {
  entry.handlers.forEach((handlers) => {
    try {
      call(handlers)
    } catch (error) {
      console.error('[CHAT_FLOW][REALTIME] handler threw:', error instanceof Error ? error.message : error)
    }
  })
}

function scheduleResubscribe(userId: string, entry: Subscription) {
  if (entry.closing || entry.retryTimer) return
  const delay = Math.min(MAX_RETRY_MS, 1000 * 2 ** entry.attempts)
  entry.attempts++
  entry.retryTimer = setTimeout(() => {
    entry.retryTimer = null
    if (entry.closing) return
    const supabase = getClient()
    if (!supabase) return
    const old = entry.channel
    if (old && old.state === 'joined') return
    entry.channel = null
    if (old) void supabase.removeChannel(old)
    openChannel(userId, entry)
  }, delay)
}

function openChannel(userId: string, entry: Subscription) {
  const supabase = getClient()
  if (!supabase || entry.closing) return
  const topic = `user:${userId}`
  const channel = supabase.channel(topic)
  entry.channel = channel

  channel.on('broadcast', { event: 'new_message' }, ({ payload }) => {
    if (!isChatMessage(payload)) {
      console.warn(`[CHAT_FLOW][REALTIME] invalid new_message payload topic=${topic}`)
      return
    }
    console.log(`[CHAT_FLOW][REALTIME] new_message topic=${topic} messageId=${payload.id}`)
    dispatch(entry, (h) => h.onNewMessage?.(payload))
  })

  channel.on('broadcast', { event: 'message_status' }, ({ payload }) => {
    if (!isStatusEvent(payload)) {
      console.warn(`[CHAT_FLOW][REALTIME] invalid message_status payload topic=${topic}`)
      return
    }
    dispatch(entry, (h) => h.onMessageStatus?.(payload))
  })

  channel.subscribe((status, err) => {
    if (entry.channel !== channel) return
    if (status === 'SUBSCRIBED') {
      const reconnected = entry.wasSubscribed
      entry.wasSubscribed = true
      entry.attempts = 0
      if (entry.retryTimer) {
        clearTimeout(entry.retryTimer)
        entry.retryTimer = null
      }
      console.log(`[CHAT_FLOW][REALTIME] SUBSCRIBED topic=${topic} reconnected=${reconnected}`)
      dispatch(entry, (h) => h.onReconnect?.())
      return
    }
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      console.error(`[CHAT_FLOW][REALTIME] ${status} topic=${topic} error=${err?.message ?? 'none'}`)
      scheduleResubscribe(userId, entry)
    }
  })
}

export function subscribeToUserChannel(userId: string, handlers: RealtimeHandlers): (() => void) | null {
  const supabase = getClient()
  if (!supabase || !userId) {
    console.error(`[CHAT_FLOW][REALTIME] subscribe skipped userId=${userId ? 'set' : 'missing'} supabaseConfig=${supabase ? 'set' : 'missing'}`)
    return null
  }

  let entry = subscriptions.get(userId)
  if (!entry) {
    entry = { channel: null, handlers: new Set(), retryTimer: null, attempts: 0, closing: false, wasSubscribed: false }
    subscriptions.set(userId, entry)
    openChannel(userId, entry)
  }
  entry.handlers.add(handlers)
  const current = entry

  return () => {
    current.handlers.delete(handlers)
    if (current.handlers.size > 0) return
    current.closing = true
    if (current.retryTimer) clearTimeout(current.retryTimer)
    current.retryTimer = null
    const channel = current.channel
    current.channel = null
    if (subscriptions.get(userId) === current) subscriptions.delete(userId)
    if (channel) void supabase.removeChannel(channel)
  }
}
