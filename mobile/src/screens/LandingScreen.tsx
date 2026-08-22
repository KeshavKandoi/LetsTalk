import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { useNetworkCheck } from '../hooks/useNetworkCheck'
import { getSession, signOut } from '../lib/auth'
import { apiFetch } from '../lib/api'
import DrawerMenu from './DrawerMenu'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Modal, ActivityIndicator, Dimensions, Animated,
} from 'react-native'
import { Image } from 'expo-image'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { MaterialIcons, Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Line } from 'react-native-svg'

const { width } = Dimensions.get('window')
const BLUE = '#4E7FFF'
const PINK = '#FF5FA8'
const PURPLE = '#9C6BFF'
const ACCENT = '#7C5CFC'
const ACCENT_DIM = 'rgba(124,92,252,0.15)'
const MUTED = 'rgba(255,255,255,0.55)'
const BORDER = 'rgba(255,255,255,0.08)'
const BG = '#050505'

function MapGrid({ w, h }: { w: number; h: number }) {
  const cols = 6
  const rows = 5
  const lines = []
  for (let i = 1; i < cols; i++) {
    const x = (w / cols) * i
    lines.push(<Line key={`v${i}`} x1={x} y1={0} x2={x} y2={h} stroke="#fff" strokeOpacity={0.05} strokeWidth={1} />)
  }
  for (let i = 1; i < rows; i++) {
    const y = (h / rows) * i
    lines.push(<Line key={`h${i}`} x1={0} y1={y} x2={w} y2={y} stroke="#fff" strokeOpacity={0.05} strokeWidth={1} />)
  }
  return <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={StyleSheet.absoluteFillObject}>{lines}</Svg>
}

