import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import {
  Alert, StyleSheet, Text, TextInput,
  TouchableOpacity, View, FlatList, Image, Keyboard, KeyboardAvoidingView, Platform, AppState, BackHandler,
  Pressable, Modal, Animated, NativeScrollEvent, NativeSyntheticEvent,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { File as FileSystemFile } from 'expo-file-system'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRoute, useNavigation } from '@react-navigation/native'
import { apiFetch } from '../lib/api'
import { getCurrentUserId } from '../lib/auth'
import { subscribeToUserChannel } from '../lib/realtime'
import { ackDelivered, ackRead } from '../lib/receipts'
import { dismissConversationNotification, setActiveConversation } from '../lib/notifications'

const ACCENT = '#5B7FFF'
const BG = '#0a0a0a'
const MIN_COMPOSER_HEIGHT = 20
const MAX_COMPOSER_HEIGHT = 120
const BASE_URL = process.env.EXPO_PUBLIC_API_URL
const EMOJIS = ['😀', '😂', '😍', '🥰', '😊', '😉', '😎', '🤔', '😢', '😭', '😡', '👍', '👎', '🙏', '👏', '🔥', '❤️', '💔', '🎉', '✨', '😴', '🤝', '👋', '💯']

type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed'

type ChatMessage = {
  id: string
  senderUserId: string
  recipientUserId?: string
  body: string
  createdAt: string
  status: MessageStatus
  messageType?: 'text' | 'image' | 'audio'
  media?: { url: string | null; mimeType?: string | null; fileName?: string | null; fileSize?: number | null; durationMs?: number | null } | null
}

type DateSeparator = {
  type: 'separator'
  date: string
  label: string
}

type ListItem = ChatMessage | DateSeparator

function generateClientId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function isSeparator(item: ListItem): item is DateSeparator {
  return 'type' in item && item.type === 'separator'
}

function localDateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function compareMessages(a: ChatMessage, b: ChatMessage) {
  const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  if (diff !== 0) return diff
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function getDateLabel(date: Date): string {
  const now = new Date()
  const key = localDateKey(date)
  if (key === localDateKey(now)) return 'TODAY'
  if (key === localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return 'YESTERDAY'
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function buildMessageList(messages: ChatMessage[]): ListItem[] {
  const sorted = [...messages].sort(compareMessages)
  const ascending: ListItem[] = []
  let lastKey = ''
  for (const msg of sorted) {
    const d = new Date(msg.createdAt)
    const key = localDateKey(d)
    if (key !== lastKey) {
      ascending.push({ type: 'separator', date: key, label: getDateLabel(d) })
      lastKey = key
    }
    ascending.push(msg)
  }
  return ascending.reverse()
}

const GROUP_WINDOW_MS = 5 * 60 * 1000
const STATUS_RANK: Record<MessageStatus, number> = { failed: -1, sending: 0, sent: 1, delivered: 2, read: 3 }

function maxStatus(a: MessageStatus | undefined, b: MessageStatus): MessageStatus {
  if (!a) return b
  return (STATUS_RANK[a] ?? 1) >= (STATUS_RANK[b] ?? 1) ? a : b
}

function sameGroup(a: ChatMessage, b: ChatMessage | null, friendUserId?: string) {
  if (!b) return false
  if ((a.senderUserId === friendUserId) !== (b.senderUserId === friendUserId)) return false
  return Math.abs(new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) <= GROUP_WINDOW_MS
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>()
  for (const m of current) byId.set(m.id, m)
  for (const m of incoming) {
    const existing = byId.get(m.id)
    byId.set(m.id, existing ? { ...m, status: maxStatus(existing.status, m.status) } : m)
  }
  return Array.from(byId.values())
}

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
  if (status === 'sending') return <MaterialIcons name="schedule" size={13} color="rgba(255,255,255,0.35)" style={{ marginLeft: 2 }} />
  if (status === 'failed') return <MaterialIcons name="error-outline" size={13} color="#ff6b6b" style={{ marginLeft: 2 }} />
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
  const insets = useSafeAreaInsets()
  const { friend } = (route.params as any) || {}
  
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [inputHeight, setInputHeight] = useState(MIN_COMPOSER_HEIGHT)
  const [loading, setLoading] = useState(true)
  const [photoModal, setPhotoModal] = useState(false)
  const [newMessagesCount, setNewMessagesCount] = useState(0)
  const [friendStatus, setFriendStatus] = useState<{ isOnline: boolean; lastSeenAt: string | null }>({
    isOnline: friend?.isOnline ?? false,
    lastSeenAt: friend?.lastSeenAt ?? null,
  })
  
  const listRef = useRef<FlatList>(null)
  const atBottomRef = useRef(true)
  const messagesRef = useRef<ChatMessage[]>([])
  const modalScale = useRef(new Animated.Value(0.8)).current
  const modalOpacity = useRef(new Animated.Value(0)).current

  const listItems = useMemo(() => buildMessageList(messages), [messages])
  messagesRef.current = messages
  const statusRef = useRef(new Map<string, MessageStatus>())

  const loadMessages = useCallback(async (silent = false) => {
    if (!friend) return
    try {
      const data = await apiFetch('/api/friends/messages', { action: 'list', friendUserId: friend.userId })
      const incoming: ChatMessage[] = data?.messages || []
      setMessages((prev) => mergeMessages(prev, incoming))
      const unread = incoming.filter((m) => m.senderUserId === friend.userId && m.status !== 'read')
      if (unread.length > 0) {
        if (AppState.currentState === 'active') {
          void ackRead(friend.userId)
          void dismissConversationNotification(friend.userId)
        } else {
          ackDelivered(unread.map((m) => m.id))
        }
      }
    } catch (e) {
      if (!silent) Alert.alert('Error', (e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [friend])

  const scrollToLatest = useCallback(() => {
    atBottomRef.current = true
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
  }, [])

  const scrollToNewMessages = useCallback(() => {
    setNewMessagesCount(0)
    scrollToLatest()
  }, [scrollToLatest])

  const deliverMessage = useCallback(async (clientId: string, body: string) => {
    try {
      const result = await apiFetch('/api/friends/messages', { action: 'send', friendUserId: friend.userId, body })
      const serverMessage = result?.message as ChatMessage | undefined
      setMessages((prev) => {
        if (!serverMessage) return prev.map((m) => (m.id === clientId ? { ...m, status: 'sent' as MessageStatus } : m))
        const rest = prev.filter((m) => m.id !== clientId)
        if (rest.some((m) => m.id === serverMessage.id)) return rest
        return [...rest, { ...serverMessage, status: maxStatus(statusRef.current.get(serverMessage.id), 'sent') }]
      })
    } catch (e) {
      setMessages((prev) => prev.map((m) => (m.id === clientId ? { ...m, status: 'failed' as MessageStatus } : m)))
    }
  }, [friend.userId])

  const sendMessage = useCallback(() => {
    if (!newMessage.trim() || !friend) return
    const body = newMessage.trim()
    const clientId = generateClientId()
    setNewMessage('')
    setInputHeight(MIN_COMPOSER_HEIGHT)
    
    setMessages((prev) => [
      ...prev,
      { id: clientId, senderUserId: 'local-self', body, createdAt: new Date().toISOString(), status: 'sending' },
    ])
    
    scrollToLatest()
    void deliverMessage(clientId, body)
  }, [newMessage, friend, deliverMessage, scrollToLatest])

  const retryMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, status: 'sending' } : m)))
    void deliverMessage(message.id, message.body)
  }, [deliverMessage])

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nearBottom = event.nativeEvent.contentOffset.y < 80
    atBottomRef.current = nearBottom
    if (nearBottom) setNewMessagesCount(0)
  }, [])

  useEffect(() => {
    loadMessages()

    let unsubscribe: (() => void) | null = null
    let cancelled = false
    
    getCurrentUserId().then((myUserId) => {
      if (cancelled || !myUserId || !friend) return
      
      unsubscribe = subscribeToUserChannel(myUserId, {
        onNewMessage: (payload) => {
          if (payload?.senderUserId !== friend.userId) return
          
          if (messagesRef.current.some((m) => m.id === payload.id)) return
          setMessages((prev) => mergeMessages(prev, [{
            id: payload.id,
            senderUserId: payload.senderUserId,
            recipientUserId: payload.recipientUserId,
            body: payload.body,
            status: payload.status ?? 'sent',
            createdAt: payload.createdAt,
            messageType: payload.messageType,
            media: payload.media,
          }]))
          if (!atBottomRef.current) setNewMessagesCount((c) => c + 1)
          if (AppState.currentState === 'active') {
            void ackRead(friend.userId, [payload.id])
            void dismissConversationNotification(friend.userId)
          }
        },
        onMessageStatus: (event) => {
          if (event.recipientUserId !== friend.userId) return
          for (const id of event.messageIds) statusRef.current.set(id, maxStatus(statusRef.current.get(id), event.status))
          const ids = new Set(event.messageIds)
          setMessages((prev) => prev.map((m) => (ids.has(m.id) ? { ...m, status: maxStatus(m.status, event.status) } : m)))
        },
      })
    })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [friend, loadMessages])

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

  useEffect(() => {
    if (!friend?.userId) return
    setActiveConversation(friend.userId)
    void dismissConversationNotification(friend.userId)
    return () => setActiveConversation(null)
  }, [friend?.userId])

  const [kbVisible, setKbVisible] = useState(false)

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const show = Keyboard.addListener(showEvent, () => setKbVisible(true))
    const hide = Keyboard.addListener(hideEvent, () => setKbVisible(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  const [emojiOpen, setEmojiOpen] = useState(false)

  const sendImage = useCallback(async (asset: ImagePicker.ImagePickerAsset) => {
    if (!friend) return
    const clientId = generateClientId()
    setMessages((prev) => [
      ...prev,
      { id: clientId, senderUserId: 'local-self', body: '', createdAt: new Date().toISOString(), status: 'sending', messageType: 'image', media: { url: asset.uri } },
    ])
    scrollToLatest()
    try {
      const token = await AsyncStorage.getItem('session_token')
      const form = new FormData()
      form.append('action', 'send')
      form.append('friendUserId', friend.userId)
      form.append('messageType', 'image')
      form.append('body', '')
      form.append('file', new FileSystemFile(asset.uri))
      const res = await fetch(`${BASE_URL}/api/friends/messages`, {
        method: 'POST',
        headers: token ? { Cookie: `better-auth.session_token=${token}` } : {},
        body: form,
      })
      const data = (await res.json()) as { message?: ChatMessage; error?: string }
      if (!res.ok || !data.message) throw new Error(data.error || 'Upload failed.')
      const server = data.message
      setMessages((prev) => {
        const rest = prev.filter((m) => m.id !== clientId)
        if (rest.some((m) => m.id === server.id)) return rest
        return [...rest, { ...server, status: maxStatus(statusRef.current.get(server.id), 'sent') }]
      })
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== clientId))
      Alert.alert('Could not send photo', e instanceof Error ? e.message : 'Please try again.')
    }
  }, [friend, scrollToLatest])

  const openCamera = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      if (!perm.granted) {
        Alert.alert('Camera permission needed', 'Allow camera access in Settings to take photos.')
        return
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
      if (!result.canceled && result.assets[0]) void sendImage(result.assets[0])
    } catch {
      Alert.alert('Error', 'Could not open the camera.')
    }
  }, [sendImage])

  const openGallery = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!perm.granted) {
        Alert.alert('Photos permission needed', 'Allow photo access in Settings to share pictures.')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 })
      if (!result.canceled && result.assets[0]) void sendImage(result.assets[0])
    } catch {
      Alert.alert('Error', 'Could not open your photos.')
    }
  }, [sendImage])

  useEffect(() => {
    if (!emojiOpen) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setEmojiOpen(false)
      return true
    })
    return () => sub.remove()
  }, [emojiOpen])

  const openPhoto = useCallback(() => {
    if (!friend?.photoUrl) return
    setPhotoModal(true)
    modalScale.setValue(0.8)
    modalOpacity.setValue(0)
    Animated.parallel([
      Animated.spring(modalScale, { toValue: 1, useNativeDriver: true, friction: 6 }),
      Animated.timing(modalOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start()
  }, [friend?.photoUrl])

  const closePhoto = useCallback(() => {
    Animated.parallel([
      Animated.timing(modalScale, { toValue: 0.8, duration: 150, useNativeDriver: true }),
      Animated.timing(modalOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => setPhotoModal(false))
  }, [])

  return (
    <View style={s.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
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

        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0} enabled={kbVisible}>
          <View style={s.listRegion}>
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
              data={listItems}
              keyExtractor={(item) => isSeparator(item) ? `sep-${item.date}` : item.id}
              contentContainerStyle={s.listContent}
              style={s.flatList}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              inverted
              maintainVisibleContentPosition={{ minIndexForVisible: 1, autoscrollToTopThreshold: 80 }}
              initialNumToRender={20}
              scrollEventThrottle={16}
              onScroll={handleScroll}
              renderItem={({ item, index }) => {
                if (isSeparator(item)) {
                  return (
                    <View style={s.datePill}>
                      <Text style={s.datePillTxt}>{item.label}</Text>
                    </View>
                  )
                }

                const msg = item as ChatMessage
                const isOwn = msg.senderUserId !== friend?.userId
                const prev = index < listItems.length - 1 && !isSeparator(listItems[index + 1]) ? listItems[index + 1] as ChatMessage : null
                const next = index > 0 && !isSeparator(listItems[index - 1]) ? listItems[index - 1] as ChatMessage : null
                const prevSame = sameGroup(msg, prev, friend?.userId)
                const nextSame = sameGroup(msg, next, friend?.userId)
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
                      <Pressable
                        disabled={msg.status !== 'failed'}
                        onPress={() => retryMessage(msg)}
                        style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleTheir, msg.status === 'failed' && s.bubbleFailed, msg.status === 'sending' && s.bubbleSending]}
                      >
                        {msg.messageType === 'image' && msg.media?.url ? (
                          <Image source={{ uri: msg.media.url }} style={s.imageBubble} resizeMode="cover" />
                        ) : msg.messageType === 'audio' ? (
                          <Text style={[s.bubbleTxt, isOwn ? s.bubbleTxtOwn : s.bubbleTxtTheir]}>Voice message</Text>
                        ) : (
                          <Text style={[s.bubbleTxt, isOwn ? s.bubbleTxtOwn : s.bubbleTxtTheir]}>{msg.body}</Text>
                        )}
                      </Pressable>
                      {msg.status === 'failed' ? (
                        <Text style={s.retryLabel}>Tap to retry</Text>
                      ) : showTime ? (
                        <View style={[s.timeRow, isOwn ? s.timeLabelOwn : s.timeLabelTheir]}>
                          <Text style={s.timeLabel}>{formatTime(new Date(msg.createdAt))}</Text>
                          {isOwn && <StatusTicks status={msg.status} />}
                        </View>
                      ) : null}
                    </View>
                  </View>
                )
              }}
            />
          )}

          {newMessagesCount > 0 && (
            <TouchableOpacity style={s.newMessagesBadge} onPress={scrollToNewMessages}>
              <MaterialIcons name="arrow-downward" size={18} color="#fff" />
              <Text style={s.newMessagesText}>{newMessagesCount} new {newMessagesCount === 1 ? 'message' : 'messages'}</Text>
            </TouchableOpacity>
          )}

          </View>

          {emojiOpen && (
            <View style={s.emojiPanel}>
              {EMOJIS.map((e) => (
                <TouchableOpacity key={e} style={s.emojiItem} onPress={() => setNewMessage((t) => (t + e).slice(0, 2000))}>
                  <Text style={s.emojiTxt}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={[s.inputArea, { paddingBottom: Math.max(insets.bottom, 10) + 8 }]}>
            <View style={s.inputPill}>
              <TouchableOpacity style={s.pillIcon} onPress={() => { Keyboard.dismiss(); setEmojiOpen((v) => !v) }} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}>
                <MaterialIcons name="emoji-emotions" size={22} color="rgba(255,255,255,0.55)" />
              </TouchableOpacity>
              <TextInput
                style={[s.input, { height: Math.max(inputHeight, MIN_COMPOSER_HEIGHT) }]}
                placeholder="Type a message..."
                onFocus={() => setEmojiOpen(false)}
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={newMessage}
                onChangeText={setNewMessage}
                onContentSizeChange={(e) => {
                  const newHeight = Math.ceil(e.nativeEvent.contentSize.height)
                  const clamped = Math.max(MIN_COMPOSER_HEIGHT, Math.min(newHeight, MAX_COMPOSER_HEIGHT))
                  setInputHeight(clamped)
                }}
                multiline
                maxLength={2000}
                scrollEnabled={inputHeight >= MAX_COMPOSER_HEIGHT}
              />
              <TouchableOpacity style={s.pillIcon} onPress={openGallery} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
                <MaterialIcons name="attach-file" size={20} color="rgba(255,255,255,0.55)" style={{ transform: [{ rotate: '45deg' }] }} />
              </TouchableOpacity>
              <TouchableOpacity style={s.pillIcon} onPress={openCamera} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
                <MaterialIcons name="photo-camera" size={20} color="rgba(255,255,255,0.55)" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={s.sendBtn}
              onPress={newMessage.trim() ? sendMessage : () => {}}
              activeOpacity={0.8}
            >
              <MaterialIcons name={newMessage.trim() ? 'arrow-upward' : 'mic'} size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

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
  list: { paddingHorizontal: 20, paddingVertical: 12 },
  listRegion: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingVertical: 12, flexGrow: 1, justifyContent: 'flex-end' },
  flatList: { flex: 1, backgroundColor: BG },
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
  bubbleSending: { opacity: 0.6 },
  bubbleFailed: { borderWidth: 1, borderColor: 'rgba(255,107,107,0.5)' },
  retryLabel: { fontSize: 11, color: '#ff6b6b', fontWeight: '600', marginTop: 3 },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  timeLabel: { fontSize: 10, color: 'rgba(255,255,255,0.3)' },
  timeLabelTheir: { marginLeft: 2 },
  timeLabelOwn: { marginRight: 2 },
  inputArea: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: BG, gap: 8 },
  inputPill: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', paddingLeft: 14, paddingRight: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  input: { flex: 1, fontSize: 15, color: '#ffffff', paddingVertical: 0, paddingTop: 0, paddingBottom: 0, lineHeight: 20, textAlignVertical: 'top', includeFontPadding: false },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center', shadowColor: ACCENT, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  pillIcon: { width: 22, height: 20, justifyContent: 'center', alignItems: 'center' },
  imageBubble: { width: 200, height: 200, borderRadius: 12 },
  emojiPanel: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: BG, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  emojiItem: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  emojiTxt: { fontSize: 24 },
  sendBtnOff: { backgroundColor: 'rgba(91,127,255,0.3)', shadowOpacity: 0 },
  newMessagesBadge: { position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: ACCENT, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, shadowColor: ACCENT, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
  newMessagesText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { alignItems: 'center', gap: 16 },
  modalName: { color: '#fff', fontSize: 18, fontWeight: '800' },
  modalPhoto: { width: 300, height: 300, borderRadius: 24, borderWidth: 2, borderColor: 'rgba(91,127,255,0.4)' },
  modalClose: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  modalCloseTxt: { color: 'rgba(255,255,255,0.85)', fontWeight: '700', fontSize: 14 },
})
