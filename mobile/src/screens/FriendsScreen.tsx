import { useEffect, useState, useRef } from 'react'
import {
  Image,
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, RefreshControl, Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { VideoView, useVideoPlayer } from 'expo-video'
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
type IncomingRequest = {
  id: string
  user: FriendUser
}
type OutgoingRequest = {
  id: string
  user: FriendUser
}

const AMBER = '#e8824a'
const DARK = '#0a0704'
const MID = 'rgba(255,180,100,0.6)'

function Avatar({ user }: { user: FriendUser }) {
  const initials = (user.username || '?').slice(0, 2).toUpperCase()
  return user.photoUrl
    ? <Image source={{ uri: user.photoUrl }} style={s.avatarImg} />
    : <View style={s.avatar}><Text style={s.avatarTxt}>{initials}</Text></View>
}

export default function FriendsScreen() {
  const navigation = useNavigation<any>()
  const [tab, setTab] = useState<'friends' | 'requests'>('friends')
  const [friends, setFriends] = useState<FriendUser[]>([])
  const [incoming, setIncoming] = useState<IncomingRequest[]>([])
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const videoSource = require('../video/animation.mp4')
  const player = useVideoPlayer(videoSource, (player) => {
    player.loop = true
    player.muted = true
    player.play()
  })

  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start()
  }, [])

  const load = async () => {
    const [friendsData] = await Promise.all([
      apiFetch('/api/friends/list', {}),
      apiFetch('/api/places/state', {}),
    ])
    setFriends(friendsData.friends ?? [])
    setIncoming(friendsData.incoming ?? [])
    setOutgoing(friendsData.outgoing ?? [])
  }

  useEffect(() => {
    load().catch(() => {}).finally(() => setLoading(false))
    const interval = setInterval(() => { load().catch(() => {}) }, 5000)
    return () => clearInterval(interval)
  }, [])

  const refresh = async () => {
    setRefreshing(true)
    await load().catch(() => {})
    setRefreshing(false)
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

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Video Background */}
      <VideoView
        style={s.videoBackground}
        player={player}
        allowsFullscreen={false}
        nativeControls={false}
        contentFit="cover"
      />
      <View style={s.overlay} />
      <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <View style={s.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}>
              <Text style={s.iconTxt}>←</Text>
            </TouchableOpacity>
            <Text style={s.headerTitle}>Friends</Text>
            <View style={s.iconBtn} />
          </View>

          <View style={s.tabs}>
            {([[ 'friends', 'Friends'], ['requests', 'Requests']] as const).map(([key, label]) => (
              <TouchableOpacity key={key} style={[s.tab, tab === key && s.tabActive]} onPress={() => setTab(key as any)}>
                <Text style={[s.tabTxt, tab === key && s.tabTxtActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? (
            <View style={s.centered}><ActivityIndicator color={AMBER} size="large" /></View>
          ) : (
            <ScrollView
              contentContainerStyle={s.scroll}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={AMBER} />}
            >
              {tab === 'friends' && (
                friends.length ? friends.map((friend) => (
                  <TouchableOpacity
                    key={friend.userId}
                    style={s.row}
                    onPress={() => navigation.navigate('Conversation', { friend })}
                  >
                    <Avatar user={friend} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.name}>{friend.username}</Text>
                      <Text style={s.messagePreview}>{friend.lastMessage || 'Start a conversation'}</Text>
                    </View>
                  </TouchableOpacity>
                )) : <Text style={s.empty}>Accepted friends will show up here.</Text>
              )}
              {tab === 'requests' && (
                (incoming.length || outgoing.length) ? (
                  <>
                    {incoming.map((request) => (
                      <View key={request.id} style={s.requestCard}>
                        <View style={s.rowInner}>
                          <Avatar user={request.user} />
                          <View style={{ flex: 1 }}>
                            <Text style={s.name}>{request.user.username}</Text>
                            <Text style={s.mood}>{request.user.moodEmoji || '🙂'} wants to be friends</Text>
                          </View>
                        </View>
                        <View style={s.actions}>
                          <TouchableOpacity style={s.rejectBtn} disabled={busyId === request.id} onPress={() => respond(request.id, 'reject')}>
                            <Text style={s.rejectTxt}>Reject</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={s.acceptBtn} disabled={busyId === request.id} onPress={() => respond(request.id, 'accept')}>
                            {busyId === request.id ? <ActivityIndicator color="white" /> : <Text style={s.acceptTxt}>Accept</Text>}
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                    {outgoing.map((request) => (
                      <View key={request.id} style={s.pendingCard}>
                        <View style={s.rowInner}>
                          <Avatar user={request.user} />
                          <View style={{ flex: 1 }}>
                            <Text style={s.name}>{request.user.username}</Text>
                            <Text style={s.mood}>Pending acceptance</Text>
                          </View>
                          <View style={s.pendingBadge}>
                            <Text style={s.pendingBadgeTxt}>Pending</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </>
                ) : <Text style={s.empty}>Friend requests will show up here.</Text>
              )}
            </ScrollView>
          )}
      </Animated.View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0704' },
  videoBackground: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  overlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.65)' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(232,130,74,0.15)' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  iconBtn: { width: 40, alignItems: 'center' },
  iconTxt: { fontSize: 20, color: '#fff', fontWeight: '700' },
  tabs: { flexDirection: 'row', margin: 16, padding: 4, borderRadius: 16, backgroundColor: 'rgba(232,130,74,0.08)' },
  tab: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  tabActive: { backgroundColor: 'rgba(255,255,255,0.95)' },
  tabTxt: { color: MID, fontWeight: '900', fontSize: 16 },
  tabTxtActive: { color: AMBER },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingTop: 4, paddingBottom: 60 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(26,16,8,0.75)', borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(232,130,74,0.2)' },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: AMBER, justifyContent: 'center', alignItems: 'center' },
  avatarImg: { width: 52, height: 52, borderRadius: 26, backgroundColor: AMBER },
  avatarTxt: { color: 'white', fontWeight: '800', fontSize: 18 },
  name: { color: '#fff', fontWeight: '800', fontSize: 16, marginBottom: 3 },
  mood: { color: MID, fontWeight: '600', fontSize: 13 },
  messagePreview: { color: MID, fontWeight: '600', fontSize: 13 },
  requestCard: { backgroundColor: 'rgba(26,16,8,0.75)', borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(232,130,74,0.2)', gap: 12 },
  pendingCard: { backgroundColor: 'rgba(26,16,8,0.75)', borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(232,130,74,0.2)' },
  actions: { flexDirection: 'row', gap: 10 },
  rejectBtn: { flex: 1, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(186,26,26,0.25)', paddingVertical: 12, alignItems: 'center' },
  rejectTxt: { color: '#ba1a1a', fontWeight: '800' },
  acceptBtn: { flex: 1, borderRadius: 50, backgroundColor: AMBER, paddingVertical: 12, alignItems: 'center' },
  acceptTxt: { color: '#151515', fontWeight: '800' },
  pendingBadge: { backgroundColor: 'rgba(232,130,74,0.08)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pendingBadgeTxt: { color: '#fff', fontWeight: '800', fontSize: 11 },
  empty: { color: MID, fontWeight: '600', textAlign: 'center', marginTop: 28 },
})
