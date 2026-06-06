import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Dimensions, ActivityIndicator, Image,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { MaterialIcons } from '@expo/vector-icons'
import { signOut } from '../lib/auth'
import { apiFetch } from '../lib/api'

const { width } = Dimensions.get('window')
const DRAWER_WIDTH = width * 0.65

interface Props {
  visible: boolean
  onClose: () => void
}

const MENU_ITEMS = [
  { icon: 'home',          label: 'HOME',             screen: 'Landing',         color: '#F5C842' },
  { icon: 'person-outline',label: 'PROFILE',          screen: 'Profile',         color: '#F5C842' },
  { icon: 'bar-chart',     label: 'ACTIVITY',         screen: null,              color: '#F0B830' },
  { icon: 'settings',      label: 'ACCOUNT SETTINGS', screen: 'AccountSettings', color: '#E8A020' },
  { icon: 'info-outline',  label: 'ABOUT US',         screen: 'AboutUs',         color: '#E09060' },
]

export default function DrawerMenu({ visible, onClose }: Props) {
  const navigation = useNavigation<any>()
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current
  const fadeAnim  = useRef(new Animated.Value(0)).current
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (visible) {
      setLoading(true)
      apiFetch('/api/places/state', {})
        .then(setProfile).catch(() => setProfile(null)).finally(() => setLoading(false))
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, friction: 8 }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -DRAWER_WIDTH, duration: 220, useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start()
    }
  }, [visible])

  const handleLogout = async () => {
    await signOut()
    onClose()
    navigation.reset({ index: 0, routes: [{ name: 'Landing' }] })
  }

  const username  = profile?.session?.user?.username || profile?.session?.user?.name || null
  const email     = profile?.session?.user?.email || ''
  const photoUrl  = profile?.profile?.photoUrl || profile?.session?.user?.image
  const initials  = username ? username.slice(0, 2).toUpperCase() : '?'
  const isLoggedIn = !!profile?.session

  if (!visible) return null

  return (
    <View style={s.root}>
      <Animated.View style={[s.backdrop, { opacity: fadeAnim }]} pointerEvents="none" />
      <TouchableOpacity style={s.backdropTouch} activeOpacity={1} onPress={onClose} />

      <Animated.View style={[s.drawer, { transform: [{ translateX: slideAnim }] }]}>

        {/* Yellow header - big top area like reference */}
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.backBtn}>
            <MaterialIcons name="arrow-back" size={26} color="#1a1a1a" />
          </TouchableOpacity>

          {/* Avatar + name */}
          <View style={s.avatarWrap}>
            {photoUrl
              ? <Image source={{ uri: photoUrl }} style={s.avatarImg} />
              : <View style={s.avatar}>
                  <Text style={s.avatarTxt}>{initials}</Text>
                </View>
            }
          </View>
          {loading
            ? <ActivityIndicator color="#1a1a1a" style={{ marginTop: 12 }} />
            : <>
                <Text style={s.username}>{username || 'Guest'}</Text>
                {email ? <Text style={s.email}>{email}</Text> : null}
              </>
          }
        </View>

        {/* Menu items - each slightly darker */}
        <View style={s.menuList}>
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[s.menuItem, { backgroundColor: item.color }]}
              onPress={() => { onClose(); if (item.screen) navigation.navigate(item.screen as never) }}
            >
              <MaterialIcons name={item.icon as any} size={26} color="#1a1a1a" />
              <Text style={s.menuLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}

          {/* Logout / Login+Signup */}
          {isLoggedIn ? (
            <TouchableOpacity
              style={[s.menuItem, { backgroundColor: '#d07050' }]}
              onPress={handleLogout}
            >
              <MaterialIcons name="logout" size={26} color="#1a1a1a" />
              <Text style={s.menuLabel}>LOG OUT</Text>
            </TouchableOpacity>
          ) : (
            <View style={[s.menuItem, { backgroundColor: '#d07050', gap: 12 }]}>
              <TouchableOpacity style={s.loginBtn} onPress={() => { onClose(); navigation.navigate('Login' as never) }}>
                <Text style={s.loginTxt}>Log in</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.signupBtn} onPress={() => { onClose(); navigation.navigate('Signup' as never) }}>
                <Text style={s.signupTxt}>Sign up</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  root:         { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 },
  backdrop:     { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  backdropTouch:{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 },
  drawer: {
    position: 'absolute', top: 0, left: 0, bottom: 0, zIndex: 2,
    width: DRAWER_WIDTH,
    backgroundColor: '#F5C842',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, elevation: 16,
  },
  header: {
    backgroundColor: '#F5C842',
    paddingTop: 56,
    paddingBottom: 32,
    paddingHorizontal: 28,
    flex: 0,
    minHeight: 260,
    justifyContent: 'flex-end',
  },
  backBtn:   { position: 'absolute', top: 56, left: 20, padding: 8 },
  avatarWrap:{ marginBottom: 14 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarImg: { width: 80, height: 80, borderRadius: 40 },
  avatarTxt: { fontSize: 28, fontWeight: '900', color: '#1a1a1a' },
  username:  { fontSize: 26, fontWeight: '900', color: '#1a1a1a', marginBottom: 2 },
  email:     { fontSize: 13, color: 'rgba(0,0,0,0.5)' },
  menuList:  { flex: 1 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 28, paddingVertical: 22,
    gap: 18,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  menuLabel: { flex: 1, fontSize: 16, fontWeight: '900', color: '#1a1a1a', letterSpacing: 1.5 },
  loginBtn:  { flex: 1, borderWidth: 2, borderColor: '#1a1a1a', borderRadius: 50, paddingVertical: 10, alignItems: 'center' },
  loginTxt:  { color: '#1a1a1a', fontWeight: '800', fontSize: 14 },
  signupBtn: { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 50, paddingVertical: 10, alignItems: 'center' },
  signupTxt: { color: '#F5C842', fontWeight: '800', fontSize: 14 },
})
