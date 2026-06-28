import { useNavigation } from '@react-navigation/native'
import { useNetworkCheck } from '../hooks/useNetworkCheck'
import { getSession, signOut } from '../lib/auth'
import DrawerMenu from './DrawerMenu'
import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Animated, Modal, ActivityIndicator, Dimensions,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons'

const { width, height } = Dimensions.get('window')
const AMBER = '#e8824a'
const AMBER_DIM = 'rgba(232,130,74,0.15)'
const MUTED = 'rgba(255,180,100,0.55)'
const DARK = '#050302'

function Ember({ delay, startX, size, duration }: { delay: number; startX: number; size: number; duration: number }) {
  const translateY = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(0)).current
  const translateX = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const animate = () => {
      translateY.setValue(0)
      opacity.setValue(0)
      translateX.setValue(0)
      Animated.parallel([
        Animated.timing(translateY, { toValue: -height * 1.2, duration, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.95, duration: duration * 0.12, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: duration * 0.58, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: duration * 0.3, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(translateX, { toValue: 16, duration: duration * 0.25, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: -14, duration: duration * 0.35, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: 10, duration: duration * 0.25, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: -6, duration: duration * 0.15, useNativeDriver: true }),
        ]),
      ]).start(() => animate())
    }
    const timer = setTimeout(animate, delay)
    return () => clearTimeout(timer)
  }, [])

  return (
    <Animated.View style={{
      position: 'absolute', bottom: 0, left: startX,
      width: size, height: size * 3,
      borderRadius: size,
      backgroundColor: size > 3.5 ? '#ffaa55' : AMBER,
      opacity,
      transform: [{ translateY }, { translateX }],
      shadowColor: AMBER, shadowOpacity: 1, shadowRadius: size * 3, elevation: 6,
    }} />
  )
}

