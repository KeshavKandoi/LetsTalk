import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppState, Platform } from 'react-native'
import { StackActions, createNavigationContainerRef, type ParamListBase } from '@react-navigation/native'
import { apiFetch } from './api'

const CHANNEL_ID = 'messages'
const LEGACY_BACKGROUND_TASK = 'letstalk-chat-push'
const PUSH_TOKEN_KEY = 'push_token'
const HANDLED_KEY = 'last_handled_notification'
const BLOCKED_ROUTES = new Set(['Login', 'Signup', 'OTP', 'ForgotPassword', 'Onboarding', 'Tutorial', 'AddPhoto'])

type ChatPush = {
  conversationId: string
  friendUserId: string
  senderName: string
  senderPhotoUrl: string | null
}

export const navigationRef = createNavigationContainerRef<ParamListBase>()

let activeConversationUserId: string | null = null
let pendingTarget: ChatPush | null = null

function toChatPush(value: object): ChatPush | null {
  const r = value as Record<string, unknown>
  if (r.type !== 'chat_message' || typeof r.friendUserId !== 'string' || typeof r.conversationId !== 'string') return null
  return {
    conversationId: r.conversationId,
    friendUserId: r.friendUserId,
    senderName: typeof r.senderName === 'string' ? r.senderName : 'Someone',
    senderPhotoUrl: typeof r.senderPhotoUrl === 'string' ? r.senderPhotoUrl : null,
  }
}

function findPayload(value: unknown, depth = 0): ChatPush | null {
  if (depth > 4) return null
  if (typeof value === 'string') {
    try {
      return findPayload(JSON.parse(value), depth + 1)
    } catch {
      return null
    }
  }
  if (typeof value !== 'object' || value === null) return null
  const direct = toChatPush(value)
  if (direct) return direct
  for (const child of Object.values(value)) {
    const found = findPayload(child, depth + 1)
    if (found) return found
  }
  return null
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Messages',
    importance: Notifications.AndroidImportance.HIGH,
  })
}

if (Platform.OS === 'android') {
  ensureChannel().catch((e) => console.error('[CHAT_FLOW][PUSH] channel setup failed:', e instanceof Error ? e.message : e))
  Notifications.unregisterTaskAsync(LEGACY_BACKGROUND_TASK).catch(() => {})
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const push = findPayload(notification.request.content.data)
      const suppress = AppState.currentState === 'active' && push !== null && push.friendUserId === activeConversationUserId
      return { shouldShowBanner: !suppress, shouldShowList: !suppress, shouldPlaySound: !suppress, shouldSetBadge: false }
    },
  })
}

export function setActiveConversation(friendUserId: string | null) {
  activeConversationUserId = friendUserId
}

export async function dismissConversationNotification(friendUserId: string) {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync()
    await Promise.all(
      presented
        .filter((n) => findPayload(n.request.content.data)?.friendUserId === friendUserId)
        .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
    )
  } catch {}
}

export async function registerForPush(): Promise<{ ok: boolean; reason?: string }> {
  if (Platform.OS !== 'android') return { ok: false, reason: 'unsupported_platform' }
  const fail = (reason: string, detail?: unknown) => {
    console.error(`[CHAT_FLOW][PUSH] register failed reason=${reason}`, detail instanceof Error ? detail.message : (detail ?? ''))
    return { ok: false, reason }
  }
  try {
    console.log(`[CHAT_FLOW][PUSH] register started isDevice=${Device.isDevice}`)
    await ensureChannel()
    let { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status
    }
    if (status !== 'granted') return fail('permission_not_granted', status)

    const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined
    const projectId = extra?.eas?.projectId ?? Constants.easConfig?.projectId
    if (!projectId) return fail('project_id_missing')

    let token: string
    try {
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
    } catch (tokenErr) {
      return fail('token_generation_failed', tokenErr)
    }

    try {
      await apiFetch('/api/notifications/device', { action: 'register', pushToken: token, platform: 'android' })
    } catch (regErr) {
      return fail('device_registration_failed', regErr)
    }
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token)
    console.log('[CHAT_FLOW][PUSH] device registered')
    return { ok: true }
  } catch (err) {
    return fail('unexpected_error', err)
  }
}

export async function unregisterPush() {
  try {
    await Notifications.dismissAllNotificationsAsync()
  } catch {}
  const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY)
  if (!token) return
  try {
    await apiFetch('/api/notifications/device', { action: 'unregister', pushToken: token, platform: 'android' })
  } catch (e) {
    console.warn('[CHAT_FLOW][PUSH] unregister failed:', e instanceof Error ? e.message : e)
  }
  await AsyncStorage.removeItem(PUSH_TOKEN_KEY)
}

export function flushPendingNavigation() {
  const target = pendingTarget
  if (!target || !navigationRef.isReady()) return
  const route = navigationRef.getCurrentRoute()
  if (!route || BLOCKED_ROUTES.has(route.name)) return
  pendingTarget = null
  const params = route.params as { friend?: { userId?: string } } | undefined
  if (route.name === 'Conversation' && params?.friend?.userId === target.friendUserId) return
  const friend = { userId: target.friendUserId, username: target.senderName, photoUrl: target.senderPhotoUrl }
  navigationRef.dispatch(StackActions.push('Conversation', { friend }))
}

async function handleResponse(response: Notifications.NotificationResponse) {
  const key = `${response.notification.request.identifier}:${response.notification.date}`
  if ((await AsyncStorage.getItem(HANDLED_KEY)) === key) return
  await AsyncStorage.setItem(HANDLED_KEY, key)
  const push = findPayload(response.notification.request.content.data)
  if (!push) return
  pendingTarget = push
  flushPendingNavigation()
}

export function initNotificationListeners() {
  if (Platform.OS !== 'android') return () => {}
  const responded = Notifications.addNotificationResponseReceivedListener((response) => {
    void handleResponse(response)
  })
  Notifications.getLastNotificationResponseAsync()
    .then((response) => { if (response) void handleResponse(response) })
    .catch((e) => console.warn('[CHAT_FLOW][PUSH] last response failed:', e instanceof Error ? e.message : e))
  return () => {
    responded.remove()
  }
}
