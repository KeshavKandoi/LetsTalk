import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Animated, Dimensions, ActivityIndicator, Alert,
} from 'react-native'
import { Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { MaterialIcons } from '@expo/vector-icons'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getSession, signOut } from '../lib/auth'
import { apiFetch } from '../lib/api'

const { height } = Dimensions.get('window')
const PANEL_COLLAPSED = height * 0.42
const PANEL_EXPANDED = height * 0.72

export default function ProfileScreen() {
  const navigation = useNavigation<any>()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const panelY = useRef(new Animated.Value(PANEL_COLLAPSED)).current
  const [expanded, setExpanded] = useState(false)

  const loadProfile = async () => {
    try {
      const session = await getSession()
      if (!session?.session) { navigation.goBack(); return }
      const u = session.user
      const photoTs = await AsyncStorage.getItem('photo_ts').then(t => t || '1')
      let stateData: any = null
      try {
        stateData = await apiFetch('/api/places/state', {})
      } catch {}
      setProfile({
        username: u?.name || u?.username || 'You',
        full_name: u?.name || 'You',
        email: u?.email || '',
        photoUrl: stateData?.profile?.photoUrl ? stateData.profile.photoUrl + '?t=' + photoTs : null,
        created_at: u?.createdAt || null,
        gender: stateData?.profile?.gender || null,
        age: stateData?.profile?.age || null,
        intent_text: stateData?.profile?.intentText || '',
        about: stateData?.profile?.about || '',
        current_place_id: stateData?.profile?.currentPlaceId || null,
      })
    } catch (e) {
    }
    setLoading(false)
  }

  useEffect(() => { loadProfile() }, [])
  useFocusEffect(useCallback(() => { loadProfile() }, []))

  const togglePanel = () => {
    const toValue = expanded ? PANEL_COLLAPSED : PANEL_EXPANDED
    Animated.spring(panelY, { toValue, useNativeDriver: false, friction: 8 }).start()
    setExpanded(!expanded)
  }

  const handleLogout = async () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out', style: 'destructive', onPress: async () => {
          await signOut()
          navigation.reset({ index: 0, routes: [{ name: 'Landing' }] })
        }
      }
    ])
  }

  const photoUrl = profile?.photoUrl || null
  const username = profile?.username || 'You'
  const displayName = profile?.full_name || username
  const email = profile?.email || ''
  const intentText = profile?.intent_text || 'Open to a conversation.'
  const about = profile?.about || ''
  const age = profile?.age || null
  const gender = profile?.gender || null

  return (
    <View style={s.root}>
      <View style={s.photoSection}>
        <SafeAreaView edges={['top']} style={s.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <MaterialIcons name="chevron-left" size={28} color="#000" />
            <Text style={s.backText}>Profile</Text>
          </TouchableOpacity>
        </SafeAreaView>

        {loading ? (
          <ActivityIndicator color="#F5C500" size="large" style={{ marginTop: 80 }} />
        ) : photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            style={s.profilePhoto}
            resizeMode="cover"
          />
        ) : (
          <View style={s.photoPlaceholder}>
            <Text style={s.photoInitial}>{displayName[0]?.toUpperCase()}</Text>
          </View>
        )}
      </View>

      <Animated.View style={[s.panel, { top: panelY }]}>
        <LinearGradient
          colors={['#F5C500', '#F2A96B', '#F0956A', '#EE8A5C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <TouchableOpacity style={s.handleArea} onPress={togglePanel} activeOpacity={0.8}>
          <MaterialIcons name={expanded ? 'keyboard-arrow-down' : 'keyboard-arrow-up'} size={22} color="#151515" style={{ marginTop: 2 }} />
        </TouchableOpacity>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={s.nameRow}>
            <Text style={s.displayName}>{displayName}</Text>
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>ABOUT</Text>
            <Text style={s.sectionBody}>{about || 'No about yet. Edit your profile to add one.'}</Text>
          </View>

          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={s.statNum}>{age || '—'}</Text>
              <Text style={s.statLabel}>Age</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statNum}>{gender ? gender[0].toUpperCase() + gender.slice(1) : '—'}</Text>
              <Text style={s.statLabel}>Gender</Text>
            </View>
          </View>

          <TouchableOpacity style={s.editBtn} onPress={() => navigation.navigate('EditProfile' as never)}>
            <Text style={s.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>

          <View style={s.section}>
            <Text style={s.sectionTitle}>ACCOUNT</Text>
            <View style={s.accountRow}>
              <MaterialIcons name="person" size={16} color="#151515" />
              <Text style={s.accountText}>{username}</Text>
            </View>
            <View style={s.accountRow}>
              <MaterialIcons name="email" size={16} color="#151515" />
              <Text style={s.accountText}>{email || 'No email'}</Text>
            </View>
            <View style={s.accountRow}>
              <MaterialIcons name="calendar-today" size={16} color="#151515" />
              <Text style={s.accountText}>Joined {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Recently'}</Text>
            </View>
          </View>

          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
            <Text style={s.logoutText}>Log out</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  photoSection: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#f5ead0', overflow: 'hidden' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, zIndex: 10 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { fontSize: 17, fontWeight: '800', color: '#151515' },
  profilePhoto: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 },
  photoPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  photoInitial: { fontSize: 80, fontWeight: '900', color: '#D06010' },
  panel: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    minHeight: height * 0.65,
    backgroundColor: '#F5C500',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, overflow: 'hidden',
  },
  handleArea: { alignItems: 'center', paddingVertical: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(21,21,21,0.3)' },
  nameRow: { marginBottom: 20 },
  displayName: { fontSize: 38, fontWeight: '900', color: '#151515', letterSpacing: -1, lineHeight: 42 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, backgroundColor: 'rgba(21,21,21,0.08)', borderRadius: 16, padding: 16 },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '900', color: '#151515' },
  statLabel: { fontSize: 11, color: 'rgba(21,21,21,0.55)', marginTop: 2, fontWeight: '600' },
  statDivider: { width: 1, height: 36, backgroundColor: 'rgba(21,21,21,0.2)' },
  editBtn: { backgroundColor: '#1A1A1A', borderRadius: 50, paddingVertical: 15, alignItems: 'center', marginBottom: 24 },
  editBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: '#151515', letterSpacing: 1.5, marginBottom: 12 },
  sectionBody: { fontSize: 14, color: 'rgba(0,0,0,0.85)', lineHeight: 22 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  accountText: { fontSize: 14, color: '#151515', flex: 1, fontWeight: '700' },
  logoutBtn: { borderWidth: 1.5, borderColor: '#151515', borderRadius: 50, paddingVertical: 14, alignItems: 'center', marginTop: 24, marginBottom: 40 },
  logoutText: { color: '#c0392b', fontWeight: '700', fontSize: 15 },
})
