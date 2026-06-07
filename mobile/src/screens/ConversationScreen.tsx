import { useEffect, useState, useRef } from 'react'
import {
  Alert, ActivityIndicator, StyleSheet, Text, TextInput,
  TouchableOpacity, View, FlatList, Image, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRoute, useNavigation } from '@react-navigation/native'
import { apiFetch } from '../lib/api'

function Avatar({ uri, username, size = 32 }: { uri?: string | null; username?: string; size?: number }) {
  const initials = (username || '?').slice(0, 1).toUpperCase()
  return uri
    ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
    : (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#e9f0e5', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#006b2c', fontWeight: '700', fontSize: size * 0.4 }}>{initials}</Text>
      </View>
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
  const listRef = useRef<FlatList>(null)

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
    try {
      setSending(true)
      await apiFetch('/api/friends/messages', { action: 'send', friendUserId: friend.userId, body: newMessage.trim() })
      setNewMessage('')
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

  if (loading && messages.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#006b2c" />
      </View>
    )
  }

  return (
    <View style={s.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
            <Text style={s.headerBtnTxt}>←</Text>
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Avatar uri={friend?.photoUrl} username={friend?.username} size={40} />
            <View>
              <Text style={s.headerName}>{friend?.username}</Text>
              <Text style={s.headerOnline}>Online</Text>
            </View>
          </View>
          <View style={s.headerBtn} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={s.list}
            style={{ backgroundColor: '#0a0a0a' }}
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
                  {/* Avatar spacer */}
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
                      <Text style={[s.timeLabel, isOwn ? s.timeLabelOwn : s.timeLabelTheir]}>
                        {formatTime(new Date(item.createdAt))}{isOwn ? (item.status === 'read' ? ' ✓✓' : ' ✓') : ''}
                      </Text>
                    )}
                  </View>
                </View>
              )
            }}
          />

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
              <Text style={s.sendTxt}>➤</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

      </SafeAreaView>
    </View>
  )
}

function formatTime(date: Date) {
  const h = date.getHours()
  const m = date.getMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m} ${ampm}`
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#111111', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerBtnTxt: { fontSize: 22, color: '#006b2c', fontWeight: '700' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerName: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  headerOnline: { fontSize: 12, fontWeight: '500', color: '#4ade80', marginTop: 1 },
  datePill: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 14, paddingVertical: 4, borderRadius: 999, marginBottom: 16, marginTop: 8 },
  datePillTxt: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.8 },
  list: { paddingHorizontal: 20, paddingBottom: 12 },
  msgGroup: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 3, gap: 8 },
  msgGroupTheir: { justifyContent: 'flex-start' },
  msgGroupOwn: { justifyContent: 'flex-end' },
  avatarCol: { width: 32, alignItems: 'center', justifyContent: 'flex-end', marginBottom: 2 },
  msgCol: { flex: 1, maxWidth: '78%' },
  senderName: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.4)', marginBottom: 3, marginLeft: 2 },
  bubble: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 20, maxWidth: '100%' },
  bubbleTheir: { backgroundColor: 'rgba(255,255,255,0.08)', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  bubbleOwn: { backgroundColor: 'rgba(0,107,44,0.35)', borderBottomRightRadius: 4 },
  bubbleTxt: { fontSize: 15, lineHeight: 22 },
  bubbleTxtTheir: { color: 'rgba(255,255,255,0.9)' },
  bubbleTxtOwn: { color: 'rgba(255,255,255,0.9)' },
  timeLabel: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3 },
  timeLabelTheir: { marginLeft: 2 },
  timeLabelOwn: { marginRight: 2 },
  inputArea: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#0a0a0a', gap: 10 },
  inputPill: { flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 16, paddingVertical: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  input: { fontSize: 15, color: '#ffffff', paddingVertical: 8, maxHeight: 100 },
  sendBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#006b2c', justifyContent: 'center', alignItems: 'center', shadowColor: '#006b2c', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  sendBtnOff: { backgroundColor: 'rgba(0,107,44,0.3)', shadowOpacity: 0 },
  sendTxt: { color: '#fff', fontSize: 18, fontWeight: '700' },
})
