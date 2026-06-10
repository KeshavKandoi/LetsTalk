import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, ActivityIndicator, RefreshControl, Alert, Modal, Image, AppState, BackHandler,
} from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { VideoView, useVideoPlayer } from 'expo-video'
import { useCallback } from 'react'
import QRCode from 'react-native-qrcode-svg'
import ScannerModal from './ScannerModal'
import { apiFetch } from '../lib/api'
import AsyncStorage from '@react-native-async-storage/async-storage'

const FINDER_HINTS = ['By the window', 'Near the counter', 'At the bar', 'Corner table', 'Outside area', 'Near entrance']

interface Profile {
  moodEmoji: string
  intentText: string
  intentSummary: string | null
  status: string
  currentPlaceId: string
  isFindable: boolean
  locationHint: string | null
  pingRequestedAt: string | null
  pingRequestedByUsername: string | null
}
interface CurrentPlace {
  place: { placeId: string; name: string; address: string; readyCount: number }
  readyCount: number
}
interface Participant {
  userId: string
  username: string
  moodEmoji: string
  intentText: string | null
  intentSummary: string | null
  status: string
  isFindable: boolean
  locationHint: string | null
  age: string | null
  gender: string | null
  photoUrl: string | null
}
interface ActiveConnection {
  id: string
  placeId: string
  createdAt: string
  counterpart: {
    userId: string
    username: string
    moodEmoji: string
    intentSummary: string | null
    photoUrl?: string | null
  }
}
interface PendingConnectionRequest {
  id: string
  requesterUserId: string
  recipientUserId: string
  direction: 'incoming' | 'outgoing'
  user: {
    userId: string
    username: string
    moodEmoji: string | null
    intentSummary: string | null
    photoUrl: string | null
  }
}
interface ConnectionEvent {
  id: string
  status: 'accepted' | 'declined'
  direction: 'incoming' | 'outgoing'
  user: {
    userId: string
    username: string
  }
}
interface QrHandoff {
  token: string
  url: string
  isActive: boolean
}
interface PlaceViewState {
  profile: Profile | null
  currentPlace: CurrentPlace | null
  activeConnection: ActiveConnection | null
  qrHandoff: QrHandoff | null
  session: { user: { id: string; name?: string; username?: string } } | null
}


function VideoBackground({ style }: { style: any }) {
  const player = useVideoPlayer(require('../video/animation.mp4'), (p) => {
    p.loop = true
    p.muted = true
    p.play()
  })
  useFocusEffect(
    useCallback(() => {
      try { player.replay() } catch { try { player.play() } catch {} }
    }, [player])
  )
  return (
    <VideoView
      style={style}
      player={player}
      allowsFullscreen={false}
      nativeControls={false}
      contentFit="cover"
    />
  )
}

