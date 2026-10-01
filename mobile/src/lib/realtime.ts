import { createClient, type RealtimeChannel } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

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
}

type Subscription = { channel: RealtimeChannel; handlers: Set<RealtimeHandlers> }

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

function isChatMessage(value: unknown): value is ChatMessage {
  return isRecord(value) && typeof value.id === 'string' && typeof value.senderUserId === 'string' && typeof value.body === 'string' && typeof value.createdAt === 'string'
}

function isStatusEvent(value: unknown): value is MessageStatusEvent {
  return (
    isRecord(value) &&
    (value.status === 'delivered' || value.status === 'read') &&
    typeof value.conversationId === 'string' &&
    typeof value.recipientUserId === 'string' &&
    Array.isArray(value.messageIds) &&
    value.messageIds.every((id) => typeof id === 'string')
  )
}

export function subscribeToUserChannel(userId: string, handlers: RealtimeHandlers): (() => void) | null {
  const supabase = getClient()
  if (!supabase || !userId) return null
  const channelName = `user:${userId}`

  let entry = subscriptions.get(userId)
  if (!entry) {
    console.log(`[CHAT_DEBUG][REALTIME] subscription started channel=${channelName}`)
    const handlerSet = new Set<RealtimeHandlers>()
    const channel = supabase.channel(channelName)

    channel.on('broadcast', { event: 'new_message' }, ({ payload }) => {
      console.log(`[CHAT_DEBUG][REALTIME] received event=new_message channel=${channelName} receivedMessageId=${payload?.id}`)
      const valid = isChatMessage(payload)
      console.log(`[CHAT_DEBUG][REALTIME] payload validation result=${valid ? 'success' : 'failed'}`)
      if (valid) {
        handlerSet.forEach((h) => {
          h.onNewMessage?.(payload)
          console.log(`[CHAT_DEBUG][REALTIME] message state updated messageId=${payload.id}`)
        })
      }
    })

    channel.on('broadcast', { event: 'message_status' }, ({ payload }) => {
      console.log(`[CHAT_DEBUG][REALTIME] received event=message_status channel=${channelName}`)
      const valid = isStatusEvent(payload)
      console.log(`[CHAT_DEBUG][REALTIME] status payload validation result=${valid ? 'success' : 'failed'}`)
      if (valid) {
        handlerSet.forEach((h) => h.onMessageStatus?.(payload))
      }
    })

    channel.subscribe((status, err) => {
      console.log(`[CHAT_DEBUG][REALTIME] channel=${channelName} subscription status=${status}`, err ? err : '')
      if (status === 'SUBSCRIBED') {
        console.log(`[CHAT_DEBUG][REALTIME] SUBSCRIBED channel=${channelName}`)
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`[CHAT_DEBUG][REALTIME] CHANNEL_ERROR channel=${channelName}`, err)
      } else if (status === 'TIMED_OUT') {
        console.error(`[CHAT_DEBUG][REALTIME] TIMED_OUT channel=${channelName}`)
      } else if (status === 'CLOSED') {
        console.log(`[CHAT_DEBUG][REALTIME] CLOSED channel=${channelName}`)
      }
    })

    entry = { channel, handlers: handlerSet }
    subscriptions.set(userId, entry)
  }

  entry.handlers.add(handlers)
  const current = entry

  return () => {
    current.handlers.delete(handlers)
    if (current.handlers.size === 0) {
      console.log(`[CHAT_DEBUG][REALTIME] CLOSED channel=${channelName} (unsubscribing)`)
      subscriptions.delete(userId)
      supabase.removeChannel(current.channel)
    }
  }
}

