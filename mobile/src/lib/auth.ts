import AsyncStorage from '@react-native-async-storage/async-storage'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL
const SESSION_TOKEN_KEY = 'session_token'
const CURRENT_USER_ID_KEY = 'current_user_id'
let currentUserIdMemory: string | null = null
const userCacheMemory = new Map<string, { userId: string; data: any }>()

export async function signIn(username: string, password: string) {
  const email = username.trim().toLowerCase()
  const res = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL },
    body: JSON.stringify({ email, password, rememberMe: true }),
  })
  const data = await res.json()
  if (!res.ok || data.code || data.error) throw new Error(data.message || data.error?.message || 'Login failed')
  const setCookie = res.headers.get('set-cookie') || ''
  const cookieMatch = setCookie.match(/better-auth\.session_token=([^;]+)/)
  if (cookieMatch) await AsyncStorage.setItem(SESSION_TOKEN_KEY, decodeURIComponent(cookieMatch[1]))
  else if (data.token) await AsyncStorage.setItem(SESSION_TOKEN_KEY, data.token)
  else throw new Error('Login did not return a valid session.')
  const user = await establishSession()
  if (!user) throw new Error('Could not verify your session after login.')
  return data
}

export async function signUp(email: string, username: string, password: string, dob?: string, gender?: string) {
  email = email.trim().toLowerCase()
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
  email = email.trim().toLowerCase()
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
  email = email.trim().toLowerCase()
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
  await AsyncStorage.removeItem(CURRENT_USER_ID_KEY)
  currentUserIdMemory = null
}

// Removes only values owned by the currently authenticated user. Global
// discovery caches remain available for the next account.
export async function clearDeletedUserData(userId: string, email?: string) {
  if (!userId) return
  const keys = await AsyncStorage.getAllKeys()
  const ownedKeys: string[] = []
  for (const key of keys) {
    try {
      const raw = await AsyncStorage.getItem(key)
      if (raw && JSON.parse(raw)?.userId === userId) ownedKeys.push(key)
    } catch {}
  }
  await AsyncStorage.multiRemove([
    ...ownedKeys,
    ONBOARDING_PREFIX + userId,
    PHOTO_ONBOARDING_PREFIX + userId,
    ...(email ? [ONBOARDING_PREFIX + email.trim().toLowerCase()] : []),
    SESSION_TOKEN_KEY,
    CURRENT_USER_ID_KEY,
  ])
}

const ONBOARDING_PREFIX = 'onboarding_completed:'
const PHOTO_ONBOARDING_PREFIX = 'photo_onboarding_completed:'

export async function hasCompletedOnboarding(userId: string, legacyEmail?: string) {
  if (!userId) return false
  const val = await AsyncStorage.getItem(ONBOARDING_PREFIX + userId)
  if (val === 'true') return true
  if (legacyEmail && await AsyncStorage.getItem(ONBOARDING_PREFIX + legacyEmail.toLowerCase()) === 'true') {
    await AsyncStorage.setItem(ONBOARDING_PREFIX + userId, 'true')
    return true
  }
  return false
}

export async function markOnboardingCompleted(userId: string) {
  if (!userId) return
  await AsyncStorage.setItem(ONBOARDING_PREFIX + userId, 'true')
}

export async function hasCompletedPhotoOnboarding(userId: string) {
  if (!userId) return false
  return (await AsyncStorage.getItem(PHOTO_ONBOARDING_PREFIX + userId)) === 'true'
}

export async function markPhotoOnboardingCompleted(userId: string) {
  if (!userId) return
  await AsyncStorage.setItem(PHOTO_ONBOARDING_PREFIX + userId, 'true')
}

export async function getCurrentUserId() {
  return AsyncStorage.getItem(CURRENT_USER_ID_KEY)
}

// Confirms the stored session token actually resolves to a real user, and
// records which user it belongs to. Returns null (and clears the token) if
// the session cannot be verified, so callers never proceed as if logged in
// on a broken or stale session.
export async function establishSession() {
  const data = await getSession()
  if (!data?.session || !data?.user?.id) {
    await AsyncStorage.removeItem(SESSION_TOKEN_KEY)
    await AsyncStorage.removeItem(CURRENT_USER_ID_KEY)
    return null
  }
  await AsyncStorage.setItem(CURRENT_USER_ID_KEY, data.user.id)
  currentUserIdMemory = data.user.id
  return data.user
}

// Cache helpers that tag every cached value with the user it belongs to.
// A read is treated as a cache miss unless the stored owner matches the
// currently logged-in user, so switching accounts can never surface the
// previous user's cached profile, photo, etc.
export async function getUserScopedCache<T = any>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const currentUserId = await getCurrentUserId()
    if (!currentUserId || parsed.userId !== currentUserId) return null
    userCacheMemory.set(key, parsed)
    return parsed.data as T
  } catch {
    return null
  }
}

export async function setUserScopedCache(key: string, data: any) {
  const currentUserId = await getCurrentUserId()
  if (!currentUserId) return
  const value = { userId: currentUserId, data }
  userCacheMemory.set(key, value)
  await AsyncStorage.setItem(key, JSON.stringify(value))
}

export function getUserScopedCacheSync<T = any>(key: string) {
  const cached = userCacheMemory.get(key)
  return cached?.userId === currentUserIdMemory ? cached.data as T : null
}
