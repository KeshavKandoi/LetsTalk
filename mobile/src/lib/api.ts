import AsyncStorage from '@react-native-async-storage/async-storage'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL
const REQUEST_TIMEOUT_MS = 15000

export function isNetworkError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes('network request failed') || message.includes('failed to fetch') || message.includes('network error') || message.includes('timeout') || message.includes('dns') || message.includes('internet')
}

export function getNetworkErrorMessage(error: unknown) {
  return isNetworkError(error) ? 'Please check your internet connection and try again.' : (error instanceof Error ? error.message : 'Something went wrong. Please try again.')
}

export async function apiFetch(path: string, body: object) {
  const token = await AsyncStorage.getItem('session_token')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Cookie: `better-auth.session_token=${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    let data: any = null
    try { data = await res.json() } catch { throw new Error('The server returned an invalid response.') }
    if (!res.ok || data?.error) throw new Error(data?.error || 'Request failed.')
    return data
  } catch (error) {
    if (isNetworkError(error) || (error instanceof Error && error.name === 'AbortError')) {
      throw new Error('Please check your internet connection and try again.')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
