import { createClient, type RealtimeChannel } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

let client: ReturnType<typeof createClient> | null = null

function getClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return client
}

export function subscribeToUserChannel(
  userId: string,
  handlers: { onNewMessage?: (payload: any) => void },
): (() => void) | null {
  const supabase = getClient()
  if (!supabase || !userId) return null

  const channel: RealtimeChannel = supabase.channel(`user:${userId}`)
  if (handlers.onNewMessage) {
    channel.on('broadcast', { event: 'new_message' }, ({ payload }) => handlers.onNewMessage?.(payload))
  }
  channel.subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
