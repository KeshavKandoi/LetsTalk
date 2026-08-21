import { useEffect, useState, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  Image, Modal,
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, ScrollView, RefreshControl, Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { MaterialIcons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { apiFetch } from '../lib/api'

type FriendUser = {
  id: string
  userId: string
  username: string
  moodEmoji: string | null
  photoUrl: string | null
  lastMessage?: string | null
}
type IncomingRequest = { id: string; user: FriendUser }
type PendingRequest = { id: string; user: FriendUser }
type RejectedRequest = { id: string; user: FriendUser }

const ACCENT = '#5B7FFF'
const BG_TOP = '#0d1220'
const BG_BOTTOM = '#070a12'
const MID = 'rgba(180,195,230,0.55)'
const CARD = 'rgba(255,255,255,0.045)'
const BORDER = 'rgba(255,255,255,0.08)'

function Avatar({ user, size = 52, onPress }: { user: FriendUser; size?: number; onPress?: () => void }) {
  const initials = (user.username || '?').slice(0, 2).toUpperCase()
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} style={[s.avatarRing, { width: size + 4, height: size + 4, borderRadius: (size + 4) / 2 }]}>
      {user.photoUrl
        ? <Image source={{ uri: user.photoUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        : (
          <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
            <Text style={[s.avatarTxt, { fontSize: size * 0.34 }]}>{initials}</Text>
          </View>
        )
      }
    </TouchableOpacity>
  )
}

export default function FriendsScreen() {
  const navigation = useNavigation<any>()
  const [tab, setTab] = useState<'friends' | 'requests'>('friends')
  const [friends, setFriends] = useState<FriendUser[]>([])
  const [incoming, setIncoming] = useState<IncomingRequest[]>([])
  const [pending, setPending] = useState<PendingRequest[]>([])
  const [rejected, setRejected] = useState<RejectedRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [photoModal, setPhotoModal] = useState<{ url: string; username: string } | null>(null)
  const [dismissedRejected, setDismissedRejected] = useState<string[]>([])

  useEffect(() => {
    AsyncStorage.getItem('dismissedRejectedRequests')
      .then((raw) => {
        if (raw) setDismissedRejected(JSON.parse(raw))
      })
      .catch(() => {})
  }, [])

  const dismissRejected = (requestId: string) => {
    setDismissedRejected((prev) => {
      const next = prev.includes(requestId) ? prev : [...prev, requestId]
      AsyncStorage.setItem('dismissedRejectedRequests', JSON.stringify(next)).catch(() => {})
      return next
    })
  }

  const visibleRejected = rejected.filter((r) => !dismissedRejected.includes(r.id))

  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current
  const modalScale = useRef(new Animated.Value(0.8)).current
  const modalOpacity = useRef(new Animated.Value(0)).current
  const indicatorAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start()
  }, [])

  const switchTab = (key: 'friends' | 'requests') => {
    setTab(key)
    Animated.spring(indicatorAnim, { toValue: key === 'friends' ? 0 : 1, useNativeDriver: true, friction: 9, tension: 80 }).start()
  }

  const openPhoto = (url: string, username: string) => {
    setPhotoModal({ url, username })
    modalScale.setValue(0.8)
    modalOpacity.setValue(0)
    Animated.parallel([
      Animated.spring(modalScale, { toValue: 1, useNativeDriver: true, friction: 6 }),
      Animated.timing(modalOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start()
  }

  const closePhoto = () => {
    Animated.parallel([
      Animated.timing(modalScale, { toValue: 0.8, duration: 150, useNativeDriver: true }),
      Animated.timing(modalOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => setPhotoModal(null))
  }

  const load = async () => {
    const [friendsData] = await Promise.all([
      apiFetch('/api/friends/list', {}),
      apiFetch('/api/places/state', {}),
    ])
    const next = {
      friends: friendsData.friends ?? [],
      incoming: friendsData.incoming ?? [],
      pending: friendsData.pending ?? [],
      rejected: friendsData.rejected ?? [],
    }
    setFriends(next.friends)
    setIncoming(next.incoming)
    setPending(next.pending)
    setRejected(next.rejected)
    AsyncStorage.setItem('cached_friends_data', JSON.stringify(next)).catch(() => {})
  }

  useEffect(() => {
    AsyncStorage.getItem('cached_friends_data').then(cached => {
      if (cached) {
        try {
          const c = JSON.parse(cached)
          setFriends(c.friends || [])
          setIncoming(c.incoming || [])
          setPending(c.pending || [])
          setRejected(c.rejected || [])
          setLoading(false)
        } catch {}
      }
    })

    load().catch(() => {}).finally(() => setLoading(false))
    const interval = setInterval(() => { load().catch(() => {}) }, 5000)
    return () => clearInterval(interval)
  }, [])

  const refresh = async () => {
    setRefreshing(true)
    await load().catch(() => {})
    setRefreshing(false)
  }

  const removeFriend = (friend: FriendUser) => {
    Alert.alert(
      'Remove Friend',
      `Remove ${friend.username} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive', onPress: async () => {
            try {
              await apiFetch('/api/friends/respond', { requestId: friend.id, action: 'remove' })
              refresh()
            } catch (e: any) { Alert.alert('Error', e.message) }
          }
        }
      ]
    )
  }

  const respond = async (requestId: string, action: 'accept' | 'reject') => {
    setBusyId(requestId)
    try {
      await apiFetch('/api/friends/respond', { requestId, action })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const requestCount = incoming.length

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <LinearGradient colors={[BG_TOP, BG_BOTTOM]} style={StyleSheet.absoluteFill} />

      <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}>
            <MaterialIcons name="chevron-left" size={26} color="#fff" />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={s.headerTitle}>Friends</Text>
            <Text style={s.headerSub}>{friends.length} {friends.length === 1 ? 'friend' : 'friends'}</Text>
          </View>
          <View style={s.iconBtn} />
        </View>

        <View style={s.tabsWrap}>
          <View style={s.tabs}>
            <Animated.View
              style={[
                s.tabIndicator,
                {
                  transform: [{
                    translateX: indicatorAnim.interpolate({ inputRange: [0, 1], outputRange: [4, 158] }),
                  }],
                },
              ]}
            />
            {([['friends', 'Friends'], ['requests', 'Requests']] as const).map(([key, label]) => (
              <TouchableOpacity key={key} style={s.tab} onPress={() => switchTab(key as any)} activeOpacity={0.8}>
                <Text style={[s.tabTxt, tab === key && s.tabTxtActive]}>{label}</Text>
                {key === 'requests' && requestCount > 0 && (
                  <View style={s.tabBadge}>
                    <Text style={s.tabBadgeTxt}>{requestCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {tab === 'friends' && friends.length > 0 && (
          <View style={s.hintRow}>
            <MaterialIcons name="touch-app" size={13} color={MID} />
            <Text style={s.hintTxt}>Hold a friend to remove them</Text>
          </View>
        )}

        {loading ? (
          <View style={s.centered}><ActivityIndicator color={ACCENT} size="large" /></View>
        ) : (
          <ScrollView
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={ACCENT} />}
          >
            {tab === 'friends' && (
              <>
                {friends.length ? friends.map((friend) => (
                  <TouchableOpacity
                    key={friend.userId}
                    style={s.row}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('Conversation', { friend })}
                    onLongPress={() => removeFriend(friend)}
                  >
                    <Avatar
                      user={friend}
                      onPress={friend.photoUrl ? () => openPhoto(friend.photoUrl!, friend.username) : undefined}
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={s.name}>{friend.username}</Text>
                      <Text style={s.messagePreview} numberOfLines={1}>{friend.lastMessage || 'Start a conversation'}</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.25)" />
                  </TouchableOpacity>
                )) : (
                  <View style={s.emptyWrap}>
                    <View style={s.emptyIconCircle}>
                      <MaterialIcons name="people-outline" size={30} color={ACCENT} />
                    </View>
                    <Text style={s.emptyTitle}>No friends yet</Text>
                    <Text style={s.empty}>Accepted friends will show up here.</Text>
                  </View>
                )}
              </>
            )}

            {tab === 'requests' && (
              (incoming.length || pending.length || visibleRejected.length) ? (
                <>
                  {incoming.length > 0 && (
                    <Text style={s.groupLabel}>INCOMING</Text>
                  )}
                  {incoming.map((request) => (
                    <View key={request.id} style={s.requestCard}>
                      <View style={s.rowInner}>
                        <Avatar
                          user={request.user}
                          onPress={request.user.photoUrl ? () => openPhoto(request.user.photoUrl!, request.user.username) : undefined}
                        />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={s.name}>{request.user.username}</Text>
                          <Text style={s.mood}>{request.user.moodEmoji || '🙂'} wants to be friends</Text>
                        </View>
                      </View>
                      <View style={s.actions}>
                        <TouchableOpacity style={s.rejectBtn} disabled={busyId === request.id} onPress={() => respond(request.id, 'reject')}>
                          <MaterialIcons name="close" size={16} color="#ba1a1a" />
                          <Text style={s.rejectTxt}>Decline</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.acceptBtn} disabled={busyId === request.id} onPress={() => respond(request.id, 'accept')}>
                          {busyId === request.id ? <ActivityIndicator color="#fff" /> : (
                            <>
                              <MaterialIcons name="check" size={16} color="#fff" />
                              <Text style={s.acceptTxt}>Accept</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}

                  {pending.length > 0 && (
                    <Text style={s.groupLabel}>SENT</Text>
                  )}
                  {pending.map((request) => (
                    <View key={request.id} style={s.pendingCard}>
                      <View style={s.rowInner}>
                        <Avatar
                          user={request.user}
                          onPress={request.user.photoUrl ? () => openPhoto(request.user.photoUrl!, request.user.username) : undefined}
                        />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={s.name}>{request.user.username}</Text>
                          <Text style={s.mood}>Waiting for them to accept</Text>
                        </View>
                        <View style={s.pendingBadge}>
                          <MaterialIcons name="schedule" size={12} color={MID} />
                          <Text style={s.pendingBadgeTxt}>Pending</Text>
                        </View>
                      </View>
                    </View>
                  ))}

                  {visibleRejected.length > 0 && (
                    <Text style={s.groupLabel}>DECLINED</Text>
                  )}
                  {visibleRejected.map((request) => (
                    <View key={request.id} style={s.rejectedCard}>
                      <View style={s.rowInner}>
                        <Avatar
                          user={request.user}
                          onPress={request.user.photoUrl ? () => openPhoto(request.user.photoUrl!, request.user.username) : undefined}
                        />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={s.name}>{request.user.username}</Text>
                          <Text style={s.mood}>Request declined</Text>
                        </View>
                        <TouchableOpacity
                          style={s.rejectedBadge}
                          onPress={() => dismissRejected(request.id)}
                        >
                          <MaterialIcons name="close" size={12} color="#e8a89e" />
                          <Text style={s.rejectedBadgeTxt}>Dismiss</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </>
              ) : (
                <View style={s.emptyWrap}>
                  <View style={s.emptyIconCircle}>
                    <MaterialIcons name="mail-outline" size={30} color={ACCENT} />
                  </View>
                  <Text style={s.emptyTitle}>No requests</Text>
                  <Text style={s.empty}>Friend requests will show up here.</Text>
                </View>
              )
            )}
          </ScrollView>
        )}
      </Animated.View>

      {/* Photo viewer modal */}
      <Modal visible={!!photoModal} transparent animationType="none" onRequestClose={closePhoto}>
        <TouchableOpacity style={s.modalBg} activeOpacity={1} onPress={closePhoto}>
          <Animated.View style={[s.modalContent, { opacity: modalOpacity, transform: [{ scale: modalScale }] }]}>
            <Text style={s.modalName}>{photoModal?.username}</Text>
            {photoModal?.url && (
              <Image
                source={{ uri: photoModal.url }}
                style={s.modalPhoto}
                resizeMode="cover"
              />
            )}
            <TouchableOpacity style={s.modalClose} onPress={closePhoto}>
              <MaterialIcons name="close" size={18} color="rgba(255,255,255,0.85)" />
              <Text style={s.modalCloseTxt}>Close</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_BOTTOM },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, fontWeight: '600', color: MID, marginTop: 1 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },

  tabsWrap: { paddingHorizontal: 16, marginTop: 8 },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: BORDER, position: 'relative' },
  tabIndicator: { position: 'absolute', top: 4, bottom: 4, width: 150, borderRadius: 12, backgroundColor: ACCENT },
  tab: { flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  tabTxt: { color: MID, fontWeight: '800', fontSize: 14 },
  tabTxtActive: { color: '#fff' },
  tabBadge: { backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 999, minWidth: 18, height: 18, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  tabBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '900' },

  hintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingTop: 12, paddingBottom: 4 },
  hintTxt: { color: MID, fontSize: 12, fontWeight: '600' },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingTop: 8, paddingBottom: 60 },

  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 18, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: BORDER },
  rowInner: { flexDirection: 'row', alignItems: 'center' },

  avatarRing: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(91,127,255,0.15)' },
  avatar: { backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { color: '#fff', fontWeight: '900' },

  name: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 2 },
  mood: { color: MID, fontWeight: '600', fontSize: 12.5 },
  messagePreview: { color: MID, fontWeight: '600', fontSize: 12.5 },

  groupLabel: { color: MID, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8, marginTop: 4, marginLeft: 2 },

  requestCard: { backgroundColor: CARD, borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: BORDER, gap: 12 },
  pendingCard: { backgroundColor: CARD, borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: BORDER },
  actions: { flexDirection: 'row', gap: 8 },
  rejectBtn: { flex: 1, flexDirection: 'row', gap: 6, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(186,26,26,0.3)', paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  rejectTxt: { color: '#ba1a1a', fontWeight: '800', fontSize: 13.5 },
  acceptBtn: { flex: 1, flexDirection: 'row', gap: 6, borderRadius: 50, backgroundColor: ACCENT, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  acceptTxt: { color: '#fff', fontWeight: '800', fontSize: 13.5 },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pendingBadgeTxt: { color: MID, fontWeight: '800', fontSize: 11 },

  rejectedCard: { backgroundColor: CARD, borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(150,90,80,0.2)' },
  rejectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(120,60,55,0.25)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  rejectedBadgeTxt: { color: '#e8a89e', fontWeight: '800', fontSize: 11 },

  emptyWrap: { alignItems: 'center', marginTop: 60, paddingHorizontal: 30 },
  emptyIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(91,127,255,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { color: '#fff', fontWeight: '800', fontSize: 16, marginBottom: 4 },
  empty: { color: MID, fontWeight: '600', textAlign: 'center', fontSize: 13, lineHeight: 19 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { alignItems: 'center', gap: 16 },
  modalName: { color: '#fff', fontSize: 18, fontWeight: '800' },
  modalPhoto: { width: 300, height: 300, borderRadius: 24, borderWidth: 2, borderColor: 'rgba(91,127,255,0.4)' },
  modalClose: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  modalCloseTxt: { color: 'rgba(255,255,255,0.85)', fontWeight: '700', fontSize: 14 },
})
