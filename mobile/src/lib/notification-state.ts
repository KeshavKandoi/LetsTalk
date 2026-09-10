import { apiFetch } from './api'

let unreadCount = 0
const listeners = new Set<(count: number) => void>()

export function getNotificationUnreadCount() {
  return unreadCount
}

export function subscribeNotificationUnreadCount(listener: (count: number) => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setNotificationUnreadCount(count: number) {
  unreadCount = Math.max(0, count)
  listeners.forEach((listener) => listener(unreadCount))
}

export async function refreshNotificationUnreadCount() {
  const data = await apiFetch('/api/friends/notifications', { action: 'unreadCount' })
  setNotificationUnreadCount(Number(data?.unreadCount ?? 0))
  return unreadCount
}
