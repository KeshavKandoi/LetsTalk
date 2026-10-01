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

  let entry = subscriptions.get(userId)
  if (!entry) {
    const handlerSet = new Set<RealtimeHandlers>()
    const channel = supabase.channel(`user:${userId}`)
    channel.on('broadcast', { event: 'new_message' }, ({ payload }) => {
      if (isChatMessage(payload)) handlerSet.forEach((h) => h.onNewMessage?.(payload))
    })
    channel.on('broadcast', { event: 'message_status' }, ({ payload }) => {
      if (isStatusEvent(payload)) handlerSet.forEach((h) => h.onMessageStatus?.(payload))
    })
    channel.subscribe()
    entry = { channel, handlers: handlerSet }
    subscriptions.set(userId, entry)
  }
  entry.handlers.add(handlers)
  const current = entry

  return () => {
    current.handlers.delete(handlers)
    if (current.handlers.size === 0) {
      subscriptions.delete(userId)
      supabase.removeChannel(current.channel)
    }
  }
}
