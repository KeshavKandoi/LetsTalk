import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { useNetworkCheck } from '../hooks/useNetworkCheck'
import { getSession, signOut } from '../lib/auth'
import { apiFetch } from '../lib/api'
import DrawerMenu from './DrawerMenu'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Modal, ActivityIndicator, Dimensions, Animated, InteractionManager,
} from 'react-native'
import { Image } from 'expo-image'
import * as Location from 'expo-location'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { MaterialIcons, Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'

const { width } = Dimensions.get('window')
const BLUE = '#4E7FFF'
const PINK = '#FF5FA8'
const PURPLE = '#9C6BFF'
const ACCENT = '#7C5CFC'
const ACCENT_DIM = 'rgba(124,92,252,0.15)'
const MUTED = 'rgba(255,255,255,0.55)'
const BORDER = 'rgba(255,255,255,0.08)'
const BG = '#050505'

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(m: number) {
  if (m < 1000) return `${Math.round(m)}m away`
  return `${(m / 1000).toFixed(1)}km away`
}

function NearbyMap({ pulseAnim }: any) {
  const w = width
  const h = 280

  return (
    <View style={[ns.mapCard, { width: w, height: h }]}>
      <Image
        source={require('../../assets/map.jpeg')}
        style={{ position: 'absolute', top: 0, left: 0, width: w, height: h }}
        contentFit="cover"
        cachePolicy="memory-disk"
      />

      <LinearGradient
        colors={['rgba(5,5,5,1)', 'rgba(5,5,5,0.3)', 'rgba(5,5,5,0)', 'rgba(5,5,5,0.15)', 'rgba(5,5,5,1)']}
        locations={[0, 0.18, 0.5, 0.8, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={['rgba(5,5,5,0.9)', 'rgba(5,5,5,0)', 'rgba(5,5,5,0)', 'rgba(5,5,5,0.9)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        locations={[0, 0.1, 0.9, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={ns.textOverlay}>
        <Text style={ns.overlayTitle}>Real people.{'\n'}Real conversations.</Text>
        <Text style={ns.overlaySub}>Discover people nearby who are open to talking.</Text>
      </View>
    </View>
  )
}

export default function LandingScreen() {
  const navigation = useNavigation<any>()
  const isConnected = useNetworkCheck()
  const insets = useSafeAreaInsets()
  const [profileVisible, setProfileVisible] = useState(false)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [avatarProfile, setAvatarProfile] = useState<{ photoUrl?: string; initials: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'explore' | 'nearby' | 'chats' | 'profile'>('explore')
  const [session, setSession] = useState<any>(undefined)
  const [placesNearby, setPlacesNearby] = useState<any[]>([])
  const [peopleNearby, setPeopleNearby] = useState<any[]>([])
  const [placesLoading, setPlacesLoading] = useState(true)
  const [peopleLoading, setPeopleLoading] = useState(true)

  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    AsyncStorage.getItem('avatar_profile_cache')
      .then((cached) => { if (cached) setAvatarProfile(JSON.parse(cached)) })
      .catch(() => {})
      .then(() => apiFetch('/api/places/state', {}).catch(() => null))
      .then((data) => {
        const user = data?.session?.user
        if (user) {
          const name = user.username || user.name || '?'
          const rawUrl = data?.profile?.photoUrl || user.image || null
          const fresh = { photoUrl: rawUrl, initials: name.slice(0, 2).toUpperCase() }
          setAvatarProfile(fresh)
          AsyncStorage.setItem('avatar_profile_cache', JSON.stringify(fresh)).catch(() => {})
        }
      })
      .catch(() => {})

    getSession()
      .then((s) => setSession(s))
      .catch(() => setSession(null))

    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.25, duration: 1200, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
    ])).start()
  }, [])

  useEffect(() => {
    let cancelled = false
    const task = InteractionManager.runAfterInteractions(() => {
      ;(async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync()
          if (status !== 'granted') { setPlacesLoading(false); setPeopleLoading(false); return }

          const lastKnown = await Location.getLastKnownPositionAsync({})
          const loc = lastKnown ?? await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Lowest,
          })
          const { latitude, longitude } = loc.coords

          const places = await apiFetch('/api/places/nearby', { latitude, longitude })
          if (cancelled) return
          const placesList = Array.isArray(places) ? places : []
          const withDistance = placesList.map((p: any) => ({
            ...p,
            distanceLabel: formatDistance(distanceMeters(latitude, longitude, p.lat, p.lng)),
          }))
          setPlacesNearby(withDistance)
          setPlacesLoading(false)

          const topPlaces = withDistance.slice(0, 2)
          const previews = await Promise.all(
            topPlaces.map((p: any) => apiFetch('/api/places/nearby-people', { placeId: p.placeId }).catch(() => null))
          )
          if (cancelled) return
          const people: any[] = []
          previews.forEach((preview: any) => {
            if (preview?.participants) {
              preview.participants.forEach((participant: any) => {
                people.push(participant)
              })
            }
          })
          setPeopleNearby(people)
          setPeopleLoading(false)
        } catch (e) {
          if (!cancelled) { setPlacesLoading(false); setPeopleLoading(false) }
        }
      })()
    })
    return () => { cancelled = true; task.cancel() }
  }, [])

  const openProfile = async () => {
    setProfileVisible(true)
    setProfileLoading(true)
    try { const s = await getSession(); setProfile(s) } catch { setProfile(null) }
    setProfileLoading(false)
  }

  const handleLogout = async () => {
    await signOut()
    setProfileVisible(false)
    setProfile(null)
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] })
  }

  const handleJoin = () => {
    if (!isConnected) return

    if (session !== undefined) {
      if (session?.session) navigation.navigate('Onboarding' as never)
      else { signOut(); navigation.navigate('Signup' as never) }
      return
    }

    getSession()
      .then((s) => {
        if (s?.session) navigation.navigate('Onboarding' as never)
        else { signOut(); navigation.navigate('Signup' as never) }
      })
      .catch(() => { signOut(); navigation.navigate('Signup' as never) })
  }

  const handleTabPress = (tab: 'explore' | 'nearby' | 'chats' | 'profile') => {
    setActiveTab(tab)
    if (tab === 'explore') return
    if (!isConnected) return
    if (!session?.session) { navigation.navigate('Signup' as never); return }
    if (tab === 'nearby') navigation.navigate('Onboarding' as never)
    else if (tab === 'chats') navigation.navigate('Friends' as never)
    else navigation.navigate('Profile' as never)
  }

  useFocusEffect(
    useCallback(() => {
      setActiveTab('explore')
    }, [])
  )

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar style="light" />

      <View style={s.nav}>
        <View style={s.navBrand}>
          <Text style={s.navTitle}>Let's Talk</Text>
        </View>
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('AccountMenu' as never)}>
          {avatarProfile?.photoUrl ? (
            <Image source={{ uri: avatarProfile.photoUrl }} style={s.headerAvatarImg} cachePolicy="disk" transition={150} />
          ) : (
            <View style={s.headerAvatarFallback}>
              <Text style={s.headerAvatarTxt}>{avatarProfile?.initials || '?'}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.hero}>
          <NearbyMap pulseAnim={pulseAnim} />

          <TouchableOpacity activeOpacity={0.9} onPress={handleJoin} style={{ width: '100%', paddingHorizontal: 20, marginTop: 20 }}>
            <LinearGradient colors={[BLUE, PURPLE, PINK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.ctaBtn}>
              <Text style={s.ctaBtnText}>Find People Nearby</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={s.rowSection}>
          <View style={s.rowSectionHeader}>
            <Text style={s.rowSectionTitle}>People nearby</Text>
            <TouchableOpacity onPress={() => handleTabPress('nearby')}>
              <Text style={s.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cardRow}>
            {peopleLoading ? (
              [0, 1].map((i) => (
                <View key={i} style={s.personCard}>
                  <View style={s.personAvatar}><Feather name="user" size={18} color={ACCENT} /></View>
                  <Text style={s.personName} numberOfLines={2}>Searching for people nearby...</Text>
                </View>
              ))
            ) : peopleNearby.length === 0 ? (
              <View style={s.personCard}>
                <View style={s.personAvatar}><Feather name="user" size={18} color={ACCENT} /></View>
                <Text style={s.personName} numberOfLines={2}>No one nearby right now</Text>
              </View>
            ) : (
              peopleNearby.map((p) => (
                <View key={p.userId} style={s.personCard}>
                  {p.photoUrl ? (
                    <Image source={{ uri: p.photoUrl }} style={s.personAvatarImg} />
                  ) : (
                    <View style={s.personAvatar}><Feather name="user" size={18} color={ACCENT} /></View>
                  )}
                  <Text style={s.personName} numberOfLines={2}>
                    {(p.username || 'Someone nearby')}{p.moodEmoji ? ' ' + p.moodEmoji : ''}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>

        <View style={s.rowSection}>
          <View style={s.rowSectionHeader}>
            <Text style={s.rowSectionTitle}>Places nearby</Text>
            <TouchableOpacity onPress={() => handleTabPress('nearby')}>
              <Text style={s.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cardRow}>
            {placesLoading ? (
              [0, 1].map((i) => (
                <View key={i} style={s.placeCard}>
                  <View style={s.placeThumb} />
                  <Text style={s.placeName} numberOfLines={2}>Loading nearby venues...</Text>
                </View>
              ))
            ) : placesNearby.length === 0 ? (
              <View style={s.placeCard}>
                <View style={s.placeThumb} />
                <Text style={s.placeName} numberOfLines={2}>No places found nearby</Text>
              </View>
            ) : (
              placesNearby.map((p) => (
                <View key={p.placeId} style={s.placeCard}>
                  {p.photoUrl ? (
                    <Image source={{ uri: p.photoUrl }} style={s.placeThumbImg} contentFit="cover" cachePolicy="memory-disk" />
                  ) : (
                    <View style={s.placeThumb} />
                  )}
                  <Text style={s.placeName} numberOfLines={2}>{p.name} · {p.distanceLabel}</Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>

      </ScrollView>

      <DrawerMenu visible={drawerVisible} onClose={() => setDrawerVisible(false)} />

      <Modal visible={profileVisible} transparent animationType="slide" onRequestClose={() => setProfileVisible(false)}>
        <TouchableOpacity style={ps.overlay} activeOpacity={1} onPress={() => setProfileVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={ps.sheet}>
            <View style={ps.handle} />
            {profileLoading ? (
              <ActivityIndicator color={ACCENT} size="large" style={{ marginVertical: 40 }} />
            ) : profile?.session ? (
              <>
                <View style={ps.avatarRow}>
                  <View style={ps.avatar}>
                    <Text style={ps.avatarTxt}>{(profile.session.user?.username || profile.session.user?.name || '?').slice(0,2).toUpperCase()}</Text>
                  </View>
                  <View>
                    <Text style={ps.name}>{profile.session.user?.username || profile.session.user?.name}</Text>
                    <Text style={ps.email}>{profile.session.user?.email}</Text>
                  </View>
                </View>
                <Text style={ps.bio}>{profile.profile?.intentText || 'Open to a conversation.'}</Text>
                <View style={ps.tagsRow}>
                  <View style={ps.tag}><Text style={ps.tagTxt}>{profile.profile?.moodEmoji || '🙂'} Mood</Text></View>
                  {profile.profile?.currentPlaceId
                    ? <View style={ps.tag}><Text style={ps.tagTxt}>📍 Checked in</Text></View>
                    : <View style={ps.tag}><Text style={ps.tagTxt}>🏠 Not checked in</Text></View>}
                </View>
                <TouchableOpacity style={ps.fullBtn} onPress={() => { setProfileVisible(false); navigation.navigate('Profile' as never) }}>
                  <Text style={ps.fullBtnTxt}>View full profile</Text>
                  <MaterialIcons name="arrow-forward" size={16} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={ps.logoutBtn} onPress={handleLogout}>
                  <Text style={ps.logoutTxt}>Log out</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={ps.name}>Not logged in</Text>
                <Text style={ps.bio}>Join Let's Talk to explore more.</Text>
                <TouchableOpacity style={ps.fullBtn} onPress={() => { setProfileVisible(false); navigation.navigate('Signup' as never) }}>
                  <Text style={ps.fullBtnTxt}>Sign up</Text>
                  <MaterialIcons name="arrow-forward" size={16} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={ps.logoutBtn} onPress={() => { setProfileVisible(false); navigation.navigate('Login' as never) }}>
                  <Text style={ps.logoutTxt}>Log in</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <View style={[s.bottomNav, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={[s.navItem, activeTab === 'explore' && s.navItemActive]} onPress={() => handleTabPress('explore')}>
          <Feather name="compass" size={21} color={activeTab === 'explore' ? ACCENT : 'rgba(255,255,255,0.38)'} />
          <Text style={[s.navItemLabel, activeTab === 'explore' && s.navItemLabelActive]}>Explore</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.navItem, activeTab === 'nearby' && s.navItemActive]} onPress={() => handleTabPress('nearby')}>
          <Feather name="map-pin" size={21} color={activeTab === 'nearby' ? ACCENT : 'rgba(255,255,255,0.38)'} />
          <Text style={[s.navItemLabel, activeTab === 'nearby' && s.navItemLabelActive]}>Nearby</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.navItem, activeTab === 'chats' && s.navItemActive]} onPress={() => handleTabPress('chats')}>
          <Feather name="message-circle" size={21} color={activeTab === 'chats' ? ACCENT : 'rgba(255,255,255,0.38)'} />
          <Text style={[s.navItemLabel, activeTab === 'chats' && s.navItemLabelActive]}>Chats</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.navItem, activeTab === 'profile' && s.navItemActive]} onPress={() => handleTabPress('profile')}>
          <Feather name="user" size={21} color={activeTab === 'profile' ? ACCENT : 'rgba(255,255,255,0.38)'} />
          <Text style={[s.navItemLabel, activeTab === 'profile' && s.navItemLabelActive]}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const ns = StyleSheet.create({
  mapCard: { overflow: 'hidden', position: 'relative' },
  centerDotWrap: { position: 'absolute', top: '50%', left: '50%', marginLeft: -18, marginTop: -18, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  centerRing: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.75)' },
  centerPin: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(124,92,252,0.9)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
    shadowColor: ACCENT, shadowOpacity: 0.9, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 10,
  },
  textOverlay: { position: 'absolute', bottom: 22, left: 0, right: 0, paddingHorizontal: 20 },
  overlayTitle: { fontSize: 28, fontWeight: '800', color: '#fff', lineHeight: 34, letterSpacing: -0.5, marginBottom: 8 },
  overlaySub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 18 },
})

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4, zIndex: 10 },
  navBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navTitle: { fontSize: 22, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },

  scroll: { paddingBottom: 132 },

  hero: { paddingTop: 0, paddingBottom: 8 },

  heroTextWrap: { marginTop: 16, marginBottom: 16, paddingHorizontal: 20 },
  heroTitle: { fontSize: 28, fontWeight: '800', color: '#fff', lineHeight: 34, letterSpacing: -0.5, marginBottom: 8 },
  heroSub: { fontSize: 14, color: MUTED, lineHeight: 19 },

  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, width: '100%', borderRadius: 999, marginBottom: 8, shadowColor: PURPLE, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  ctaBtnText: { color: '#fff', fontWeight: '700', fontSize: 15, letterSpacing: 0.1 },

  rowSection: { marginTop: 24, paddingLeft: 20 },
  rowSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingRight: 20 },
  rowSectionTitle: { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  seeAll: { fontSize: 13, fontWeight: '600', color: ACCENT },
  cardRow: { flexDirection: 'row', gap: 12, paddingRight: 20 },

  personCard: { width: 200, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: BORDER },
  personAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: ACCENT_DIM, alignItems: 'center', justifyContent: 'center' },
  personAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  personName: { flex: 1, fontSize: 12, color: MUTED, lineHeight: 16 },

  placeCard: { width: 200, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14,padding: 12, borderWidth: 1, borderColor: BORDER },
  placeThumb: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(124,92,252,0.15)' },
  placeThumbImg: { width: 40, height: 40, borderRadius: 10 },
  placeName: { flex: 1, fontSize: 12, color: MUTED, lineHeight: 16 },

  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: '#0a0a0a', paddingTop: 10, paddingHorizontal: 14, justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: BORDER },
  navItem: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, minWidth: 60 },
  navItemActive: { backgroundColor: ACCENT_DIM, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  navItemLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.4)', marginTop: 2, letterSpacing: 0.2 },
  navItemLabelActive: { color: ACCENT },
  headerAvatarImg: { width: 32, height: 32, borderRadius: 16 },
  headerAvatarFallback: { width: 32, height: 32, borderRadius: 16, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  headerAvatarTxt: { fontSize: 12, fontWeight: '800', color: '#fff' },
})

const ps = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: 'rgba(10,10,10,0.98)', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 24, paddingBottom: 40, borderTopWidth: 1, borderTopColor: BORDER },
  handle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: ACCENT_DIM },
  avatarTxt: { fontSize: 22, fontWeight: '800', color: '#fff' },
  name: { fontSize: 20, fontWeight: '800', color: '#fff' },
  email: { fontSize: 13, color: MUTED, marginTop: 2 },
  bio: { fontSize: 14, color: MUTED, lineHeight: 20, marginBottom: 14 },
  tagsRow: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  tag: { backgroundColor: ACCENT_DIM, borderRadius: 50, paddingHorizontal: 14, paddingVertical: 6 },
  tagTxt: { fontSize: 13, fontWeight: '600', color: '#fff' },
  fullBtn: { backgroundColor: ACCENT, borderRadius: 50, paddingVertical: 14, alignItems: 'center', marginBottom: 10, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  fullBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  logoutBtn: { borderWidth: 1.5, borderColor: 'rgba(186,26,26,0.4)', borderRadius: 50, paddingVertical: 13, alignItems: 'center' },
  logoutTxt: { color: '#ff6b6b', fontWeight: '700', fontSize: 15 },
})
