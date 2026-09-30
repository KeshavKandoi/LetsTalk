import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Modal, Pressable,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { MaterialIcons, Feather } from '@expo/vector-icons'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { getSession, signOut, getCachedMyState, refreshMyState, getMyPhotoUrl, getStoredSessionToken, patchCachedMyPhoto } from '../lib/auth'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL
const ACCENT = '#8B5CF6'
const ACCENT_BLUE = '#5B7FFF'

export default function ProfileScreen() {
  const navigation = useNavigation<any>()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const buildProfile = (u: any, stateData: any) => ({
    username: u?.name || u?.username || 'You',
    full_name: u?.name || 'You',
    email: u?.email || '',
    photoUrl: getMyPhotoUrl(stateData),
    created_at: u?.createdAt || null,
    gender: stateData?.profile?.gender || null,
    age: stateData?.profile?.age || null,
    about: stateData?.profile?.about || '',
  })

  const loadProfile = async () => {
    try {
      const cached = await getCachedMyState()
      if (cached) {
        const cachedUser = cached.session?.user
        setProfile(buildProfile(cachedUser, cached))
        setLoading(false)
      }
    } catch {}

    try {
      const session = await getSession()
      if (!session?.session) { navigation.goBack(); return }
      const u = session.user
      let stateData: any = null
      try {
        stateData = await refreshMyState()
      } catch {}
      if (stateData) setProfile(buildProfile(u, stateData))
    } catch (e) {}
    setLoading(false)
  }

  useEffect(() => { loadProfile() }, [])
  useFocusEffect(useCallback(() => { loadProfile() }, []))

  const handleLogout = async () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out', style: 'destructive', onPress: async () => {
          await signOut()
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] })
        }
      }
    ])
  }

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access.'); return }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true, aspect: [1, 1], quality: 0.7,
    })
    if (result.canceled || !result.assets[0]) return
    setUploadingPhoto(true)
    try {
      const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
        encoding: FileSystem.EncodingType.Base64,
      })
      const token = await getStoredSessionToken()
      const res = await fetch(`${BASE_URL}/api/places/upload-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ photoBase64: `data:image/jpeg;base64,${base64}` }),
      })
      const data = await res.json()
      if (data?.photoUrl) {
        setProfile((p: any) => p ? { ...p, photoUrl: data.photoUrl } : p)
        await patchCachedMyPhoto(data.photoUrl)
      } else {
        Alert.alert('Error', data?.error || 'Upload failed.')
      }
    } catch {
      Alert.alert('Error', 'Could not upload photo.')
    }
    setUploadingPhoto(false)
  }

  const photoUrl = profile?.photoUrl || null
  const username = profile?.username || 'You'
  const displayName = profile?.full_name || username
  const email = profile?.email || ''
  const about = profile?.about || ''
  const age = profile?.age || null
  const gender = profile?.gender || null
  const genderLabel = gender ? gender[0].toUpperCase() + gender.slice(1) : '—'
  const genderIcon = gender?.toLowerCase() === 'female' ? 'female' : gender?.toLowerCase() === 'male' ? 'male' : 'help-outline'

  if (loading && !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <View style={styles.avatarBlock}>
          <View style={styles.avatarRingWrap}>
            <LinearGradient
              colors={[ACCENT_BLUE, ACCENT]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarRing}
            >
              <TouchableOpacity
                activeOpacity={photoUrl ? 0.85 : 1}
                disabled={!photoUrl}
                onPress={() => setPhotoViewerVisible(true)}
              >
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={styles.avatarImage} contentFit="cover" cachePolicy="memory-disk" transition={150} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitial}>{displayName[0]?.toUpperCase()}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </LinearGradient>
            <TouchableOpacity style={styles.cameraBadge} onPress={handlePickAvatar} disabled={uploadingPhoto}>
              {uploadingPhoto ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <MaterialIcons name="camera-alt" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.displayName}>{displayName}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <LinearGradient colors={['#a855f7', '#ec4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statIconWrap}>
              <MaterialIcons name="badge" size={20} color="#fff" />
            </LinearGradient>
            <Text style={styles.statValue}>{age || '—'}</Text>
            <Text style={styles.statLabel}>Age</Text>
          </View>
          <View style={styles.statCard}>
            <LinearGradient colors={['#3b82f6', '#2563eb']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statIconWrap}>
              <MaterialIcons name={genderIcon as any} size={20} color="#fff" />
            </LinearGradient>
            <Text style={styles.statValue}>{genderLabel}</Text>
            <Text style={styles.statLabel}>Gender</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>About me</Text>
            <TouchableOpacity style={styles.sectionEditLink} onPress={() => navigation.navigate('EditProfile' as never)}>
              <MaterialIcons name="edit" size={13} color="rgba(255,255,255,0.55)" />
              <Text style={styles.sectionEditLinkText}>Edit</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            <MaterialIcons name="format-quote" size={22} color={ACCENT_BLUE} style={styles.quoteIcon} />
            <Text style={styles.cardBody}>{about || 'No about yet. Edit your profile to add one.'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <MaterialIcons name="person-outline" size={18} color="rgba(255,255,255,0.5)" />
              <Text style={styles.rowText}>{username}</Text>
              <MaterialIcons name="chevron-right" size={18} color="rgba(255,255,255,0.3)" />
            </View>
            <View style={styles.rowDivider} />
            <View style={styles.row}>
              <MaterialIcons name="mail-outline" size={18} color="rgba(255,255,255,0.5)" />
              <Text style={styles.rowText}>{email || 'No email'}</Text>
              <MaterialIcons name="chevron-right" size={18} color="rgba(255,255,255,0.3)" />
            </View>
            <View style={styles.rowDivider} />
            <View style={styles.row}>
              <MaterialIcons name="calendar-today" size={18} color="rgba(255,255,255,0.5)" />
              <Text style={styles.rowText}>
                Joined {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Recently'}
              </Text>
              <MaterialIcons name="chevron-right" size={18} color="rgba(255,255,255,0.3)" />
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.85}>
          <MaterialIcons name="logout" size={18} color="#ef4444" />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>

      </ScrollView>

      <Modal visible={photoViewerVisible} transparent animationType="fade" onRequestClose={() => setPhotoViewerVisible(false)}>
        <Pressable style={viewerStyles.backdrop} onPress={() => setPhotoViewerVisible(false)}>
          <TouchableOpacity style={viewerStyles.closeBtn} onPress={() => setPhotoViewerVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          {photoUrl && (
            <Image source={{ uri: photoUrl }} style={viewerStyles.fullImage} contentFit="contain" cachePolicy="memory-disk" />
          )}
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 48 },

  avatarBlock: { alignItems: 'center', marginBottom: 26, marginTop: 12 },
  avatarRingWrap: { position: 'relative', marginBottom: 16 },
  avatarRing: { width: 152, height: 152, borderRadius: 76, alignItems: 'center', justifyContent: 'center', padding: 4 },
  avatarImage: { width: 144, height: 144, borderRadius: 72 },
  avatarPlaceholder: { width: 144, height: 144, borderRadius: 72, backgroundColor: '#0d0d0d', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 52, fontWeight: '800', color: '#fff' },
  cameraBadge: {
    position: 'absolute', bottom: 4, right: 4, width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(20,20,20,0.92)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
  },
  displayName: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 4 },
  email: { fontSize: 13, color: 'rgba(255,255,255,0.45)' },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, borderWidth: 1, borderColor: 'rgba(139,92,246,0.18)', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 14 },
  statIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 2 },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },

  editButtonWrap: { marginBottom: 28 },
  editButtonBorder: { borderRadius: 14, padding: 1.5 },
  editButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 50, borderRadius: 12.5, backgroundColor: '#0a0a0a', paddingHorizontal: 18 },
  editButtonLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  editButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  section: { marginBottom: 20 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  sectionEditLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionEditLinkText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  card: { borderWidth: 1, borderColor: 'rgba(139,92,246,0.18)', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 16 },
  quoteIcon: { marginBottom: 6 },
  cardBody: { fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 21 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  rowText: { fontSize: 14, color: '#fff', flex: 1 },
  rowDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 10 },

  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(239,68,68,0.4)',
    backgroundColor: 'rgba(220,38,38,0.08)', marginTop: 8,
  },
  logoutText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
})

const viewerStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  closeBtn: { position: 'absolute', top: 60, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  fullImage: { width: '100%', height: '80%' },
})
