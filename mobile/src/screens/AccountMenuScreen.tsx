import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Image as ExpoImage } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { MaterialIcons } from '@expo/vector-icons'
import { signOut } from '../lib/auth'
import { apiFetch } from '../lib/api'
import AsyncStorage from '@react-native-async-storage/async-storage'

const ACCENT = '#7C5CFC'

const MENU_ITEMS = [
  { icon: 'home', label: 'Home', screen: 'Landing' },
  { icon: 'person-outline', label: 'Profile', screen: 'Profile' },
  { icon: 'bar-chart', label: 'Friends', screen: 'Friends' },
  { icon: 'notifications', label: 'Notifications', screen: 'Notifications' },
  { icon: 'settings', label: 'Account settings', screen: 'AccountSettings' },
  { icon: 'info-outline', label: 'About us', screen: 'AboutUs' },
]

export default function AccountMenuScreen() {
  const navigation = useNavigation<any>()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    AsyncStorage.getItem('cached_profile').then(cached => {
      if (cached) {
        setProfile(JSON.parse(cached))
        setLoading(false)
      }
    })
    apiFetch('/api/places/state', {})
      .then(data => {
        setProfile(data)
        AsyncStorage.setItem('cached_profile', JSON.stringify(data))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const [photoTs, setPhotoTs] = useState('1')
  useEffect(() => {
    AsyncStorage.getItem('photo_ts').then(ts => setPhotoTs(ts || '1'))
  }, [])

  const handleLogout = async () => {
    await signOut()
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] })
  }

  const username = profile?.session?.user?.username || profile?.session?.user?.name || null
  const rawPhoto = profile?.profile?.photoUrl || profile?.session?.user?.image
  const photoUrl = rawPhoto ? `${rawPhoto.split('?')[0]}?t=${photoTs}` : null
  const initials = username ? username.slice(0, 2).toUpperCase() : '?'
  const isLoggedIn = !!profile?.session

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={s.profileBlock}>
        <View style={s.avatarWrap}>
          {photoUrl ? (
            <ExpoImage source={{ uri: photoUrl }} style={s.avatarImg} transition={150} cachePolicy="memory-disk" />
          ) : (
            <View style={s.avatarFallback}>
              <Text style={s.avatarTxt}>{initials}</Text>
            </View>
          )}
        </View>
        {loading
          ? <ActivityIndicator color={ACCENT} style={{ marginTop: 12 }} />
          : <Text style={s.username}>{username || 'Guest'}</Text>}
      </View>

      <View style={s.menuList}>
        {MENU_ITEMS.map(item => (
          <TouchableOpacity
            key={item.label}
            style={s.menuItem}
            onPress={() => navigation.navigate(item.screen as never)}
          >
            <MaterialIcons name={item.icon as any} size={22} color="rgba(255,255,255,0.8)" />
            <Text style={s.menuLabel}>{item.label}</Text>
            <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>
        ))}

        {isLoggedIn ? (
          <TouchableOpacity style={s.menuItem} onPress={handleLogout}>
            <MaterialIcons name="logout" size={22} color="#ff6b6b" />
            <Text style={[s.menuLabel, { color: '#ff6b6b' }]}>Log out</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.authRow}>
            <TouchableOpacity style={s.loginBtn} onPress={() => navigation.navigate('Login' as never)}>
              <Text style={s.loginTxt}>Log in</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.signupBtn} onPress={() => navigation.navigate('Signup' as never)}>
              <Text style={s.signupTxt}>Sign up</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  profileBlock: { alignItems: 'center', paddingVertical: 24 },
  avatarWrap: { width: 84, height: 84, borderRadius: 42, marginBottom: 12, overflow: 'hidden' },
  avatarImg: { width: 84, height: 84, borderRadius: 42 },
  avatarFallback: { width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(124,92,252,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 28, fontWeight: '800', color: '#fff' },
  username: { fontSize: 20, fontWeight: '800', color: '#fff' },
  menuList: { paddingHorizontal: 18, marginTop: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#fff' },
  authRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  loginBtn: { flex: 1, borderWidth: 1.5, borderColor: '#fff', borderRadius: 50, paddingVertical: 12, alignItems: 'center' },
  loginTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  signupBtn: { flex: 1, backgroundColor: ACCENT, borderRadius: 50, paddingVertical: 12, alignItems: 'center' },
  signupTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
