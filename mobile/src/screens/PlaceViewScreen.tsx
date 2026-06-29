import { useEffect, useRef, useState, useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, RefreshControl, Alert, Modal, Image, AppState, BackHandler, TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import * as Location from 'expo-location'
import QRCode from 'react-native-qrcode-svg'
import ScannerModal from './ScannerModal'
import { apiFetch } from '../lib/api'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { MaterialIcons } from '@expo/vector-icons'

const FINDER_HINTS = ['By the window', 'Near the counter', 'At the bar', 'Corner table', 'Outside area', 'Near entrance']
const GPS_LIMIT_METERS = 200
const AMBER = '#e8824a'
const AMBER_LIGHT = 'rgba(232,130,74,0.7)'

function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const toRad = (value: number) => (value * Math.PI) / 180
  const earthRadiusMeters = 6371000
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(h))
}

interface Profile {
  moodEmoji: string
  intentText: string
  intentSummary: string | null
  status: string
  currentPlaceId: string
  isFindable: boolean
  isVerifiedOnSite: boolean
  locationHint: string | null
  pingRequestedAt: string | null
  pingRequestedByUsername: string | null
  photoUrl?: string | null
}
interface CurrentPlace {
  place: { placeId: string; name: string; address: string; readyCount: number; lat?: number; lng?: number; latitude?: number | null; longitude?: number | null }
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
  isVerifiedOnSite: boolean
  locationHint: string | null
  photoUrl?: string | null
  updatedAt?: string
  gender?: string
  age?: string
  about?: string
}
interface ActiveConnection {
  counterpart: { userId: string; username: string; photoUrl?: string | null; spotLabel?: string | null; intentText?: string | null }
}
interface QrHandoff { url: string }
interface PendingConnectionRequest {
  id: string
  direction: 'incoming' | 'outgoing'
  user: { userId: string; username: string; photoUrl?: string | null; intentSummary?: string | null }
}
interface ConnectionEvent {
  id: string
  status: string
  user: { username: string }
  message?: string
}
interface PlaceViewState {
  profile: Profile | null
  currentPlace: CurrentPlace | null
  activeConnection: ActiveConnection | null
  qrHandoff: QrHandoff | null
  session: { user: { id: string; name?: string; username?: string } } | null
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
  const [customSpot, setCustomSpot] = useState('')
  const [selectedHint, setSelectedHint] = useState<string | null>(null)
  const [myUsername, setMyUsername] = useState<string>('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const gpsVerifyRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const photoLoadedRef = useRef(false)
  const seenConnectionEventIdsRef = useRef<Set<string>>(new Set())

  const getCurrentGpsLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') throw new Error('Location permission denied.')
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
    return { latitude: position.coords.latitude, longitude: position.coords.longitude }
  }

  const getCurrentPlaceLocation = () => {
    const place = state?.currentPlace?.place
    const latitude = place?.latitude ?? place?.lat
    const longitude = place?.longitude ?? place?.lng
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
    return { latitude: latitude as number, longitude: longitude as number }
  }

  const verifyCurrentGpsLocation = async (silent = false) => {
    if (!state?.profile || !['ready', 'in_conversation'].includes(state.profile.status)) return
    const currentPlaceLocation = getCurrentPlaceLocation()
    if (!currentPlaceLocation) return
    const currentLocation = await getCurrentGpsLocation()
    if (distanceMeters(currentLocation, currentPlaceLocation) > GPS_LIMIT_METERS) {
      const result = await apiFetch('/api/places/verify-location', currentLocation)
      setQrVerified(false)
      setNotice(result.message || 'You are out of 200 meters. Your availability has been deactivated.')
      await loadState(true)
      return
    }
    const result = await apiFetch('/api/places/verify-location', currentLocation)
    if (result.deactivated) {
      setQrVerified(false)
      setNotice(result.message || 'You are out of 200 meters. Your availability has been deactivated.')
      await loadState(true)
    } else if (!silent) {
      await loadState(true)
    }
  }

