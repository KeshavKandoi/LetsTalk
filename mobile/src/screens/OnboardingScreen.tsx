import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { MaterialIcons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { apiFetch } from '../lib/api'

const AMBER = '#e8824a'
const AMBER_LIGHT = 'rgba(232,130,74,0.7)'

interface NearbyPlace {
  placeId: string
  name: string
  address: string
  readyCount: number
  lat?: number
  lng?: number
}

interface PlacePreview {
  checkedInCount: number
  readyCount: number
  activeConversationCount: number
}

export default function OnboardingScreen() {
  const navigation = useNavigation<any>()
  const [places, setPlaces] = useState<NearbyPlace[]>([])
  const [placesLoading, setPlacesLoading] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<NearbyPlace | null>(null)
  const [preview, setPreview] = useState<PlacePreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [intentText, setIntentText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredPlaces, setFilteredPlaces] = useState<NearbyPlace[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)

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

  const searchPlaces = (query: string) => {
    setSearchQuery(query)
    if (!query.trim()) {
      setIsSearching(false)
      setFilteredPlaces([])
      return
    }
    setIsSearching(true)
    const filtered = places.filter(place =>
      place.name.toLowerCase().includes(query.toLowerCase()) ||
      place.address.toLowerCase().includes(query.toLowerCase())
    )
    setFilteredPlaces(filtered)
  }

  useFocusEffect(
    useCallback(() => {
      fetchNearbyPlaces()
      const interval = setInterval(() => {
        if (!selectedPlace) fetchNearbyPlaces()
      }, 30000)
      return () => clearInterval(interval)
    }, [])
  )

  useEffect(() => {
    if (!selectedPlace) { setPreview(null); setError(''); return }
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
    if (!intentText.trim()) { setError('Please tell us what you would like to talk about.'); return }
    const wordCount = intentText.trim().split(/\s+/).length
    if (wordCount > 20) { setError('Please keep it to 20 words or less.'); return }
    setSaving(true)
    setError('')
    try {
      const fullIntent = intentText.trim()
      await apiFetch('/api/places/join', {
        moodEmoji: '🙂',
        intentText: fullIntent,
        currentPlaceId: selectedPlace.placeId,
      })
      navigation.navigate('PlaceView')
    } catch (e: any) {
      setError(e.message || 'Could not join this place.')
    } finally {
      setSaving(false)
    }
  }

  const displayPlaces = isSearching ? filteredPlaces : places
  const wordCount = intentText.trim() ? intentText.trim().split(/\s+/).filter(Boolean).length : 0

  return (
    <View style={s.root}>
      <View style={s.bgCircle1} />
      <View style={s.bgCircle2} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => {
              if (selectedPlace) {
                setSelectedPlace(null)
              } else if (navigation.canGoBack()) {
                navigation.goBack()
              } else {
                navigation.navigate('Landing')
              }
            }}
            style={s.backBtn}
          >
            <MaterialIcons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Let's Talk</Text>
          <View style={{ width: 44 }} />
        </View>

        {!selectedPlace ? (
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={s.pageTitle}>Find your spot</Text>
            <Text style={s.subtitle}>Pick a place that feels active right now.</Text>

            {error ? (
              <View style={s.errorBox}>
                <MaterialIcons name="error-outline" size={16} color="#ff6b6b" style={{ marginRight: 6 }} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={[s.searchBar, searchFocused && s.searchBarFocused]}>
              <MaterialIcons name="search" size={20} color={searchFocused ? AMBER : 'rgba(255,255,255,0.4)'} />
              <TextInput
                style={s.searchInput}
                placeholder="Search cafés, parks, libraries..."
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={searchQuery}
                onChangeText={searchPlaces}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => { setSearchQuery(''); setIsSearching(false); setFilteredPlaces([]) }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <MaterialIcons name="close" size={18} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={fetchNearbyPlaces} disabled={placesLoading}>
                  {placesLoading
                    ? <ActivityIndicator size="small" color={AMBER} />
                    : <MaterialIcons name="my-location" size={18} color={AMBER} />
                  }
                </TouchableOpacity>
              )}
            </View>

            {displayPlaces.length === 0 && !placesLoading ? (
              <View style={s.emptyState}>
                <MaterialIcons name="location-off" size={40} color="rgba(255,255,255,0.2)" />
                <Text style={s.emptyText}>{isSearching ? 'No places match your search' : 'No places found nearby'}</Text>
                {!isSearching && (
                  <TouchableOpacity style={s.retryBtn} onPress={fetchNearbyPlaces}>
                    <Text style={s.retryBtnText}>Try again</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              displayPlaces.map((place) => (
                <TouchableOpacity key={place.placeId} style={s.placeCard} onPress={() => setSelectedPlace(place)} activeOpacity={0.75}>
                  <View style={s.placeCardRow}>
                    <View style={s.placeIcon}>
                      <MaterialIcons name="place" size={18} color={AMBER} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.placeName}>{place.name}</Text>
                      <Text style={s.placeAddress} numberOfLines={1}>{place.address}</Text>
                    </View>
                    <View style={[s.readyBadge, place.readyCount > 0 && s.readyBadgeActive]}>
                      <View style={[s.statusDot, place.readyCount > 0 && s.statusDotActive]} />
                      <Text style={[s.readyBadgeText, place.readyCount > 0 && s.readyBadgeTextActive]}>{place.readyCount} ready</Text>
                    </View>
                  </View>
                  <Text style={s.statusText}>{place.readyCount > 0 ? '🟢 People are ready here now' : '⚪ Quiet right now'}</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={s.pageTitle}>Set your vibe</Text>
            <Text style={s.subtitle}>Tell people what you're here for.</Text>

            {error ? (
              <View style={s.errorBox}>
                <MaterialIcons name="error-outline" size={16} color="#ff6b6b" style={{ marginRight: 6 }} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Selected place */}
            <View style={s.selectedCard}>
              <View style={s.selectedCardLeft}>
                <MaterialIcons name="place" size={20} color={AMBER} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.selectedName}>{selectedPlace.name}</Text>
                <Text style={s.selectedAddress} numberOfLines={1}>{selectedPlace.address}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedPlace(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="close" size={18} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>

            {/* Stats */}
            {previewLoading && <ActivityIndicator color={AMBER} style={{ marginVertical: 12 }} />}
            {preview && (
              <View style={s.statsRow}>
                {[
                  { val: preview.readyCount, label: 'Ready', icon: 'person' },
                  { val: preview.checkedInCount, label: 'Here now', icon: 'location-on' },
                  { val: preview.activeConversationCount, label: 'Talking', icon: 'chat-bubble' },
                ].map((item) => (
                  <View key={item.label} style={s.statBox}>
                    <Text style={s.statVal}>{item.val}</Text>
                    <Text style={s.statLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
            )}


            {/* Intent */}
            <View style={s.sectionCard}>
              <Text style={s.sectionLabel}>What do you want to talk about?</Text>
              <TextInput
                style={s.intentInput}
                placeholder="e.g. looking for a creative mind to bounce ideas with..."
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={intentText}
                onChangeText={setIntentText}
                multiline
                maxLength={200}
              />
              <Text style={[s.wordCount, wordCount > 20 && s.wordCountOver]}>{wordCount}/20 words</Text>
            </View>

            <TouchableOpacity style={s.joinBtn} onPress={handleJoin} disabled={saving} activeOpacity={0.85}>
              {saving
                ? <ActivityIndicator color="#0a0704" />
                : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={s.joinBtnText}>Join this place</Text>
                    <MaterialIcons name="arrow-forward" size={20} color="#0a0704" />
                  </View>
              }
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080502' },
  bgCircle1: { position: 'absolute', top: -80, right: -80, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(232,130,74,0.06)' },
  bgCircle2: { position: 'absolute', bottom: 100, left: -100, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(232,130,74,0.04)' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(232,130,74,0.1)' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.07)', justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 60 },
  pageTitle: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 6, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 20, lineHeight: 20 },
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(186,26,26,0.12)', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(186,26,26,0.25)' },
  errorText: { color: '#ff6b6b', fontSize: 13, flex: 1 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 16 },
  searchBarFocused: { borderColor: 'rgba(232,130,74,0.5)', backgroundColor: 'rgba(232,130,74,0.05)' },
  searchInput: { flex: 1, fontSize: 14, color: '#fff' },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.35)', fontWeight: '600' },
  retryBtn: { marginTop: 4, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(232,130,74,0.4)' },
  retryBtnText: { color: AMBER, fontWeight: '700', fontSize: 13 },
  placeCard: { backgroundColor: 'rgba(20,12,6,0.9)', borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(232,130,74,0.15)' },
  placeCardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  placeIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(232,130,74,0.1)', justifyContent: 'center', alignItems: 'center' },
  placeName: { fontSize: 15, fontWeight: '800', color: '#fff', marginBottom: 2 },
  placeAddress: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  readyBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  readyBadgeActive: { backgroundColor: 'rgba(74,222,128,0.1)' },
  readyBadgeText: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '700' },
  readyBadgeTextActive: { color: '#4ade80' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  statusDotActive: { backgroundColor: '#4ade80' },
  statusText: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
  selectedCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(232,130,74,0.08)', borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(232,130,74,0.25)' },
  selectedCardLeft: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(232,130,74,0.15)', justifyContent: 'center', alignItems: 'center' },
  selectedName: { fontSize: 15, fontWeight: '800', color: '#fff', marginBottom: 2 },
  selectedAddress: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statBox: { flex: 1, backgroundColor: 'rgba(232,130,74,0.07)', borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(232,130,74,0.12)' },
  statVal: { fontSize: 22, fontWeight: '900', color: AMBER },
  statLabel: { fontSize: 11, color: AMBER_LIGHT, fontWeight: '600', marginTop: 2 },
  sectionCard: { backgroundColor: 'rgba(20,12,6,0.9)', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(232,130,74,0.15)' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.6)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  vibeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vibeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)' },
  vibeBtnActive: { borderColor: AMBER, backgroundColor: 'rgba(232,130,74,0.1)' },
  vibeBtnText: { fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: '600' },
  vibeBtnTextActive: { color: AMBER },
  intentInput: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12, fontSize: 14, color: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', minHeight: 90, textAlignVertical: 'top', lineHeight: 22 },
  wordCount: { fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'right', marginTop: 8 },
  wordCountOver: { color: '#ff4444' },
  locationHintRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  hintChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  hintChipActive: { borderColor: AMBER, backgroundColor: 'rgba(232,130,74,0.1)' },
  hintChipText: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  hintChipTextActive: { color: AMBER },
  hintInput: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12, fontSize: 13, color: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  joinBtn: { backgroundColor: AMBER, borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  joinBtnText: { color: '#0a0704', fontWeight: '900', fontSize: 16 },
})
