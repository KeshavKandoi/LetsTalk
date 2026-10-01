import { createClient, type RealtimeChannel } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

type ChatMessage = {
  id: string
  senderUserId: string
  recipientUserId?: string
  body: string
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
  createdAt: string
  messageType?: 'text' | 'image' | 'audio'
  media?: { url: string | null; mimeType?: string | null; fileName?: string | null; fileSize?: number | null; durationMs?: number | null } | null
}

type RealtimeHandlers = {
  onNewMessage?: (message: ChatMessage) => void
}

let client: ReturnType<typeof createClient> | null = null

function getClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return client
}

export function subscribeToUserChannel(
  userId: string,
  handlers: RealtimeHandlers,
): (() => void) | null {
  const supabase = getClient()
  if (!supabase || !userId) return null

  const channel: RealtimeChannel = supabase.channel(`user:${userId}`)
  if (handlers.onNewMessage) {
    channel.on('broadcast', { event: 'new_message' }, ({ payload }) => {
      if (payload && typeof payload === 'object') {
        handlers.onNewMessage?.(payload as ChatMessage)
      }
    })
  }
  channel.subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
