import AsyncStorage from '@react-native-async-storage/async-storage'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.29.59:3000'

export async function apiFetch(path: string, body: object) {
  const token = await AsyncStorage.getItem('session_token')
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Cookie: `better-auth.session_token=${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}