function EmberBackground() {
  const embers = Array.from({ length: 32 }, (_, i) => ({
    id: i,
    delay: (i * 300) + Math.random() * 2000,
    startX: Math.random() * width,
    size: Math.random() * 3.5 + 1.2,
    duration: Math.random() * 5000 + 6000,
  }))
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: DARK }} />
      <View style={{ position: 'absolute', bottom: -120, left: -60, right: -60, height: 500, borderRadius: 250, backgroundColor: 'rgba(232,130,74,0.10)' }} />
      <View style={{ position: 'absolute', bottom: -40, left: width * 0.2, right: width * 0.2, height: 220, borderRadius: 110, backgroundColor: 'rgba(232,130,74,0.16)' }} />
      <View style={{ position: 'absolute', bottom: 0, left: width * 0.35, right: width * 0.35, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,160,80,0.22)' }} />
      {embers.map(e => <Ember key={e.id} {...e} />)}
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

  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(50)).current
  const floatAnim = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(1)).current
  const step1 = useRef(new Animated.Value(0)).current
  const step2 = useRef(new Animated.Value(0)).current
  const step3 = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
    ]).start()
    Animated.loop(Animated.sequence([
      Animated.timing(floatAnim, { toValue: -14, duration: 3000, useNativeDriver: true }),
      Animated.timing(floatAnim, { toValue: 0, duration: 3000, useNativeDriver: true }),
    ])).start()
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.04, duration: 1400, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
    ])).start()
    const bounce = (anim: Animated.Value, delay: number) => setTimeout(() =>
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 7, tension: 60 }).start(), delay)
    bounce(step1, 600)
    bounce(step2, 850)
    bounce(step3, 1100)
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
    navigation.reset({ index: 0, routes: [{ name: 'Landing' }] })
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

      {/* Nav */}
      <View style={s.nav}>
        <View style={s.navBrand}>
          <MaterialIcons name="forum" size={20} color={AMBER} />
          <Text style={s.navTitle}>Let's Talk</Text>
        </View>
        <TouchableOpacity style={s.joinBtn} onPress={handleJoin}>
          <Text style={s.joinBtnText}>Join Now</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── HERO ── */}
        <Animated.View style={[s.hero, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* Live pill */}
          <View style={s.livePill}>
            <Animated.View style={[s.liveDotRing, { transform: [{ scale: pulseAnim }] }]}>
              <View style={s.liveDotCore} />
            </Animated.View>
            <Text style={s.livePillText}>LIVE NOW IN YOUR CITY</Text>
          </View>

          <Text style={s.heroTitle}>Real people.{'\n'}Real places.{'\n'}Real talk.</Text>
          <Text style={s.heroSub}>Walk into any cafe nearby and instantly meet people who actually want to have a conversation.</Text>

          {/* Stats */}
          <View style={s.statsRow}>
            {[
              { val: '2.4k', lbl: 'Online now' },
              { val: '180+', lbl: 'Active venues' },
              { val: '94%', lbl: 'Made a friend' },
            ].map((st, i) => (
              <View key={i} style={[s.statBox, i < 2 && s.statBorder]}>
                <Text style={s.statVal}>{st.val}</Text>
                <Text style={s.statLbl}>{st.lbl}</Text>
              </View>
            ))}
          </View>

          {/* CTA */}
          <Animated.View style={[s.ctaBtnWrap, { transform: [{ scale: pulseAnim }] }]}>
            <TouchableOpacity style={s.ctaBtn} onPress={handleJoin}>
              <MaterialIcons name="near-me" size={20} color="#fff" />
              <Text style={s.ctaBtnText}>Find People Nearby</Text>
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity onPress={() => navigation.navigate('Login' as never)}>
            <Text style={s.signinHint}>Already have an account? <Text style={{ color: AMBER, fontWeight: '700' }}>Sign in</Text></Text>
          </TouchableOpacity>

          {/* Activity card */}
          <Animated.View style={[s.actCard, { transform: [{ translateY: floatAnim }] }]}>
            <View style={s.actLeft}>
              <View style={s.actAvatarRow}>
                {['R','P','A','K'].map((l, i) => (
                  <View key={l} style={[s.actAvatar, { marginLeft: i === 0 ? 0 : -10, backgroundColor: ['#e8824a','#5b8dee','#3dbf7a','#d45b8a'][i] }]}>
                    <Text style={s.actAvatarTxt}>{l}</Text>
                  </View>
                ))}
              </View>
              <Text style={s.actTitle}>4 people ready to talk</Text>
              <View style={s.actVenueRow}>
                <MaterialIcons name="place" size={11} color={MUTED} />
                <Text style={s.actVenue}>BREW & CO · 0.3 KM AWAY</Text>
              </View>
            </View>
            <View style={s.actPing}>
              <Animated.View style={[s.actPingRing, { transform: [{ scale: pulseAnim }] }]} />
              <View style={s.actPingDot} />
            </View>
          </Animated.View>
        </Animated.View>

        {/* ── DIVIDER ── */}
        <View style={s.divider}>
          <View style={s.divLine} />
          <Text style={s.divTxt}>HOW IT WORKS</Text>
          <View style={s.divLine} />
        </View>

        {/* ── STEPS ── */}
        <View style={s.stepsWrap}>
          {[
            {
              anim: step1, num: '01',
              icon: <MaterialIcons name="mood" size={26} color={AMBER} />,
              title: 'Set your vibe',
              desc: 'Tell the room what you\'re in the mood for — deep talk, casual chat, or just good company.',
              tag: 'Takes 10 seconds',
              tagColor: '#3dbf7a',
            },
            {
              anim: step2, num: '02',
              icon: <MaterialIcons name="location-on" size={26} color={AMBER} />,
              title: 'Walk in, check in',
              desc: 'Arrive at any participating cafe or venue. One tap puts you on the live map.',
              tag: 'Location verified',
              tagColor: '#5b8dee',
            },
            {
              anim: step3, num: '03',
              icon: <MaterialIcons name="chat-bubble" size={26} color={AMBER} />,
              title: 'Say hello for real',
              desc: 'See who\'s there, break the ice digitally, then look up and actually talk.',
              tag: 'No swiping. No matching.',
              tagColor: AMBER,
            },
          ].map((step) => (
            <Animated.View key={step.num} style={[s.stepCard, { opacity: step.anim, transform: [{ scale: step.anim }] }]}>
              <View style={s.stepTop}>
                <Text style={s.stepNum}>{step.num}</Text>
                <View style={s.stepIconBox}>{step.icon}</View>
              </View>
              <Text style={s.stepTitle}>{step.title}</Text>
              <Text style={s.stepDesc}>{step.desc}</Text>
              <View style={[s.stepTag, { borderColor: step.tagColor + '44', backgroundColor: step.tagColor + '18' }]}>
                <MaterialIcons name="check-circle" size={11} color={step.tagColor} />
                <Text style={[s.stepTagTxt, { color: step.tagColor }]}>{step.tag}</Text>
              </View>
            </Animated.View>
          ))}
        </View>

        {/* ── WHY ── */}
        <View style={s.whySect}>
          <Text style={s.whyTitle}>Why Let's Talk?</Text>
          <Text style={s.whySub}>Because real connection doesn't happen on a screen — it happens across a table.</Text>
          <View style={s.whyGrid}>
            {[
              { icon: <MaterialIcons name="block" size={28} color={AMBER} />, title: 'No endless scrolling', desc: 'You\'re not here to scroll. You\'re here to talk.' },
              { icon: <MaterialIcons name="verified-user" size={28} color={AMBER} />, title: 'No fake profiles', desc: 'You\'re physically at the same place. It\'s real.' },
              { icon: <MaterialIcons name="flash-on" size={28} color={AMBER} />, title: 'Instant connection', desc: 'No waiting. People are there right now.' },
              { icon: <MaterialIcons name="tune" size={28} color={AMBER} />, title: 'You\'re in control', desc: 'Set your mood, choose who to talk to.' },
            ].map((item, i) => (
              <View key={i} style={s.whyCard}>
                <View style={s.whyIconBox}>{item.icon}</View>
                <Text style={s.whyCardTitle}>{item.title}</Text>
                <Text style={s.whyCardDesc}>{item.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── QUOTE ── */}
        <View style={s.finalSect}>
          <View style={s.finalGlow} />
          <MaterialIcons name="location-on" size={36} color={AMBER} style={{ marginBottom: 16 }} />
          <Text style={s.finalTitle}>Your next real{'\n'}conversation is nearby.</Text>
          <Text style={s.finalSub}>Join thousands of people who chose real connection over another scroll session.</Text>
          <TouchableOpacity style={s.finalBtn} onPress={handleJoin}>
            <Text style={s.finalBtnTxt}>Start Now — It's Free</Text>
            <MaterialIcons name="arrow-forward" size={18} color="#050302" />
          </TouchableOpacity>
          <Text style={s.finalNote}>No credit card · No algorithm · Just people</Text>
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
                  <Text style={ps.fullBtnTxt}>View Full Profile</Text>
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
                if (!isConnected) return
                try {
                  const session = await getSession()
                  if (!session?.session) { navigation.navigate('Signup' as never); return }
                  if (item.label === 'Chats') { navigation.navigate('Friends' as never); return }
                  navigation.navigate('Onboarding' as never)
                } catch { navigation.navigate('Signup' as never) }
              }
            }}
          >
            <MaterialIcons name={item.icon as any} size={22} color={item.active ? AMBER : 'rgba(255,220,160,0.4)'} />
            <Text style={[s.navItemLabel, item.active && s.navItemLabelActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK },

  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: 'rgba(5,3,2,0.9)', borderBottomWidth: 1, borderBottomColor: 'rgba(232,130,74,0.1)', zIndex: 10 },
  navBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navTitle: { fontSize: 19, fontWeight: '800', color: AMBER },
  joinBtn: { backgroundColor: AMBER, borderRadius: 50, paddingHorizontal: 18, paddingVertical: 8 },
  joinBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  scroll: { paddingBottom: 120 },

  // HERO
  hero: { paddingHorizontal: 22, paddingTop: 52, paddingBottom: 24, alignItems: 'center' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(232,130,74,0.1)', borderWidth: 1, borderColor: 'rgba(232,130,74,0.25)', borderRadius: 50, paddingHorizontal: 14, paddingVertical: 7, marginBottom: 30 },
  liveDotRing: { width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(232,130,74,0.3)', justifyContent: 'center', alignItems: 'center' },
  liveDotCore: { width: 6, height: 6, borderRadius: 3, backgroundColor: AMBER },
  livePillText: { fontSize: 10, fontWeight: '800', color: AMBER, letterSpacing: 2.5 },

  heroTitle: { fontSize: 46, fontWeight: '900', color: '#ffffff', textAlign: 'center', lineHeight: 54, marginBottom: 16, letterSpacing: -1.5 },
  heroSub: { fontSize: 16, color: MUTED, textAlign: 'center', lineHeight: 26, marginBottom: 30, paddingHorizontal: 4 },

  statsRow: { flexDirection: 'row', width: '100%', backgroundColor: 'rgba(15,10,6,0.85)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(232,130,74,0.1)', marginBottom: 28, overflow: 'hidden' },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statBorder: { borderRightWidth: 1, borderRightColor: 'rgba(232,130,74,0.1)' },
  statVal: { fontSize: 24, fontWeight: '900', color: AMBER, marginBottom: 2 },
  statLbl: { fontSize: 10, color: MUTED, fontWeight: '600', letterSpacing: 0.3 },

  ctaBtnWrap: { width: '100%', marginBottom: 14 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: AMBER, borderRadius: 50, paddingVertical: 18, shadowColor: AMBER, shadowOpacity: 0.45, shadowRadius: 24, elevation: 14 },
  ctaBtnText: { color: '#fff', fontWeight: '900', fontSize: 17, letterSpacing: 0.3 },
  signinHint: { fontSize: 13, color: MUTED, marginBottom: 36 },

  actCard: { width: '100%', backgroundColor: 'rgba(12,8,4,0.95)', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: 'rgba(232,130,74,0.18)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actLeft: { flex: 1 },
  actAvatarRow: { flexDirection: 'row', marginBottom: 10 },
  actAvatar: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: DARK },
  actAvatarTxt: { fontSize: 11, fontWeight: '900', color: '#fff' },
  actTitle: { fontSize: 14, fontWeight: '800', color: '#fff', marginBottom: 5 },
  actVenueRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  actVenue: { fontSize: 10, color: MUTED, letterSpacing: 1, fontWeight: '600' },
  actPing: { width: 22, height: 22, justifyContent: 'center', alignItems: 'center' },
  actPingRing: { position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(61,191,122,0.2)' },
  actPingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3dbf7a' },

  // DIVIDER
  divider: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, marginVertical: 44, gap: 14 },
  divLine: { flex: 1, height: 1, backgroundColor: 'rgba(232,130,74,0.12)' },
  divTxt: { fontSize: 10, fontWeight: '800', color: 'rgba(232,130,74,0.5)', letterSpacing: 3 },

  // STEPS
  stepsWrap: { paddingHorizontal: 18, gap: 14, marginBottom: 14 },
  stepCard: { backgroundColor: 'rgba(12,8,4,0.92)', borderRadius: 26, padding: 24, borderWidth: 1, borderColor: 'rgba(232,130,74,0.13)' },
  stepTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  stepNum: { fontSize: 52, fontWeight: '900', color: 'rgba(232,130,74,0.35)', lineHeight: 56 },
  stepIconBox: { width: 54, height: 54, borderRadius: 18, backgroundColor: 'rgba(232,130,74,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(232,130,74,0.2)' },
  stepTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 8 },
  stepDesc: { fontSize: 14, color: MUTED, lineHeight: 22, marginBottom: 16 },
  stepTag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 50, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start', borderWidth: 1 },
  stepTagTxt: { fontSize: 11, fontWeight: '700' },

  // WHY
  whySect: { paddingHorizontal: 18, paddingVertical: 44 },
  whyTitle: { fontSize: 30, fontWeight: '900', color: '#fff', marginBottom: 10, letterSpacing: -0.8 },
  whySub: { fontSize: 15, color: MUTED, lineHeight: 24, marginBottom: 24 },
  whyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  whyCard: { width: (width - 48) / 2, backgroundColor: 'rgba(12,8,4,0.92)', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: 'rgba(232,130,74,0.1)' },
  whyIconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(232,130,74,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(232,130,74,0.18)' },
  whyCardTitle: { fontSize: 13, fontWeight: '800', color: '#fff', marginBottom: 6 },
  whyCardDesc: { fontSize: 12, color: MUTED, lineHeight: 18 },

  // QUOTE

  // FINAL CTA
  finalSect: { margin: 18, backgroundColor: 'rgba(12,8,4,0.95)', borderRadius: 28, padding: 30, borderWidth: 1, borderColor: 'rgba(232,130,74,0.2)', alignItems: 'center', overflow: 'hidden', marginBottom: 20 },
  finalGlow: { position: 'absolute', top: -80, left: -80, right: -80, height: 220, borderRadius: 110, backgroundColor: 'rgba(232,130,74,0.07)' },
  finalTitle: { fontSize: 28, fontWeight: '900', color: '#fff', textAlign: 'center', lineHeight: 36, marginBottom: 12, letterSpacing: -0.6 },
  finalSub: { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 22, marginBottom: 26 },
  finalBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: AMBER, borderRadius: 50, paddingHorizontal: 28, paddingVertical: 16, marginBottom: 14, width: '100%', justifyContent: 'center', shadowColor: AMBER, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12 },
  finalBtnTxt: { color: DARK, fontWeight: '900', fontSize: 16 },
  finalNote: { fontSize: 11, color: 'rgba(255,180,100,0.35)', textAlign: 'center', letterSpacing: 0.5 },

  // BOTTOM NAV
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: 'rgba(5,3,2,0.97)', paddingTop: 10, paddingHorizontal: 16, justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: 'rgba(232,130,74,0.15)' },
  navItem: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6 },
  navItemActive: { backgroundColor: 'rgba(232,130,74,0.12)', borderRadius: 12, paddingHorizontal: 14 },
  navItemLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,200,150,0.35)', marginTop: 2 },
  navItemLabelActive: { color: '#fff' },
})

