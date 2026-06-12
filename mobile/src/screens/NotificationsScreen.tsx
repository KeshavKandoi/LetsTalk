import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation } from '@react-navigation/native'
import { MaterialIcons } from '@expo/vector-icons'
import { apiFetch } from '../lib/api'
import { useNetworkCheck } from '../hooks/useNetworkCheck'

type Notification = { id: string; type: string; message: string; time: string }

const ICON_MAP: Record<string, { icon: string; color: string }> = {
  friend_request:  { icon: 'person-add',      color: '#F5C842' },
  friend_accepted: { icon: 'people',           color: '#4CAF50' },
  friend_removed:  { icon: 'person-remove',    color: '#E05010' },
  scan_connected:  { icon: 'qr-code-scanner',  color: '#64B5F6' },
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function NotificationsScreen() {
  const navigation = useNavigation<any>()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const isConnected = useNetworkCheck()

  useEffect(() => {
    apiFetch('/api/friends/notifications', {})
      .then((data: any) => setNotifications(data.notifications || []))
      .catch((e: any) => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <View style={s.root}>
      <LinearGradient
        colors={['#1a0000', '#6B1500', '#C4400A', '#E05010', '#8B2000', '#1a0000']}
        locations={[0, 0.15, 0.35, 0.55, 0.8, 1]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <MaterialIcons name="chevron-left" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={s.title}>Notifications</Text>
          <View style={{ width: 36 }} />
        </View>

        {!isConnected && (
          <View style={{ backgroundColor: '#b00020', padding: 10, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>No internet connection</Text>
          </View>
        )}
        {loading ? (
          <ActivityIndicator color="#fff" style={{ marginTop: 60 }} />
        ) : error ? (
          <Text style={s.errorText}>{error}</Text>
        ) : notifications.length === 0 ? (
          <View style={s.emptyContainer}>
            <MaterialIcons name="notifications-none" size={64} color="rgba(255,255,255,0.2)" />
            <Text style={s.emptyTitle}>No notifications yet</Text>
            <Text style={s.emptySub}>When you get notifications, they'll show up here.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
            {notifications.map(n => {
              const { icon, color } = ICON_MAP[n.type] || { icon: 'notifications', color: '#fff' }
              return (
                <View key={n.id} style={s.card}>
                  <View style={[s.iconWrap, { backgroundColor: color + '22' }]}>
                    <MaterialIcons name={icon as any} size={22} color={color} />
                  </View>
                  <View style={s.textWrap}>
                    <Text style={s.message}>{n.message}</Text>
                    <Text style={s.time}>{timeAgo(n.time)}</Text>
                  </View>
                </View>
              )
            })}
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
  title: { fontSize: 18, fontWeight: '700', color: '#fff' },
  list: { padding: 16, gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 14, padding: 14, gap: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  textWrap: { flex: 1 },
  message: { fontSize: 14, color: '#1a0000', fontWeight: '500', lineHeight: 20 },
  time: { fontSize: 12, color: '#1a0000', fontWeight: '700', marginTop: 3 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.6)', marginTop: 16 },
  emptySub: { fontSize: 14, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  errorText: { color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 60 },
})
