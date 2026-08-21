import { useEffect, useState, useRef } from 'react'
import {
  Alert, StyleSheet, Text, TextInput,
  TouchableOpacity, View, FlatList, Image, KeyboardAvoidingView, Platform, AppState,
  Keyboard, Pressable, Modal, Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { useRoute, useNavigation } from '@react-navigation/native'
import { apiFetch } from '../lib/api'

const ACCENT = '#5B7FFF'
const BG = '#0a0a0a'

function Avatar({ uri, username, size = 32 }: { uri?: string | null; username?: string; size?: number }) {
  const initials = (username || '?').slice(0, 1).toUpperCase()
  return uri
    ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
    : (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(91,127,255,0.18)', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: ACCENT, fontWeight: '700', fontSize: size * 0.4 }}>{initials}</Text>
      </View>
    )
}

function StatusTicks({ status }: { status?: string }) {
  if (status === 'read') return <MaterialIcons name="done-all" size={14} color={ACCENT} style={{ marginLeft: 2 }} />
  if (status === 'delivered') return <MaterialIcons name="done-all" size={14} color="rgba(255,255,255,0.35)" style={{ marginLeft: 2 }} />
  return <MaterialIcons name="done" size={14} color="rgba(255,255,255,0.35)" style={{ marginLeft: 2 }} />
}

function SkeletonBubble({ align, width }: { align: 'flex-start' | 'flex-end'; width: number }) {
  const pulse = useRef(new Animated.Value(0.4)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [])
  return (
    <Animated.View
      style={{
        alignSelf: align, width, height: 34, borderRadius: 18, marginBottom: 10,
        backgroundColor: 'rgba(255,255,255,0.06)', opacity: pulse,
      }}
    />
  )
}

export default function ConversationScreen() {
  const route = useRoute()
  const navigation = useNavigation<any>()
  const { friend } = (route.params as any) || {}
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [photoModal, setPhotoModal] = useState(false)
  const [friendStatus, setFriendStatus] = useState<{ isOnline: boolean; lastSeenAt: string | null }>({
    isOnline: friend?.isOnline ?? false,
    lastSeenAt: friend?.lastSeenAt ?? null,
  })
  const listRef = useRef<FlatList>(null)
  const modalScale = useRef(new Animated.Value(0.8)).current
  const modalOpacity = useRef(new Animated.Value(0)).current

  const loadMessages = async () => {
    if (!friend) return
    try {
      const data = await apiFetch('/api/friends/messages', { action: 'list', friendUserId: friend.userId })
      setMessages(data?.messages || [])
    } catch (e) {
      Alert.alert('Error', (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !friend) return
    const body = newMessage.trim()
    try {
      setSending(true)
      setNewMessage('')
      await apiFetch('/api/friends/messages', { action: 'send', friendUserId: friend.userId, body })
      await loadMessages()
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
    } catch (e) {
      Alert.alert('Error', (e as Error).message)
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    loadMessages()
    const interval = setInterval(loadMessages, 3000)
    return () => clearInterval(interval)
  }, [friend])

  // Mark self as online, poll friend status
  useEffect(() => {
    const markOnline = () => apiFetch('/api/friends/online-status', { isOnline: true }).catch(() => {})
    const markOffline = () => apiFetch('/api/friends/online-status', { isOnline: false }).catch(() => {})
    const pollFriendStatus = async () => {
      if (!friend?.userId) return
      try {
        const data = await apiFetch('/api/friends/online-status', { userId: friend.userId })
        setFriendStatus({ isOnline: data.isOnline ?? false, lastSeenAt: data.lastSeenAt ?? null })
      } catch {}
    }

    markOnline()
    pollFriendStatus()
    const statusInterval = setInterval(pollFriendStatus, 15000)

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') markOnline()
      else markOffline()
    })

    return () => {
      markOffline()
      clearInterval(statusInterval)
      sub.remove()
    }
  }, [friend?.userId])

  const openPhoto = () => {
    if (!friend?.photoUrl) return
    setPhotoModal(true)
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
    ]).start(() => setPhotoModal(false))
  }

  return (
    <View style={s.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
            <MaterialIcons name="chevron-left" size={26} color={ACCENT} />
          </TouchableOpacity>
          <TouchableOpacity style={s.headerCenter} activeOpacity={0.75} onPress={openPhoto} disabled={!friend?.photoUrl}>
            <Avatar uri={friend?.photoUrl} username={friend?.username} size={40} />
            <View>
              <Text style={s.headerName}>{friend?.username}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {friendStatus.isOnline && <View style={s.onlineDot} />}
                <Text style={[s.headerOnline, !friendStatus.isOnline && s.headerOffline]}>
                  {friendStatus.isOnline
                    ? 'Online'
                    : friendStatus.lastSeenAt
                      ? formatLastSeen(new Date(friendStatus.lastSeenAt))
                      : 'Offline'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
          <View style={s.headerBtn} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss}>
            {loading && messages.length === 0 ? (
              <View style={s.list}>
                <View style={s.datePill}><Text style={s.datePillTxt}>TODAY</Text></View>
                <SkeletonBubble align="flex-start" width={160} />
                <SkeletonBubble align="flex-start" width={110} />
                <SkeletonBubble align="flex-end" width={140} />
                <SkeletonBubble align="flex-end" width={90} />
                <SkeletonBubble align="flex-start" width={180} />
              </View>
            ) : (
              <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(item) => item.id}
                contentContainerStyle={s.list}
                style={{ backgroundColor: BG }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
                ListHeaderComponent={
                  <View style={s.datePill}>
                    <Text style={s.datePillTxt}>TODAY</Text>
                  </View>
                }
                renderItem={({ item, index }) => {
                  const isOwn = item.senderUserId !== friend?.userId
                  const prev = index > 0 ? messages[index - 1] : null
                  const next = index < messages.length - 1 ? messages[index + 1] : null
                  const prevSame = prev && prev.senderUserId === item.senderUserId
                  const nextSame = next && next.senderUserId === item.senderUserId
                  const showName = !isOwn && !prevSame
                  const showTime = !nextSame
                  const showAvatar = !isOwn && !nextSame

                  return (
                    <View style={[s.msgGroup, isOwn ? s.msgGroupOwn : s.msgGroupTheir]}>
                      {!isOwn && (
                        <View style={s.avatarCol}>
                          {showAvatar
                            ? <Avatar uri={friend?.photoUrl} username={friend?.username} size={32} />
                            : <View style={{ width: 32 }} />
                          }
                        </View>
                      )}

                      <View style={[s.msgCol, isOwn ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
                        {showName && <Text style={s.senderName}>{friend?.username}</Text>}
                        <View style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleTheir]}>
                          <Text style={[s.bubbleTxt, isOwn ? s.bubbleTxtOwn : s.bubbleTxtTheir]}>{item.body}</Text>
                        </View>
                        {showTime && (
                          <View style={[s.timeRow, isOwn ? s.timeLabelOwn : s.timeLabelTheir]}>
                            <Text style={s.timeLabel}>{formatTime(new Date(item.createdAt))}</Text>
                            {isOwn && <StatusTicks status={item.status} />}
                          </View>
                        )}
                      </View>
                    </View>
                  )
                }}
              />
            )}
          </Pressable>

          {/* Input */}
          <View style={s.inputArea}>
            <View style={s.inputPill}>
              <TextInput
                style={s.input}
                placeholder="Type a message..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={newMessage}
                onChangeText={setNewMessage}
                editable={!sending}
                multiline
              />
            </View>
            <TouchableOpacity
              style={[s.sendBtn, (!newMessage.trim() || sending) && s.sendBtnOff]}
              onPress={sendMessage}
              disabled={!newMessage.trim() || sending}
            >
              <MaterialIcons name="arrow-upward" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

      </SafeAreaView>

      {/* Profile photo viewer */}
      <Modal visible={photoModal} transparent animationType="none" onRequestClose={closePhoto}>
        <Pressable style={s.modalBg} onPress={closePhoto}>
          <Animated.View style={[s.modalContent, { opacity: modalOpacity, transform: [{ scale: modalScale }] }]}>
            <Text style={s.modalName}>{friend?.username}</Text>
            {friend?.photoUrl && (
              <Image source={{ uri: friend.photoUrl }} style={s.modalPhoto} resizeMode="cover" />
            )}
            <TouchableOpacity style={s.modalClose} onPress={closePhoto}>
              <MaterialIcons name="close" size={18} color="rgba(255,255,255,0.85)" />
              <Text style={s.modalCloseTxt}>Close</Text>
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  )
}

