import { useRef, useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { MaterialIcons, Feather } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { useNavigation } from '@react-navigation/native'
import { getSession, getStoredSessionToken, markOnboardingCompleted, markPhotoOnboardingCompleted, setUserScopedCache } from '../lib/auth'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL

export default function AddPhotoScreen() {
  const navigation = useNavigation<any>()
  const [uploading, setUploading] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const transitionStarted = useRef(false)

  const finish = async () => {
    if (transitionStarted.current) return
    transitionStarted.current = true
    const session = await getSession()
    const userId = session?.user?.id
    if (userId) {
      await Promise.all([markPhotoOnboardingCompleted(userId), markOnboardingCompleted(userId)])
    }
    navigation.reset({ index: 0, routes: [{ name: 'Landing' }] })
  }

  const skip = async () => {
    if (uploading || skipping) return
    setSkipping(true)
    try { await finish() } catch { transitionStarted.current = false } finally { setSkipping(false) }
  }

  const pickPhoto = async () => {
    if (uploading || skipping || transitionStarted.current) return
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (permission.status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to add a profile photo.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any, allowsEditing: true, aspect: [1, 1], quality: 0.7,
    })
    if (result.canceled || !result.assets[0]) return
    setUploading(true)
    try {
      const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 })
      const token = await getStoredSessionToken()
      const response = await fetch(`${BASE_URL}/api/places/upload-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ photoBase64: `data:image/jpeg;base64,${base64}` }),
      })
      const data = await response.json()
      if (!response.ok || !data?.photoUrl) throw new Error(data?.error || 'Upload failed.')
      await setUserScopedCache('photo_ts', Date.now().toString())
      await finish()
    } catch (error: any) {
      transitionStarted.current = false
      Alert.alert('Could not upload photo', error?.message || 'Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} disabled={uploading || skipping} hitSlop={10}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Let's Talk</Text>
        <View style={styles.headerSpace} />
      </View>
      <View style={styles.content}>
        <View>
          <Text style={styles.title}>Add your photo</Text>
          <Text style={styles.subtitle}>Adding a photo helps people recognize you. You can always add one later.</Text>
        </View>
        <View style={styles.photoSection}>
          <TouchableOpacity onPress={pickPhoto} disabled={uploading || skipping} activeOpacity={0.8} style={styles.photoCircle}>
            {uploading ? <ActivityIndicator color="#8B5CF6" size="large" /> : <MaterialIcons name="add-a-photo" size={42} color="#8B5CF6" />}
          </TouchableOpacity>
          <Text style={styles.tapText}>{uploading ? 'Uploading...' : 'Tap to upload'}</Text>
        </View>
        <TouchableOpacity style={styles.skipButton} onPress={skip} disabled={uploading || skipping} activeOpacity={0.8}>
          {skipping ? <ActivityIndicator color="#fff" /> : <Text style={styles.skipText}>Skip for now</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: { height: 58, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.14)' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  headerSpace: { width: 24 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 42, paddingBottom: 20, justifyContent: 'space-between' },
  title: { color: '#fff', fontSize: 30, fontWeight: '800', marginBottom: 12 },
  subtitle: { color: 'rgba(255,255,255,0.62)', fontSize: 15, lineHeight: 23, maxWidth: 330 },
  photoSection: { alignItems: 'center', marginTop: -20 },
  photoCircle: { width: 190, height: 190, borderRadius: 95, borderWidth: 1.5, borderColor: '#8B5CF6', alignItems: 'center', justifyContent: 'center' },
  tapText: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 20 },
  skipButton: { height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: '#fff', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  skipText: { color: '#fff', fontSize: 16, fontWeight: '800' },
})
