import 'dotenv/config'

export function getAuthSecret() {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error('Missing BETTER_AUTH_SECRET in .env')
  return secret
}

export function getDatabaseUrl() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('Missing DATABASE_URL in .env')
  return url
}

export function getGoogleMapsApiKey() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) throw new Error('Missing GOOGLE_MAPS_API_KEY in .env')
  return apiKey
}

export function getGoogleMapsMapId() {
  return process.env.GOOGLE_MAPS_MAP_ID ?? null
}

export function getAppBaseUrl() {
  const url = process.env.BETTER_AUTH_URL
  if (!url) throw new Error('Missing BETTER_AUTH_URL in .env')
  return url
}

export function getSupabaseUrl() {
  const url = process.env.SUPABASE_URL
  if (!url) throw new Error('Missing SUPABASE_URL in .env')
  return url
}

export function getSupabaseAnonKey() {
  const key = process.env.SUPABASE_ANON_KEY
  if (!key) throw new Error('Missing SUPABASE_ANON_KEY in .env')
  return key
}
