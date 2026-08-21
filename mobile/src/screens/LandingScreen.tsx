import { useNavigation } from '@react-navigation/native'
import { useNetworkCheck } from '../hooks/useNetworkCheck'
import { getSession, signOut } from '../lib/auth'
import { apiFetch } from '../lib/api'
import DrawerMenu from './DrawerMenu'
import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Animated, Modal, ActivityIndicator, Dimensions,
} from 'react-native'
import { Image } from 'expo-image'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { MaterialIcons, Feather } from '@expo/vector-icons'
import Svg, { Path, Circle, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg'

const { width } = Dimensions.get('window')
const ACCENT = '#7C5CFC'
const ACCENT_DIM = 'rgba(124,92,252,0.15)'
const MUTED = 'rgba(255,255,255,0.55)'
const BORDER = 'rgba(255,255,255,0.08)'
const AMBER = '#e8824a'

function EmberBackground() {
  return <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#050505' }]} pointerEvents="none" />
}

function AvatarStack({ pulseAnim }: any) {
  const avatars = [
    { l: 'R', c: '#7C5CFC' },
    { l: 'P', c: '#9F7AEA' },
    { l: 'A', c: '#6D5BD0' },
    { l: 'K', c: '#5B4BC4' },
  ]
  return (
    <View style={as.row}>
      <View style={as.stack}>
        {avatars.map((a, i) => (
          <View key={a.l} style={[as.avatar, { backgroundColor: a.c, marginLeft: i === 0 ? 0 : -12, zIndex: avatars.length - i }]}>
            <Text style={as.avatarTxt}>{a.l}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function HeroIllustration() {
  return (
    <View style={s.illustrationWrap}>
      <Svg width={150} height={150} viewBox="0 0 160 160">
        <Defs>
          <LinearGradient id="pinGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#7C5CFC" stopOpacity="1" />
            <Stop offset="1" stopColor="#9F7AEA" stopOpacity="1" />
          </LinearGradient>
          <RadialGradient id="pinGlow" cx="50%" cy="45%" r="55%">
            <Stop offset="0" stopColor="#7C5CFC" stopOpacity="0.28" />
            <Stop offset="1" stopColor="#7C5CFC" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="80" cy="80" r="75" fill="url(#pinGlow)" />
        <Path d="M80 24 C50 24 28 46 28 76 C28 112 80 150 80 150 C80 150 132 112 132 76 C132 46 110 24 80 24 Z" fill="url(#pinGrad)" />
        <Circle cx="80" cy="74" r="20" fill="#050505" />
      </Svg>
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

  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(50)).current
  const pulseAnim = useRef(new Animated.Value(1)).current
  const step1 = useRef(new Animated.Value(0)).current
  const step2 = useRef(new Animated.Value(0)).current
  const step3 = useRef(new Animated.Value(0)).current

  useEffect(() => {
    (async () => {
      // Show cached avatar instantly (no network wait)
      try {
        const cached = await AsyncStorage.getItem('avatar_profile_cache')
        if (cached) setAvatarProfile(JSON.parse(cached))
      } catch {}
      // Then refresh in the background
      try {
        const data = await apiFetch('/api/places/state', {}).catch(() => null)
        const user = data?.session?.user
        if (user) {
          const name = user.username || user.name || '?'
          const rawUrl = data?.profile?.photoUrl || user.image || null
          const fresh = { photoUrl: rawUrl, initials: name.slice(0, 2).toUpperCase() }
          setAvatarProfile(fresh)
          AsyncStorage.setItem('avatar_profile_cache', JSON.stringify(fresh)).catch(() => {})
        }
      } catch {}
    })()
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]).start()
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.15, duration: 1200, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
    ])).start()
    const bounce = (anim: Animated.Value, delay: number) => setTimeout(() =>
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 7, tension: 60 }).start(), delay)
    bounce(step1, 500)
    bounce(step2, 700)
    bounce(step3, 900)
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
      const session = await getSession()
      if (session?.session) navigation.navigate('Onboarding' as never)
      else { await signOut(); navigation.navigate('Signup' as never) }
    } catch { await signOut(); navigation.navigate('Signup' as never) }
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <EmberBackground />
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
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <Animated.View style={[s.hero, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          <Text style={s.heroTitle}>
            <Text style={s.heroTitleLight}>Real people.{'\n'}</Text>
            <Text style={s.heroTitleBold}>Real conversations.</Text>
          </Text>
          <Text style={s.heroSub}>Meet people nearby who actually want to talk.</Text>

          <HeroIllustration />

          <TouchableOpacity activeOpacity={0.88} style={s.ctaBtn} onPress={handleJoin}>
            <Feather name="navigation" size={19} color="#fff" />
            <Text style={s.ctaBtnText}>Find people nearby</Text>
          </TouchableOpacity>

        </Animated.View>

        <View style={s.venueSect}>
          <Text style={s.whyTitle}>Explore nearby</Text>
          <Text style={s.whySub}>Real venues where conversations happen.</Text>
          <View style={s.venueGrid}>
            {[
              { icon: 'coffee', label: 'Cafes', color: '#7C5CFC' },
              { icon: 'moon', label: 'Bars & Lounges', color: '#9F7AEA' },
              { icon: 'book-open', label: 'Study Spots', color: '#5B4BC4' },
              { icon: 'sun', label: 'Rooftop Hangouts', color: AMBER },
            ].map((v, i) => (
              <View key={i} style={s.venueCard}>
                <View style={[s.venueIconBox, { backgroundColor: v.color + '22' }]}>
                  <Feather name={v.icon as any} size={20} color={v.color} />
                </View>
                <Text style={s.venueLabel}>{v.label}</Text>
                <Text style={s.venueTag}>Tap to explore</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.finalSect}>
          <Text style={s.finalTitle}>Your next real conversation is <Text style={s.finalTitleHighlight}>nearby</Text>.</Text>
          <Text style={s.finalSub}>Step into a small, growing network of people who came here to talk face to face.</Text>
          <TouchableOpacity activeOpacity={0.88} style={s.finalBtn} onPress={handleJoin}>
            <Text style={s.finalBtnTxt}>Start now</Text>
          </TouchableOpacity>
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
        <TouchableOpacity style={[s.navItem, s.navItemActive]}>
          <Feather name="compass" size={22} color={ACCENT} />
          <Text style={[s.navItemLabel, s.navItemLabelActive]}>Explore</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.navItem} onPress={async () => {
          if (!isConnected) return
          try {
            const session = await getSession()
            if (!session?.session) { navigation.navigate('Signup' as never); return }
            navigation.navigate('Onboarding' as never)
          } catch { navigation.navigate('Signup' as never) }
        }}>
          <Feather name="map-pin" size={22} color="rgba(255,255,255,0.38)" />
          <Text style={s.navItemLabel}>Nearby</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.navItem} onPress={async () => {
          if (!isConnected) return
          try {
            const session = await getSession()
            if (!session?.session) { navigation.navigate('Signup' as never); return }
            navigation.navigate('Friends' as never)
          } catch { navigation.navigate('Signup' as never) }
        }}>
          <Feather name="message-circle" size={22} color="rgba(255,255,255,0.38)" />
          <Text style={s.navItemLabel}>Chats</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const as = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  stack: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#050505' },
  avatarTxt: { fontSize: 12, fontWeight: '800', color: '#fff' },
  textCol: { justifyContent: 'center' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#3dbf7a' },
  liveTxt: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
})

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },

  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, zIndex: 10 },
  navBrand: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1, justifyContent: 'center' },
  logoMark: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: ACCENT },
  navTitle: { fontSize: 24, fontWeight: '700', fontStyle: 'italic', color: '#fff', letterSpacing: -0.3 },
  navIconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },

  scroll: { paddingBottom: 132 },

  hero: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 8, alignItems: 'center' },
  heroTitle: { textAlign: 'center', marginBottom: 20 },
  heroTitleLight: { fontSize: 26, fontWeight: '600', color: 'rgba(255,255,255,0.6)', lineHeight: 32, letterSpacing: -0.3 },
  heroTitleBold: { fontSize: 34, fontWeight: '900', color: '#fff', lineHeight: 40, letterSpacing: -0.6 },
  heroSub: { fontSize: 15, color: MUTED, textAlign: 'center', lineHeight: 21, marginBottom: 26, marginTop: 4, maxWidth: '82%' },
  illustrationWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 24 },

  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 56, width: '100%', borderRadius: 999, backgroundColor: ACCENT, marginBottom: 20, shadowColor: ACCENT, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  ctaBtnText: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.1 },

  benefitsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  benefitItem: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: BORDER, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  benefitText: { fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: '600' },

  divider: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, marginVertical: 42, gap: 14 },
  divLine: { flex: 1, height: 1, backgroundColor: BORDER },
  divTxt: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.4)', letterSpacing: 3 },

  stepsWrap: { paddingHorizontal: 18, gap: 14, marginBottom: 18 },
  stepCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 22, padding: 22, borderWidth: 1, borderColor: BORDER },
  stepTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  stepNum: { fontSize: 44, fontWeight: '900', color: 'rgba(255,255,255,0.06)', lineHeight: 48, letterSpacing: -1 },
  stepIconBox: { width: 48, height: 48, borderRadius: 16, backgroundColor: ACCENT_DIM, justifyContent: 'center', alignItems: 'center' },
  stepTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 6, letterSpacing: -0.3 },
  stepDesc: { fontSize: 13, color: MUTED, lineHeight: 20, marginBottom: 14 },
  stepTag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', borderWidth: 1 },
  stepTagTxt: { fontSize: 11, fontWeight: '800' },

  whySect: { paddingHorizontal: 18, paddingVertical: 42 },
  whyTitle: { fontSize: 26, fontWeight: '900', color: '#fff', marginBottom: 8, letterSpacing: -0.6 },
  whySub: { fontSize: 14, color: MUTED, lineHeight: 21, marginBottom: 20 },
  whyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  whyCard: { width: (width - 48) / 2, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: BORDER },
  whyIconBox: { width: 42, height: 42, borderRadius: 13, backgroundColor: ACCENT_DIM, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  whyCardTitle: { fontSize: 13, fontWeight: '800', color: '#fff', marginBottom: 5 },
  whyCardDesc: { fontSize: 12, color: MUTED, lineHeight: 17 },

  mapSect: { paddingHorizontal: 18, paddingVertical: 42 },
  mapCard: { borderRadius: 24, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: BORDER, marginBottom: 18, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  mapPulseRing: { position: 'absolute', top: '50%', left: '50%', marginLeft: -35, marginTop: -35, width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: 'rgba(124,92,252,0.4)', backgroundColor: 'rgba(124,92,252,0.08)' },
  mapPin: { position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -20, width: 40, height: 40, borderRadius: 20, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', shadowColor: ACCENT, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
  mapStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  mapStatItem: { alignItems: 'center' },
  mapStatNum: { fontSize: 20, fontWeight: '900', color: '#fff', marginBottom: 2 },
  mapStatLabel: { fontSize: 12, color: MUTED, fontWeight: '600' },
  mapStatDivider: { width: 1, height: 30, backgroundColor: BORDER },
  venueSect: { paddingHorizontal: 18, paddingVertical: 42 },
  venueGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  venueCard: { width: (width - 48) / 2, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: BORDER },
  venueIconBox: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  venueLabel: { fontSize: 15, fontWeight: '800', color: '#fff', marginBottom: 4 },
  venueTag: { fontSize: 12, color: MUTED, fontWeight: '600' },
  finalSect: { margin: 18, backgroundColor: '#000000', borderRadius: 26, padding: 28, borderWidth: 1, borderColor: BORDER, alignItems: 'center', overflow: 'hidden', marginBottom: 20 },
  finalGlow: { position: 'absolute', top: -90, left: -90, right: -90, height: 240, borderRadius: 120, backgroundColor: ACCENT_DIM },
  finalPinRing: { width: 68, height: 68, borderRadius: 34, backgroundColor: ACCENT_DIM, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  finalPinBadge: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', backgroundColor: ACCENT },
  finalTitleHighlight: { color: '#fff' },
  finalIconRow: { flexDirection: 'row', justifyContent: 'center', gap: 26, marginTop: 20 },
  finalIconItem: { alignItems: 'center', gap: 6 },
  finalIconLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  finalTitle: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center', lineHeight: 32, marginBottom: 10, letterSpacing: -0.4 },
  finalSub: { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 20, marginBottom: 22 },
  finalBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 999, paddingHorizontal: 26, paddingVertical: 16, width: '100%', justifyContent: 'center', backgroundColor: ACCENT, shadowColor: ACCENT, shadowOpacity: 0.3, shadowRadius: 18, elevation: 8, marginBottom: 4 },
  finalBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },

  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: '#0a0a0a', paddingTop: 10, paddingHorizontal: 14, justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: BORDER },
  navItem: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, minWidth: 66 },
  navItemActive: { backgroundColor: ACCENT_DIM, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 8 },
  navItemLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.4)', marginTop: 2, letterSpacing: 0.2 },
  navItemLabelActive: { color: ACCENT },
  navAvatarImg: { width: 22, height: 22, borderRadius: 11 },
  navAvatarFallback: { width: 22, height: 22, borderRadius: 11, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  navAvatarTxt: { fontSize: 9, fontWeight: '800', color: '#fff' },
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
