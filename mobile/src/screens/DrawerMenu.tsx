import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Dimensions, ActivityIndicator, Image,
} from 'react-native'
import { Image as ExpoImage } from 'expo-image'
import { useNavigation } from '@react-navigation/native'
import { MaterialIcons } from '@expo/vector-icons'
import { signOut } from '../lib/auth'
import { apiFetch } from '../lib/api'
import AsyncStorage from '@react-native-async-storage/async-storage'

const { width } = Dimensions.get('window')
const DRAWER_WIDTH = width * 0.65

interface Props {
  visible: boolean
  onClose: () => void
}

const MENU_ITEMS = [
  { icon: 'home',           label: 'HOME',             screen: 'Landing',         color: '#000000' },
  { icon: 'person-outline', label: 'PROFILE',          screen: 'Profile',         color: '#000000' },
  { icon: 'bar-chart',      label: 'FRIENDS',         screen: 'Friends',         color: '#000000' },
  { icon: 'notifications', label: 'NOTIFICATIONS',   screen: 'Notifications',   color: '#000000' },
  { icon: 'settings',       label: 'ACCOUNT SETTINGS', screen: 'AccountSettings', color: '#000000' },
  { icon: 'info-outline',   label: 'ABOUT US',         screen: 'AboutUs',         color: '#000000' },
]

