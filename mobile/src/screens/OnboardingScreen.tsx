import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import * as Location from 'expo-location'
import { VideoView, useVideoPlayer } from 'expo-video'
import { apiFetch } from '../lib/api'

const MOOD_OPTIONS = ['🙂', '😌', '☕', '🤝', '💬', '🌿']
const AMBER = '#e8824a'
const AMBER_LIGHT = 'rgba(232,130,74,0.7)'

interface NearbyPlace {
  placeId: string
  name: string
  address: string
  readyCount: number
}

interface PlacePreview {
  checkedInCount: number
  readyCount: number
  activeConversationCount: number
  participants?: { userId: string; username: string; moodEmoji: string; intentSummary: string | null }[]
  readyParticipants?: { userId: string; username: string; moodEmoji: string; intentSummary: string | null }[]
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

export default function OnboardingScreen() {
  const navigation = useNavigation<any>()
  const [places, setPlaces] = useState<NearbyPlace[]>([])
  const [placesLoading, setPlacesLoading] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<NearbyPlace | null>(null)
  const [preview, setPreview] = useState<PlacePreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [moodEmoji, setMoodEmoji] = useState('🙂')
  const [intentText, setIntentText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const previewParticipants = preview?.participants ?? preview?.readyParticipants ?? []

  const fetchNearbyPlaces = async () => {
    setPlacesLoading(true)
    setError('')
    setPlaces([])
    setSelectedPlace(null)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setError('Location permission denied. Please enable in Settings.')
        setPlacesLoading(false)
        return
      }
      let coords: { latitude: number; longitude: number } | null = null
      const lastKnown = await Location.getLastKnownPositionAsync({})
      if (lastKnown) {
        coords = lastKnown.coords
      } else {
        const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest })
        coords = fresh.coords
      }
      const result = await apiFetch('/api/places/nearby', {
        latitude: coords.latitude,
        longitude: coords.longitude,
      })
      setPlaces(Array.isArray(result) ? result : [])
    } catch (e: any) {
      setError(e.message || 'Could not load nearby places.')
    } finally {
      setPlacesLoading(false)
    }
  }

  useEffect(() => { fetchNearbyPlaces() }, [])

  useEffect(() => {
    if (!selectedPlace) { setPreview(null); return }
    let cancelled = false
    setPreviewLoading(true)
    apiFetch('/api/places/preview', { placeId: selectedPlace.placeId })
      .then((data) => { if (!cancelled) setPreview(data) })
      .catch(() => { if (!cancelled) setPreview(null) })
      .finally(() => { if (!cancelled) setPreviewLoading(false) })
    return () => { cancelled = true }
  }, [selectedPlace])

  const handleJoin = async () => {
    if (!selectedPlace) { setError('Pick a place first.'); return }
    setSaving(true)
    setError('')
    try {
      await apiFetch('/api/places/join', {
        moodEmoji,
        intentText,
        currentPlaceId: selectedPlace.placeId,
      })
      navigation.navigate('PlaceView')
    } catch (e: any) {
      setError(e.message || 'Could not join this place.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={s.root}>
      <VideoBackground style={s.videoBackground} />
      <View style={s.overlay} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Fixed Header */}
        <View style={s.header}>
            <TouchableOpacity onPress={() => { if (selectedPlace) { setSelectedPlace(null); } else if (navigation.canGoBack()) { navigation.goBack(); } else { navigation.navigate('Landing'); } }} style={s.backBtn}>
              <Text style={s.backBtnText}>‹</Text>
            </TouchableOpacity>
            <Text style={s.headerTitle}>
              Let's Talk{' '}
              <Text style={s.headerTitleHighlight}>Real</Text>
            </Text>
            <View style={{ width: 56 }} />
          </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>


          <Text style={s.subtitle}>Pick a place that feels active, then add your vibe.</Text>

          {error ? <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View> : null}

          {!selectedPlace && (
            <>
              <TouchableOpacity style={s.primaryBtn} onPress={fetchNearbyPlaces} disabled={placesLoading}>
                {placesLoading
                  ? <ActivityIndicator color="white" />
                  : <Text style={s.primaryBtnText}>📍 Refresh nearby places</Text>}
              </TouchableOpacity>
              {places.map((place) => (
                <TouchableOpacity key={place.placeId} style={s.placeCard} onPress={() => setSelectedPlace(place)}>
                  <View style={s.placeCardRow}>
                    <Text style={s.placeName}>{place.name}</Text>
                    <View style={[s.readyBadge, place.readyCount > 0 && s.readyBadgeActive]}>
                      <Text style={[s.readyBadgeText, place.readyCount > 0 && s.readyBadgeTextActive]}>
                        {place.readyCount} ready
                      </Text>
                    </View>
                  </View>
                  <Text style={s.placeAddress} numberOfLines={2}>{place.address}</Text>
                  <View style={s.placeStatus}>
                    <View style={[s.statusDot, place.readyCount > 0 && s.statusDotActive]} />
                    <Text style={s.statusText}>
                      {place.readyCount > 0 ? 'People are ready here now' : 'Quiet right now'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}

          {selectedPlace && (
            <>


              <View style={s.selectedCard}>
                <Text style={s.selectedName}>{selectedPlace.name}</Text>
                <Text style={s.selectedAddress}>{selectedPlace.address}</Text>
              </View>

              {previewLoading && <ActivityIndicator color={AMBER} style={{ marginVertical: 12 }} />}

              {preview && (
                <View style={s.previewCard}>
                  <Text style={s.previewTitle}>Place preview</Text>
                  <Text style={s.previewSubtitle}>See how active it is before you join.</Text>
                  <View style={s.statsRow}>
                    {[
                      { val: preview.readyCount, label: 'Ready' },
                      { val: preview.checkedInCount, label: 'Here now' },
                      { val: preview.activeConversationCount, label: 'Talking' },
                    ].map((item) => (
                      <View key={item.label} style={s.statBox}>
                        <Text style={s.statVal}>{item.val}</Text>
                        <Text style={s.statLabel}>{item.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={s.moodCard}>
                <Text style={s.moodTitle}>What would you like to talk about?</Text>
                <TextInput
                  style={s.intentInput}
                  placeholder="What's on your mind? (optional)"
                  placeholderTextColor="rgba(232,130,74,0.35)"
                  value={intentText}
                  onChangeText={setIntentText}
                  multiline
                  maxLength={200}
                />
              </View>

              <TouchableOpacity style={s.joinBtn} onPress={handleJoin} disabled={saving}>
                {saving ? <ActivityIndicator color="white" /> : <Text style={s.joinBtnText}>Join this place →</Text>}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0704' },
  videoBackground: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  overlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.65)' },
  scroll: { padding: 20, paddingTop: 12, paddingBottom: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#c084fc' },
  headerTitleHighlight: { fontSize: 26, fontWeight: '900', color: '#e9d5ff' },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(30,15,5,0.75)', justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: '#fff', fontWeight: '300', fontSize: 28, lineHeight: 30, marginLeft: -2 },
  logo: { fontSize: 20, fontWeight: '900', color: '#fff' },
  title: { fontSize: 32, fontWeight: '900', color: '#c084fc', lineHeight: 40, marginBottom: 20, textAlign: 'center' },
  titleHighlight: { fontSize: 32, fontWeight: '900', color: '#e9d5ff' },
  subtitle: { fontSize: 18, color: '#fff', lineHeight: 24, marginBottom: 20, fontWeight: '700' },
  errorBox: { backgroundColor: 'rgba(186,26,26,0.15)', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(186,26,26,0.3)' },
  errorText: { color: '#ff6b6b', fontSize: 13 },
  primaryBtn: { backgroundColor: AMBER, borderRadius: 50, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
  primaryBtnText: { color: '#0a0704', fontWeight: '800', fontSize: 15 },
  placeCard: { backgroundColor: 'rgba(26,16,8,0.75)', borderRadius: 20, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(232,130,74,0.2)' },
  placeCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  placeName: { fontSize: 16, fontWeight: '800', color: '#fff', flex: 1 },
  readyBadge: { backgroundColor: 'rgba(232,130,74,0.1)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  readyBadgeActive: { backgroundColor: 'rgba(232,130,74,0.2)' },
  readyBadgeText: { fontSize: 12, color: AMBER_LIGHT, fontWeight: '800' },
  readyBadgeTextActive: { color: AMBER },
  placeAddress: { fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 16, marginBottom: 8 },
  placeStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#94a3b8' },
  statusDotActive: { backgroundColor: '#4ade80' },
  statusText: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  backToPlaces: { marginBottom: 12 },
  backToPlacesText: { color: AMBER, fontWeight: '700', fontSize: 14 },
  selectedCard: { backgroundColor: 'rgba(26,16,8,0.75)', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(232,130,74,0.2)' },
  selectedName: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  selectedAddress: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  previewCard: { backgroundColor: 'rgba(26,16,8,0.75)', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(232,130,74,0.2)' },
  previewTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 2 },
  previewSubtitle: { fontSize: 12, color: AMBER_LIGHT, marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statBox: { flex: 1, backgroundColor: 'rgba(232,130,74,0.08)', borderRadius: 12, padding: 10, alignItems: 'center' },
  statVal: { fontSize: 22, fontWeight: '900', color: AMBER },
  statLabel: { fontSize: 11, color: AMBER_LIGHT, fontWeight: '600' },
  moodCard: { backgroundColor: 'rgba(26,16,8,0.75)', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(232,130,74,0.2)' },
  moodTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 10 },
  moodRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  moodBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(232,130,74,0.08)', borderWidth: 2, borderColor: 'transparent' },
  moodBtnActive: { borderColor: AMBER, backgroundColor: 'rgba(232,130,74,0.15)' },
  moodEmoji: { fontSize: 22 },
  intentInput: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 12, fontSize: 14, color: '#fff', borderWidth: 1, borderColor: 'rgba(232,130,74,0.25)', minHeight: 80, textAlignVertical: 'top' },
  joinBtn: { backgroundColor: AMBER, borderRadius: 50, paddingVertical: 16, alignItems: 'center' },
  joinBtnText: { color: '#0a0704', fontWeight: '800', fontSize: 16 },
})