  const loadState = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data: PlaceViewState = await apiFetch('/api/places/state', {})
      if (!data.profile?.currentPlaceId) {
        navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] })
        return
      }
      setState(data)
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
          if (event.status === 'declined') setNotice(`${event.user.username} declined your connection request.`)
          else if (event.status === 'accepted') setNotice(`You and ${event.user.username} are now connected.`)
          else if (event.status === 'left_verified_location') setNotice(event.message || 'Your connection has left.')
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
        if (Date.now() - pingTime < 30000) setNotice(`👋 ${data.profile.pingRequestedByUsername} is looking for you nearby!`)
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
      if (gpsVerifyRef.current) clearInterval(gpsVerifyRef.current)
      subscription.remove()
    }
  }, [])

  useEffect(() => {
    if (gpsVerifyRef.current) { clearInterval(gpsVerifyRef.current); gpsVerifyRef.current = null }
    if (!state?.profile || !['ready', 'in_conversation'].includes(state.profile.status)) return
    gpsVerifyRef.current = setInterval(() => {
      verifyCurrentGpsLocation(true).catch((e: any) => setError(e.message || 'Could not verify location.'))
    }, 30000)
    return () => { if (gpsVerifyRef.current) { clearInterval(gpsVerifyRef.current); gpsVerifyRef.current = null } }
  }, [state?.profile?.status, state?.currentPlace?.place?.placeId])

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert('Leave Place?', 'You must leave before going back.', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: async () => {
          setLeaving(true)
          try { await apiFetch('/api/places/leave', {}); navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] }) }
          catch (e: any) { setError(e.message); setLeaving(false) }
        }},
      ])
      return true
    })
    return () => backHandler.remove()
  }, [])

  const toggleReady = async () => {
    if (!state?.profile) return
    setTogglingReady(true); setError('')
    try {
      const isReady = state.profile.status === 'ready'
      if (!isReady) {
        const currentPlaceLocation = getCurrentPlaceLocation()
        if (!currentPlaceLocation) throw new Error('This place is missing GPS coordinates.')
        const currentLocation = await getCurrentGpsLocation()
        if (distanceMeters(currentLocation, currentPlaceLocation) > GPS_LIMIT_METERS) throw new Error('You are outside 200 meters of this location.')
        await apiFetch('/api/places/ready', { ready: true, ...currentLocation })
      } else {
        await apiFetch('/api/places/ready', { ready: false })
        setQrVerified(false)
      }
      await loadState(true)
    } catch (e: any) { setError(e.message) }
    finally { setTogglingReady(false) }
  }

  const handleLeave = () => {
    Alert.alert('Leave place', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: async () => {
        setLeaving(true)
        try { await apiFetch('/api/places/leave', {}); navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] }) }
        catch (e: any) { setError(e.message); setLeaving(false) }
      }}
    ])
  }

  const handleEndConversation = async () => {
    setEndingConversation(true); setError('')
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
    setFinderLoading(true); setError('')
    try {
      await apiFetch('/api/places/finder', { isFindable: !state.profile.isFindable, locationHint: state.profile.locationHint })
      await loadState(true)
    } catch (e: any) { setError(e.message) }
    finally { setFinderLoading(false) }
  }

  const handleSelectHint = async (hint: string) => {
    if (!state?.profile) return
    setState(prev => prev ? { ...prev, profile: prev.profile ? { ...prev.profile, isFindable: true, locationHint: hint } : prev.profile } : prev)
    try {
      await apiFetch('/api/places/finder', { isFindable: true, locationHint: hint })
      await loadState(true)
    } catch (e: any) { setError(e.message) }
  }

  const handleSendConnectRequest = async (participant: Participant) => {
    setConnectionActionId(participant.userId); setError('')
    try {
      await apiFetch('/api/places/connect-request', { action: 'send', targetUserId: participant.userId })
      setNotice(`Connection request sent to ${participant.username}.`)
      await loadState(true)
    } catch (e: any) { setError(e.message || 'Could not send request.') }
    finally { setConnectionActionId(null) }
  }

  const handleRespondToRequest = async (request: PendingConnectionRequest, action: 'accept' | 'decline' | 'cancel') => {
    setConnectionActionId(request.id); setError('')
    try {
      await apiFetch('/api/places/connect-request', { action, requestId: request.id })
      if (action === 'accept') setNotice(`You and ${request.user.username} are now connected.`)
      else if (action === 'decline') setNotice(`Request from ${request.user.username} declined.`)
      else setNotice(`Request canceled.`)
      await loadState(true)
    } catch (e: any) { setError(e.message || 'Could not update request.') }
    finally { setConnectionActionId(null) }
  }

  const renderAvatar = (p: Participant | { username: string; photoUrl?: string | null }, size = 48) => {
    const initials = ((p as any).username || '?').slice(0, 2).toUpperCase()
    const photoUrl = (p as any).photoUrl
    const updatedAt = (p as any).updatedAt
    return photoUrl
      ? <Image source={{ uri: photoUrl + (updatedAt ? '?t=' + new Date(updatedAt).getTime() : '') }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      : <View style={[s.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={[s.avatarInitials, { fontSize: size * 0.35 }]}>{initials}</Text>
        </View>
  }

  if (loading) return (
    <View style={s.root}>
      <View style={s.centered}><ActivityIndicator size="large" color={AMBER} /></View>
    </View>
  )

  if (!state?.profile || !state.currentPlace) return (
    <View style={s.root}>
      <View style={s.centered}>
        <ActivityIndicator size="large" color={AMBER} />
        <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 12, fontSize: 14 }}>Loading place...</Text>
      </View>
    </View>
  )

  const { profile, currentPlace, activeConnection, qrHandoff } = state
  const isReady = profile.status === 'ready'
  const isInConversation = profile.status === 'in_conversation'
  const myUserId = state.session?.user.id
  const myDisplayName = myUsername || state.session?.user.username || state.session?.user.name || 'You'
  const availableParticipants = participants.filter((p) => p.status !== 'in_conversation' && (p.isVerifiedOnSite || p.userId === myUserId))
  const incomingRequests = pendingRequests.filter((r) => r.direction === 'incoming')
  const requestByUserId = new Map(pendingRequests.map((r) => [r.user.userId, r]))
  const currentParticipant = participants.find((p) => p.userId === myUserId)

  return (
    <View style={s.root}>
      {/* Decorative background circles */}
      <View style={s.bgCircle1} />
      <View style={s.bgCircle2} />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.leaveBtn} onPress={handleLeave} disabled={leaving}>
            {leaving
              ? <ActivityIndicator color="#ef4444" size="small" />
              : <Text style={s.leaveText}>Leave Place</Text>}
          </TouchableOpacity>
          <Text style={s.logo}>Let's Talk</Text>
          <View style={{ width: 90 }} />
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadState() }} tintColor={AMBER} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Error / Notice */}
          {error ? (
            <TouchableOpacity style={s.errorBox} onPress={() => setError('')}>
              <MaterialIcons name="error-outline" size={15} color="#ff6b6b" style={{ marginRight: 6 }} />
              <Text style={s.errorText}>{error}</Text>
            </TouchableOpacity>
          ) : null}
          {notice ? (
            <TouchableOpacity style={s.noticeBox} onPress={() => setNotice('')}>
              <Text style={s.noticeText}>{notice}</Text>
              <Text style={s.noticeDismiss}>Tap to dismiss</Text>
            </TouchableOpacity>
          ) : null}

          {/* Active Connection Banner */}
          {activeConnection && (
            <View style={s.connectionBanner}>
              <View style={s.connectionHeader}>
                <View style={s.connectedDot} />
                <Text style={s.connectedLabel}>CONNECTED</Text>
              </View>
              <View style={s.connectionAvatarRow}>
                <View style={s.connectionPerson}>
                  {renderAvatar({ username: myDisplayName, photoUrl: myPhotoUrl || profile?.photoUrl || currentParticipant?.photoUrl }, 52)}
                  <Text style={s.connectionName} numberOfLines={1}>{myDisplayName}</Text>
                  {profile?.locationHint
                    ? <View style={s.spotChip}><Text style={s.spotChipText}>📍 {profile.locationHint}</Text></View>
                    : <Text style={s.noSpot}>No spot shared</Text>}
                </View>
                <MaterialIcons name="swap-horiz" size={24} color={AMBER} style={{ marginTop: 16 }} />
                <View style={s.connectionPerson}>
                  {renderAvatar(activeConnection.counterpart, 52)}
                  <Text style={s.connectionName} numberOfLines={1}>{activeConnection.counterpart.username}</Text>
                  {activeConnection.counterpart.spotLabel
                    ? <View style={s.spotChip}><Text style={s.spotChipText}>📍 {activeConnection.counterpart.spotLabel}</Text></View>
                    : <Text style={s.noSpot}>No spot shared</Text>}
                </View>
              </View>

              <View style={s.divider} />

              {qrVerified ? (
                <View style={s.qrVerifiedBox}>
                  <MaterialIcons name="verified" size={16} color="#4ade80" style={{ marginRight: 6 }} />
                  <Text style={s.qrVerifiedText}>Connected & Verified</Text>
                </View>
              ) : (
                <View style={s.qrBtnRow}>
                  <TouchableOpacity style={[s.qrBtn, { marginRight: 8 }]} onPress={() => setQrVisible(true)}>
                    <MaterialIcons name="qr-code" size={15} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={s.qrBtnText}>Show My QR</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.qrBtn} onPress={() => setScannerVisible(true)}>
                    <MaterialIcons name="qr-code-scanner" size={15} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={s.qrBtnText}>Scan QR</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity style={s.endBtn} onPress={handleEndConversation} disabled={endingConversation}>
                {endingConversation
                  ? <ActivityIndicator color="rgba(255,255,255,0.7)" size="small" />
                  : <Text style={s.endBtnText}>I'm free again</Text>}
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
            <Text style={s.placeAddress} numberOfLines={2}>{currentPlace.place.address}</Text>
            <View style={s.statsRow}>
              {[
                { val: currentPlace.readyCount, label: 'Available' },
                { val: checkedInCount, label: 'Here Now' },
                { val: activeConversationCount, label: 'Talking' },
              ].map((item, i) => (
                <View key={item.label} style={[s.statBox, i > 0 && s.statBorderLeft]}>
                  <Text style={s.statVal}>{item.val}</Text>
                  <Text style={s.statLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Your Status */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Your Status</Text>
            <Text style={s.cardHint}>
              {isInConversation
                ? `You're talking with ${activeConnection?.counterpart.username ?? 'someone'}.`
                : isReady
                ? "You're visible. People nearby can connect with you."
                : "Set yourself ready and let people nearby discover you."}
            </Text>
            {!isInConversation && (
              <TouchableOpacity
                style={[s.readyBtn, isReady && s.readyBtnActive]}
                onPress={toggleReady}
                disabled={togglingReady}
              >
                {togglingReady
                  ? <ActivityIndicator color={isReady ? AMBER : '#0a0704'} size="small" />
                  : <Text style={[s.readyBtnText, isReady && s.readyBtnTextActive]}>
                      {isReady ? '✓ Leave ready pool' : '👋 Set me ready'}
                    </Text>}
              </TouchableOpacity>
            )}
          </View>

          {/* People Nearby */}
          <Text style={s.sectionTitle}>People Nearby</Text>

          {/* Incoming Requests */}
          {incomingRequests.length > 0 && !activeConnection && (
            <View style={s.requestsBox}>
              <Text style={s.requestsTitle}>Incoming Requests</Text>
              {incomingRequests.map((request) => (
                <View key={request.id} style={s.requestRow}>
                  {renderAvatar(request.user, 42)}
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={s.requestName}>{request.user.username}</Text>
                    {request.user.intentSummary ? <Text style={s.requestHint} numberOfLines={1}>{request.user.intentSummary}</Text> : null}
                  </View>
                  <TouchableOpacity style={s.acceptBtn} onPress={() => handleRespondToRequest(request, 'accept')} disabled={connectionActionId === request.id}>
                    <Text style={s.acceptBtnText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.declineBtn} onPress={() => handleRespondToRequest(request, 'decline')} disabled={connectionActionId === request.id}>
                    <Text style={s.declineBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Participant Cards */}
          {availableParticipants.length > 0
            ? availableParticipants.map((p) => {
                const request = requestByUserId.get(p.userId)
                const isMe = myUserId === p.userId
                const isConnectedPerson = activeConnection?.counterpart.userId === p.userId
                const actionLoading = connectionActionId === p.userId || (request && connectionActionId === request.id)
                const canSendConnectRequest = isReady && (profile.isVerifiedOnSite !== false) && !activeConnection && p.status === 'ready' && p.isVerifiedOnSite
                if (p.username === 'keshu') console.log('Connect debug:', {isReady, profileVerified: profile.isVerifiedOnSite, hasConnection: !!activeConnection, pStatus: p.status, pVerified: p.isVerifiedOnSite})
                return (
                  <View key={p.userId} style={[s.personCard, p.status === 'ready' && s.personCardReady]}>
                    {/* Header row */}
                    <View style={s.personCardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {isMe && <View style={s.youBadge}><Text style={s.youBadgeText}>YOU</Text></View>}
                        {p.isFindable && p.locationHint ? (
                          <Text style={s.personHint}>📍 {p.locationHint}</Text>
                        ) : null}
                      </View>
                      <View style={[s.statusPill, p.status === 'ready' && s.statusPillActive]}>
                        <View style={[s.statusDot, p.status === 'ready' && s.statusDotActive]} />
                        <Text style={[s.statusPillText, p.status === 'ready' && s.statusPillTextActive]}>
                          {p.status === 'ready' ? 'Open to Talk' : 'Browsing'}
                        </Text>
                      </View>
                    </View>

                    {/* Avatar + info */}
                    <View style={s.personCardMain}>
                      <View style={s.personAvatarWrap}>
                        {renderAvatar(p, 46)}
                        {p.status === 'ready' && <View style={s.avatarOnline} />}
                      </View>
                      <View style={{ flex: 1, marginLeft: 44 }}>
                        <Text style={s.personName}>{p.username}</Text>
                        {(p.intentSummary || p.intentText || '').trim().length > 0 ? (
                          <View style={s.intentBox}>
                            <Text style={s.intentBoxLabel}>wants to talk about</Text>
                            <Text style={s.personIntent} numberOfLines={4}>{p.intentSummary || p.intentText}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {/* Divider */}
                    <View style={s.personDivider} />

                    {/* Action buttons */}
                    {!isMe ? (
                      <View style={s.personBtns}>
                        <TouchableOpacity style={s.viewProfileBtn} onPress={() => setSelectedPerson(p)}>
                          <Text style={s.viewProfileBtnText}>View Profile</Text>
                        </TouchableOpacity>

                        {isConnectedPerson ? (
                          <View style={[s.actionBtn, s.actionBtnConnected]}>
                            <Text style={s.actionBtnConnectedText}>✓ Connected</Text>
                          </View>
                        ) : request?.direction === 'outgoing' ? (
                          <TouchableOpacity style={[s.actionBtn, s.actionBtnCancel]} onPress={() => handleRespondToRequest(request, 'cancel')} disabled={Boolean(actionLoading)}>
                            {actionLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.actionBtnCancelText}>Cancel</Text>}
                          </TouchableOpacity>
                        ) : request?.direction === 'incoming' ? (
                          <TouchableOpacity style={[s.actionBtn, s.actionBtnAccept]} onPress={() => handleRespondToRequest(request, 'accept')} disabled={Boolean(actionLoading)}>
                            {actionLoading ? <ActivityIndicator size="small" color="#0a0704" /> : <Text style={s.actionBtnAcceptText}>Accept</Text>}
                          </TouchableOpacity>
                        ) : canSendConnectRequest ? (
                          <TouchableOpacity style={[s.actionBtn, s.actionBtnConnect]} onPress={() => handleSendConnectRequest(p)} disabled={Boolean(actionLoading)}>
                            {actionLoading ? <ActivityIndicator size="small" color="#0a0704" /> : <Text style={s.actionBtnConnectText}>Connect</Text>}
                          </TouchableOpacity>
                        ) : (
                          <View style={[s.actionBtn, s.actionBtnDisabled]}>
                            <Text style={s.actionBtnDisabledText}>Connect</Text>
                          </View>
                        )}
                      </View>
                    ) : null}
                  </View>
                )
              })
            : (
              <View style={s.emptyPeople}>
                <Text style={s.emptyEmoji}>👀</Text>
                <Text style={s.emptyTitle}>No one ready yet</Text>
                <Text style={s.emptyHint}>Mark yourself ready and wait for others.</Text>
              </View>
            )}
          {/* Help Someone Find You */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Help Someone Find You</Text>
            <Text style={s.cardHint}>Sharing your spot makes it easier for people to walk up and say hi!</Text>
            <View style={s.hintRow}>
              {FINDER_HINTS.map((hint) => (
                <TouchableOpacity
                  key={hint}
                  style={[s.hintChip, (selectedHint ?? profile.locationHint) === hint && s.hintChipActive]}
                  onPress={() => {
                    if ((selectedHint ?? profile.locationHint) === hint) { setSelectedHint(null) }
                    else { setSelectedHint(hint); setCustomSpot('') }
                  }}
                >
                  <Text style={[s.hintChipText, (selectedHint ?? profile.locationHint) === hint && s.hintChipTextActive]}>{hint}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              placeholder="Or describe your spot..."
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={customSpot}
              onChangeText={(text) => { setCustomSpot(text); if (text) setSelectedHint(null) }}
              style={s.spotInput}
            />
            <TouchableOpacity
              style={[s.shareSpotBtn, profile.isFindable && s.shareSpotBtnActive]}
              onPress={async () => {
                if (!profile.isFindable) {
                  const hintToShare = customSpot.trim() || selectedHint
                  if (!hintToShare) { setError('Pick a spot or describe your location first.'); return }
                  await handleSelectHint(hintToShare)
                  setCustomSpot(''); setSelectedHint(null)
                } else {
                  await handleFinderToggle()
                }
              }}
              disabled={finderLoading}
            >
              {finderLoading
                ? <ActivityIndicator color={profile.isFindable ? '#ef4444' : '#0a0704'} size="small" />
                : <Text style={[s.shareSpotBtnText, profile.isFindable && s.shareSpotBtnTextActive]}>
                    {profile.isFindable ? 'Stop sharing my spot' : 'Share My Spot'}
                  </Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* QR Modal */}
      <Modal visible={qrVisible} transparent animationType="fade" onRequestClose={() => setQrVisible(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setQrVisible(false)}>
          <View style={s.qrModal}>
            <Text style={s.qrModalTitle}>Your QR Code</Text>
            {qrHandoff && (
              <View style={s.qrModalCode}>
                <QRCode value={qrHandoff.url} size={220} backgroundColor="white" color="#000" />
              </View>
            )}
            <Text style={s.qrModalHint}>
              {activeConnection
                ? `Show this to ${activeConnection.counterpart.username} to verify.`
                : isReady ? 'Live — people can scan this' : 'Set yourself ready to activate'}
            </Text>
            <TouchableOpacity style={s.qrCloseBtn} onPress={() => setQrVisible(false)}>
              <Text style={s.qrCloseBtnText}>Close</Text>
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
          <TouchableOpacity activeOpacity={1} style={s.personModal}>
            {selectedPerson && (
              <>
                <View style={s.personModalBanner} />
                <View style={s.personModalAvatarWrap}>
                  {renderAvatar(selectedPerson, 76)}
                </View>
                <View style={s.personModalBody}>
                  <Text style={s.personModalName}>{selectedPerson.username}</Text>
                  <View style={s.personTags}>
                    {selectedPerson.gender ? <View style={s.personTag}><Text style={s.personTagText}>{selectedPerson.gender}</Text></View> : null}
                    {selectedPerson.age ? <View style={s.personTag}><Text style={s.personTagText}>{selectedPerson.age}</Text></View> : null}
                    <View style={s.personTag}>
                      <Text style={s.personTagText}>{selectedPerson.status === 'ready' ? 'Open to Talk' : 'Browsing'}</Text>
                    </View>
                  </View>
                  {(selectedPerson.intentText || selectedPerson.about || selectedPerson.intentSummary) ? (
                    <Text style={s.personModalAbout}>{selectedPerson.intentText || selectedPerson.about || selectedPerson.intentSummary}</Text>
                  ) : null}
                </View>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080502' },
  bgCircle1: { position: 'absolute', top: -100, right: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(232,130,74,0.05)' },
  bgCircle2: { position: 'absolute', bottom: 60, left: -120, width: 350, height: 350, borderRadius: 175, backgroundColor: 'rgba(232,130,74,0.03)' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingBottom: 48 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(232,130,74,0.1)' },
  logo: { fontSize: 20, fontWeight: '900', color: AMBER, letterSpacing: -0.5 },
  leaveBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)' },
  leaveText: { color: '#ef4444', fontWeight: '700', fontSize: 13 },

  // Alerts
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(186,26,26,0.12)', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(186,26,26,0.25)' },
  errorText: { color: '#ff6b6b', fontSize: 13, flex: 1 },
  noticeBox: { backgroundColor: 'rgba(232,130,74,0.1)', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(232,130,74,0.2)' },
  noticeText: { color: '#ffd700', fontSize: 14, fontWeight: '600' },
  noticeDismiss: { color: 'rgba(255,215,0,0.5)', fontSize: 11, marginTop: 3 },

  // Connection Banner
  connectionBanner: { backgroundColor: 'rgba(20,12,6,0.95)', borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)' },
  connectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  connectedDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ade80', marginRight: 8 },
  connectedLabel: { color: '#4ade80', fontWeight: '800', fontSize: 12, letterSpacing: 1.2 },
  connectionAvatarRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  connectionPerson: { flex: 1, alignItems: 'center', gap: 6 },
  connectionName: { color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  spotChip: { backgroundColor: 'rgba(232,130,74,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  spotChipText: { color: AMBER, fontSize: 11, fontWeight: '600' },
  noSpot: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 14 },
  qrVerifiedBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(74,222,128,0.08)', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)' },
  qrVerifiedText: { color: '#4ade80', fontWeight: '700', fontSize: 14 },
  qrBtnRow: { flexDirection: 'row', marginBottom: 12 },
  qrBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingVertical: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  qrBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  endBtn: { borderRadius: 50, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.04)' },
  endBtnText: { color: 'rgba(255,255,255,0.7)', fontWeight: '700', fontSize: 14 },

  // Place Card
  placeCard: { backgroundColor: 'rgba(20,12,6,0.95)', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(232,130,74,0.15)' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,180,80,0.1)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 10 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00b050' },
  liveText: { fontSize: 11, color: '#00b050', fontWeight: '700', letterSpacing: 0.5 },
  placeName: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 4 },
  placeAddress: { fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 17, marginBottom: 14 },
  statsRow: { flexDirection: 'row', backgroundColor: 'rgba(232,130,74,0.05)', borderRadius: 14, paddingVertical: 12 },
  statBox: { flex: 1, alignItems: 'center' },
  statBorderLeft: { borderLeftWidth: 1, borderLeftColor: 'rgba(232,130,74,0.12)' },
  statVal: { fontSize: 22, fontWeight: '900', color: AMBER },
  statLabel: { fontSize: 11, color: AMBER_LIGHT, fontWeight: '600', marginTop: 2 },

  // Card
  card: { backgroundColor: 'rgba(20,12,6,0.95)', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(232,130,74,0.12)' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 6 },
  cardHint: { fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 19, marginBottom: 14 },

  // Ready Button
  readyBtn: { backgroundColor: AMBER, borderRadius: 50, paddingVertical: 14, alignItems: 'center' },
  readyBtnActive: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
  readyBtnText: { color: '#0a0704', fontWeight: '800', fontSize: 15 },
  readyBtnTextActive: { color: 'rgba(255,255,255,0.7)' },

  // Finder
  hintRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  hintChip: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)' },
  hintChipActive: { backgroundColor: 'rgba(232,130,74,0.15)', borderColor: AMBER },
  hintChipText: { fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: '600' },
  hintChipTextActive: { color: AMBER },
  spotInput: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 12 },
  shareSpotBtn: { borderRadius: 50, paddingVertical: 13, alignItems: 'center', backgroundColor: AMBER },
  shareSpotBtnActive: { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  shareSpotBtnText: { color: '#0a0704', fontWeight: '800', fontSize: 14 },
  shareSpotBtnTextActive: { color: '#ef4444' },

  // People
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 12, paddingHorizontal: 2 },
  requestsBox: { backgroundColor: 'rgba(20,12,6,0.95)', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(232,130,74,0.2)' },
  requestsTitle: { fontSize: 13, fontWeight: '800', color: AMBER, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  requestRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  requestName: { fontSize: 14, fontWeight: '700', color: '#fff' },
  requestHint: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  acceptBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(232,130,74,0.15)', borderWidth: 1, borderColor: AMBER, marginLeft: 8 },
  acceptBtnText: { color: AMBER, fontSize: 12, fontWeight: '700' },
  declineBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', marginLeft: 6 },
  declineBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '700' },

  // Person Card
  personCard: { backgroundColor: 'rgba(18,10,4,0.98)', borderRadius: 16, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 0, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  personCardReady: { borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(232,130,74,0.04)' },
  personCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  personDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 8 },
  personIntentEmpty: { fontSize: 12, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic', marginTop: 3 },
  itsYouText: { fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', paddingVertical: 4 },
  youBadge: { backgroundColor: 'rgba(99,102,241,0.2)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(99,102,241,0.4)' },
  youBadgeText: { color: '#818cf8', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  statusPillActive: { backgroundColor: 'rgba(232,130,74,0.1)', borderColor: 'rgba(232,130,74,0.3)' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  statusDotActive: { backgroundColor: AMBER },
  statusPillText: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '700' },
  statusPillTextActive: { color: AMBER },
  personCardMain: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  personAvatarWrap: { position: 'relative' },
  avatarOnline: { position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: 6, backgroundColor: '#4ade80', borderWidth: 2, borderColor: '#080502' },
  avatarPlaceholder: { backgroundColor: 'rgba(232,130,74,0.12)', justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { color: '#fff', fontWeight: '800' },
  personName: { fontSize: 15, fontWeight: '800', color: '#fff', marginBottom: 6 },
  intentBox: { marginTop: 2, backgroundColor: 'rgba(232,130,74,0.07)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderLeftWidth: 2, borderLeftColor: 'rgba(232,130,74,0.5)', alignSelf: 'flex-start', maxWidth: 200 },
  intentBoxLabel: { fontSize: 9, color: 'rgba(232,130,74,0.6)', fontWeight: '600', marginBottom: 1 },
  personIntentLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(232,130,74,0.7)', letterSpacing: 1, marginBottom: 5, marginTop: 6, textTransform: 'uppercase' },
  personIntent: { fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 16, marginBottom: 0 },
  personHint: { fontSize: 12, color: AMBER_LIGHT, fontWeight: '600' },
  personBtns: { flexDirection: 'row', gap: 8 },
  viewProfileBtn: { flex: 1, paddingVertical: 9, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center' },
  viewProfileBtnText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  actionBtn: { flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: 'center' },
  actionBtnConnect: { backgroundColor: AMBER },
  actionBtnConnectText: { color: '#0a0704', fontWeight: '800', fontSize: 13 },
  actionBtnConnected: { backgroundColor: 'rgba(74,222,128,0.08)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.25)' },
  actionBtnConnectedText: { color: '#4ade80', fontWeight: '700', fontSize: 13 },
  actionBtnCancel: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  actionBtnCancelText: { color: 'rgba(255,255,255,0.5)', fontWeight: '700', fontSize: 13 },
  actionBtnAccept: { backgroundColor: AMBER },
  actionBtnAcceptText: { color: '#0a0704', fontWeight: '800', fontSize: 13 },
  actionBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  actionBtnDisabledText: { color: 'rgba(255,255,255,0.2)', fontWeight: '700', fontSize: 13 },

  emptyPeople: { backgroundColor: 'rgba(20,12,6,0.95)', borderRadius: 18, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(232,130,74,0.08)' },
  emptyEmoji: { fontSize: 32, marginBottom: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 4 },
  emptyHint: { fontSize: 13, color: 'rgba(255,255,255,0.35)', textAlign: 'center' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center' },
  qrModal: { backgroundColor: '#0f0a06', borderRadius: 24, padding: 28, alignItems: 'center', width: '85%', borderWidth: 1, borderColor: 'rgba(232,130,74,0.2)' },
  qrModalTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 20 },
  qrModalCode: { padding: 14, backgroundColor: '#fff', borderRadius: 16, marginBottom: 16 },
  qrModalHint: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20, textAlign: 'center', lineHeight: 19 },
  qrCloseBtn: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 50, paddingVertical: 13, paddingHorizontal: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  qrCloseBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  personOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  personModal: { backgroundColor: '#0f0a06', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(232,130,74,0.15)' },
  personModalBanner: { height: 80, backgroundColor: 'rgba(232,130,74,0.15)' },
  personModalAvatarWrap: { position: 'absolute', top: 36, left: 20, borderWidth: 3, borderColor: '#0f0a06', borderRadius: 42, overflow: 'hidden' },
  personModalBody: { paddingHorizontal: 20, paddingTop: 48, paddingBottom: 28 },
  personModalName: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 10 },
  personTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  personTag: { backgroundColor: 'rgba(232,130,74,0.12)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(232,130,74,0.25)' },
  personTagText: { color: AMBER, fontSize: 13, fontWeight: '600' },
  personModalAbout: { fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 22 },
})
