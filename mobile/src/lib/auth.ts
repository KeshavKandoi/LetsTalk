import AsyncStorage from '@react-native-async-storage/async-storage'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.29.59:3000'
const SESSION_TOKEN_KEY = 'session_token'

export async function signIn(username: string, password: string) {
  const res = await fetch(`${BASE_URL}/api/auth/sign-in/username`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    body: JSON.stringify({ username, password, rememberMe: true }),
  })
  const data = await res.json()
  if (!res.ok || data.code || data.error) throw new Error(data.message || data.error?.message || 'Login failed')
  if (data.token) await AsyncStorage.setItem(SESSION_TOKEN_KEY, data.token)
  return data
}

export async function signUp(email: string, username: string, password: string, dob?: string, gender?: string) {
  const res = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    body: JSON.stringify({ email, username, password, name: username, dob, gender }),
  })
  const data = await res.json()
  if (!res.ok || data.code || data.error) throw new Error(data.message || data.error?.message || 'Signup failed')
  if (data.token) await AsyncStorage.setItem(SESSION_TOKEN_KEY, data.token)
  return data
}

export async function getStoredSessionToken() {
  return AsyncStorage.getItem(SESSION_TOKEN_KEY)
}

export async function getSession() {
  const token = await getStoredSessionToken()
  if (!token) return null
  const res = await fetch(`${BASE_URL}/api/auth/get-session`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const data = await res.json()
  return data?.session ? data : null
}

export async function signOut() {
  const token = await getStoredSessionToken()
  await AsyncStorage.removeItem(SESSION_TOKEN_KEY)
  try {
    await fetch(`${BASE_URL}/api/auth/sign-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': BASE_URL,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({}),
    })
  } catch {}
}
