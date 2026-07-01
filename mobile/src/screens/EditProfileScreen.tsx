import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { MaterialIcons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { apiFetch } from '../lib/api'
import { getSession, getStoredSessionToken } from '../lib/auth'

const DARK = '#151515'
const BASE_URL = process.env.EXPO_PUBLIC_API_URL

export default function EditProfileScreen() {
  const navigation = useNavigation<any>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [intentText, setIntentText] = useState('')
  const [about, setAbout] = useState('')
  const [username, setUsername] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  useEffect(() => {
    Promise.all([apiFetch('/api/places/state', {}), getSession()])
      .then(([data, session]) => {
        setIntentText(data?.profile?.intentText || '')
        setAbout(data?.profile?.about || '')
        setUsername(data?.session?.user?.username || '')
        const u = session?.user || session?.session?.user
        const rawUrl = data?.profile?.photoUrl || u?.image || null
        AsyncStorage.getItem('photo_ts').then(ts => {
          setPhotoUrl(rawUrl ? rawUrl.split('?')[0] + '?t=' + (ts || '1') : null)
        })
      })
      .catch((e) => console.log('Load error:', e))
      .finally(() => setLoading(false))
  }, [])

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access.'); return }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true, aspect: [1, 1], quality: 0.7,
    })
    if (!result.canceled && result.assets[0]) {
      setUploadingPhoto(true)
      try {
        const uri = result.assets[0].uri
        // Read as base64
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        })
        const photoBase64 = `data:image/jpeg;base64,${base64}`
        const token = await getStoredSessionToken()
        console.log('Uploading to:', `${BASE_URL}/api/places/upload-photo`)
        console.log('Base64 length:', base64.length)
        const res = await fetch(`${BASE_URL}/api/places/upload-photo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ photoBase64 }),
        })
        const data = await res.json()
        console.log('Upload response status:', res.status)
        console.log('Upload response:', JSON.stringify(data))
        if (data?.photoUrl) {
          const ts = Date.now().toString()
          await AsyncStorage.setItem('photo_ts', ts)
          setPhotoUrl(data.photoUrl + '?t=' + ts)
          Alert.alert('Done!', 'Photo uploaded.')
        } else {
          Alert.alert('Error', data?.error || 'Upload failed.')
        }
      } catch (e: any) {
        console.log('Upload error:', e)
        Alert.alert('Error', 'Could not upload photo.')
      }
      setUploadingPhoto(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await apiFetch('/api/places/update-profile', { intentText, about })
      console.log('Save response:', res)
      navigation.goBack()
    } catch (e: any) {
      console.log('Save error:', e)
      Alert.alert('Error', e.message || 'Could not save.')
    }
    setSaving(false)
  }

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff8ee' }}>
      <ActivityIndicator color="#F5C500" size="large" />
    </View>
  )

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <MaterialIcons name="chevron-left" size={28} color={DARK} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Edit Profile</Text>
        <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color={DARK} size="small" /> : <Text style={s.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Photo */}
        <View style={s.card}>
          <Text style={s.label}>PHOTO</Text>
          <View style={s.photoRow}>
            <View style={s.photoWrap}>
              {photoUrl
                ? <Image
                source={{ uri: photoUrl }}
                style={s.photo}
                contentFit="cover"
                placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                transition={200}
              />
                : <View style={s.photoPlaceholder}><Text style={s.photoInitial}>{username[0]?.toUpperCase() || '?'}</Text></View>
              }
              {uploadingPhoto && (
                <View style={s.photoOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </View>
            <TouchableOpacity style={s.changePhotoBtn} onPress={pickPhoto} disabled={uploadingPhoto}>
              <MaterialIcons name="camera-alt" size={18} color={DARK} />
              <Text style={s.changePhotoText}>{uploadingPhoto ? 'Uploading...' : 'Change Photo'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        {/* About */}
        <View style={s.card}>
          <Text style={s.label}>ABOUT</Text>
          <Text style={s.sublabel}>Tell others about yourself</Text>
          <TextInput
            style={s.textArea}
            value={about}
            onChangeText={setAbout}
            multiline
            numberOfLines={4}
            placeholder="A little about yourself..."
            placeholderTextColor="rgba(21,21,21,0.35)"
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0704' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#0a0704',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#fff' },
  saveBtn: {
    backgroundColor: '#F5C500', borderRadius: 50,
    paddingHorizontal: 20, paddingVertical: 8,
  },
  saveBtnText: { color: DARK, fontWeight: '800', fontSize: 14 },
  scroll: { padding: 16, gap: 16, paddingBottom: 60 },
  card: {
    backgroundColor: 'rgba(20,12,6,0.9)', borderRadius: 20, padding: 20,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 3,
  },
  label: { fontSize: 12, fontWeight: '900', color: '#F0956A', letterSpacing: 1.5, marginBottom: 6 },
  sublabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 14 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  photoWrap: { width: 80, height: 80, borderRadius: 40, overflow: 'hidden' },
  photo: { width: 80, height: 80, borderRadius: 40 },
  photoPlaceholder: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#F5C500', justifyContent: 'center', alignItems: 'center',
  },
  photoInitial: { fontSize: 32, fontWeight: '900', color: DARK },
  photoOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  changePhotoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F5C500', borderRadius: 50,
    paddingHorizontal: 18, paddingVertical: 12,
  },
  changePhotoText: { color: DARK, fontWeight: '800', fontSize: 14 },
  textArea: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)',
    padding: 14, fontSize: 14, color: '#fff',
    minHeight: 100, textAlignVertical: 'top',
  },
})
