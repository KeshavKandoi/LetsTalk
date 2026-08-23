import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Image, Modal, Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { MaterialIcons, Feather } from '@expo/vector-icons'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getSession, signOut } from '../lib/auth'
import { apiFetch } from '../lib/api'

const CACHE_KEY = 'cached_profile_screen'

export default function ProfileScreen() {
  const navigation = useNavigation<any>()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false)

  const buildProfile = (u: any, stateData: any, photoTs: string) => ({
    username: u?.name || u?.username || 'You',
    full_name: u?.name || 'You',
    email: u?.email || '',
    photoUrl: stateData?.profile?.photoUrl ? stateData.profile.photoUrl + '?t=' + photoTs : null,
    created_at: u?.createdAt || null,
    gender: stateData?.profile?.gender || null,
    age: stateData?.profile?.age || null,
    about: stateData?.profile?.about || '',
  })

  const loadProfile = async () => {
    // 1. Show cached profile instantly, if we have one
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY)
      if (cached) {
        setProfile(JSON.parse(cached))
        setLoading(false)
      }
    } catch {}

    // 2. Fetch fresh data in the background and update once ready
    try {
      const session = await getSession()
      if (!session?.session) { navigation.goBack(); return }
      const u = session.user
      const photoTs = await AsyncStorage.getItem('photo_ts').then(t => t || '1')
      let stateData: any = null
      try {
        stateData = await apiFetch('/api/places/state', {})
      } catch {}
      const fresh = buildProfile(u, stateData, photoTs)
      setProfile(fresh)
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(fresh)).catch(() => {})
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
          await AsyncStorage.removeItem(CACHE_KEY)
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] })
        }
      }
    ])
  }

  const photoUrl = profile?.photoUrl || null
  const username = profile?.username || 'You'
  const displayName = profile?.full_name || username
  const email = profile?.email || ''
  const about = profile?.about || ''
  const age = profile?.age || null
  const gender = profile?.gender || null

  if (loading && !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#8B5CF6" size="large" />
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
          <TouchableOpacity
            activeOpacity={photoUrl ? 0.85 : 1}
            disabled={!photoUrl}
            onPress={() => setPhotoViewerVisible(true)}
          >
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{displayName[0]?.toUpperCase()}</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.displayName}>{displayName}</Text>
          {email ? <Text style={styles.email}>{email}</Text> : null}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{age || '—'}</Text>
            <Text style={styles.statLabel}>Age</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{gender ? gender[0].toUpperCase() + gender.slice(1) : '—'}</Text>
            <Text style={styles.statLabel}>Gender</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate('EditProfile' as never)} activeOpacity={0.85}>
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <Text style={styles.cardBody}>{about || 'No about yet. Edit your profile to add one.'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <MaterialIcons name="person-outline" size={18} color="rgba(255,255,255,0.5)" />
              <Text style={styles.rowText}>{username}</Text>
            </View>
            <View style={styles.rowDivider} />
            <View style={styles.row}>
              <MaterialIcons name="mail-outline" size={18} color="rgba(255,255,255,0.5)" />
              <Text style={styles.rowText}>{email || 'No email'}</Text>
            </View>
            <View style={styles.rowDivider} />
            <View style={styles.row}>
              <MaterialIcons name="calendar-today" size={18} color="rgba(255,255,255,0.5)" />
              <Text style={styles.rowText}>
                Joined {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Recently'}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.85}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>

      </ScrollView>

      <Modal visible={photoViewerVisible} transparent animationType="fade" onRequestClose={() => setPhotoViewerVisible(false)}>
        <Pressable style={viewerStyles.backdrop} onPress={() => setPhotoViewerVisible(false)}>
          <TouchableOpacity style={viewerStyles.closeBtn} onPress={() => setPhotoViewerVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          {photoUrl && (
            <Image source={{ uri: photoUrl }} style={viewerStyles.fullImage} resizeMode="contain" />
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
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 48 },

  avatarBlock: { alignItems: 'center', marginBottom: 24, marginTop: 8 },
  avatarImage: { width: 92, height: 92, borderRadius: 46, marginBottom: 14 },
  avatarPlaceholder: { width: 92, height: 92, borderRadius: 46, backgroundColor: 'rgba(139,92,246,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  avatarInitial: { fontSize: 34, fontWeight: '800', color: '#8B5CF6' },
  displayName: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  email: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },

  editButton: { height: 48, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center',marginBottom: 28 },
  editButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10},
  card: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 16 },
  cardBody: { fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 21 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  rowText: { fontSize: 14, color: '#fff', flex: 1 },
  rowDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 10 },

  logoutButton: { height: 48, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,90,90,0.4)', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  logoutText: { color: '#ff6b6b', fontWeight: '700', fontSize: 14 },
})

const viewerStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  closeBtn: { position: 'absolute', top: 60, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  fullImage: { width: '100%', height: '80%' },
})
