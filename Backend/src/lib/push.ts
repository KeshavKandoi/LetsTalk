export async function sendPushNotification(pushToken: string, title: string, body: string, data?: object): Promise<boolean> {
  if (!pushToken || !pushToken.startsWith('ExponentPushToken')) return false
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ to: pushToken, title, body, data: data ?? {}, sound: 'default', priority: 'high' }),
    })
    if (!response.ok) return false
    const result = await response.json().catch(() => null) as { data?: { status?: string; details?: { error?: string } } } | null
    return result?.data?.status !== 'error'
  } catch {
    console.error('[push] delivery failed')
    return false
  }
}
