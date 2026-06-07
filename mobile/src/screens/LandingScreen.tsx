import { useNavigation } from '@react-navigation/native'
import { getSession, signOut } from '../lib/auth'
import DrawerMenu from './DrawerMenu'
import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Animated, Modal, ActivityIndicator,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { VideoView, useVideoPlayer } from 'expo-video'

export default function LandingScreen() {
  const navigation = useNavigation<any>()
  const insets = useSafeAreaInsets()
  const [profileVisible, setProfileVisible] = useState(false)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const videoSource = require('../video/animation.mp4')
  const player = useVideoPlayer(videoSource, (player) => {
    player.loop = true
    player.muted = true
    player.playbackRate = 1.0
  })

  useEffect(() => {
    player.play()
    const sub1 = player.addListener('playingChange', (isPlaying) => {
      if (!isPlaying) {
        try { player.play() } catch {}
      }
    })
    const sub2 = player.addListener('statusChange', (status) => {
      if (status === 'idle' || status === 'error') {
        try { player.replay() } catch { try { player.play() } catch {} }
      }
    })
    return () => { sub1.remove(); sub2.remove() }
  }, [player])


  
  const openProfile = async () => {
    setProfileVisible(true)
    setProfileLoading(true)
    try {
      const session = await getSession()
      setProfile(session)
    } catch { setProfile(null) }
    setProfileLoading(false)
  }

  const handleLogout = async () => {
    await signOut()
    setProfileVisible(false)
    setProfile(null)
    navigation.reset({ index: 0, routes: [{ name: 'Landing' }] })
  }

  const handleJoin = async () => {
    try {
      const session = await getSession()
      if (session?.session) {
        navigation.navigate('Onboarding' as never)
      } else {
        await signOut()
        navigation.navigate('Signup' as never)
      }
    } catch {
      await signOut()
      navigation.navigate('Signup' as never)
    }
  }

  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current
  const floatAnim = useRef(new Animated.Value(0)).current
  const step1 = useRef(new Animated.Value(0)).current
  const step2 = useRef(new Animated.Value(0)).current
  const step3 = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start()

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -10, duration: 2000, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start()

    const bounceStep = (anim: Animated.Value, delay: number) => {
      setTimeout(() => {
        Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 5 }).start()
      }, delay)
    }
    bounceStep(step1, 400)
    bounceStep(step2, 600)
    bounceStep(step3, 800)
  }, [])

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Video Background */}
      <VideoView
        style={s.videoBackground}
        player={player}
        allowsFullscreen={false}
        nativeControls={false}
        contentFit="cover"
      />
      <View style={s.overlay} />

      {/* Nav */}
      <View style={s.nav}>
        <View style={s.navBrand}>
          <MaterialIcons name="forum" size={22} color={AMBER} />
          <Text style={s.navTitle}>Let's Talk</Text>
        </View>
        <TouchableOpacity style={s.joinBtn} onPress={handleJoin}>
          <Text style={s.joinBtnText}>Join Now</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <Animated.View style={[s.hero, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={s.heroTitle}>Connect with real people, right where you are.</Text>
          <Text style={s.heroSub}>Discover nearby cafes & venues where conversations are happening now.</Text>
          <TouchableOpacity style={s.heroBtn} onPress={handleJoin}>
            <Text style={s.heroBtnIcon}>📍</Text>
            <Text style={s.heroBtnText}>Find Nearby Places</Text>
          </TouchableOpacity>

          {/* Floating card */}
          <Animated.View style={[s.floatCard, { transform: [{ translateY: floatAnim }] }]}>
            <View style={s.avatarRow}>
              {[
                { l: 'A', bg: '#e8824a' },
                { l: 'B', bg: '#5b8dee' },
                { l: 'C', bg: '#3dbf7a' },
              ].map((item, i) => (
                <View key={item.l} style={[s.avatar, { marginLeft: i === 0 ? 0 : -8, backgroundColor: item.bg }]}>
                  <Text style={s.avatarText}>{item.l}</Text>
                </View>
              ))}
              <View style={[s.avatar, { backgroundColor: '#2a2a2a', marginLeft: -8 }]}>
                <Text style={[s.avatarText, { color: AMBER, fontSize: 10 }]}>+1</Text>
              </View>
            </View>
            <View>
              <Text style={s.floatTitle}>4 people ready</Text>
              <Text style={s.floatSub}>NEARBY AT STARBUCKS</Text>
            </View>
          </Animated.View>
        </Animated.View>

        {/* How it works */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Three steps to a real conversation.</Text>
          <View style={s.steps}>
            {[
              { anim: step1, icon: '🎭', title: 'Set mood', desc: "Let others know if you're up for a deep chat or just some casual banter." },
              { anim: step2, icon: '📍', title: 'Check in', desc: 'Arrive at a participating venue and tap to join the local digital lounge.' },
              { anim: step3, icon: '💬', title: 'Connect', desc: 'Break the ice digitally, then look up and say hello in person.' },
            ].map((step) => (
              <Animated.View key={step.title} style={[s.stepCard, { transform: [{ scale: step.anim }] }]}>
                <View style={s.stepIconWrap}>
                  <Text style={s.stepIcon}>{step.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.stepTitle}>{step.title}</Text>
                  <Text style={s.stepDesc}>{step.desc}</Text>
                </View>
              </Animated.View>
            ))}
          </View>
        </View>

        {/* Live vibe map card */}
        <View style={s.mapCard}>
          <View style={s.livePill}>
            <View style={s.liveDot} />
            <Text style={s.livePillText}>LIVE VIBE MAP</Text>
          </View>
          <Text style={s.mapTitle}>See where the vibe is right before you leave home.</Text>
          <Text style={s.mapDesc}>Our real-time map shows you exactly which local spots have the most active conversationalists right now.</Text>
          <View style={s.mapFooter}>
            <View style={s.mapCount}>
              <Text style={s.mapCountText}>12k</Text>
            </View>
            <Text style={s.mapCountLabel}>Active users in your area</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerBrand}>Let's Talk</Text>
          <View style={s.footerLinks}>
            {['Privacy', 'Terms', 'Safety', 'Support'].map(l => (
              <Text key={l} style={s.footerLink}>{l}</Text>
            ))}
          </View>
          <Text style={s.footerCopy}>© 2024 Let's Talk. Built for connection.</Text>
        </View>
      </ScrollView>

      <DrawerMenu visible={drawerVisible} onClose={() => setDrawerVisible(false)} />

      {/* Profile modal */}
      <Modal visible={profileVisible} transparent animationType="slide" onRequestClose={() => setProfileVisible(false)}>
        <TouchableOpacity style={ps.overlay} activeOpacity={1} onPress={() => setProfileVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={ps.sheet}>
            <View style={ps.handle} />
            {profileLoading ? (
              <ActivityIndicator color={AMBER} size="large" style={{ marginVertical: 40 }} />
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
                  <Text style={ps.fullBtnTxt}>View Full Profile →</Text>
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
                  <Text style={ps.fullBtnTxt}>Sign up →</Text>
                </TouchableOpacity>
                <TouchableOpacity style={ps.logoutBtn} onPress={() => { setProfileVisible(false); navigation.navigate('Login' as never) }}>
                  <Text style={ps.logoutTxt}>Log in</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Bottom nav */}
      <View style={[s.bottomNav, { paddingBottom: insets.bottom + 8 }]}>
        {[
          { icon: 'explore', label: 'Explore', active: true, guard: false },
          { icon: 'near-me', label: 'Nearby', active: false, guard: true },
          { icon: 'chat-bubble-outline', label: 'Chats', active: false, guard: true },
          { icon: 'person-outline', label: 'Profile', active: false, guard: false },
        ].map(item => (
          <TouchableOpacity
            key={item.label}
            style={[s.navItem, item.active && s.navItemActive]}
            onPress={async () => {
              if (item.label === 'Profile') { setDrawerVisible(true); return }
              if (item.guard) {
                try {
                  const session = await getSession()
                  if (!session?.session) { navigation.navigate('Signup' as never); return }
                  navigation.navigate('Onboarding' as never)
                } catch { navigation.navigate('Signup' as never) }
              }
            }}
          >
            <MaterialIcons name={item.icon as any} size={22} color={item.active ? '#e8824a' : 'rgba(255,220,160,0.5)'} />
            <Text style={[s.navItemLabel, item.active && s.navItemLabelActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  )
}

const AMBER  = '#e8824a'
const MUTED  = 'rgba(255,180,100,0.6)'

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0704' },
  videoBackground: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  overlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.65)' },

  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: 'rgba(18, 16, 12, 0.9)', borderBottomWidth: 1, borderBottomColor: 'rgba(232,130,74,0.15)' },
  navBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navTitle: { fontSize: 20, fontWeight: '800', color: AMBER },
  joinBtn: { backgroundColor: AMBER, borderRadius: 50, paddingHorizontal: 18, paddingVertical: 8 },
  joinBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },

  scroll: { paddingBottom: 120 },

  hero: { padding: 24, paddingTop: 40, alignItems: 'center' },
  heroTitle: { fontSize: 30, fontWeight: '900', color: '#ffffff', textAlign: 'center', lineHeight: 38, marginBottom: 14, letterSpacing: -0.5 },
  heroSub: { fontSize: 16, color: MUTED, textAlign: 'center', lineHeight: 24, marginBottom: 28 },
  heroBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: AMBER, borderRadius: 50, paddingHorizontal: 28, paddingVertical: 16, marginBottom: 36, shadowColor: '#0d0a06', shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
  heroBtnIcon: { fontSize: 18 },
  heroBtnText: { color: '#fff', fontWeight: '800', fontSize: 17 },

  floatCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(232,130,74,0.15)', shadowColor: '#0d0a06', shadowOpacity: 0.1, shadowRadius: 16, elevation: 4, width: '90%' },
  avatarRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: AMBER, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0a0704' },
  avatarText: { fontSize: 12, fontWeight: '700', color: '#ffffff' },
  floatTitle: { fontSize: 13, fontWeight: '700', color: '#000000' },
  floatSub: { fontSize: 9, color: '#000000', letterSpacing: 1.5, marginTop: 2 },

  section: { paddingHorizontal: 20, paddingVertical: 36 },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: '#ffffff', textAlign: 'center', marginBottom: 24, lineHeight: 30 },
  steps: { gap: 14 },
  stepCard: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: 'rgba(28, 22, 16, 0.85)', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(232,130,74,0.15)' },
  stepIconWrap: { backgroundColor: 'rgba(232,130,74,0.18)', borderRadius: 16, width: 60, height: 60, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(232,130,74,0.3)' },
  stepIcon: { fontSize: 26 },
  stepTitle: { fontSize: 16, fontWeight: '700', color: '#e8824a', marginBottom: 6 },
  stepDesc: { fontSize: 14, color: MUTED, lineHeight: 22 },

  mapCard: { margin: 20, backgroundColor: 'rgba(13, 10, 6, 0.8)', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(232,130,74,0.15)' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e8824a', borderRadius: 50, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start', marginBottom: 16 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  livePillText: { fontSize: 9, fontWeight: '700', color: '#fff', letterSpacing: 2 },
  mapTitle: { fontSize: 22, fontWeight: '800', color: '#ffffff', lineHeight: 30, marginBottom: 12 },
  mapDesc: { fontSize: 14, color: MUTED, lineHeight: 20, marginBottom: 20 },
  mapFooter: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: 'rgba(232,130,74,0.15)', paddingTop: 16 },
  mapCount: { width: 44, height: 44, borderRadius: 22, backgroundColor: AMBER, justifyContent: 'center', alignItems: 'center' },
  mapCountText: { fontSize: 10, fontWeight: '900', color: '#ffffff' },
  mapCountLabel: { fontSize: 13, fontWeight: '600', color: MUTED },

  footer: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20, gap: 14, borderTopWidth: 1, borderTopColor: 'rgba(232,130,74,0.15)' },
  footerBrand: { fontSize: 22, fontWeight: '900', color: '#ffffff' },
  footerLinks: { flexDirection: 'row', gap: 20, flexWrap: 'wrap', justifyContent: 'center' },
  footerLink: { fontSize: 14, color: MUTED },
  footerCopy: { fontSize: 12, color: 'rgba(255,200,150,0.3)', textAlign: 'center' },

  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: 'rgba(13, 10, 6, 0.95)', paddingTop: 10, paddingHorizontal: 16, justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: 'rgba(232,130,74,0.25)' },
  navItem: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 50 },
  navItemActive: { backgroundColor: 'rgba(232,130,74,0.15)', borderRadius: 12, paddingHorizontal: 14 },
  navItemLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,200,150,0.4)', marginTop: 2 },
  navItemLabelActive: { color: '#ffffff' },
})

const ps = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: 'rgba(28, 22, 16, 0.95)', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, borderTopWidth: 1, borderTopColor: 'rgba(232,130,74,0.15)' },
  handle: { width: 40, height: 4, backgroundColor: 'rgba(232,130,74,0.15)', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#0d0a06', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontSize: 22, fontWeight: '800', color: '#ffffff' },
  name: { fontSize: 20, fontWeight: '800', color: '#ffffff' },
  email: { fontSize: 13, color: MUTED, marginTop: 2 },
  bio: { fontSize: 14, color: MUTED, lineHeight: 20, marginBottom: 14 },
  tagsRow: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  tag: { backgroundColor: 'rgba(232,130,74,0.12)', borderRadius: 50, paddingHorizontal: 14, paddingVertical: 6 },
  tagTxt: { fontSize: 13, fontWeight: '600', color: '#ffffff' },
  fullBtn: { backgroundColor: '#0d0a06', borderRadius: 50, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  fullBtnTxt: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
  logoutBtn: { borderWidth: 1.5, borderColor: 'rgba(186,26,26,0.4)', borderRadius: 50, paddingVertical: 13, alignItems: 'center' },
  logoutTxt: { color: '#ff6b6b', fontWeight: '700', fontSize: 15 },
})