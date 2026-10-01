import * as Notifications from 'expo-notifications'
import * as TaskManager from 'expo-task-manager'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppState, Platform } from 'react-native'
import { StackActions, createNavigationContainerRef, type ParamListBase } from '@react-navigation/native'
import { apiFetch } from './api'

const CHANNEL_ID = 'messages'
const BACKGROUND_TASK = 'letstalk-chat-push'
const PUSH_TOKEN_KEY = 'push_token'
const HANDLED_KEY = 'last_handled_notification'
const BLOCKED_ROUTES = new Set(['Login', 'Signup', 'OTP', 'ForgotPassword', 'Onboarding', 'Tutorial', 'AddPhoto'])

type ChatPush = {
  conversationId: string
  friendUserId: string
  senderName: string
  senderPhotoUrl: string | null
  unreadCount: number
  recent: string[]
}

export const navigationRef = createNavigationContainerRef<ParamListBase>()

let activeConversationUserId: string | null = null
let pendingTarget: ChatPush | null = null
const lastShownCount = new Map<string, number>()

function identifierFor(friendUserId: string) {
  return `chat-${friendUserId}`
}

function toChatPush(value: object): ChatPush | null {
  const r = value as Record<string, unknown>
  if (r.type !== 'chat_message' || typeof r.friendUserId !== 'string' || typeof r.conversationId !== 'string') return null
  return {
    conversationId: r.conversationId,
    friendUserId: r.friendUserId,
    senderName: typeof r.senderName === 'string' ? r.senderName : 'Someone',
    senderPhotoUrl: typeof r.senderPhotoUrl === 'string' ? r.senderPhotoUrl : null,
    unreadCount: typeof r.unreadCount === 'number' ? r.unreadCount : 1,
    recent: Array.isArray(r.recent) ? r.recent.filter((x): x is string => typeof x === 'string') : [],
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

async function presentChatNotification(push: ChatPush) {
  if (AppState.currentState === 'active' && activeConversationUserId === push.friendUserId) return
  const count = Math.max(push.unreadCount, push.recent.length, lastShownCount.get(push.friendUserId) ?? 0, 1)
  lastShownCount.set(push.friendUserId, count)
  await ensureChannel()
  await Notifications.scheduleNotificationAsync({
    identifier: identifierFor(push.friendUserId),
    content: {
      title: count > 1 ? `${push.senderName} — ${count} new messages` : push.senderName,
      body: push.recent.length > 0 ? push.recent.join('\n') : 'New message',
      data: {
        type: 'chat_message',
        conversationId: push.conversationId,
        friendUserId: push.friendUserId,
        senderName: push.senderName,
        senderPhotoUrl: push.senderPhotoUrl,
      },
      sound: 'default',
    },
    trigger: { channelId: CHANNEL_ID },
  })
}

if (Platform.OS === 'android') {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const visible = !!notification.request.content.title
      return { shouldShowBanner: visible, shouldShowList: visible, shouldPlaySound: false, shouldSetBadge: false }
    },
  })
  TaskManager.defineTask(BACKGROUND_TASK, async ({ data, error }) => {
    if (error) return
    const push = findPayload(data)
    if (push) await presentChatNotification(push)
  })
  Notifications.registerTaskAsync(BACKGROUND_TASK).catch(() => {})
}

export function setActiveConversation(friendUserId: string | null) {
  activeConversationUserId = friendUserId
}

export async function dismissConversationNotification(friendUserId: string) {
  lastShownCount.delete(friendUserId)
  try {
    await Notifications.dismissNotificationAsync(identifierFor(friendUserId))
  } catch {}
}

export async function registerForPush() {
  if (Platform.OS !== 'android' || !Device.isDevice) return
  try {
    await ensureChannel()
    let { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync())
    if (status !== 'granted') return
    const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined
    const projectId = extra?.eas?.projectId ?? Constants.easConfig?.projectId
    if (!projectId) return
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
    await apiFetch('/api/notifications/device', { action: 'register', pushToken: token, platform: 'android' })
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token)
  } catch {}
}

export async function unregisterPush() {
  try {
    await Notifications.dismissAllNotificationsAsync()
  } catch {}
  const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY)
  if (!token) return
  try {
    await apiFetch('/api/notifications/device', { action: 'unregister', pushToken: token, platform: 'android' })
  } catch {}
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
  const received = Notifications.addNotificationReceivedListener((notification) => {
    if (notification.request.content.title) return
    const push = findPayload(notification.request.content.data)
    if (push) void presentChatNotification(push)
  })
  const responded = Notifications.addNotificationResponseReceivedListener((response) => {
    void handleResponse(response)
  })
  Notifications.getLastNotificationResponseAsync()
    .then((response) => { if (response) void handleResponse(response) })
    .catch(() => {})
  return () => {
    received.remove()
    responded.remove()
  }
}
