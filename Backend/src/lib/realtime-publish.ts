import { createClient } from '@supabase/supabase-js'
import { getSupabaseAnonKey, getSupabaseUrl } from './env'

export async function publishUserEvent(userId: string, event: string, payload: object) {
  try {
    const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey())
    const channel = supabase.channel(`user:${userId}`)
    await channel.send({ type: 'broadcast', event, payload })
    await supabase.removeChannel(channel)
  } catch {}
}