const ps = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: 'rgba(12,8,4,0.98)', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, borderTopWidth: 1, borderTopColor: 'rgba(232,130,74,0.15)' },
  handle: { width: 40, height: 4, backgroundColor: 'rgba(232,130,74,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#0d0a06', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(232,130,74,0.3)' },
  avatarTxt: { fontSize: 22, fontWeight: '800', color: '#fff' },
  name: { fontSize: 20, fontWeight: '800', color: '#fff' },
  email: { fontSize: 13, color: MUTED, marginTop: 2 },
  bio: { fontSize: 14, color: MUTED, lineHeight: 20, marginBottom: 14 },
  tagsRow: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  tag: { backgroundColor: 'rgba(232,130,74,0.12)', borderRadius: 50, paddingHorizontal: 14, paddingVertical: 6 },
  tagTxt: { fontSize: 13, fontWeight: '600', color: '#fff' },
  fullBtn: { backgroundColor: AMBER, borderRadius: 50, paddingVertical: 14, alignItems: 'center', marginBottom: 10, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  fullBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  logoutBtn: { borderWidth: 1.5, borderColor: 'rgba(186,26,26,0.4)', borderRadius: 50, paddingVertical: 13, alignItems: 'center' },
  logoutTxt: { color: '#ff6b6b', fontWeight: '700', fontSize: 15 },
})
