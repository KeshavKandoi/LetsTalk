import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator, Alert,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { apiFetch } from '../lib/api'

const MOOD_OPTIONS = ['🙂', '😌', '☕', '🤝', '💬', '🌿', '😄', '🧠', '🎯', '✨']
const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say']
const G = '#005129'
const DARK = '#002111'
const MID = '#006d36'

export default function EditProfileScreen() {
  const navigation = useNavigation<any>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [moodEmoji, setMoodEmoji] = useState('🙂')
  const [intentText, setIntentText] = useState('')
  const [username, setUsername] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState('')

  useEffect(() => {
    apiFetch('/api/places/state', {})
      .then((data) => {
        setMoodEmoji(data?.profile?.moodEmoji || '🙂')
        setIntentText(data?.profile?.intentText || '')
        setUsername(data?.session?.user?.username || '')
        setAge(data?.profile?.age || '')
        setGender(data?.profile?.gender || '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (age && (isNaN(Number(age)) || Number(age) < 13 || Number(age) > 100)) {
      Alert.alert('Invalid age', 'Please enter a valid age between 13 and 100.')
      return
    }
    setSaving(true)
    try {
      await apiFetch('/api/places/update-profile', { moodEmoji, intentText, age, gender })
      Alert.alert('Saved', 'Profile updated successfully.')
      navigation.goBack()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <SafeAreaView style={s.container}>
      <View style={s.centered}><ActivityIndicator color={G} size="large" /></View>
    </SafeAreaView>
  )

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backTxt}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Edit Profile</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Username - read only */}
        <View style={s.card}>
          <Text style={s.label}>USERNAME</Text>
          <View style={s.disabledInput}>
            <Text style={s.disabledTxt}>{username}</Text>
            <Text style={s.disabledHint}>Cannot be changed</Text>
          </View>
        </View>

        {/* Age */}
        <View style={s.card}>
          <Text style={s.label}>AGE</Text>
          <TextInput
            style={s.input}
            value={age}
            onChangeText={setAge}
            placeholder="Your age"
            placeholderTextColor="rgba(0,109,54,0.4)"
            keyboardType="numeric"
            maxLength={3}
          />
        </View>

        {/* Gender */}
        <View style={s.card}>
          <Text style={s.label}>GENDER</Text>
          <View style={s.optionsRow}>
            {GENDER_OPTIONS.map((g) => (
              <TouchableOpacity
                key={g}
                style={[s.optionBtn, gender === g && s.optionBtnActive]}
                onPress={() => setGender(g)}
              >
                <Text style={[s.optionTxt, gender === g && s.optionTxtActive]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Mood */}
        <View style={s.card}>
          <Text style={s.label}>YOUR MOOD</Text>
          <View style={s.moodRow}>
            {MOOD_OPTIONS.map((m) => (
              <TouchableOpacity
                key={m}
                style={[s.moodBtn, moodEmoji === m && s.moodBtnActive]}
                onPress={() => setMoodEmoji(m)}
              >
                <Text style={s.moodEmoji}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* About */}
        <View style={s.card}>
          <Text style={s.label}>ABOUT YOU</Text>
          <TextInput
            style={s.textArea}
            value={intentText}
            onChangeText={setIntentText}
            placeholder="What are you open to talking about?"
            placeholderTextColor="rgba(0,109,54,0.4)"
            multiline
            maxLength={200}
          />
          <Text style={s.charCount}>{intentText.length}/200</Text>
        </View>

        <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color="white" />
            : <Text style={s.saveBtnTxt}>Save Changes</Text>}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e9ffed' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(191,201,190,0.3)' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: G },
  backBtn: { width: 60 },
  backTxt: { color: G, fontWeight: '700', fontSize: 15 },
  scroll: { padding: 20, paddingBottom: 48, gap: 16 },
  card: { backgroundColor: 'white', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: 'rgba(191,201,190,0.3)' },
  label: { fontSize: 11, fontWeight: '700', color: MID, marginBottom: 12, letterSpacing: 1.5 },
  disabledInput: { backgroundColor: '#f0faf0', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(191,201,190,0.4)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  disabledTxt: { fontSize: 15, fontWeight: '600', color: DARK },
  disabledHint: { fontSize: 11, color: MID, opacity: 0.6 },
  input: { backgroundColor: '#f0faf0', borderRadius: 12, padding: 14, fontSize: 15, color: DARK, borderWidth: 1, borderColor: 'rgba(191,201,190,0.4)' },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionBtn: { borderRadius: 50, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: '#f0faf0', borderWidth: 2, borderColor: 'transparent' },
  optionBtnActive: { borderColor: G, backgroundColor: '#caf2d5' },
  optionTxt: { fontSize: 14, fontWeight: '600', color: MID },
  optionTxtActive: { color: G },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  moodBtn: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0faf0', borderWidth: 2, borderColor: 'transparent' },
  moodBtnActive: { borderColor: G, backgroundColor: '#caf2d5' },
  moodEmoji: { fontSize: 24 },
  textArea: { backgroundColor: '#f0faf0', borderRadius: 12, padding: 14, fontSize: 15, color: DARK, borderWidth: 1, borderColor: 'rgba(191,201,190,0.4)', minHeight: 100, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: MID, textAlign: 'right', marginTop: 6, opacity: 0.6 },
  saveBtn: { backgroundColor: G, borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveBtnTxt: { color: 'white', fontWeight: '700', fontSize: 16 },
})
