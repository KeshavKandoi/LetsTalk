import { useEffect, useState, useRef } from 'react'
import {
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import { apiFetch } from '../lib/api'

export default function ConversationScreen() {
  const route = useRoute()
  const navigation = useNavigation()
  const { friend } = route.params || {}

  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [friendIsOnline, setFriendIsOnline] = useState(false)
  const [friendLastSeen, setFriendLastSeen] = useState(null)
  const typingTimeoutRef = useRef(null)
  const messageListRef = useRef(null)

  // Load messages
  const loadMessages = async () => {
    if (!friend) return
    try {
      setLoading(true)
      const data = await apiFetch('/api/friends/messages', {
        action: 'list',
        friendUserId: friend.userId,
      })
      setMessages(data?.messages || [])
      
      // Mark all unread messages as read
      if (data && Array.isArray(data)) {
        data.forEach(msg => {
          if (msg.status !== 'read') {
            markMessageAsRead(msg.id)
          }
        })
      }
    } catch (e) {
      Alert.alert('Error', (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // Check friend online status
  const checkFriendStatus = async () => {
    if (!friend) return
    try {
      const status = await apiFetch('/api/friends/online-status', {
        userId: friend.userId,
      })
      setFriendIsOnline(status.isOnline)
      setFriendLastSeen(status.lastSeenAt)
    } catch (e) {
      console.error('Error checking status:', e)
    }
  }

  // Mark message as read
  const markMessageAsRead = async (messageId: string) => {
    try {
      await apiFetch('/api/friends/message-status', {
        messageId,
        action: 'read',
      })
    } catch (e) {
      console.error('Error marking read:', e)
    }
  }

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !friend) return

    try {
      setSending(true)
      const result = await apiFetch('/api/friends/messages', {
        action: 'send',
        friendUserId: friend.userId,
        body: newMessage.trim(),
      })

      if (result.success) {
        setNewMessage('')
        // Refresh messages
        await loadMessages()
        // Scroll to bottom
        setTimeout(() => {
          messageListRef.current?.scrollToEnd({ animated: true })
        }, 100)
      }
    } catch (e) {
      Alert.alert('Error', (e as Error).message)
    } finally {
      setSending(false)
    }
  }

  // Handle typing
  const handleTyping = () => {
    // Cancel previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    
    setIsTyping(true)

    // Reset typing after 2 seconds of no input
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
    }, 2000)
  }

  useEffect(() => {
    loadMessages()
    checkFriendStatus()

    // Set up navigation header with friend info
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerTitle}>
          <View style={styles.headerLeft}>
            {friend?.photoUrl ? (
              <Image
                source={{ uri: friend.photoUrl }}
                style={styles.headerProfilePic}
              />
            ) : (
              <View style={styles.headerProfilePicPlaceholder}>
                <Text style={styles.placeholderText}>
                  {friend?.username?.[0]?.toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.headerInfo}>
              <Text style={styles.headerName}>{friend?.username}</Text>
              <Text style={styles.headerStatus}>
                {friendIsOnline ? (
                  <Text style={styles.onlineText}>● Online</Text>
                ) : friendLastSeen ? (
                  <Text style={styles.lastSeenText}>
                    Last seen {formatTime(new Date(friendLastSeen))}
                  </Text>
                ) : (
                  <Text style={styles.lastSeenText}>Offline</Text>
                )}
              </Text>
            </View>
          </View>
        </View>
      ),
    })

    // Auto-refresh messages every 3 seconds
    const interval = setInterval(() => {
      loadMessages()
      checkFriendStatus()
    }, 3000)

    return () => {
      clearInterval(interval)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [friend])

  if (loading && messages.length === 0 && !friend) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#075E54" />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={100}
    >
      <SafeAreaView style={styles.container}>
        <FlatList
          ref={messageListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => {
            const isOwn = item.senderUserId === friend?.userId ? false : true
            const prevMsg = index > 0 ? messages[index - 1] : null
            const showTimestamp =
              !prevMsg ||
              new Date(item.createdAt).getTime() -
                new Date(prevMsg.createdAt).getTime() >
                5 * 60 * 1000 // 5 minutes

            return (
              <View key={item.id}>
                {showTimestamp && (
                  <Text style={styles.timestamp}>
                    {formatDateSeparator(new Date(item.createdAt))}
                  </Text>
                )}
                <View
                  style={[
                    styles.messageRow,
                    isOwn ? styles.ownMessage : styles.theirMessage,
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      isOwn
                        ? styles.ownBubble
                        : styles.theirBubble,
                    ]}
                  >
                    <Text style={isOwn ? styles.ownText : styles.theirText}>
                      {item.body}
                    </Text>
                    <View style={styles.messageFooter}>
                      <Text
                        style={[
                          styles.messageTime,
                          isOwn ? styles.ownTime : styles.theirTime,
                        ]}
                      >
                        {formatTime(new Date(item.createdAt))}
                      </Text>
                      {isOwn && (
                        <Text
                          style={[
                            styles.statusIcon,
                            item.status === 'read'
                              ? styles.readIcon
                              : item.status === 'delivered'
                                ? styles.deliveredIcon
                                : styles.sentIcon,
                          ]}
                        >
                          {item.status === 'read'
                            ? '✓✓'
                            : item.status === 'delivered'
                              ? '✓✓'
                              : '✓'}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            )
          }}
          onEndReached={() => {
            if (messages.length > 0) {
              messageListRef.current?.scrollToEnd({ animated: true })
            }
          }}
          scrollEnabled={true}
          contentContainerStyle={styles.messageList}
        />

        {isTyping && (
          <View style={styles.typingIndicator}>
            <Text style={styles.typingText}>
              {friend?.username} is typing
            </Text>
            <View style={styles.typingDots}>
              <View style={styles.dot} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>
          </View>
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            value={newMessage}
            onChangeText={(text) => {
              setNewMessage(text)
              handleTyping()
            }}
            editable={!sending}
            placeholderTextColor="#999"
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!newMessage.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            <Text style={styles.sendButtonText}>
              {sending ? '...' : '➤'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  )
}

function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

function formatDateSeparator(date: Date): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  headerProfilePic: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  headerProfilePicPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  placeholderText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  headerStatus: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  onlineText: {
    color: '#075E54',
    fontWeight: '600',
  },
  lastSeenText: {
    color: '#999',
  },
  messageList: {
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  messageRow: {
    marginVertical: 5,
    flexDirection: 'row',
  },
  ownMessage: {
    justifyContent: 'flex-end',
  },
  theirMessage: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    maxWidth: '80%',
  },
  ownBubble: {
    backgroundColor: '#DCF8C6',
  },
  theirBubble: {
    backgroundColor: '#E5E5EA',
  },
  ownText: {
    color: '#000',
    fontSize: 16,
  },
  theirText: {
    color: '#000',
    fontSize: 16,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
    marginRight: 4,
  },
  ownTime: {
    color: '#666',
  },
  theirTime: {
    color: '#999',
  },
  statusIcon: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  sentIcon: {
    color: '#999',
  },
  deliveredIcon: {
    color: '#999',
  },
  readIcon: {
    color: '#0084FF',
  },
  timestamp: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginVertical: 10,
    fontStyle: 'italic',
  },
  typingIndicator: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingText: {
    fontSize: 13,
    color: '#666',
    marginRight: 8,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#999',
    marginHorizontal: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    marginLeft: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#075E54',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
})
