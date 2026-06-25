import AsyncStorage from '@react-native-async-storage/async-storage'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.29.59:3000'
const SESSION_TOKEN_KEY = 'session_token'

export async function signIn(username: string, password: string) {
  const res = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL },
    body: JSON.stringify({ email: username, password, rememberMe: true }),
  })
  const data = await res.json()
  if (!res.ok || data.code || data.error) throw new Error(data.message || data.error?.message || 'Login failed')
  const setCookie = res.headers.get('set-cookie') || ''
  const cookieMatch = setCookie.match(/better-auth\.session_token=([^;]+)/)
  if (cookieMatch) await AsyncStorage.setItem(SESSION_TOKEN_KEY, decodeURIComponent(cookieMatch[1]))
  else if (data.token) await AsyncStorage.setItem(SESSION_TOKEN_KEY, data.token)
  return data
}

export async function signUp(email: string, username: string, password: string, dob?: string, gender?: string) {
  const res = await fetch(`${BASE_URL}/api/auth/signup-with-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL },
    body: JSON.stringify({ email, username, password, name: username, dob, gender }),
  })
  const data = await res.json()
  if (!res.ok || data.code || data.error) throw new Error(data.message || data.error?.message || 'Signup failed')
  // ❌ Do NOT save token here — user is not verified yet
  return data
}

export async function sendOTP(email: string) {
  const res = await fetch(`${BASE_URL}/api/auth/email-otp/send-verification-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL },
    body: JSON.stringify({ email, type: 'email-verification' }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Failed to send OTP')
  return data
}

export async function verifyOTP(email: string, otp: string) {
  const res = await fetch(`${BASE_URL}/api/auth/email-otp/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL },
    body: JSON.stringify({ email, otp }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Invalid OTP')
  // ✅ Only save token after verified
  if (data.token) await AsyncStorage.setItem(SESSION_TOKEN_KEY, data.token)
  return data
}

export async function signInWithOTP(email: string, otp: string) {
  const res = await fetch(`${BASE_URL}/api/auth/email-otp/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL },
    body: JSON.stringify({ email, otp }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Invalid OTP')
  if (data.token) await AsyncStorage.setItem(SESSION_TOKEN_KEY, data.token)
  return data
}

export async function getGoogleAuthURL() {
  const res = await fetch(`${BASE_URL}/api/auth/sign-in/social`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL },
    body: JSON.stringify({ provider: 'google', callbackURL: `${BASE_URL}/api/auth/callback/google` }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Failed to get Google auth URL')
  return data.url as string
}

export async function getStoredSessionToken() {
  return AsyncStorage.getItem(SESSION_TOKEN_KEY)
}

export async function getSession() {
  const token = await getStoredSessionToken()
  if (!token) return null
  const res = await fetch(`${BASE_URL}/api/auth/get-session`, {
    headers: { Cookie: `better-auth.session_token=${token}` },
  })
  if (!res.ok) return null
  const data = await res.json()
  return data?.session ? data : null
}

export async function signOut() {
  const token = await getStoredSessionToken()
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
  await AsyncStorage.removeItem(SESSION_TOKEN_KEY)
}