function formatLastSeen(date: Date): string {
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()
  const time = formatTime(date)

  if (isToday) return `last seen today at ${time}`
  if (isYesterday) return `last seen yesterday at ${time}`

  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000)
  if (diffDays < 7) {
    return `last seen ${date.toLocaleDateString('en-US', { weekday: 'long' })} at ${time}`
  }
  return `last seen ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

function formatTime(date: Date) {
  const h = date.getHours()
  const m = date.getMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m} ${ampm}`
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#111111', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingLeft: 2 },
  headerName: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ade80' },
  headerOnline: { fontSize: 12, fontWeight: '500', color: '#4ade80', marginTop: 1 },
  headerOffline: { color: 'rgba(255,255,255,0.4)' },
  datePill: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 14, paddingVertical: 4, borderRadius: 999, marginBottom: 16, marginTop: 8 },
  datePillTxt: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.8 },
  list: { paddingHorizontal: 20, paddingBottom: 12, paddingTop: 4 },
  msgGroup: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 3, gap: 8 },
  msgGroupTheir: { justifyContent: 'flex-start' },
  msgGroupOwn: { justifyContent: 'flex-end' },
  avatarCol: { width: 32, alignItems: 'center', justifyContent: 'flex-end', marginBottom: 2 },
  msgCol: { flex: 1, maxWidth: '78%' },
  senderName: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.4)', marginBottom: 3, marginLeft: 2 },
  bubble: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 20, maxWidth: '100%' },
  bubbleTheir: { backgroundColor: 'rgba(255,255,255,0.08)', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  bubbleOwn: { backgroundColor: 'rgba(91,127,255,0.35)', borderBottomRightRadius: 4 },
  bubbleTxt: { fontSize: 15, lineHeight: 22 },
  bubbleTxtTheir: { color: 'rgba(255,255,255,0.92)' },
  bubbleTxtOwn: { color: '#ffffff' },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  timeLabel: { fontSize: 10, color: 'rgba(255,255,255,0.3)' },
  timeLabelTheir: { marginLeft: 2 },
  timeLabelOwn: { marginRight: 2 },
  inputArea: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: BG, gap: 10 },
  inputPill: { flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 16, paddingVertical: 4 },
  input: { fontSize: 15, color: '#ffffff', paddingVertical: 8, maxHeight: 100 },
  sendBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center', shadowColor: ACCENT, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  sendBtnOff: { backgroundColor: 'rgba(91,127,255,0.3)', shadowOpacity: 0 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { alignItems: 'center', gap: 16 },
  modalName: { color: '#fff', fontSize: 18, fontWeight: '800' },
  modalPhoto: { width: 300, height: 300, borderRadius: 24, borderWidth: 2, borderColor: 'rgba(91,127,255,0.4)' },
  modalClose: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  modalCloseTxt: { color: 'rgba(255,255,255,0.85)', fontWeight: '700', fontSize: 14 },
})
