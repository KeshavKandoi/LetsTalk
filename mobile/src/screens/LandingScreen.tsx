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
import { MaterialIcons, Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'

const { width, height } = Dimensions.get('window')
const AMBER = '#e8824a'
const AMBER_DIM = 'rgba(232,130,74,0.15)'
const MUTED = 'rgba(255,180,100,0.55)'
const DARK = '#050302'

function EmberBackground() {
  return (
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000000' }]} pointerEvents="none" />
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
          <Feather name="message-circle" size={22} color="#8B5CF6" />
          <Text style={s.navTitle}>Let's Talk</Text>
        </View>
        <TouchableOpacity activeOpacity={0.88} style={s.joinBtnWrap} onPress={handleJoin}>
          <LinearGradient
            colors={['#EC4899', '#8B5CF6', '#6366F1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.joinBtn}
          >
            <Text style={s.joinBtnText}>Join Now</Text>
          </LinearGradient>
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

          <Text style={s.heroTitle}>
            <Text style={s.heroTitleLight}>Real people. Real places.{'\n'}</Text>
            <Text style={s.heroTitleBold}>Real conversations.</Text>
          </Text>
          <Text style={s.heroSub}>Meet people nearby who actually want to talk.</Text>

          {/* Feature strip */}
          <View style={s.featureStrip}>
            {[
              { icon: <Feather name="zap" size={14} color={MUTED} />, text: 'No swiping' },
              { icon: <Feather name="map-pin" size={14} color={MUTED} />, text: 'Real venues' },
              { icon: <Feather name="message-circle" size={14} color={MUTED} />, text: 'In-person talk' },
            ].map((f, i) => (
              <View key={i} style={s.featureItem}>
                {f.icon}
                <Text style={s.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>

          {/* CTA */}
          <Animated.View style={[s.ctaBtnWrap, { transform: [{ scale: pulseAnim }] }]}>
            <TouchableOpacity activeOpacity={0.88} style={s.ctaBtnOuter} onPress={handleJoin}>
              <LinearGradient
                colors={['#EC4899', '#8B5CF6', '#6366F1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.ctaBtn}
              >
                <Feather name="navigation" size={20} color="#fffaf6" />
                <Text style={s.ctaBtnText}>Find People Nearby</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

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
              <Text style={s.actTitle}>A live room feels better than a feed</Text>
              <View style={s.actVenueRow}>
                <Feather name="map-pin" size={11} color={MUTED} />
                <Text style={s.actVenue}>CHECK IN, SEE WHO'S OPEN TO CHAT</Text>
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
              icon: <Feather name="smile" size={25} color="#8B5CF6" />,
              title: 'Set your vibe',
              desc: 'Tell the room what you\'re in the mood for — deep talk, casual chat, or just good company.',
              tag: 'Takes 10 seconds',
              tagColor: '#3dbf7a',
            },
            {
              anim: step2, num: '02',
              icon: <Feather name="map-pin" size={25} color="#8B5CF6" />,
              title: 'Walk in, check in',
              desc: 'Arrive at any participating cafe or venue. One tap puts you on the live map.',
              tag: 'Location verified',
              tagColor: '#5b8dee',
            },
            {
              anim: step3, num: '03',
              icon: <Feather name="message-circle" size={25} color="#8B5CF6" />,
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
              { icon: <Feather name="eye-off" size={24} color="#8B5CF6" />, title: 'No endless scrolling', desc: 'You\'re not here to scroll. You\'re here to talk.' },
              { icon: <Feather name="shield" size={24} color="#8B5CF6" />, title: 'No fake profiles', desc: 'You\'re physically at the same place. It\'s real.' },
              { icon: <Feather name="zap" size={24} color="#8B5CF6" />, title: 'Instant connection', desc: 'No waiting. People are there right now.' },
              { icon: <Feather name="sliders" size={24} color="#8B5CF6" />, title: 'You\'re in control', desc: 'Set your mood, choose who to talk to.' },
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
          <View style={s.finalPinRing}>
            <LinearGradient colors={['#8B5CF6', '#6366F1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.finalPinBadge}>
              <Feather name="map-pin" size={26} color="#fff" />
            </LinearGradient>
          </View>
          <Text style={s.finalTitle}>Your next real conversation is <Text style={s.finalTitleHighlight}>nearby</Text>.</Text>
          <Text style={s.finalSub}>Step into a small, growing network of people who came here to talk face to face.</Text>
          <TouchableOpacity activeOpacity={0.88} style={s.finalBtnWrap} onPress={handleJoin}>
            <LinearGradient colors={['#EC4899', '#8B5CF6', '#6366F1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.finalBtn}>
              <Text style={s.finalBtnTxt}>Start Now — It's Free</Text>
              <Feather name="arrow-right" size={18} color="#fffaf6" />
            </LinearGradient>
          </TouchableOpacity>
          <View style={s.finalIconRow}>
            <View style={s.finalIconItem}>
              <Feather name="credit-card" size={18} color="rgba(255,255,255,0.65)" />
              <Text style={s.finalIconLabel}>No credit card</Text>
            </View>
            <View style={s.finalIconItem}>
              <Feather name="message-circle" size={18} color="#FF8C42" />
              <Text style={s.finalIconLabel}>No algorithm</Text>
            </View>
            <View style={s.finalIconItem}>
              <Feather name="users" size={18} color="#8B5CF6" />
              <Text style={s.finalIconLabel}>Just people</Text>
            </View>
          </View>
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
          { icon: 'compass', label: 'Explore', active: true, guard: false, badge: 0 },
          { icon: 'map-pin', label: 'Nearby', active: false, guard: true, badge: 0 },
          { icon: 'message-circle', label: 'Chats', active: false, guard: true, badge: 0 },
          { icon: 'user', label: 'Profile', active: false, guard: false, badge: 0 },
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
            <Feather name={item.icon as any} size={22} color={item.active ? '#FF8C42' : 'rgba(255,255,255,0.38)'} />
            <Text style={[s.navItemLabel, item.active && s.navItemLabelActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090909' },

  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 14, paddingBottom: 12, backgroundColor: 'rgba(20,20,20,0.85)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', zIndex: 10, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 24, elevation: 6 },
  navBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navTitle: { fontSize: 19, fontWeight: '900', color: '#fff', letterSpacing: -0.2 },
  joinBtnWrap: { borderRadius: 999, overflow: 'hidden', shadowColor: '#FF8C42', shadowOpacity: 0.28, shadowRadius: 30, elevation: 8 },
  joinBtn: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, minWidth: 104, alignItems: 'center', justifyContent: 'center' },
  joinBtnText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.2 },

  scroll: { paddingBottom: 132 },

  // HERO
  hero: { paddingHorizontal: 18, paddingTop: 32, paddingBottom: 20, alignItems: 'center' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(17,17,17,0.74)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.35)', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, marginBottom: 28, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 14, elevation: 2 },
  liveDotRing: { width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(139,92,246,0.22)', justifyContent: 'center', alignItems: 'center' },
  liveDotCore: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#8B5CF6' },
  livePillText: { fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 2.2 },

  heroTitle: { textAlign: 'center', marginBottom: 28 },
  heroTitleLight: { fontSize: 24, fontWeight: '600', color: 'rgba(255,255,255,0.65)', lineHeight: 32, letterSpacing: -0.2 },
  heroTitleBold: { fontSize: 34, fontWeight: '900', color: '#fff', lineHeight: 42, letterSpacing: -0.6 },
  heroSub: { fontSize: 16, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 22, marginBottom: 38, paddingHorizontal: 8, maxWidth: '86%' },
  featureStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 42, flexWrap: 'wrap' },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 6 },
  featureText: { fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: '600' },

  statsRow: { flexDirection: 'row', width: '100%', backgroundColor: 'rgba(17,17,17,0.88)', borderRadius: 24, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)', marginBottom: 26, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, elevation: 4 },
  statBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 26, paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.01)' },
  statBorder: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.08)' },
  statTitle: { fontSize: 19, fontWeight: '800', color: '#fff', textAlign: 'center', lineHeight: 23, marginBottom: 8, letterSpacing: -0.3 },
  statLbl: { fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: '600', letterSpacing: 0.1, textAlign: 'center', lineHeight: 15 },

  ctaBtnWrap: { width: '100%', marginBottom: 28 },
  ctaBtnOuter: { borderRadius: 999, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 24, elevation: 10 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 999, height: 58, paddingHorizontal: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  ctaBtnText: { color: '#fffaf6', fontWeight: '700', fontSize: 16, letterSpacing: 0.1 },
  signinHint: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 26 },

  actCard: { width: '100%', backgroundColor: 'rgba(17,17,17,0.92)', borderRadius: 24, padding: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, elevation: 4 },
  actLeft: { flex: 1 },
  actAvatarRow: { flexDirection: 'row', marginBottom: 10 },
  actAvatar: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#111111' },
  actAvatarTxt: { fontSize: 11, fontWeight: '900', color: '#fff' },
  actTitle: { fontSize: 15, fontWeight: '800', color: '#fff', marginBottom: 5, letterSpacing: -0.1 },
  actVenueRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  actVenue: { fontSize: 10, color: 'rgba(255,255,255,0.65)', letterSpacing: 1, fontWeight: '600' },
  actPing: { width: 22, height: 22, justifyContent: 'center', alignItems: 'center' },
  actPingRing: { position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,140,66,0.16)' },
  actPingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3dbf7a' },

  // DIVIDER
  divider: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, marginVertical: 48, gap: 14 },
  divLine: { flex: 1, height: 1.5, backgroundColor: 'rgba(255,255,255,0.6)' },
  divTxt: { fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.65)', letterSpacing: 3.2 },

  // STEPS
  stepsWrap: { paddingHorizontal: 18, gap: 14, marginBottom: 18 },
  stepCard: { backgroundColor: 'rgba(17,17,17,0.92)', borderRadius: 26, padding: 24, borderWidth: 2, borderColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, elevation: 4 },
  stepTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  stepNum: { fontSize: 50, fontWeight: '900', color: 'rgba(255,255,255,0.08)', lineHeight: 54, letterSpacing: -1 },
  stepIconBox: { width: 54, height: 54, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.03)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  stepTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 8, letterSpacing: -0.3 },
  stepDesc: { fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 23, marginBottom: 16 },
  stepTag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', borderWidth: 1 },
  stepTagTxt: { fontSize: 11, fontWeight: '800' },

  // WHY
  whySect: { paddingHorizontal: 18, paddingVertical: 48 },
  whyTitle: { fontSize: 30, fontWeight: '900', color: '#fff', marginBottom: 10, letterSpacing: -0.8 },
  whySub: { fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 24, marginBottom: 24 },
  whyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  whyCard: { width: (width - 48) / 2, backgroundColor: 'rgba(17,17,17,0.92)', borderRadius: 22, padding: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)', shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 18, elevation: 3 },
  whyIconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.03)', justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  whyCardTitle: { fontSize: 13, fontWeight: '800', color: '#fff', marginBottom: 6 },
  whyCardDesc: { fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 18 },

  // QUOTE

  // FINAL CTA
  finalSect: { margin: 18, backgroundColor: 'rgba(17,17,17,0.92)', borderRadius: 28, padding: 30, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)', alignItems: 'center', overflow: 'hidden', marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.24, shadowRadius: 24, elevation: 4 },
  finalGlow: { position: 'absolute', top: -90, left: -90, right: -90, height: 240, borderRadius: 120, backgroundColor: 'rgba(139,92,246,0.10)' },
  finalPinRing: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(139,92,246,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  finalPinBadge: { width: 54, height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center' },
  finalTitleHighlight: { color: '#A78BFA' },
  finalIconRow: { flexDirection: 'row', justifyContent: 'center', gap: 28, marginTop: 22 },
  finalIconItem: { alignItems: 'center', gap: 6 },
  finalIconLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  finalTitle: { fontSize: 26, fontWeight: '800', color: '#fff', textAlign: 'center', lineHeight: 34, marginBottom: 12, letterSpacing: -0.4 },
  finalSub: { fontSize: 14, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  finalBtnWrap: { width: '100%', borderRadius: 999, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, elevation: 8, marginBottom: 14 },
  finalBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 999, paddingHorizontal: 28, paddingVertical: 16, width: '100%', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  finalBtnTxt: { color: '#fffaf6', fontWeight: '900', fontSize: 16 },
  finalNote: { fontSize: 11, color: 'rgba(255,255,255,0.65)', textAlign: 'center', letterSpacing: 0.5 },

  // BOTTOM NAV
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: '#0a0a0a', paddingTop: 10, paddingHorizontal: 14, justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', shadowColor: '#000', shadowOpacity: 0.24, shadowRadius: 24, elevation: 8 },
  navItem: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, minWidth: 66 },
  navItemActive: { backgroundColor: 'rgba(255,140,66,0.12)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,140,66,0.14)' },
  navItemLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.65)', marginTop: 2, letterSpacing: 0.2 },
  navItemLabelActive: { color: '#FF8C42' },
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