export default function DrawerMenu({ visible, onClose }: Props) {
  const navigation = useNavigation<any>()
  const slideAnim  = useRef(new Animated.Value(-DRAWER_WIDTH)).current
  const fadeAnim   = useRef(new Animated.Value(0)).current
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // One animation value per row: header + menu items + logout
  const TOTAL_ROWS = MENU_ITEMS.length + 2 // header, items, logout
  const rowAnims = useRef(Array.from({ length: TOTAL_ROWS }, () => new Animated.Value(30))).current
  const rowFades = useRef(Array.from({ length: TOTAL_ROWS }, () => new Animated.Value(0))).current

  const animateRowsIn = () => {
    const animations = rowAnims.map((anim, i) =>
      Animated.parallel([
        Animated.timing(anim, { toValue: 0, duration: 220, delay: i === 0 ? 0 : 40 + i * 60, useNativeDriver: true }),
        Animated.timing(rowFades[i], { toValue: 1, duration: 220, delay: i === 0 ? 0 : 40 + i * 60, useNativeDriver: true }),
      ])
    )
    Animated.parallel(animations).start()
  }

  const resetRows = () => {
    rowAnims.forEach(a => a.setValue(DRAWER_WIDTH))
    rowFades.forEach(a => a.setValue(0))
  }

  useEffect(() => {
    if (visible) {
      resetRows()
      // Start animation immediately
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, friction: 12, tension: 120 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start()
      animateRowsIn()
      // Load from cache first (instant), then fetch fresh data
      AsyncStorage.getItem('cached_profile').then(cached => {
        if (cached) setProfile(JSON.parse(cached))
      })
      // Fetch fresh data in background
      apiFetch('/api/places/state', { _t: Date.now() })
        .then(data => {
          setProfile(data)
          AsyncStorage.setItem('cached_profile', JSON.stringify(data))
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -DRAWER_WIDTH, duration: 220, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start()
    }
  }, [visible])

  const handleLogout = async () => {
    await signOut()
    onClose()
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] })
  }

  const username   = profile?.session?.user?.username || profile?.session?.user?.name || null
  const email      = profile?.session?.user?.email || ''
  const rawPhoto   = profile?.profile?.photoUrl || profile?.session?.user?.image
  const photoUrl   = rawPhoto ? `${rawPhoto}?t=${Date.now()}` : null
  const initials   = username ? username.slice(0, 2).toUpperCase() : '?'
  const isLoggedIn = !!profile?.session

  if (!visible) return null

  return (
    <View style={s.root}>
      <Animated.View style={[s.backdrop, { opacity: fadeAnim }]} pointerEvents="none" />
      <TouchableOpacity style={s.backdropTouch} activeOpacity={1} onPress={onClose} />

      <Animated.View style={[s.drawer, { transform: [{ translateX: slideAnim }] }]}>

        {/* Header row - animated first */}
        <Animated.View style={[s.header, {
          opacity: rowFades[0],
          transform: [{ translateX: rowAnims[0] }]
        }]}>
          <TouchableOpacity onPress={onClose} style={s.backBtn}>
            <MaterialIcons name="arrow-back" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={s.avatarWrap}>
            {photoUrl
              ? <>
                  <View style={s.avatar}>
                    <Text style={s.avatarTxt}>{initials}</Text>
                  </View>
                  <ExpoImage
                    source={{ uri: photoUrl }}
                    style={[s.avatarImg, { position: 'absolute' }]}
                    transition={150}
                    cachePolicy="memory-disk"
                  />
                </>
              : <View style={s.avatar}>
                  <Text style={s.avatarTxt}>{initials}</Text>
                </View>
            }
          </View>
          {loading
            ? <ActivityIndicator color="#FFFFFF" style={{ marginTop: 12 }} />
            : <>
                <Text style={s.username}>{username || 'Guest'}</Text>

              </>
          }
        </Animated.View>

        {/* Menu items - each animated one by one */}
        <View style={s.menuList}>
          {MENU_ITEMS.map((item, index) => (
            <Animated.View key={item.label} style={{
              opacity: rowFades[index + 1],
              transform: [{ translateX: rowAnims[index + 1] }]
            }}>
              <TouchableOpacity
                style={[s.menuItem, { backgroundColor: item.color }]}
                onPress={() => { onClose(); if (item.screen) navigation.navigate(item.screen as never) }}
              >
                <MaterialIcons name={item.icon as any} size={26} color="#FFFFFF" />
                <Text style={s.menuLabel}>{item.label}</Text>
              </TouchableOpacity>
            </Animated.View>
          ))}

          {/* Logout / Auth - last animated */}
          <Animated.View style={{
            opacity: rowFades[MENU_ITEMS.length + 1],
            transform: [{ translateX: rowAnims[MENU_ITEMS.length + 1] }]
          }}>
            {isLoggedIn ? (
              <TouchableOpacity
                style={[s.menuItem, { backgroundColor: '#000000' }]}
                onPress={handleLogout}
              >
                <MaterialIcons name="logout" size={26} color="#FFFFFF" />
                <Text style={s.menuLabel}>LOG OUT</Text>
              </TouchableOpacity>
            ) : (
              <View style={[s.menuItem, { backgroundColor: '#000000', gap: 12 }]}>
                <TouchableOpacity style={s.loginBtn} onPress={() => { onClose(); navigation.navigate('Login' as never) }}>
                  <Text style={s.loginTxt}>Log in</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.signupBtn} onPress={() => { onClose(); navigation.navigate('Signup' as never) }}>
                  <Text style={s.signupTxt}>Sign up</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </View>

      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  root:          { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 },
  backdrop:      { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  backdropTouch: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 },
  drawer: {
    position: 'absolute', top: 0, left: 0, bottom: 0, zIndex: 2,
    width: DRAWER_WIDTH, backgroundColor: '#000000',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, elevation: 16,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#000000',
    paddingTop: 56, paddingBottom: 32, paddingHorizontal: 24,
    minHeight: 240, justifyContent: 'flex-end',
  },
  backBtn:    { position: 'absolute', top: 56, left: 16, padding: 8 },
  avatarWrap: { marginBottom: 12, width: 72, height: 72, position: 'relative' },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(185,131,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarImg:  { width: 72, height: 72, borderRadius: 36 },
  avatarTxt:  { fontSize: 24, fontWeight: '900', color: '#FFFFFF' },
  username:   { fontSize: 22, fontWeight: '900', color: '#FFFFFF', marginBottom: 2 },
  email:      { fontSize: 12, color: 'rgba(185,131,255,0.6)' },
  menuList:   { flex: 1 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 20,
    gap: 16,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)',
  },
  menuLabel:  { flex: 1, fontSize: 14, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1.2 },
  loginBtn:   { flex: 1, borderWidth: 2, borderColor: '#FFFFFF', borderRadius: 50, paddingVertical: 8, alignItems: 'center' },
  loginTxt:   { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  signupBtn:  { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 50, paddingVertical: 8, alignItems: 'center' },
  signupTxt:  { color: '#000000', fontWeight: '800', fontSize: 13 },
})
