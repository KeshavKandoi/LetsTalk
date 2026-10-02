import { getSupabaseAnonKey, getSupabaseUrl } from './env'

export async function publishUserEvent(userId: string, event: string, payload: object) {
  const topic = `user:${userId}`
  try {
    const key = getSupabaseAnonKey()
    const res = await fetch(`${getSupabaseUrl()}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ messages: [{ topic, event, payload, private: false }] }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      console.error(`[REALTIME] broadcast failed status=${res.status} topic=${topic} event=${event} body=${(await res.text()).slice(0, 200)}`)
      return false
    }
    return true
  } catch (error) {
    console.error(`[REALTIME] broadcast error topic=${topic} event=${event}:`, error)
    return false
  }
}
