import { useNavigation } from '@react-navigation/native'
import { getSession, signOut } from '../lib/auth'
import DrawerMenu from './DrawerMenu'
import { apiFetch } from '../lib/api'
import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, Animated, Modal, ActivityIndicator,
} from 'react-native'

export default function LandingScreen() {
  const navigation = useNavigation<any>()
  const [profileVisible, setProfileVisible] = useState(false)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const openProfile = async () => {
    setProfileVisible(true)
    setProfileLoading(true)
    try {
      const state = await apiFetch('/api/places/state', {})
      setProfile(state)
    } catch { setProfile(null) }
    setProfileLoading(false)
  }

  const handleLogout = async () => {
    await signOut()
    setProfileVisible(false)
    setProfile(null)
  }

  const handleJoin = async () => {
    try {
      const state = await apiFetch('/api/places/state', {})
      if (state.session) {
        navigation.navigate('Onboarding' as never)
      } else {
        // Token exists but no session — account deleted or expired, clear it
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
    // Fade + slide hero
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start()

    // Float card
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -10, duration: 2000, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start()

    // Bounce steps sequentially
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
    <SafeAreaView style={s.container}>
      {/* Nav */}
      <View style={s.nav}>
        <View style={s.navBrand}>
          <Text style={s.navIcon}>💬</Text>
          <Text style={s.navTitle}>LetsTalk</Text>
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
              <View style={[s.avatar, { backgroundColor: '#a5f4b8' }]}><Text style={s.avatarText}>A</Text></View>
              <View style={[s.avatar, { backgroundColor: '#6dfe9c', marginLeft: -8 }]}><Text style={s.avatarText}>B</Text></View>
              <View style={[s.avatar, { backgroundColor: '#89d89e', marginLeft: -8 }]}><Text style={s.avatarText}>C</Text></View>
              <View style={[s.avatar, { backgroundColor: '#1a6b3c', marginLeft: -8 }]}><Text style={[s.avatarText, { color: 'white', fontSize: 10 }]}>+1</Text></View>
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
              { anim: step1, icon: '🎭', title: 'Set mood', desc: "Let others know if you're up for a deep chat or just some casual banter.", emoji: '🎭' },
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

        {/* CTA */}


        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerBrand}>LetsTalk</Text>
          <View style={s.footerLinks}>
            {['Privacy', 'Terms', 'Safety', 'Support'].map(l => (
              <Text key={l} style={s.footerLink}>{l}</Text>
            ))}
          </View>
          <Text style={s.footerCopy}>© 2024 LetsTalk Social. Built for connection.</Text>
        </View>
      </ScrollView>

      <DrawerMenu visible={drawerVisible} onClose={() => setDrawerVisible(false)} />

      {/* Profile half-sheet modal */}
      <Modal visible={profileVisible} transparent animationType="slide" onRequestClose={() => setProfileVisible(false)}>
        <TouchableOpacity style={ps.overlay} activeOpacity={1} onPress={() => setProfileVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={ps.sheet}>
            <View style={ps.handle} />
            {profileLoading ? (
              <ActivityIndicator color="#005129" size="large" style={{ marginVertical: 40 }} />
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
                <Text style={ps.bio}>Join LetsTalk to explore more.</Text>
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
      <View style={s.bottomNav}>
        {[
          { icon: '🧭', label: 'Explore', active: true },
          { icon: '🗺️', label: 'Map', active: false },
          { icon: '💬', label: 'Chats', active: false },
          { icon: '👤', label: 'Profile', active: false },
        ].map(item => (
          <TouchableOpacity key={item.label} style={[s.navItem, item.active && s.navItemActive]} onPress={item.label === 'Profile' ? () => setDrawerVisible(true) : undefined}>
            <Text style={s.navItemIcon}>{item.icon}</Text>
            <Text style={[s.navItemLabel, item.active && s.navItemLabelActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  )
}

const G = '#1a6b3c'
const DARK = '#0f3320'
const MID = '#2d6e3e'

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e9ffed' },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: 'rgba(233,255,237,0.85)', borderBottomWidth: 1, borderBottomColor: 'rgba(191,201,190,0.3)' },
  navBrand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  navIcon: { fontSize: 20 },
  navTitle: { fontSize: 20, fontWeight: '800', color: G },
  joinBtn: { backgroundColor: G, borderRadius: 50, paddingHorizontal: 20, paddingVertical: 8 },
  joinBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
  scroll: { paddingBottom: 100 },
  hero: { padding: 24, paddingTop: 32, alignItems: 'center' },
  heroTitle: { fontSize: 28, fontWeight: '800', color: DARK, textAlign: 'center', lineHeight: 36, marginBottom: 12 },
  heroSub: { fontSize: 16, color: MID, textAlign: 'center', lineHeight: 24, marginBottom: 24 },
  heroBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: G, borderRadius: 50, paddingHorizontal: 28, paddingVertical: 16, marginBottom: 32 },
  heroBtnIcon: { fontSize: 18 },
  heroBtnText: { color: 'white', fontWeight: '700', fontSize: 17 },
  floatCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'white', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(26,107,60,0.1)', shadowColor: DARK, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
  avatarRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white' },
  avatarText: { fontSize: 12, fontWeight: '700', color: DARK },
  floatTitle: { fontSize: 13, fontWeight: '700', color: G },
  floatSub: { fontSize: 9, color: MID, letterSpacing: 1.5, marginTop: 2 },
  section: { paddingHorizontal: 20, paddingVertical: 32, backgroundColor: '#cff8da' },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: DARK, textAlign: 'center', marginBottom: 20 },
  steps: { gap: 12 },
  stepCard: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: 'white', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  stepIconWrap: { backgroundColor: '#eef0ee', borderRadius: 50, width: 60, height: 60, justifyContent: 'center', alignItems: 'center' },
  stepIcon: { fontSize: 26 },
  stepTitle: { fontSize: 16, fontWeight: '700', color: G, marginBottom: 6 },
  stepDesc: { fontSize: 14, color: MID, lineHeight: 22 },
  mapCard: { margin: 20, backgroundColor: DARK, borderRadius: 20, padding: 24, minHeight: 280, justifyContent: 'flex-end' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: G, borderRadius: 50, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start', marginBottom: 16 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'white' },
  livePillText: { fontSize: 9, fontWeight: '700', color: 'white', letterSpacing: 2 },
  mapTitle: { fontSize: 22, fontWeight: '800', color: 'white', lineHeight: 30, marginBottom: 12 },
  mapDesc: { fontSize: 14, color: 'rgba(210,250,221,0.8)', lineHeight: 20, marginBottom: 20 },
  mapFooter: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: 'rgba(191,201,190,0.2)', paddingTop: 16 },
  mapCount: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#6dfe9c', justifyContent: 'center', alignItems: 'center' },
  mapCountText: { fontSize: 9, fontWeight: '900', color: DARK },
  mapCountLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(210,250,221,0.9)' },
  primaryBtn: { backgroundColor: G, borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginHorizontal: 20, marginTop: 8, marginBottom: 12 },
  primaryText: { color: 'white', fontWeight: '700', fontSize: 17 },
  secondaryBtn: { backgroundColor: 'white', borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginHorizontal: 20, borderWidth: 2, borderColor: 'rgba(26,107,60,0.25)' },
  secondaryText: { color: G, fontWeight: '700', fontSize: 17 },
  footer: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20, backgroundColor: '#d5fde0', marginTop: 32, gap: 12 },
  footerBrand: { fontSize: 22, fontWeight: '900', color: G },
  footerLinks: { flexDirection: 'row', gap: 20, flexWrap: 'wrap', justifyContent: 'center' },
  footerLink: { fontSize: 14, color: MID },
  footerCopy: { fontSize: 12, color: MID, opacity: 0.6, textAlign: 'center' },
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: 'rgba(233,255,237,0.95)', paddingTop: 8, paddingBottom: 20, paddingHorizontal: 16, justifyContent: 'space-around', borderTopLeftRadius: 20, borderTopRightRadius: 20, shadowColor: DARK, shadowOpacity: 0.06, shadowRadius: 12, elevation: 8 },
  navItem: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 50 },
  navItemActive: { backgroundColor: '#6dfe9c' },
  navItemIcon: { fontSize: 20, marginBottom: 2 },
  navItemLabel: { fontSize: 10, fontWeight: '600', color: MID },
  navItemLabelActive: { color: DARK },
})

const ps = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,33,17,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#e9ffed', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  handle: { width: 40, height: 4, backgroundColor: 'rgba(0,81,41,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#005129', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontSize: 22, fontWeight: '800', color: 'white' },
  name: { fontSize: 20, fontWeight: '800', color: '#002111' },
  email: { fontSize: 13, color: '#006d36', marginTop: 2 },
  bio: { fontSize: 14, color: '#404940', lineHeight: 20, marginBottom: 14 },
  tagsRow: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  tag: { backgroundColor: '#caf2d5', borderRadius: 50, paddingHorizontal: 14, paddingVertical: 6 },
  tagTxt: { fontSize: 13, fontWeight: '600', color: '#005129' },
  fullBtn: { backgroundColor: '#005129', borderRadius: 50, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  fullBtnTxt: { color: 'white', fontWeight: '700', fontSize: 15 },
  logoutBtn: { borderWidth: 2, borderColor: 'rgba(186,26,26,0.25)', borderRadius: 50, paddingVertical: 13, alignItems: 'center' },
  logoutTxt: { color: '#ba1a1a', fontWeight: '700', fontSize: 15 },
})