export default function PlaceViewScreen() {
  const navigation = useNavigation<any>()
  const [state, setState] = useState<PlaceViewState | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [checkedInCount, setCheckedInCount] = useState(0)
  const [activeConversationCount, setActiveConversationCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [togglingReady, setTogglingReady] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [endingConversation, setEndingConversation] = useState(false)
  const [error, setError] = useState('')
  const [qrVisible, setQrVisible] = useState(false)
  const [scannerVisible, setScannerVisible] = useState(false)
  const [qrVerified, setQrVerified] = useState(false)
  const [finderLoading, setFinderLoading] = useState(false)
  const [pendingRequests, setPendingRequests] = useState<PendingConnectionRequest[]>([])
  const [connectionActionId, setConnectionActionId] = useState<string | null>(null)
  const [selectedPerson, setSelectedPerson] = useState<Participant | null>(null)
  const [notice, setNotice] = useState('')
  const [myPhotoUrl, setMyPhotoUrl] = useState<string | null>(null)
  const [myUsername, setMyUsername] = useState<string>('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const photoLoadedRef = useRef(false)
  const seenConnectionEventIdsRef = useRef<Set<string>>(new Set())

  const loadState = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data: PlaceViewState = await apiFetch('/api/places/state', {})
      if (!data.profile?.currentPlaceId) {
        navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] })
        return
      }
      setState(data)
      // Photo will be set from participants list (more accurate)
      if (!myUsername) {
        if (data.session?.user?.username) setMyUsername(data.session.user.username)
        else if (data.session?.user?.name) setMyUsername(data.session.user.name)
      }
      if (data.currentPlace?.place?.placeId) {
        const preview = await apiFetch('/api/places/preview', { placeId: data.currentPlace.place.placeId })
        const allParticipants = preview.participants ?? []
        const nextActiveConnection = data.activeConnection ?? preview.activeConnection ?? null
        setParticipants(allParticipants)
        setPendingRequests(nextActiveConnection ? [] : preview.pendingConnectionRequests ?? [])
        if (nextActiveConnection && !data.activeConnection) {
          setState({ ...data, activeConnection: nextActiveConnection })
        }
        for (const event of (preview.connectionEvents ?? []) as ConnectionEvent[]) {
          if (seenConnectionEventIdsRef.current.has(event.id)) continue
          seenConnectionEventIdsRef.current.add(event.id)
          if (event.status === 'declined') {
            setNotice(`${event.user.username} declined your connection request.`)
          } else if (event.status === 'accepted') {
            setNotice(`You and ${event.user.username} are now connected. QR verification is unlocked.`)
          }
        }
        if (!photoLoadedRef.current) {
          const me = allParticipants.find((p: any) => p.userId === data.session?.user?.id)
          if (me?.photoUrl) {
            photoLoadedRef.current = true
            const photoTs = await AsyncStorage.getItem('photo_ts').catch(() => '1') || '1'
            setMyPhotoUrl(me.photoUrl + '?t=' + photoTs)
          }
        }
        setCheckedInCount(preview.checkedInCount ?? 0)
        setActiveConversationCount(preview.activeConversationCount ?? 0)
      }
      if (data.profile?.pingRequestedAt && data.profile?.pingRequestedByUsername) {
        const pingTime = new Date(data.profile.pingRequestedAt).getTime()
        if (Date.now() - pingTime < 30000) {
          setNotice(`👋 ${data.profile.pingRequestedByUsername} is looking for you nearby!`)
        }
      }
    } catch (e: any) {
      setError(e.message || 'Could not load place.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false })
    loadState()
    pollRef.current = setInterval(() => loadState(true), 3000)
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void loadState(true)
    })
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      subscription.remove()
    }
  }, [])


  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert(
        'Leave Place?',
        'You must leave the place before going back.',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: async () => {
            setLeaving(true)
            try {
              await apiFetch('/api/places/leave', {})
              navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] })
            } catch (e: any) { setError(e.message); setLeaving(false) }
          }},
        ]
      )
      return true
    })
    return () => backHandler.remove()
  }, [])

  const toggleReady = async () => {
    if (!state?.profile) return
    setTogglingReady(true)
    setError('')
    try {
      const isReady = state.profile.status === 'ready'
      await apiFetch('/api/places/ready', { ready: !isReady })
      await loadState(true)
    } catch (e: any) { setError(e.message) }
    finally { setTogglingReady(false) }
  }

  const handleLeave = () => {
    Alert.alert('Leave place', 'Are you sure you want to leave?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: async () => {
        setLeaving(true)
        try {
          await apiFetch('/api/places/leave', {})
          navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] })
        } catch (e: any) { setError(e.message); setLeaving(false) }
      }}
    ])
  }

  const handleEndConversation = async () => {
    setEndingConversation(true)
    setError('')
    try {
      await apiFetch('/api/places/end-connection', {})
      setQrVerified(false)
      setNotice("Conversation ended. You're back in the ready pool.")
      await loadState(true)
    } catch (e: any) { setError(e.message) }
    finally { setEndingConversation(false) }
  }

  const handleFinderToggle = async () => {
    if (!state?.profile) return
    setFinderLoading(true)
    setError('')
    try {
      await apiFetch('/api/places/finder', {
        isFindable: !state.profile.isFindable,
        locationHint: state.profile.locationHint,
      })
      await loadState(true)
    } catch (e: any) { setError(e.message) }
    finally { setFinderLoading(false) }
  }

  const handleSelectHint = async (hint: string) => {
    if (!state?.profile) return
    setFinderLoading(true)
    try {
      await apiFetch('/api/places/finder', {
        isFindable: state.profile.isFindable,
        locationHint: hint,
      })
      await loadState(true)
    } catch (e: any) { setError(e.message) }
    finally { setFinderLoading(false) }
  }

  const handleSendConnectRequest = async (participant: Participant) => {
    setConnectionActionId(participant.userId)
    setError('')
    try {
      await apiFetch('/api/places/connect-request', {
        action: 'send',
        targetUserId: participant.userId,
      })
      setNotice(`Connection request sent to ${participant.username}.`)
      await loadState(true)
    } catch (e: any) { setError(e.message || 'Could not send request.') }
    finally { setConnectionActionId(null) }
  }

  const handleRespondToRequest = async (
    request: PendingConnectionRequest,
    action: 'accept' | 'decline' | 'cancel',
  ) => {
    setConnectionActionId(request.id)
    setError('')
    try {
      await apiFetch('/api/places/connect-request', {
        action,
        requestId: request.id,
      })
      if (action === 'accept') setNotice(`You and ${request.user.username} are now connected. QR verification is unlocked.`)
      else if (action === 'decline') setNotice(`Request from ${request.user.username} declined.`)
      else setNotice(`Request to ${request.user.username} canceled.`)
      await loadState(true)
    } catch (e: any) { setError(e.message || 'Could not update request.') }
    finally { setConnectionActionId(null) }
  }

  const renderAvatar = (p: Participant, size = 52) => {
    const initials = (p.username || '?').slice(0, 2).toUpperCase()
    return p.photoUrl
      ? <Image source={{ uri: p.photoUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      : <View style={[s.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={s.avatarInitials}>{initials}</Text>
        </View>
  }

  const renderConnectionAvatar = (
    person: { username: string; photoUrl?: string | null },
    size = 52,
  ) => {
    const initials = (person.username || '?').slice(0, 2).toUpperCase()
    return person.photoUrl
      ? <Image source={{ uri: person.photoUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      : <View style={[s.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={s.avatarInitials}>{initials}</Text>
        </View>
  }

  if (loading) return (
    <SafeAreaView style={s.container}>
      <VideoBackground style={s.videoBackground} />
      <View style={s.overlay} />
      <View style={s.centered}><ActivityIndicator size="large" color="#000000" /></View>
    </SafeAreaView>
  )

  if (!state?.profile || !state.currentPlace) return (
    <SafeAreaView style={s.container}>
      
      <View style={s.overlay} />
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#000000" />
        <Text style={{ color: '#ffffff', marginTop: 12, fontSize: 14 }}>Loading place...</Text>
      </View>
    </SafeAreaView>
  )

  const { profile, currentPlace, activeConnection, qrHandoff } = state
  const isReady = profile.status === 'ready'
  const isInConversation = profile.status === 'in_conversation'
  const myUserId = state.session?.user.id
  const myDisplayName = myUsername || state.session?.user.username || state.session?.user.name || 'You'
  const availableParticipants = participants.filter((p) => p.status !== 'in_conversation')
  const incomingRequests = pendingRequests.filter((request) => request.direction === 'incoming')
  const requestByUserId = new Map(pendingRequests.map((request) => [request.user.userId, request]))
  const currentParticipant = participants.find((p) => p.userId === myUserId)

  return (
    <SafeAreaView style={s.container}>
      <VideoBackground style={s.videoBackground} />
      <View style={s.overlay} />
      <View style={s.header}>
        <TouchableOpacity style={s.leaveBtn} onPress={handleLeave} disabled={leaving}>
          {leaving ? <ActivityIndicator color="#dc2626" size="small" /> : <Text style={s.leaveText}>Leave Place</Text>}
        </TouchableOpacity>
        <Text style={s.logo}>Let's Talk</Text>
        <View style={{ width: 90 }} />
      </View>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadState() }} tintColor="#ffffff" />}
      >

        {error ? <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View> : null}
        {notice ? (
          <TouchableOpacity style={s.noticeBox} onPress={() => setNotice('')}>
            <Text style={s.noticeText}>{notice}</Text>
            <Text style={s.noticeDismiss}>Tap to dismiss</Text>
          </TouchableOpacity>
        ) : null}

        {/* Connected User */}
        {activeConnection && (
          <View style={s.connectionBanner}>
            <Text style={s.connectedSectionTitle}>Connected User</Text>
            <View style={s.connectedPeopleRow}>
              <View style={s.connectedPerson}>
                {renderConnectionAvatar({
                  username: myDisplayName,
                  photoUrl: myPhotoUrl || state?.profile?.photoUrl || currentParticipant?.photoUrl,
                }, 58)}
                <Text style={s.connectedName} numberOfLines={1}>{myDisplayName}</Text>
                <Text style={s.connectedMood} numberOfLines={2}></Text>
              </View>
              <Text style={s.connectedLink}>↔</Text>
              <View style={s.connectedPerson}>
                {renderConnectionAvatar(activeConnection.counterpart, 58)}
                <Text style={s.connectedName} numberOfLines={1}>{activeConnection.counterpart.username}</Text>
                <Text style={s.connectedMood} numberOfLines={2}></Text>
              </View>
            </View>
            {qrVerified ? (
              <View style={s.qrVerifiedBox}>
                <Text style={s.qrVerifiedText}>✓ Connected & Verified</Text>
              </View>
            ) : (
              <View style={s.qrBtnRow}>
                <TouchableOpacity style={[s.unlockQrBtn, { flex: 1, marginRight: 8 }]} onPress={() => setQrVisible(true)}>
                  <Text style={s.unlockQrBtnText}>Show My QR</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.scanQrBtn, { flex: 1 }]} onPress={() => setScannerVisible(true)}>
                  <Text style={s.scanQrBtnText}>Scan QR</Text>
                </TouchableOpacity>
              </View>
            )}
            <Text style={s.connectionHint}>You are connected. New requests are paused until this conversation ends.</Text>
            <TouchableOpacity style={s.endBtn} onPress={handleEndConversation} disabled={endingConversation}>
              {endingConversation ? <ActivityIndicator color="white" /> : <Text style={s.endBtnText}>I'm free again</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Place Card */}
        <View style={s.placeCard}>
          <View style={s.livePill}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>Live Place</Text>
          </View>
          <Text style={s.placeName}>{currentPlace.place.name}</Text>
          <Text style={s.placeAddress}>{currentPlace.place.address}</Text>
          <View style={s.divider} />
          <View style={s.statsRow}>
            <View style={s.statBox}>
              <Text style={s.statValueGreen}>{currentPlace.readyCount}</Text>
              <Text style={s.statLabel}>Available</Text>
            </View>
            <View style={[s.statBox, s.statBorderX]}>
              <Text style={s.statValueDark}>{checkedInCount}</Text>
              <Text style={s.statLabel}>Here Now</Text>
            </View>
            <View style={s.statBox}>
              <Text style={s.statValueSecondary}>{activeConversationCount}</Text>
              <Text style={s.statLabel}>Talking</Text>
            </View>
          </View>
        </View>

        {/* Your Status */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Your Status</Text>
          <Text style={s.cardHint}>
            {isInConversation
              ? `You're talking with ${activeConnection?.counterpart.username ?? 'someone'}.`
              : isReady
              ? "You're visible in the ready count for this place."
              : "When you're ready people nearby can discover and connect with you."}
          </Text>
          {!isInConversation && (
            <TouchableOpacity
              style={[s.primaryBtn, isReady && s.primaryBtnOutline]}
              onPress={toggleReady}
              disabled={togglingReady}
            >
              {togglingReady
                ? <ActivityIndicator color={isReady ? '#ffffff' : 'white'} />
                : <Text style={[s.primaryBtnText, isReady && s.primaryBtnTextOutline]}>
                    {isReady ? '✓ Leave ready pool' : '👋 Set me ready'}
                  </Text>}
            </TouchableOpacity>
          )}
        </View>



        {/* People Nearby */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>People Nearby</Text>
          {incomingRequests.length > 0 && !activeConnection ? (
            <View style={s.requestsBox}>
              <Text style={s.requestsTitle}>Incoming Requests</Text>
              {incomingRequests.map((request) => (
                <View key={request.id} style={s.requestRow}>
                  {renderConnectionAvatar(request.user, 44)}
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={s.requestName}>{request.user.username}</Text>
                    <Text style={s.requestMood} numberOfLines={1}>{request.user.intentSummary || ''}</Text>
                  </View>
                  <TouchableOpacity
                    style={s.acceptBtn}
                    onPress={() => handleRespondToRequest(request, 'accept')}
                    disabled={connectionActionId === request.id}
                  >
                    <Text style={s.acceptBtnText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.declineBtn}
                    onPress={() => handleRespondToRequest(request, 'decline')}
                    disabled={connectionActionId === request.id}
                  >
                    <Text style={s.declineBtnText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}
          {availableParticipants.length > 0
            ? availableParticipants.map((p) => {
                const request = requestByUserId.get(p.userId)
                const isMe = myUserId === p.userId
                const isConnectedPerson = activeConnection?.counterpart.userId === p.userId
                const actionLoading = connectionActionId === p.userId || (request && connectionActionId === request.id)
                const canSendConnectRequest = isReady && !activeConnection && p.status === 'ready'
                return (
                <View key={p.userId} style={s.personCard}>
                  <View style={s.personCardTop}>
                    {renderAvatar(p, 56)}
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={s.personNameRow}>
                        <Text style={s.personName}>{p.username}</Text>
                        {isMe && (
                          <View style={s.youBadge}><Text style={s.youBadgeText}>You</Text></View>
                        )}
                        <View style={[s.statusBadge, p.status === 'ready' && s.statusBadgeActive]}>
                          <Text style={[s.statusBadgeText, p.status === 'ready' && s.statusBadgeTextActive]}>
                            {p.status === 'ready' ? 'Open to Talk' : 'Browsing'}
                          </Text>
                        </View>
                      </View>
                      
                      {p.isFindable && p.locationHint ? (
                        <Text style={s.locationHint}>📍 Near {p.locationHint.toLowerCase()}</Text>
                      ) : null}
                    </View>
                  </View>
                  {!isMe && (
                    <View style={s.personBtns}>
                      <TouchableOpacity style={s.viewProfileBtn} onPress={() => setSelectedPerson(p)}>
                        <Text style={s.viewProfileBtnText}>View Profile</Text>
                      </TouchableOpacity>
                      <View style={s.personActionColumn}>
                        {isConnectedPerson ? (
                          <View style={[s.connectBtn, s.personActionButton, s.connectedBtn]}>
                            <Text style={s.connectBtnText}>✓ Connected</Text>
                          </View>
                        ) : request?.direction === 'outgoing' ? (
                          <TouchableOpacity
                            style={[s.connectBtn, s.personActionButton, s.cancelRequestBtn]}
                            onPress={() => handleRespondToRequest(request, 'cancel')}
                            disabled={Boolean(actionLoading)}
                          >
                            {actionLoading
                              ? <ActivityIndicator size="small" color={'#ffffff'} />
                              : <Text style={s.cancelRequestBtnText}>Cancel Request</Text>}
                          </TouchableOpacity>
                        ) : request?.direction === 'incoming' ? (
                          <TouchableOpacity
                            style={[s.connectBtn, s.personActionButton]}
                            onPress={() => handleRespondToRequest(request, 'accept')}
                            disabled={Boolean(actionLoading)}
                          >
                            {actionLoading
                              ? <ActivityIndicator size="small" color="white" />
                              : <Text style={s.connectBtnText}>Accept</Text>}
                          </TouchableOpacity>
                        ) : canSendConnectRequest ? (
                          <TouchableOpacity
                            style={[s.connectBtn, s.personActionButton]}
                            onPress={() => handleSendConnectRequest(p)}
                            disabled={Boolean(actionLoading)}
                          >
                            {actionLoading
                              ? <ActivityIndicator size="small" color="white" />
                              : <Text style={s.connectBtnText}>Connect</Text>}
                          </TouchableOpacity>
                        ) : (
                          <>
                            <View style={[s.connectBtn, s.personActionButton, s.connectBtnDisabled]}>
                              <Text style={s.connectBtnTextDisabled}>Connect</Text>
                            </View>
                            {!isReady && !activeConnection ? (
                              <Text style={s.connectDisabledHint}>Set yourself ready to connect</Text>
                            ) : null}
                          </>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              )})
            : (
              <View style={s.emptyPeople}>
                <Text style={s.emptyEmoji}>👀</Text>
                <Text style={s.emptyTitle}>No one ready yet</Text>
                <Text style={s.emptyText}>Mark yourself ready and wait for others.</Text>
              </View>
            )}
        </View>

        {/* Help Someone Find You */}
        <View style={s.finderCard}>
          <Text style={s.cardTitle}>Help Someone Find You</Text>
          <Text style={s.cardHint}>Sharing your spot makes it easier for people to walk up and say hi!</Text>
          <View style={s.hintRow}>
            {FINDER_HINTS.map((hint) => (
              <TouchableOpacity
                key={hint}
                style={[s.hintChip, profile.locationHint === hint && s.hintChipActive]}
                onPress={() => handleSelectHint(hint)}
                disabled={finderLoading || (!isReady && !profile.isFindable) || isInConversation}
              >
                <Text style={[s.hintChipText, profile.locationHint === hint && s.hintChipTextActive]}>{hint}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[s.primaryBtn, profile.isFindable && s.primaryBtnOutline]}
            onPress={handleFinderToggle}
            disabled={finderLoading || !isReady || isInConversation}
          >
            {finderLoading
              ? <ActivityIndicator color="white" />
              : <Text style={[s.primaryBtnText, profile.isFindable && s.primaryBtnTextOutline]}>
                  {profile.isFindable ? 'Stop sharing my spot' : 'Share My Spot'}
                </Text>}
          </TouchableOpacity>
        </View>


      </ScrollView>

      {/* QR Fullscreen Modal */}
      <Modal visible={qrVisible} transparent animationType="fade" onRequestClose={() => setQrVisible(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setQrVisible(false)}>
          <View style={s.qrModal}>
            <Text style={s.qrModalTitle}>Your QR Code</Text>
            {qrHandoff && <View style={s.qrModalCode}><QRCode value={qrHandoff.url} size={240} backgroundColor="white" color="#000000" /></View>}
            <Text style={s.qrModalHint}>
              {activeConnection
                ? `Show this to ${activeConnection.counterpart.username} to verify your connection.`
                : isReady
                ? 'Live - people can scan this'
                : 'Set yourself ready to activate'}
            </Text>
            <TouchableOpacity style={[s.primaryBtn, { backgroundColor: "#000000", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", width: "100%", paddingVertical: 16 }]} onPress={() => setQrVisible(false)}>
              <Text style={[s.primaryBtnText, { color: "#ffffff", fontSize: 16 }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Scanner Modal */}
      {scannerVisible && (
        <ScannerModal
          onClose={() => setScannerVisible(false)}
          onConnected={async (message) => {
            setScannerVisible(false)
            setQrVerified(true)
            setNotice(message)
            await loadState(true)
          }}
        />
      )}

      {/* Person Profile Modal */}
      <Modal visible={!!selectedPerson} transparent animationType="slide" onRequestClose={() => setSelectedPerson(null)}>
        <TouchableOpacity style={s.personOverlay} activeOpacity={1} onPress={() => setSelectedPerson(null)}>
          <TouchableOpacity activeOpacity={1} style={s.personSheet}>
            <View style={s.personHandle} />
            {selectedPerson ? (
              <>
                {/* Avatar centered with orange ring */}
                <View style={{ alignItems: 'center', marginBottom: 14 }}>
                  <View style={s.personAvatarRing}>
                    {selectedPerson.photoUrl
                      ? <Image source={{ uri: selectedPerson.photoUrl }} style={s.personAvatarLarge} />
                      : <View style={[s.personAvatarLarge, { backgroundColor: 'rgba(232,130,74,0.15)', justifyContent: 'center', alignItems: 'center' }]}>
                          <Text style={{ fontSize: 36, fontWeight: '800', color: '#fff' }}>{(selectedPerson.username || '?').slice(0,2).toUpperCase()}</Text>
                        </View>
                    }
                  </View>
                  <Text style={s.personModalName}>{selectedPerson.username}</Text>
                  {/* Badges row */}
                  <View style={s.personTags}>
                    {selectedPerson.gender ? <Text style={s.personTag}>{selectedPerson.gender}</Text> : null}
                    {selectedPerson.age ? <Text style={s.personTag}>{selectedPerson.age}</Text> : null}

                  </View>
                </View>
                {/* Current Status card */}
                {(selectedPerson.intentText || selectedPerson.intentSummary) ? (
                  <View style={s.personStatusCard}>
                    <View style={s.personStatusCardIcon}>
                      <Text style={{ fontSize: 18 }}>💬</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.personStatusCardLabel}>MY VIBE</Text>
                      <Text style={s.personStatusCardText}>{selectedPerson.intentText || selectedPerson.intentSummary}</Text>
                    </View>
                  </View>
                ) : null}
                {/* Hint */}
                {state.session?.user.id !== selectedPerson.userId && (
                  <Text style={s.personHint}>Scan their QR code to send a friend request.</Text>
                )}
              </>
            ) : null}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}

const GREEN = '#ffffff'
const AMBER = '#e8824a'
const AMBER_LIGHT = 'rgba(232,130,74,0.7)'
const GREEN_DARK = '#1a1a1a'
const GREEN_MID = '#2d6e3e'
const BG = '#0a0704'

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0704' },
  videoBackground: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  overlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.65)' },
  scroll: { padding: 20, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 36 },
  logo: { fontSize: 24, fontWeight: '900', color: '#c084fc', letterSpacing: -0.5, textAlign: 'center' },
  leaveBtn: { backgroundColor: 'rgba(220,38,38,0.12)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(220,38,38,0.3)', marginLeft: 16 },
  leaveText: { color: '#ffffff', fontWeight: '600', fontSize: 13 },

  // Alerts
  errorBox: { backgroundColor: 'rgba(186,26,26,0.15)', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(186,26,26,0.3)' },
  errorText: { color: '#ff6b6b', fontSize: 13 },
  noticeBox: { backgroundColor: 'rgba(232,130,74,0.1)', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(232,130,74,0.2)' },
  noticeText: { color: '#FFD700', fontSize: 14, fontWeight: '600' },
  noticeDismiss: { color: 'rgba(255,215,0,0.7)', fontSize: 11, marginTop: 4 },

  // Connection Banner
  connectionBanner: { backgroundColor: 'rgba(0,107,44,0.1)', borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(232,130,74,0.2)' },
  connectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  connectionEmoji: { fontSize: 28 },
  connectionTitle: { fontSize: 15, fontWeight: '700', color: '#ffffff', marginBottom: 3 },
  connectionMood: { fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 18 },
  connectionHint: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 12 },
  connectedSectionTitle: { fontSize: 17, fontWeight: '800', color: '#fff', marginBottom: 12 },
  connectedPeopleRow: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 14 },
  connectedPerson: { flex: 1, backgroundColor: 'rgba(26,16,8,0.75)', borderRadius: 16, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(232,130,74,0.2)' },
  connectedLink: { width: 34, textAlign: 'center', alignSelf: 'center', color: '#ffffff', fontSize: 20, fontWeight: '800' },
  connectedName: { marginTop: 8, fontSize: 14, fontWeight: '800', color: '#ffffff', maxWidth: '100%' },
  connectedMood: { marginTop: 4, fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 16, textAlign: 'center' },
  qrVerifiedBox: { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,200,0,0.4)' },
  qrVerifiedText: { color: '#FFD700', fontWeight: '800', fontSize: 16 },
  qrBtnRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  scanQrBtn: { backgroundColor: '#000000', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  scanQrBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  unlockQrBtn: { backgroundColor: '#000000', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', marginBottom: 0, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  unlockQrBtnText: { color: 'white', fontWeight: '800', fontSize: 15 },
  endBtn: { backgroundColor: '#000000', borderRadius: 50, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  endBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },

  // Place Card
  placeCard: { backgroundColor: 'rgba(26,16,8,0.75)', borderRadius: 24, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,135,58,0.12)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 10 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#00873a' },
  liveText: { fontSize: 11, color: '#00873a', fontWeight: '700', letterSpacing: 0.5 },
  placeName: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 4 },
  placeAddress: { fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 17, marginBottom: 14 },
  divider: { height: 1, backgroundColor: 'rgba(0,107,44,0.1)', marginBottom: 14 },
  statsRow: { flexDirection: 'row' },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  statBorderX: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(232,130,74,0.15)' },
  statValueGreen: { fontSize: 22, fontWeight: '900', color: AMBER },
  statValueDark: { fontSize: 22, fontWeight: '900', color: AMBER },
  statValueSecondary: { fontSize: 22, fontWeight: '900', color: AMBER },
  statLabel: { fontSize: 11, color: AMBER_LIGHT, fontWeight: '600', marginTop: 2 },

  // Cards
  card: { backgroundColor: 'rgba(26,16,8,0.75)', borderRadius: 24, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 6 },
  cardHint: { fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 19, marginBottom: 14 },
  cardLabelSmall: { fontSize: 11, fontWeight: '700', color: '#6e7b6c', letterSpacing: 1.2, marginBottom: 12 },

  // Profile Preview
  profilePreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,107,44,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: GREEN },
  profileAvatarEmoji: { fontSize: 26 },
  profilePreviewName: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  profilePreviewMood: { fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 18 },

  // Buttons
  primaryBtn: { backgroundColor: AMBER, borderRadius: 50, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  primaryBtnOutline: { backgroundColor: '#1a1a1a', borderWidth: 2, borderColor: AMBER },
  primaryBtnText: { color: '#0a0704', fontWeight: '800', fontSize: 15 },
  primaryBtnTextOutline: { color: '#ffffff' },

  // People Section
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 12, paddingHorizontal: 2 },
  requestsBox: { backgroundColor: 'rgba(0,107,44,0.08)', borderRadius: 20, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(232,130,74,0.2)' },
  requestsTitle: { fontSize: 14, fontWeight: '800', color: '#ffffff', marginBottom: 10 },
  requestRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(26,16,8,0.75)', borderRadius: 16, padding: 10, marginBottom: 8 },
  requestName: { fontSize: 14, fontWeight: '800', color: '#ffffff' },
  requestMood: { fontSize: 12, color: '#ffffff', marginTop: 2 },
  acceptBtn: { backgroundColor: '#1a1a1a', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, marginLeft: 6, borderWidth: 1, borderColor: AMBER },
  acceptBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  declineBtn: { backgroundColor: '#1a1a1a', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, marginLeft: 6, borderWidth: 1, borderColor: 'rgba(220,38,38,0.5)' },
  declineBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  personCard: { backgroundColor: 'rgba(26,16,8,0.75)', borderRadius: 24, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 1, borderWidth: 1, borderColor: 'rgba(232,130,74,0.12)' },
  personCardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  avatarPlaceholder: { backgroundColor: 'rgba(0,107,44,0.12)', justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { color: '#ffffff', fontWeight: '800', fontSize: 18 },
  personNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' },
  personName: { fontSize: 17, fontWeight: '900', color: '#ffffff' },
  youBadge: { backgroundColor: 'rgba(37,99,235,0.6)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  youBadgeText: { fontSize: 10, color: 'white', fontWeight: '700' },
  statusBadge: { backgroundColor: AMBER, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeActive: { backgroundColor: AMBER },
  statusBadgeText: { fontSize: 11, color: '#0a0704', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  statusBadgeTextActive: { color: '#0a0704' },
  personMood: { fontSize: 13, color: '#ffffff', lineHeight: 18 },
  locationHint: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginTop: 3 },
  personBtns: { flexDirection: 'row', gap: 8 },
  viewProfileBtn: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', alignSelf: 'flex-start' },
  viewProfileBtnText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  personActionColumn: { flex: 1, alignItems: 'stretch' },
  personActionButton: { flex: 0, width: '100%' },
  connectBtn: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#2563eb', alignItems: 'center', alignSelf: 'flex-end', shadowColor: '#2563eb', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  connectBtnDisabled: { backgroundColor: 'rgba(37,99,235,0.5)', shadowOpacity: 0 },
  connectDisabledHint: { marginTop: 5, color: '#ffffff', fontSize: 11, fontWeight: '600', textAlign: 'center', lineHeight: 14 },
  cancelRequestBtn: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: AMBER, shadowOpacity: 0 },
  cancelRequestBtnText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  connectedBtn: { backgroundColor: '#0f3320', shadowOpacity: 0 },
  connectBtnText: { fontSize: 14, fontWeight: '700', color: 'white' },
  connectBtnTextDisabled: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  emptyPeople: { backgroundColor: 'rgba(26,16,8,0.75)', borderRadius: 24, padding: 28, alignItems: 'center', gap: 6 },
  emptyEmoji: { fontSize: 32 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  emptyText: { fontSize: 13, color: '#6e7b6c', textAlign: 'center' },

  // Finder
  finderCard: { backgroundColor: 'rgba(130,245,193,0.15)', borderRadius: 24, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(130,245,193,0.5)' },
  hintRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  hintChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(232,130,74,0.2)', backgroundColor: '#1a1a1a' },
  hintChipActive: { backgroundColor: GREEN, borderColor: GREEN },
  hintChipText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  hintChipTextActive: { color: 'white' },

  // QR
  qrContainer: { alignItems: 'center', paddingVertical: 12 },
  qrWrapper: { padding: 14, backgroundColor: 'rgba(26,16,8,0.75)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(232,130,74,0.2)', marginBottom: 10 },
  qrWrapperDim: { opacity: 0.35 },
  qrInactive: { opacity: 0.4 },
  qrStatus: { backgroundColor: 'rgba(148,163,184,0.15)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 6 },
  qrStatusActive: { backgroundColor: 'rgba(0,107,44,0.1)' },
  qrStatusText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  qrStatusTextActive: { color: '#ffffff' },
  qrTap: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  qrPlaceholder: { height: 100, justifyContent: 'center', alignItems: 'center' },
  qrPlaceholderText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  qrLocked: { minHeight: 132, borderRadius: 20, backgroundColor: 'rgba(148,163,184,0.12)', borderWidth: 1, borderColor: 'rgba(100,116,139,0.2)', justifyContent: 'center', alignItems: 'center', padding: 18 },
  qrLockIcon: { fontSize: 28, marginBottom: 8 },
  qrLockedTitle: { color: '#64748b', fontSize: 14, fontWeight: '800', textAlign: 'center', lineHeight: 20 },

  // Scan
  scanBtn: { backgroundColor: GREEN, borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginBottom: 8, shadowColor: GREEN, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  scanBtnDisabled: { opacity: 0.5 },
  scanBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,51,32,0.6)', justifyContent: 'center', alignItems: 'center' },
  qrModal: { backgroundColor: '#1a1a1a', borderRadius: 28, padding: 28, alignItems: 'center', width: '85%' },
  qrModalTitle: { fontSize: 18, fontWeight: '800', color: '#ffffff', marginBottom: 20 },
  qrModalCode: { padding: 16, backgroundColor: 'rgba(26,16,8,0.75)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(232,130,74,0.2)', marginBottom: 16 },
  qrModalHint: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 20, textAlign: 'center' },
  personOverlay: { flex: 1, backgroundColor: 'rgba(15,51,32,0.45)', justifyContent: 'flex-end' },
  personAvatarRing: { width: 120, height: 120, borderRadius: 60, padding: 3, backgroundColor: '#e8824a', marginBottom: 14, shadowColor: '#e8824a', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  personAvatarLarge: { width: '100%', height: '100%', borderRadius: 60, borderWidth: 3, borderColor: '#0a0704' },
  personStatusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(232,130,74,0.15)', borderWidth: 1, borderColor: 'rgba(232,130,74,0.4)' },
  personStatusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#e8824a' },
  personStatusPillText: { fontSize: 12, fontWeight: '700', color: '#e8824a' },
  personStatusCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 14, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: '#e8824a', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  personStatusCardIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(232,130,74,0.12)', justifyContent: 'center', alignItems: 'center' },
  personStatusCardLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(232,130,74,0.8)', letterSpacing: 1.5, marginBottom: 4 },
  personStatusCardText: { fontSize: 16, fontWeight: '500', color: '#ffffff', lineHeight: 22 },
  personSheet: { minHeight: '48%', backgroundColor: BG, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, paddingBottom: 40 },
  personHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,107,44,0.25)', alignSelf: 'center', marginBottom: 18 },
  personTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  personModalName: { fontSize: 22, fontWeight: '900', color: '#ffffff', marginBottom: 8 },
  personTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  personTag: { backgroundColor: '#FFD700', color: '#000000', fontWeight: '800', fontSize: 14, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, overflow: 'hidden' },
  personModalMood: { fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 22, marginBottom: 18 },
  personHint: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
})
