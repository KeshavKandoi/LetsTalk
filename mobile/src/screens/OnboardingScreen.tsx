import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, ActivityIndicator, TextInput,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import * as Location from 'expo-location'
import { apiFetch } from '../lib/api'

const MOOD_OPTIONS = ['🙂', '😌', '☕', '🤝', '💬', '🌿']

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
  participants?: {
    userId: string
    username: string
    moodEmoji: string
    intentSummary: string | null
  }[]
  readyParticipants?: {
    userId: string
    username: string
    moodEmoji: string
    intentSummary: string | null
  }[]
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
        const fresh = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Lowest,
        })
        coords = fresh.coords
      }
      const result = await apiFetch('/api/places/nearby', {
        latitude: coords.latitude,
        longitude: coords.longitude,
      })
      const placeList = Array.isArray(result) ? result : []
      setPlaces(placeList)
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
      navigation.reset({ index: 0, routes: [{ name: 'PlaceView' }] })
    } catch (e: any) {
      setError(e.message || 'Could not join this place.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.navigate('Landing')} style={styles.backBtn}>
            <Text style={styles.backBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.logo}>LetsTalk</Text>
          <View style={{ width: 60 }} />
        </View>

        <Text style={styles.title}>Find people ready{'\n'}to talk nearby.</Text>
        <Text style={styles.subtitle}>Pick a place that feels active, then add your vibe.</Text>

        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

        {!selectedPlace && (
          <>
            <TouchableOpacity style={styles.primaryBtn} onPress={fetchNearbyPlaces} disabled={placesLoading}>
              {placesLoading
                ? <ActivityIndicator color="white" />
                : <Text style={styles.primaryBtnText}>📍 Refresh nearby places</Text>}
            </TouchableOpacity>
            {places.map((place) => (
              <TouchableOpacity key={place.placeId} style={styles.placeCard} onPress={() => setSelectedPlace(place)}>
                <View style={styles.placeCardRow}>
                  <Text style={styles.placeName}>{place.name}</Text>
                  <View style={[styles.readyBadge, place.readyCount > 0 && styles.readyBadgeActive]}>
                    <Text style={[styles.readyBadgeText, place.readyCount > 0 && styles.readyBadgeTextActive]}>
                      {place.readyCount} ready
                    </Text>
                  </View>
                </View>
                <Text style={styles.placeAddress} numberOfLines={2}>{place.address}</Text>
                <View style={styles.placeStatus}>
                  <View style={[styles.statusDot, place.readyCount > 0 && styles.statusDotActive]} />
                  <Text style={styles.statusText}>
                    {place.readyCount > 0 ? 'People are ready here now' : 'Quiet right now'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {selectedPlace && (
          <>
            <TouchableOpacity style={styles.backToPlaces} onPress={() => setSelectedPlace(null)}>
              <Text style={styles.backToPlacesText}>← Back to places</Text>
            </TouchableOpacity>

            <View style={styles.selectedCard}>
              <Text style={styles.selectedName}>{selectedPlace.name}</Text>
              <Text style={styles.selectedAddress}>{selectedPlace.address}</Text>
            </View>

            {previewLoading && <ActivityIndicator color="#1a6b3c" style={{ marginVertical: 12 }} />}

            {preview && (
              <View style={styles.previewCard}>
                <Text style={styles.previewTitle}>Place preview</Text>
                <Text style={styles.previewSubtitle}>See how active it is before you join.</Text>
                <View style={styles.statsRow}>
                  {[
                    { val: preview.readyCount, label: 'Ready' },
                    { val: preview.checkedInCount, label: 'Here now' },
                    { val: preview.activeConversationCount, label: 'Talking' },
                  ].map((s) => (
                    <View key={s.label} style={styles.statBox}>
                      <Text style={styles.statVal}>{s.val}</Text>
                      <Text style={styles.statLabel}>{s.label}</Text>
                    </View>
                  ))}
                </View>

              </View>
            )}

            <View style={styles.moodCard}>
              <Text style={styles.moodTitle}>Your vibe</Text>
              <View style={styles.moodRow}>
                {MOOD_OPTIONS.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.moodBtn, moodEmoji === m && styles.moodBtnActive]}
                    onPress={() => setMoodEmoji(m)}
                  >
                    <Text style={styles.moodEmoji}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.intentInput}
                placeholder="What's on your mind? (optional)"
                placeholderTextColor="rgba(45,110,62,0.5)"
                value={intentText}
                onChangeText={setIntentText}
                multiline
                maxLength={200}
              />
            </View>

            <TouchableOpacity style={styles.joinBtn} onPress={handleJoin} disabled={saving}>
              {saving ? <ActivityIndicator color="white" /> : <Text style={styles.joinBtnText}>Join this place →</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#d4f5d4' },
  scroll: { padding: 20, paddingTop: 48, paddingBottom: 48 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(30,15,5,0.75)', justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: '#fff', fontWeight: '300', fontSize: 28, lineHeight: 30, marginLeft: -2 },
  logo: { fontSize: 20, fontWeight: '900', color: '#0f3320' },
  title: { fontSize: 32, fontWeight: '900', color: '#0f3320', lineHeight: 40, marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#2d6e3e', lineHeight: 22, marginBottom: 20 },
  errorBox: { backgroundColor: '#fee2e2', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#fca5a5' },
  errorText: { color: '#dc2626', fontSize: 13 },
  primaryBtn: { backgroundColor: '#1a6b3c', borderRadius: 50, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
  primaryBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  placeCard: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 20, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(144,212,144,0.5)' },
  placeCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  placeName: { fontSize: 16, fontWeight: '800', color: '#0f3320', flex: 1 },
  readyBadge: { backgroundColor: 'rgba(144,212,144,0.3)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  readyBadgeActive: { backgroundColor: 'rgba(26,107,60,0.15)' },
  readyBadgeText: { fontSize: 12, color: '#2d6e3e', fontWeight: '600' },
  readyBadgeTextActive: { color: '#1a6b3c' },
  placeAddress: { fontSize: 12, color: '#2d6e3e', lineHeight: 16, marginBottom: 8 },
  placeStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#94a3b8' },
  statusDotActive: { backgroundColor: '#16a34a' },
  statusText: { fontSize: 12, color: '#2d6e3e', fontWeight: '500' },
  backToPlaces: { marginBottom: 12 },
  backToPlacesText: { color: '#1a6b3c', fontWeight: '700', fontSize: 14 },
  selectedCard: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(144,212,144,0.5)' },
  selectedName: { fontSize: 18, fontWeight: '800', color: '#0f3320', marginBottom: 4 },
  selectedAddress: { fontSize: 12, color: '#2d6e3e' },
  previewCard: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(144,212,144,0.5)' },
  previewTitle: { fontSize: 15, fontWeight: '700', color: '#0f3320', marginBottom: 2 },
  previewSubtitle: { fontSize: 12, color: '#2d6e3e', marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statBox: { flex: 1, backgroundColor: 'rgba(26,107,60,0.07)', borderRadius: 12, padding: 10, alignItems: 'center' },
  statVal: { fontSize: 22, fontWeight: '900', color: '#0f3320' },
  statLabel: { fontSize: 11, color: '#2d6e3e', fontWeight: '600' },
  participantsTitle: { fontSize: 13, fontWeight: '700', color: '#0f3320', marginBottom: 8 },
  participantRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  participantEmoji: { fontSize: 24 },
  participantName: { fontSize: 13, fontWeight: '700', color: '#0f3320' },
  participantMood: { fontSize: 12, color: '#2d6e3e' },
  moodCard: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(144,212,144,0.5)' },
  moodTitle: { fontSize: 15, fontWeight: '700', color: '#0f3320', marginBottom: 10 },
  moodRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  moodBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(26,107,60,0.07)', borderWidth: 2, borderColor: 'transparent' },
  moodBtnActive: { borderColor: '#1a6b3c', backgroundColor: 'rgba(26,107,60,0.12)' },
  moodEmoji: { fontSize: 22 },
  intentInput: { backgroundColor: '#f0faf0', borderRadius: 14, padding: 12, fontSize: 14, color: '#0f3320', borderWidth: 1, borderColor: 'rgba(144,212,144,0.6)', minHeight: 80, textAlignVertical: 'top' },
  joinBtn: { backgroundColor: '#1a6b3c', borderRadius: 50, paddingVertical: 16, alignItems: 'center' },
  joinBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
})
