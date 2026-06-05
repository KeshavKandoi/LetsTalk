import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, Image,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { signOut } from '../lib/auth'
import { apiFetch } from '../lib/api'

const G = '#005129'
const MID = '#006d36'
const DARK = '#002111'
const SURFACE = '#e9ffed'
const CARD = '#cff8da'

export default function ProfileScreen() {
  const navigation = useNavigation<any>()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    try {
      const state = await apiFetch('/api/places/state', {})
      setProfile(state)
      if (state?.profile?.photoUrl) setPhotoUrl(state.profile.photoUrl)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadProfile()
    })
    return unsubscribe
  }, [navigation, loadProfile])

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') { return }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    })
    if (result.canceled) return
    setUploading(true)
    try {
      const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 })
      const dataUri = `data:image/jpeg;base64,${base64}`
      await apiFetch('/api/places/upload-photo', { photoBase64: dataUri })
      setPhotoUrl(dataUri)
      setProfile((prev: any) => ({ ...prev, profile: { ...prev?.profile, photoUrl: dataUri } }))
    } catch (e: any) {
      Alert.alert('Upload failed', e.message)
    } finally {
      setUploading(false)
    }
  }

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out', style: 'destructive',
        onPress: async () => {
          await signOut()
          navigation.reset({ index: 0, routes: [{ name: 'Landing' }] })
        },
      },
    ])
  }

  const username = profile?.session?.user?.username || profile?.session?.user?.name || '—'
  const email = profile?.session?.user?.email || ''
  const mood = profile?.profile?.moodEmoji || '🙂'
  const age = profile?.profile?.age ? String(profile.profile.age) : ''
  const gender = profile?.profile?.gender ? String(profile.profile.gender) : ''
  const intent = profile?.profile?.intentText || 'Open to a conversation.'
  const initials = username.slice(0, 2).toUpperCase()

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}>
          <Text style={s.iconTxt}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Profile</Text>
        <View style={s.iconBtn} />
      </View>

      {loading ? (
        <View style={s.centered}><ActivityIndicator color={G} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          <View style={s.heroSection}>
            <TouchableOpacity style={s.avatarWrap} onPress={pickPhoto} disabled={uploading}>
              {photoUrl
                ? <Image source={{ uri: photoUrl }} style={s.avatarImg} />
                : <View style={s.avatar}><Text style={s.avatarText}>{initials}</Text></View>}
              <View style={s.avatarEditBadge}>
                {uploading
                  ? <ActivityIndicator size="small" color={G} />
                  : <Text style={s.avatarEditTxt}>✏️</Text>}
              </View>
            </TouchableOpacity>
            <Text style={s.username}>{username}</Text>
            {email ? <Text style={s.handle}>@{email.split('@')[0]}</Text> : null}
            <Text style={s.bio}>{intent}</Text>
          </View>

          <View style={s.tagsRow}>
            <View style={s.tag}><Text style={s.tagTxt}>{mood} Mood</Text></View>
            <View style={s.tag}><Text style={s.tagTxt}>🎂 {age || 'Not set'} yrs</Text></View>
            <View style={s.tag}><Text style={s.tagTxt}>👤 {gender || 'Not set'}</Text></View>
            {profile?.profile?.currentPlaceId
              ? <View style={s.tag}><Text style={s.tagTxt}>📍 Checked in</Text></View>
              : <View style={s.tag}><Text style={s.tagTxt}>🏠 Not checked in</Text></View>}
            {profile?.profile?.status === 'ready'
              ? <View style={[s.tag, s.tagActive]}><Text style={[s.tagTxt, s.tagTxtActive]}>✅ Ready</Text></View>
              : null}
          </View>

          <View style={s.card}>
            <View style={s.cardRow}>
              <View style={s.cardRowLeft}>
                <Text style={s.cardIcon}>🔐</Text>
                <Text style={s.cardLabel}>Active Account</Text>
              </View>
              <View style={s.secureBadge}>
                <Text style={s.secureBadgeTxt}>Secure</Text>
              </View>
            </View>

            <View style={s.divider} />

            <View style={s.cardRow}>
              <View style={s.cardRowLeft}>
                <Text style={s.cardIcon}>👤</Text>
                <Text style={s.cardLabel}>{username}</Text>
              </View>
            </View>

            {email ? (
              <View style={s.cardRow}>
                <View style={s.cardRowLeft}>
                  <Text style={s.cardIcon}>✉️</Text>
                  <Text style={s.cardLabel}>{email}</Text>
                </View>
              </View>
            ) : null}
          </View>

          <TouchableOpacity style={s.editBtn} onPress={() => navigation.navigate('EditProfile')}>
            <Text style={s.editBtnTxt}>✏️  Edit Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
            <Text style={s.logoutTxt}>Log out</Text>
          </TouchableOpacity>

        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: SURFACE },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(191,201,190,0.3)' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: G },
  iconBtn: { width: 40, alignItems: 'center' },
  iconTxt: { fontSize: 20, color: G, fontWeight: '700' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 60, alignItems: 'center' },
  heroSection: { alignItems: 'center', marginBottom: 20 },
  avatarWrap: { marginBottom: 12, position: 'relative' },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: G, justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: CARD },
  avatarImg: { width: 96, height: 96, borderRadius: 48, borderWidth: 4, borderColor: CARD },
  avatarText: { fontSize: 32, fontWeight: '800', color: 'white' },
  avatarEditBadge: { position: 'absolute', bottom: 2, right: 2, backgroundColor: 'white', borderRadius: 14, width: 28, height: 28, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,81,41,0.2)', elevation: 2 },
  avatarEditTxt: { fontSize: 14 },
  username: { fontSize: 26, fontWeight: '800', color: DARK, marginBottom: 4 },
  handle: { fontSize: 14, fontWeight: '600', color: MID, marginBottom: 8 },
  bio: { fontSize: 15, color: '#404940', textAlign: 'center', maxWidth: 260, lineHeight: 22 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 24 },
  tag: { backgroundColor: '#caf2d5', borderRadius: 50, paddingHorizontal: 14, paddingVertical: 6 },
  tagActive: { backgroundColor: G },
  tagTxt: { fontSize: 13, fontWeight: '600', color: G },
  tagTxtActive: { color: 'white' },
  card: { width: '100%', backgroundColor: 'white', borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(191,201,190,0.3)', gap: 12 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: { fontSize: 18 },
  cardLabel: { fontSize: 14, fontWeight: '600', color: DARK },
  secureBadge: { backgroundColor: '#6dfe9c', borderRadius: 50, paddingHorizontal: 10, paddingVertical: 3 },
  secureBadgeTxt: { fontSize: 11, fontWeight: '700', color: DARK },
  divider: { height: 1, backgroundColor: 'rgba(191,201,190,0.4)' },
  editBtn: { width: '100%', backgroundColor: G, borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  editBtnTxt: { color: 'white', fontWeight: '700', fontSize: 15 },
  logoutBtn: { width: '100%', borderWidth: 2, borderColor: 'rgba(186,26,26,0.2)', borderRadius: 50, paddingVertical: 15, alignItems: 'center' },
  logoutTxt: { color: '#ba1a1a', fontWeight: '700', fontSize: 15 },
})
