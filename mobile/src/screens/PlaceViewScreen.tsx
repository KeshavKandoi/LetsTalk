import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, ActivityIndicator, RefreshControl, Alert, Modal, Image, AppState,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import QRCode from 'react-native-qrcode-svg'
import ScannerModal from './ScannerModal'
import { apiFetch } from '../lib/api'

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
  createdAt: string
  counterpart: {
    userId: string
    username: string
    moodEmoji: string
    intentSummary: string | null
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
  session: { user: { id: string } } | null
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
  const [finderLoading, setFinderLoading] = useState(false)
  const [pingingUserId, setPingingUserId] = useState<string | null>(null)
  const [selectedPerson, setSelectedPerson] = useState<Participant | null>(null)
  const [notice, setNotice] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const loadState = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data: PlaceViewState = await apiFetch('/api/places/state', {})
      console.log('PlaceView: got data', JSON.stringify(data).slice(0,200))
      if (!data.profile?.currentPlaceId) {
        navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] })
        return
      }
      setState(data)
      if (data.currentPlace?.place?.placeId) {
        const preview = await apiFetch('/api/places/preview', { placeId: data.currentPlace.place.placeId })
        setParticipants(preview.participants ?? [])
        setCheckedInCount(preview.checkedInCount ?? 0)
        setActiveConversationCount(preview.activeConversationCount ?? 0)
      }
      // Check for incoming ping
      if (data.profile?.pingRequestedAt && data.profile?.pingRequestedByUsername) {
        const pingTime = new Date(data.profile.pingRequestedAt).getTime()
        if (Date.now() - pingTime < 30000) {
          setNotice(`👋 ${data.profile.pingRequestedByUsername} is looking for you nearby!`)
        }
      }
    } catch (e: any) {
      console.log('PlaceView loadState error:', JSON.stringify(e))
      setError(e.message || 'Could not load place.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadState()
    pollRef.current = setInterval(() => loadState(true), 8000)
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void loadState(true)
      }
    })
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      subscription.remove()
    }
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
      setNotice('Conversation ended. You\'re back in the ready pool.')
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

  const handlePing = async (participant: Participant) => {
    setPingingUserId(participant.userId)
    try {
      await apiFetch('/api/places/finder', { action: 'ping', userId: participant.userId })
      setNotice(`👋 Ping sent to ${participant.username}!`)
    } catch (e: any) { setError(e.message) }
    finally { setPingingUserId(null) }
  }

  const renderPersonAvatar = (person: Participant) => {
    const initials = (person.username || '?').slice(0, 2).toUpperCase()
    return person.photoUrl
      ? <Image source={{ uri: person.photoUrl }} style={styles.personAvatarImg} />
      : <View style={styles.personAvatar}><Text style={styles.personAvatarText}>{initials}</Text></View>
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><ActivityIndicator size="large" color="#1a6b3c" /></View>
      </SafeAreaView>
    )
  }

  if (!state?.profile || !state.currentPlace) return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1a6b3c" />
        <Text style={{ color: '#1a6b3c', marginTop: 12, fontSize: 14 }}>Loading place...</Text>
      </View>
    </SafeAreaView>
  )

  const { profile, currentPlace, activeConnection, qrHandoff } = state
  const isReady = profile.status === 'ready'
  const isInConversation = profile.status === 'in_conversation'

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadState() }} tintColor="#1a6b3c" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>LetsTalk</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Profile')}>
              <Text style={styles.profileBtnTxt}>👤</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave} disabled={leaving}>
              {leaving ? <ActivityIndicator color="#dc2626" size="small" /> : <Text style={styles.leaveText}>Leave</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
        {notice ? (
          <TouchableOpacity style={styles.noticeBox} onPress={() => setNotice('')}>
            <Text style={styles.noticeText}>{notice}</Text>
            <Text style={styles.noticeDismiss}>Tap to dismiss</Text>
          </TouchableOpacity>
        ) : null}

        {/* Active conversation banner */}
        {activeConnection && (
          <View style={styles.connectionBanner}>
            <View style={styles.connectionHeader}>
              <Text style={styles.connectionEmoji}>🤝</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.connectionTitle}>Talking with {activeConnection.counterpart.username}</Text>
                <Text style={styles.connectionMood}>
                  {activeConnection.counterpart.moodEmoji} {activeConnection.counterpart.intentSummary || 'Open to a conversation.'}
                </Text>
              </View>
            </View>
            <Text style={styles.connectionHint}>Take your time. Either person can end it.</Text>
            <TouchableOpacity style={styles.endBtn} onPress={handleEndConversation} disabled={endingConversation}>
              {endingConversation ? <ActivityIndicator color="white" /> : <Text style={styles.endBtnText}>I'm free again</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Place info */}
        <View style={styles.placeCard}>
          <View style={styles.placeHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Live place</Text>
              </View>
              <Text style={styles.placeName}>{currentPlace.place.name}</Text>
              <Text style={styles.placeAddress} numberOfLines={2}>{currentPlace.place.address}</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{currentPlace.readyCount}</Text>
              <Text style={styles.statLabel}>Ready</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{checkedInCount}</Text>
              <Text style={styles.statLabel}>Here now</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{activeConversationCount}</Text>
              <Text style={styles.statLabel}>Talking</Text>
            </View>
          </View>
          <View style={styles.introCard}>
            <Text style={styles.introLabel}>YOUR INTRO</Text>
            <Text style={styles.introText}>{profile.moodEmoji} {profile.intentSummary || profile.intentText || 'Open to a nearby conversation.'}</Text>
          </View>
        </View>

        {/* Ready / Status control */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your status</Text>
          <Text style={styles.cardHint}>
            {isInConversation
              ? `You're talking with ${activeConnection?.counterpart.username ?? 'someone'} — your QR is paused.`
              : isReady
              ? 'You\'re visible in the ready count for this place.'
              : 'You\'re present but not yet in the ready count.'}
          </Text>
          {!isInConversation && (
            <TouchableOpacity
              style={[styles.readyBtn, isReady && styles.readyBtnActive]}
              onPress={toggleReady}
              disabled={togglingReady}
            >
              {togglingReady
                ? <ActivityIndicator color={isReady ? '#1a6b3c' : 'white'} />
                : <Text style={[styles.readyBtnText, isReady && styles.readyBtnTextActive]}>
                    {isReady ? '✓ Leave ready pool' : '👋 Set me ready'}
                  </Text>}
            </TouchableOpacity>
          )}
        </View>

        {/* People ready here */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardTitle}>People here now</Text>
            <View style={styles.readyBadge}>
              <Text style={styles.readyBadgeText}>{checkedInCount} here</Text>
            </View>
          </View>
          <Text style={styles.cardHint}>Tap someone to see their profile, mood, and bio.</Text>
          {participants.length > 0
            ? participants.map((p) => (
                <TouchableOpacity key={p.userId} style={styles.participantCard} onPress={() => setSelectedPerson(p)}>
                  {p.photoUrl
                    ? <Image source={{ uri: p.photoUrl }} style={styles.participantAvatar} />
                    : <View style={styles.participantAvatarPlaceholder}>
                        <Text style={styles.participantEmoji}>{p.moodEmoji}</Text>
                      </View>
                  }
                  <View style={{ flex: 1 }}>
                    <View style={styles.participantNameRow}>
                      <Text style={styles.participantName}>{p.username}</Text>
                      {state.session?.user.id === p.userId && (
                        <View style={styles.youBadge}><Text style={styles.youBadgeText}>You</Text></View>
                      )}
                      <View style={[styles.findableBadge, p.isFindable && styles.findableBadgeActive]}>
                        <Text style={[styles.findableBadgeText, p.isFindable && styles.findableBadgeTextActive]}>
                          {p.isFindable ? 'Findable' : 'Ready'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.participantMood} numberOfLines={2}>
                      {p.intentSummary || 'Open to a nearby conversation.'}
                    </Text>
                    {p.isFindable && p.locationHint ? (
                      <Text style={styles.locationHint}>📍 Near {p.locationHint.toLowerCase()}</Text>
                    ) : null}
                  </View>
                  {state.session?.user.id !== p.userId && p.isFindable && (
                    <TouchableOpacity
                      style={styles.pingBtn}
                      onPress={() => handlePing(p)}
                      disabled={pingingUserId === p.userId}
                    >
                      {pingingUserId === p.userId
                        ? <ActivityIndicator size="small" color="#1a6b3c" />
                        : <Text style={styles.pingBtnText}>🔔 Ping</Text>}
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))
            : (
              <View style={styles.emptyPeople}>
                <Text style={styles.emptyEmoji}>👀</Text>
                <Text style={styles.emptyTitle}>No one ready yet</Text>
                <Text style={styles.emptyText}>Mark yourself ready and wait for others.</Text>
              </View>
            )}
        </View>

        {/* Help someone find you */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📍 Help someone find you</Text>
          <Text style={styles.cardHint}>Share your spot in this place, so someone can ping you before scanning.</Text>
          <View style={styles.hintRow}>
            {FINDER_HINTS.map((hint) => (
              <TouchableOpacity
                key={hint}
                style={[styles.hintChip, profile.locationHint === hint && styles.hintChipActive]}
                onPress={() => handleSelectHint(hint)}
                disabled={finderLoading || (!isReady && !profile.isFindable) || isInConversation}
              >
                <Text style={[styles.hintChipText, profile.locationHint === hint && styles.hintChipTextActive]}>{hint}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.finderBtn, profile.isFindable && styles.finderBtnActive]}
            onPress={handleFinderToggle}
            disabled={finderLoading || !isReady || isInConversation}
          >
            {finderLoading
              ? <ActivityIndicator color="white" />
              : <Text style={styles.finderBtnText}>
                  {profile.isFindable ? 'Stop sharing my spot' : 'Help someone find me'}
                </Text>}
          </TouchableOpacity>
          {profile.isFindable && profile.locationHint ? (
            <Text style={styles.finderStatus}>Currently sharing: {profile.locationHint}</Text>
          ) : null}
        </View>

        {/* QR code */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔲 Your QR code</Text>
          <Text style={styles.cardHint}>Nearby people can scan this to send a friend request.</Text>
          {qrHandoff ? (
            <TouchableOpacity style={styles.qrContainer} onPress={() => setQrVisible(true)}>
              <View style={[styles.qrWrapper, !qrHandoff.isActive && styles.qrInactive]}>
                <QRCode value={qrHandoff.url} size={160} backgroundColor="white" color="#0f3320" />
              </View>
              <View style={[styles.qrStatus, qrHandoff.isActive && styles.qrStatusActive]}>
                <Text style={[styles.qrStatusText, qrHandoff.isActive && styles.qrStatusTextActive]}>
                  {qrHandoff.isActive ? '✓ Live while you\'re ready' : 'Set yourself ready to make this live'}
                </Text>
              </View>
              <Text style={styles.qrTap}>Tap to enlarge</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.qrPlaceholder}><Text style={styles.qrPlaceholderText}>Building QR...</Text></View>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.scanBtn, isInConversation && styles.scanBtnDisabled]}
            onPress={() => { if (!isInConversation) setScannerVisible(true) }}
            disabled={isInConversation}
          >
            <Text style={styles.scanBtnText}>📷 Scan someone nearby</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* QR Fullscreen Modal */}
      <Modal visible={qrVisible} transparent animationType="fade" onRequestClose={() => setQrVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setQrVisible(false)}>
          <View style={styles.qrModal}>
            <Text style={styles.qrModalTitle}>Your QR Code</Text>
            {qrHandoff && (
              <View style={styles.qrModalCode}>
                <QRCode value={qrHandoff.url} size={240} backgroundColor="white" color="#0f3320" />
              </View>
            )}
            <Text style={styles.qrModalHint}>{isReady ? 'Live — people can scan this' : 'Set yourself ready to activate'}</Text>
            <TouchableOpacity style={styles.qrModalClose} onPress={() => setQrVisible(false)}>
              <Text style={styles.qrModalCloseText}>Close</Text>
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
            setNotice(message)
            await loadState(true)
          }}
        />
      )}

      <Modal visible={!!selectedPerson} transparent animationType="slide" onRequestClose={() => setSelectedPerson(null)}>
        <TouchableOpacity style={styles.personOverlay} activeOpacity={1} onPress={() => setSelectedPerson(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.personSheet}>
            <View style={styles.personHandle} />
            {selectedPerson ? (
              <>
                <View style={styles.personTop}>
                  {renderPersonAvatar(selectedPerson)}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.personName}>{selectedPerson.username}</Text>
                    <View style={styles.personTags}>
                      {selectedPerson.age ? <Text style={styles.personTag}>{selectedPerson.age} yrs</Text> : null}
                      {selectedPerson.gender ? <Text style={styles.personTag}>{selectedPerson.gender}</Text> : null}
                    </View>
                  </View>
                </View>
                <Text style={styles.personMood}>{selectedPerson.moodEmoji} {selectedPerson.intentText || selectedPerson.intentSummary || 'Open to a nearby conversation.'}</Text>
                {state.session?.user.id !== selectedPerson.userId ? (
                  <Text style={styles.personHint}>
                    Scan their QR code to send a friend request.
                  </Text>
                ) : null}
              </>
            ) : null}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#d4f5d4' },
  scroll: { padding: 20, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  logo: { fontSize: 22, fontWeight: '900', color: '#0f3320' },
  leaveBtn: { backgroundColor: 'rgba(254,226,226,0.8)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(252,165,165,0.5)' },
  profileBtn: { backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(144,212,144,0.5)' },
  profileBtnTxt: { fontSize: 16 },
  leaveText: { color: '#dc2626', fontWeight: '600', fontSize: 13 },
  errorBox: { backgroundColor: '#fee2e2', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#fca5a5' },
  errorText: { color: '#dc2626', fontSize: 13 },
  noticeBox: { backgroundColor: 'rgba(26,107,60,0.12)', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(26,107,60,0.25)' },
  noticeText: { color: '#0f3320', fontSize: 14, fontWeight: '600' },
  noticeDismiss: { color: '#2d6e3e', fontSize: 11, marginTop: 4 },
  connectionBanner: { backgroundColor: 'rgba(26,107,60,0.12)', borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(26,107,60,0.25)' },
  connectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  connectionEmoji: { fontSize: 28 },
  connectionTitle: { fontSize: 15, fontWeight: '700', color: '#0f3320', marginBottom: 3 },
  connectionMood: { fontSize: 13, color: '#2d6e3e', lineHeight: 18 },
  connectionHint: { fontSize: 12, color: '#2d6e3e', marginBottom: 12 },
  endBtn: { backgroundColor: '#1a6b3c', borderRadius: 50, paddingVertical: 12, alignItems: 'center' },
  endBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  placeCard: { backgroundColor: 'rgba(255,255,255,0.82)', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(144,212,144,0.5)' },
  placeHeader: { marginBottom: 14 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(22,163,74,0.1)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 8 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16a34a' },
  liveText: { fontSize: 11, color: '#16a34a', fontWeight: '700' },
  placeName: { fontSize: 20, fontWeight: '800', color: '#0f3320', marginBottom: 4 },
  placeAddress: { fontSize: 12, color: '#2d6e3e', lineHeight: 16 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statBox: { flex: 1, backgroundColor: 'rgba(26,107,60,0.07)', borderRadius: 12, padding: 10, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '900', color: '#0f3320' },
  statLabel: { fontSize: 11, color: '#2d6e3e', fontWeight: '600', marginTop: 2 },
  introCard: { backgroundColor: 'rgba(26,107,60,0.07)', borderRadius: 14, padding: 12 },
  introLabel: { fontSize: 10, fontWeight: '700', color: '#2d6e3e', letterSpacing: 1.5, marginBottom: 6 },
  introText: { fontSize: 16, fontWeight: '600', color: '#0f3320' },
  card: { backgroundColor: 'rgba(255,255,255,0.82)', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(144,212,144,0.5)' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0f3320', marginBottom: 4 },
  cardHint: { fontSize: 12, color: '#2d6e3e', lineHeight: 18, marginBottom: 12 },
  readyBtn: { backgroundColor: '#1a6b3c', borderRadius: 50, paddingVertical: 13, alignItems: 'center' },
  readyBtnActive: { backgroundColor: 'white', borderWidth: 2, borderColor: '#1a6b3c' },
  readyBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  readyBtnTextActive: { color: '#1a6b3c' },
  readyBadge: { backgroundColor: 'rgba(26,107,60,0.1)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  readyBadgeText: { fontSize: 12, color: '#1a6b3c', fontWeight: '600' },
  participantCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(26,107,60,0.06)', borderRadius: 14, padding: 12, marginTop: 8 },
  participantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  participantAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e0f2e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  participantEmoji: { fontSize: 26, marginTop: 2 },
  participantNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' },
  participantName: { fontSize: 14, fontWeight: '700', color: '#0f3320' },
  youBadge: { backgroundColor: '#1a6b3c', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  youBadgeText: { fontSize: 10, color: 'white', fontWeight: '700' },
  findableBadge: { backgroundColor: 'rgba(144,212,144,0.3)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  findableBadgeActive: { backgroundColor: 'rgba(26,107,60,0.12)' },
  findableBadgeText: { fontSize: 10, color: '#2d6e3e', fontWeight: '600' },
  findableBadgeTextActive: { color: '#1a6b3c' },
  participantMood: { fontSize: 12, color: '#2d6e3e', lineHeight: 17 },
  locationHint: { fontSize: 12, color: '#1a6b3c', fontWeight: '600', marginTop: 3 },
  pingBtn: { backgroundColor: 'white', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(144,212,144,0.6)', alignSelf: 'flex-start' },
  personOverlay: { flex: 1, backgroundColor: 'rgba(15,51,32,0.45)', justifyContent: 'flex-end' },
  personSheet: { minHeight: '48%', backgroundColor: '#f0faf0', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, paddingBottom: 40 },
  personHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: 'rgba(45,110,62,0.35)', alignSelf: 'center', marginBottom: 18 },
  personTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  personAvatar: { width: 74, height: 74, borderRadius: 37, backgroundColor: '#1a6b3c', justifyContent: 'center', alignItems: 'center' },
  personAvatarImg: { width: 74, height: 74, borderRadius: 37, backgroundColor: '#1a6b3c' },
  personAvatarText: { color: 'white', fontWeight: '900', fontSize: 24 },
  personName: { fontSize: 22, fontWeight: '900', color: '#0f3320', marginBottom: 8 },
  personTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  personTag: { backgroundColor: 'rgba(26,107,60,0.1)', color: '#1a6b3c', fontWeight: '700', fontSize: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, overflow: 'hidden' },
  personMood: { fontSize: 15, color: '#2d6e3e', lineHeight: 22, marginBottom: 18 },
  personHint: { fontSize: 14, color: '#1a6b3c', fontWeight: '600' },
  pingBtnText: { fontSize: 11, fontWeight: '600', color: '#1a6b3c' },
  emptyPeople: { alignItems: 'center', padding: 20, gap: 6 },
  emptyEmoji: { fontSize: 32 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#0f3320' },
  emptyText: { fontSize: 12, color: '#2d6e3e', textAlign: 'center' },
  hintRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  hintChip: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(144,212,144,0.6)', backgroundColor: 'white' },
  hintChipActive: { backgroundColor: '#1a6b3c', borderColor: '#1a6b3c' },
  hintChipText: { fontSize: 13, color: '#2d6e3e', fontWeight: '500' },
  hintChipTextActive: { color: 'white' },
  finderBtn: { backgroundColor: '#1a6b3c', borderRadius: 50, paddingVertical: 13, alignItems: 'center', marginBottom: 8 },
  finderBtnActive: { backgroundColor: 'white', borderWidth: 2, borderColor: '#1a6b3c' },
  finderBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  finderStatus: { fontSize: 12, color: '#1a6b3c', fontWeight: '600', textAlign: 'center' },
  qrContainer: { alignItems: 'center', paddingVertical: 12 },
  qrWrapper: { padding: 12, backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(144,212,144,0.5)', marginBottom: 10 },
  qrInactive: { opacity: 0.4 },
  qrStatus: { backgroundColor: 'rgba(148,163,184,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 6 },
  qrStatusActive: { backgroundColor: 'rgba(26,107,60,0.1)' },
  qrStatusText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  qrStatusTextActive: { color: '#1a6b3c' },
  qrTap: { fontSize: 11, color: '#2d6e3e' },
  qrPlaceholder: { height: 100, justifyContent: 'center', alignItems: 'center' },
  qrPlaceholderText: { color: '#2d6e3e', fontSize: 13 },
  actionRow: { gap: 10 },
  scanBtn: { backgroundColor: '#1a6b3c', borderRadius: 50, paddingVertical: 14, alignItems: 'center' },
  scanBtnDisabled: { opacity: 0.5 },
  scanBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,51,32,0.6)', justifyContent: 'center', alignItems: 'center' },
  qrModal: { backgroundColor: 'white', borderRadius: 28, padding: 28, alignItems: 'center', width: '85%' },
  qrModalTitle: { fontSize: 18, fontWeight: '800', color: '#0f3320', marginBottom: 20 },
  qrModalCode: { padding: 16, backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(144,212,144,0.5)', marginBottom: 16 },
  qrModalHint: { fontSize: 13, color: '#2d6e3e', marginBottom: 20, textAlign: 'center' },
  qrModalClose: { backgroundColor: '#1a6b3c', borderRadius: 50, paddingVertical: 12, paddingHorizontal: 32 },
  qrModalCloseText: { color: 'white', fontWeight: '700', fontSize: 15 },
})
