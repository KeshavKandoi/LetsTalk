import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { MaterialIcons } from '@expo/vector-icons'
import { apiFetch, getNetworkErrorMessage } from '../lib/api'
import { getUserScopedCache, setUserScopedCache } from '../lib/auth'
import { useNetworkCheck } from '../hooks/useNetworkCheck'
import { setNotificationUnreadCount } from '../lib/notification-state'

type Notification = {
  id: string
  type: string
  message: string
  createdAt: string
  readAt: string | null
  isRead: boolean
  data?: Record<string, unknown> | null
}

const PAGE_SIZE = 20
const ICON_MAP: Record<string, { icon: string; color: string }> = {
  friend_request: { icon: 'person-add', color: '#F5C842' },
  friend_accepted: { icon: 'people', color: '#4CAF50' },
  friend_removed: { icon: 'person-remove', color: '#E05010' },
  scan_connected: { icon: 'qr-code-scanner', color: '#64B5F6' },
}

function timeAgo(dateStr: string) {
  const timestamp = new Date(dateStr).getTime()
  if (!Number.isFinite(timestamp)) return 'just now'
  const diff = Math.max(0, Date.now() - timestamp)
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function NotificationsScreen() {
  const navigation = useNavigation<any>()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [clearBusy, setClearBusy] = useState(false)
  const isConnected = useNetworkCheck()
  const requestInFlightRef = useRef(false)
  const mutationGenerationRef = useRef(0)
  const cacheWriteChainRef = useRef(Promise.resolve())

  const queueCacheWrite = (list: Notification[], generation: number) => {
    cacheWriteChainRef.current = cacheWriteChainRef.current
      .then(async () => {
        if (mutationGenerationRef.current !== generation) return
        await setUserScopedCache('cached_notifications', list)
      })
      .catch(() => {})
  }

  const loadFirstPage = useCallback(async (isRefresh = false) => {
    if (requestInFlightRef.current) return
    requestInFlightRef.current = true
    const requestGeneration = mutationGenerationRef.current
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const data = await apiFetch('/api/friends/notifications', { limit: PAGE_SIZE })
      const list = Array.isArray(data.notifications) ? data.notifications : []
      if (mutationGenerationRef.current !== requestGeneration) return
      setNotifications(list)
      setNextCursor(data.nextCursor || null)
      setHasMore(Boolean(data.hasMore))
      setNotificationUnreadCount(Number(data.unreadCount ?? 0))
      queueCacheWrite(list, requestGeneration)

      if (Number(data.unreadCount ?? 0) > 0) {
        const readResult = await apiFetch('/api/friends/notifications', { action: 'markAllRead' })
        setNotifications((current) => current.map((item) => ({ ...item, isRead: true, readAt: item.readAt || new Date().toISOString() })))
        setNotificationUnreadCount(Number(readResult.unreadCount ?? 0))
      }
    } catch (e) {
      setError(getNetworkErrorMessage(e))
    } finally {
      requestInFlightRef.current = false
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || requestInFlightRef.current) return
    requestInFlightRef.current = true
    const requestGeneration = mutationGenerationRef.current
    setLoadingMore(true)
    try {
      const data = await apiFetch('/api/friends/notifications', { cursor: nextCursor, limit: PAGE_SIZE })
      if (mutationGenerationRef.current !== requestGeneration) return
      setNotifications((current) => {
        const existing = new Set(current.map((item) => item.id))
        return [...current, ...(data.notifications || []).filter((item: Notification) => !existing.has(item.id))]
      })
      setNextCursor(data.nextCursor || null)
      setHasMore(Boolean(data.hasMore))
      setNotificationUnreadCount(Number(data.unreadCount ?? 0))
    } catch (e) {
      setError(getNetworkErrorMessage(e))
    } finally {
      requestInFlightRef.current = false
      setLoadingMore(false)
    }
  }, [hasMore, nextCursor])

  useEffect(() => {
    getUserScopedCache<Notification[]>('cached_notifications')
      .then((cached) => { if (cached?.length) setNotifications(cached) })
      .catch(() => {})
  }, [])

  useFocusEffect(useCallback(() => {
    void loadFirstPage()
  }, [loadFirstPage]))

  const markRead = async (id: string) => {
    const target = notifications.find((item) => item.id === id)
    if (!target || target.isRead) return
    setNotifications((current) => current.map((item) => item.id === id ? { ...item, isRead: true, readAt: new Date().toISOString() } : item))
    try {
      const data = await apiFetch('/api/friends/notifications', { action: 'markRead', notificationId: id })
      setNotificationUnreadCount(Number(data.unreadCount ?? 0))
    } catch {
      setNotifications((current) => current.map((item) => item.id === id ? target : item))
    }
  }

  const deleteNotification = async (id: string) => {
    const previous = notifications
    const mutationGeneration = ++mutationGenerationRef.current
    setNotifications((current) => current.filter((item) => item.id !== id))
    try {
      const data = await apiFetch('/api/friends/notifications', { action: 'delete', notificationId: id })
      if (mutationGenerationRef.current !== mutationGeneration) return
      setNotificationUnreadCount(Number(data.unreadCount ?? 0))
      queueCacheWrite(previous.filter((item) => item.id !== id), mutationGeneration)
    } catch {
      if (mutationGenerationRef.current === mutationGeneration) setNotifications(previous)
    }
  }

  const clearNotifications = async () => {
    if (clearBusy || notifications.length === 0) return
    const previous = notifications
    const mutationGeneration = ++mutationGenerationRef.current
    setClearBusy(true)
    setNotifications([])
    try {
      await apiFetch('/api/friends/notifications', { action: 'clear' })
      if (mutationGenerationRef.current !== mutationGeneration) return
      setNextCursor(null)
      setHasMore(false)
      setNotificationUnreadCount(0)
      queueCacheWrite([], mutationGeneration)
    } catch {
      if (mutationGenerationRef.current === mutationGeneration) setNotifications(previous)
    } finally {
      setClearBusy(false)
    }
  }

  return (
    <View style={s.root}>
      <LinearGradient colors={['#000000', '#000000', '#000000', '#000000']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <MaterialIcons name="chevron-left" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={s.title}>Notifications</Text>
          <TouchableOpacity onPress={clearNotifications} disabled={clearBusy || notifications.length === 0} style={s.headerAction}>
            {clearBusy ? <ActivityIndicator color="#fff" size="small" /> : <MaterialIcons name="delete-sweep" size={23} color={notifications.length ? '#fff' : 'rgba(255,255,255,0.25)'} />}
          </TouchableOpacity>
        </View>

        {!isConnected && <View style={s.offline}><Text style={s.offlineText}>No internet connection</Text></View>}
        {loading && notifications.length === 0 ? (
          <ActivityIndicator color="#FFFFFF" style={{ marginTop: 60 }} />
        ) : error && notifications.length === 0 ? (
          <Text style={s.errorText}>{error}</Text>
        ) : notifications.length === 0 ? (
          <View style={s.emptyContainer}>
            <MaterialIcons name="notifications-none" size={64} color="rgba(255,255,255,0.25)" />
            <Text style={s.emptyTitle}>No notifications yet</Text>
            <Text style={s.emptySub}>When you get notifications, they'll show up here.</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void loadFirstPage(true) }} tintColor="#FFFFFF" />}
            onScroll={({ nativeEvent }) => {
              const nearEnd = nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >= nativeEvent.contentSize.height - 120
              if (nearEnd) void loadMore()
            }}
            scrollEventThrottle={250}
          >
            {notifications.map((item) => {
              const { icon, color } = ICON_MAP[item.type] || { icon: 'notifications', color: '#fff' }
              return (
                <TouchableOpacity key={item.id} style={[s.card, !item.isRead && s.unreadCard]} onPress={() => { void markRead(item.id) }} activeOpacity={0.8}>
                  <View style={[s.iconWrap, { backgroundColor: color + '22' }]}>
                    <MaterialIcons name={icon as any} size={22} color={color} />
                  </View>
                  <View style={s.textWrap}>
                    <Text style={s.message}>{item.message}</Text>
                    <Text style={s.time}>{timeAgo(item.createdAt)}</Text>
                  </View>
                  {!item.isRead && <View style={s.unreadDot} />}
                  <TouchableOpacity onPress={() => { void deleteNotification(item.id) }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <MaterialIcons name="close" size={18} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                </TouchableOpacity>
              )
            })}
            {loadingMore && <ActivityIndicator color="#FFFFFF" style={{ marginVertical: 12 }} />}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  headerAction: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  offline: { backgroundColor: '#b00020', padding: 10, alignItems: 'center' },
  offlineText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  list: { padding: 16, gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(20,12,6,0.9)', borderRadius: 14, padding: 14, gap: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)' },
  unreadCard: { borderColor: '#7C5CFC' },
  iconWrap: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  textWrap: { flex: 1 },
  message: { fontSize: 14, color: '#fff', fontWeight: '500', lineHeight: 20 },
  time: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '700', marginTop: 3 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7C5CFC' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.7)', marginTop: 16 },
  emptySub: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  errorText: { color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 60 },
})
