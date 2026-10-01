import { createClient } from '@supabase/supabase-js'
import { getSupabaseAnonKey, getSupabaseUrl } from './env'

export async function publishUserEvent(userId: string, event: string, payload: object) {
  const channelName = `user:${userId}`
  console.log(`[CHAT_DEBUG][REALTIME] broadcast started recipientUserId=${userId} channel=${channelName} event=${event}`)

  try {
    const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey())
    const channel = supabase.channel(channelName)

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        supabase.removeChannel(channel).catch(() => {})
        reject(new Error(`Subscription to ${channelName} timed out`))
      }, 5000)

      channel.subscribe(async (status, err) => {
        if (status === 'SUBSCRIBED') {
          try {
            const result = await channel.send({ type: 'broadcast', event, payload })
            clearTimeout(timer)
            await supabase.removeChannel(channel)
            if (result === 'ok') {
              console.log(`[CHAT_DEBUG][REALTIME] broadcast result=ok recipientUserId=${userId} channel=${channelName} event=${event}`)
              resolve()
            } else {
              console.error(`[CHAT_DEBUG][REALTIME] broadcast result=${result} recipientUserId=${userId} channel=${channelName} event=${event}`)
              reject(new Error(`Broadcast send status: ${result}`))
            }
          } catch (sendErr) {
            clearTimeout(timer)
            await supabase.removeChannel(channel)
            console.error(`[CHAT_DEBUG][REALTIME] broadcast error channel=${channelName}:`, sendErr)
            reject(sendErr)
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          clearTimeout(timer)
          await supabase.removeChannel(channel)
          console.error(`[CHAT_DEBUG][REALTIME] broadcast status=${status} channel=${channelName}`, err || '')
          reject(err || new Error(`Channel status ${status}`))
        }
      })
    })
  } catch (error) {
    console.error(`[CHAT_DEBUG][REALTIME] broadcast error recipientUserId=${userId} channel=${channelName} event=${event}:`, error)
  }
}

