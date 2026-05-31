import AsyncStorage from '@react-native-async-storage/async-storage'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.29.59:3000'

export async function signIn(username: string, password: string) {
  const res = await fetch(`${BASE_URL}/api/auth/sign-in/username`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, rememberMe: true }),
  })
  const data = await res.json()
  if (!res.ok || data.code || data.error) throw new Error(data.message || data.error?.message || 'Login failed')
  if (data.token) await AsyncStorage.setItem('session_token', data.token)
  return data
}

export async function signUp(email: string, username: string, password: string) {
  const res = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username, password, name: username }),
  })
  const data = await res.json()
  if (!res.ok || data.code || data.error) throw new Error(data.message || data.error?.message || 'Signup failed')
  if (data.token) await AsyncStorage.setItem('session_token', data.token)
  return data
}

export async function getSession() {
  const token = await AsyncStorage.getItem('session_token')
  if (!token) return null
  const res = await fetch(`${BASE_URL}/api/auth/get-session`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  return data?.session ? data : null
}

export async function signOut() {
  const token = await AsyncStorage.getItem('session_token')
  try {
    await fetch(`${BASE_URL}/api/auth/sign-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({}),
    })
  } catch {}
  await AsyncStorage.removeItem('session_token')
}
