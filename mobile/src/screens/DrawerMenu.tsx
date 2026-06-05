import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Dimensions, PanResponder, ActivityIndicator, Alert, Image,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { signOut } from '../lib/auth'
import { apiFetch } from '../lib/api'

const { width } = Dimensions.get('window')
const DRAWER_WIDTH = width * 0.78

interface Props {
  visible: boolean
  onClose: () => void
}

export default function DrawerMenu({ visible, onClose }: Props) {
  const navigation = useNavigation<any>()
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current
  const fadeAnim = useRef(new Animated.Value(0)).current
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (visible) {
      setLoading(true)
      apiFetch('/api/places/state', {})
        .then(setProfile)
        .catch(() => setProfile(null))
        .finally(() => setLoading(false))
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, friction: 8 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -DRAWER_WIDTH, duration: 220, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start()
    }
  }, [visible])

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out', style: 'destructive',
        onPress: async () => {
          await signOut()
          onClose()
          navigation.reset({ index: 0, routes: [{ name: 'Landing' }] })
        },
      },
    ])
  }

  const username = profile?.session?.user?.username || profile?.session?.user?.name || '—'
  const email = profile?.session?.user?.email || ''
  const mood = profile?.profile?.moodEmoji || '🙂'
  const photoUrl = profile?.profile?.photoUrl || profile?.session?.user?.image
  const initials = username !== '—' ? username.slice(0, 2).toUpperCase() : '?'
  const isLoggedIn = !!profile?.session

  const menuItems = [
    { icon: '👤', label: 'Profile', onPress: () => { onClose(); navigation.navigate('Profile') } },
    { icon: '🤝', label: 'Friends', onPress: () => { onClose(); navigation.navigate('Friends') } },
    { icon: '📊', label: 'Activity', onPress: () => {} },
    { icon: '⚙️', label: 'Account Settings', onPress: () => { onClose(); navigation.navigate('AccountSettings') } },
    { icon: 'ℹ️', label: 'About Us', onPress: () => { onClose(); navigation.navigate('AboutUs') } },
  ]

  if (!visible) return null

  return (
    <View style={s.root}>
      {/* Backdrop - only on the right side */}
      <Animated.View style={[s.backdrop, { opacity: fadeAnim }]} pointerEvents="none" />
      <TouchableOpacity style={s.backdropTouch} activeOpacity={1} onPress={onClose} />

      {/* Drawer */}
      <Animated.View style={[s.drawer, { transform: [{ translateX: slideAnim }] }]}>
        {/* Top bar */}
        <View style={s.topBar}>
          <TouchableOpacity onPress={onClose} style={s.closeRow}>
            <Text style={s.closeArrow}>‹</Text>
            <Text style={s.closeTxt}>Back</Text>
          </TouchableOpacity>
        </View>

        {/* Header / Avatar */}
        <View style={s.drawerHeader}>
          <View style={s.avatarWrap}>
            {photoUrl
              ? <Image source={{ uri: photoUrl }} style={s.avatarImg} />
              : <View style={s.avatar}><Text style={s.avatarTxt}>{initials}</Text></View>}

          </View>
          {loading ? <ActivityIndicator color="#005129" /> : (
            <>
              <Text style={s.username}>{username}</Text>
              {email ? <Text style={s.email}>{email}</Text> : null}

            </>
          )}
        </View>

        {/* Divider */}
        <View style={s.divider} />

        {/* Menu items */}
        <View style={s.menuList}>
          {menuItems.map((item) => (
            <TouchableOpacity key={item.label} style={s.menuItem} onPress={item.onPress}>
              <Text style={s.menuIcon}>{item.icon}</Text>
              <Text style={s.menuLabel}>{item.label}</Text>
              <Text style={s.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.divider} />

        {/* Logout */}
        {isLoggedIn ? (
          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
            <Text style={s.logoutIcon}>🚪</Text>
            <Text style={s.logoutTxt}>Log out</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.authRow}>
            <TouchableOpacity style={s.loginBtn} onPress={() => { onClose(); navigation.navigate('Login') }}>
              <Text style={s.loginTxt}>Log in</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.signupBtn} onPress={() => { onClose(); navigation.navigate('Signup') }}>
              <Text style={s.signupTxt}>Sign up</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerTxt}>LetsTalk · v1.0</Text>
        </View>
      </Animated.View>
    </View>
  )
}

const G = '#005129'
const DARK = '#002111'
const MID = '#006d36'

const s = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,33,17,0.45)' },
  backdropTouch: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 },
  drawer: {
    position: 'absolute', top: 0, left: 0, bottom: 0, zIndex: 2,
    width: DRAWER_WIDTH, backgroundColor: '#e9ffed',
    paddingTop: 48, paddingBottom: 32,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 12,
  },
  drawerHeader: { paddingHorizontal: 24, paddingBottom: 24, alignItems: 'flex-start' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(191,201,190,0.3)', marginBottom: 8 },
  closeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  closeArrow: { fontSize: 28, color: G, fontWeight: '300', lineHeight: 32 },
  closeTxt: { fontSize: 16, fontWeight: '700', color: G },
  closeBtn: { marginBottom: 16 },
  closeBtnTxt: { fontSize: 15, fontWeight: '700', color: G },
  avatarWrap: { marginBottom: 12, position: 'relative' },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: G, justifyContent: 'center', alignItems: 'center' },
  avatarImg: { width: 72, height: 72, borderRadius: 36, backgroundColor: G },
  avatarTxt: { fontSize: 26, fontWeight: '800', color: 'white' },
  editBadge: { position: 'absolute', bottom: 0, right: -4, backgroundColor: 'white', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,81,41,0.2)' },
  editBadgeTxt: { fontSize: 12 },
  username: { fontSize: 20, fontWeight: '800', color: DARK, marginBottom: 2 },
  email: { fontSize: 13, color: MID, marginBottom: 8 },
  moodPill: { backgroundColor: '#caf2d5', borderRadius: 50, paddingHorizontal: 12, paddingVertical: 4 },
  moodPillTxt: { fontSize: 13, fontWeight: '600', color: G },
  divider: { height: 1, backgroundColor: 'rgba(191,201,190,0.5)', marginHorizontal: 24, marginVertical: 8 },
  menuList: { paddingTop: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, gap: 14 },
  menuIcon: { fontSize: 20, width: 28 },
  menuLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: DARK },
  menuArrow: { fontSize: 22, color: MID, fontWeight: '300' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, gap: 14, marginTop: 8 },
  logoutIcon: { fontSize: 20, width: 28 },
  logoutTxt: { fontSize: 16, fontWeight: '600', color: '#ba1a1a' },
  authRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 24, marginTop: 12 },
  loginBtn: { flex: 1, borderWidth: 2, borderColor: G, borderRadius: 50, paddingVertical: 10, alignItems: 'center' },
  loginTxt: { color: G, fontWeight: '700' },
  signupBtn: { flex: 1, backgroundColor: G, borderRadius: 50, paddingVertical: 10, alignItems: 'center' },
  signupTxt: { color: 'white', fontWeight: '700' },
  footer: { position: 'absolute', bottom: 24, left: 24 },
  footerTxt: { fontSize: 12, color: MID, opacity: 0.6 },
})
