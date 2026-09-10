import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { apiFetch } from './api'

export async function registerPushToken() {
  if (Platform.OS === 'web' || !Constants.isDevice) return

  const permissions = await Notifications.getPermissionsAsync()
  const finalStatus = permissions.status === 'granted'
    ? permissions.status
    : (await Notifications.requestPermissionsAsync()).status
  if (finalStatus !== 'granted') return

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId
  const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data
  if (token) await apiFetch('/api/places/push-token', { token })
}