function NearbyMap({ pulseAnim }: any) {
  const w = Math.min(width - 48, 320)
  const h = 200

  const avatars = [
    { label: 'A', color: PINK, top: 22, left: 26 },
    { label: 'B', color: BLUE, top: 46, right: 30 },
    { label: 'C', color: '#e8b33d', bottom: 26, left: 34 },
    { label: 'D', color: '#3dbf9a', bottom: 22, right: 26 },
  ]

  return (
    <View style={[ns.mapCard, { width: w, height: h }]}>
      <MapGrid w={w} h={h} />

      <View style={ns.centerDotWrap}>
        <Animated.View style={[ns.centerRing, { transform: [{ scale: pulseAnim }] }]} />
        <View style={ns.centerDot} />
      </View>

      {avatars.map((a, i) => (
        <View
          key={i}
          style={[
            ns.avatarDot,
            { backgroundColor: a.color },
            a.top !== undefined ? { top: a.top } : {},
            a.bottom !== undefined ? { bottom: a.bottom } : {},
            a.left !== undefined ? { left: a.left } : {},
            a.right !== undefined ? { right: a.right } : {},
          ]}
        >
          <Text style={ns.avatarDotTxt}>{a.label}</Text>
          <View style={ns.avatarOnlineDot} />
        </View>
      ))}
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
  const [session, setSession] = useState<any>(null)

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

  const handleJoin = async () => {
    if (!isConnected) return
    try {
      const s = await getSession()
      if (s?.session) navigation.navigate('Onboarding' as never)
      else { await signOut(); navigation.navigate('Signup' as never) }
    } catch { await signOut(); navigation.navigate('Signup' as never) }
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
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('AccountMenu' as never)}>
          {avatarProfile?.photoUrl ? (
            <Image source={{ uri: avatarProfile.photoUrl }} style={s.headerAvatarImg} cachePolicy="disk" transition={150} />
          ) : (
            <View style={s.headerAvatarFallback}>
              <Text style={s.headerAvatarTxt}>{avatarProfile?.initials || '?'}</Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={s.navBrand}>
          <Text style={s.navTitle}>Let's Talk</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.hero}>
          <Text style={s.heroTitle}>
            <Text style={s.heroTitleLight}>Real people.{'\n'}</Text>
            <Text style={s.heroTitleBold}>Real conversations.</Text>
          </Text>
          <Text style={s.heroSub}>Meet people nearby who actually want to talk.</Text>

          <NearbyMap pulseAnim={pulseAnim} />

          <TouchableOpacity activeOpacity={0.9} onPress={handleJoin} style={{ width: '100%' }}>
            <LinearGradient colors={[BLUE, PURPLE, PINK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.ctaBtn}>
              <Feather name="search" size={18} color="#fff" />
              <Text style={s.ctaBtnText}>Find People Nearby</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={s.benefitsRow}>
            {[
              { icon: 'message-square', text: 'Talk in person' },
              { icon: 'zap', text: 'People nearby' },
              { icon: 'map-pin', text: 'Real places' },
            ].map((f, i) => (
              <View key={i} style={s.benefitItem}>
                <Feather name={f.icon as any} size={13} color="rgba(255,255,255,0.6)" />
                <Text style={s.benefitText}>{f.text}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.peopleSection}>
          <Text style={s.peopleSectionTitle}>People around you</Text>
          <TouchableOpacity activeOpacity={0.85} style={s.peopleCard} onPress={() => handleTabPress('nearby')}>
            <View style={s.peopleCardIcon}>
              <Feather name="user" size={20} color={ACCENT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.peopleCardTitle}>People nearby</Text>
              <Text style={s.peopleCardDesc}>Find people around you who are open to talk.</Text>
            </View>
            <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>
          <Text style={s.locationNote}>Your location is only used to find people nearby.</Text>
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
  mapCard: { borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: BORDER, overflow: 'hidden', marginBottom: 20, position: 'relative' },
  centerDotWrap: { position: 'absolute', top: '50%', left: '50%', marginLeft: -18, marginTop: -18, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  centerRing: { position: 'absolute', width: 36, height: 36, borderRadius: 18, backgroundColor: ACCENT, opacity: 0.18 },
  centerDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: ACCENT, borderWidth: 2, borderColor: '#fff' },
  avatarDot: { position: 'absolute', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: BG },
  avatarDotTxt: { fontSize: 12, fontWeight: '800', color: '#fff' },
  avatarOnlineDot: { position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#3dbf7a', borderWidth: 1.5, borderColor: BG },
})

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, zIndex: 10 },
  navBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navTitle: { fontSize: 20, fontWeight: '700', fontStyle: 'italic', color: '#fff', letterSpacing: -0.2 },

  scroll: { paddingBottom: 132 },

  hero: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8, alignItems: 'center' },
  heroTitle: { textAlign: 'center', marginBottom: 10 },
  heroTitleLight: { fontSize: 24, fontWeight: '600', color: 'rgba(255,255,255,0.6)', lineHeight: 30, letterSpacing: -0.3 },
  heroTitleBold: { fontSize: 32, fontWeight: '900', color: '#fff', lineHeight: 38, letterSpacing: -0.6 },
  heroSub: { fontSize: 15, color: MUTED, textAlign: 'center', lineHeight: 21, marginBottom: 18, maxWidth: '85%' },

  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 56, width: '100%', borderRadius: 999, marginBottom: 20, shadowColor: PURPLE, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  ctaBtnText: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.1 },

  benefitsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  benefitItem: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: BORDER, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  benefitText: { fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: '600' },

  peopleSection: { paddingHorizontal: 20, marginTop: 28 },
  peopleSectionTitle: { fontSize: 15, fontWeight: '800', color: '#fff', marginBottom: 10, letterSpacing: -0.2 },
  peopleCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: BORDER },
  peopleCardIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: ACCENT_DIM, alignItems: 'center', justifyContent: 'center' },
  peopleCardTitle: { fontSize: 14, fontWeight: '800', color: '#fff', marginBottom: 2 },
  peopleCardDesc: { fontSize: 12, color: MUTED, lineHeight: 16 },
  locationNote: { fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 14 },

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
