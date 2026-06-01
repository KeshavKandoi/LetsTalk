import { useState } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator, Alert,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { apiFetch } from '../lib/api'
import { signOut } from '../lib/auth'

const G = '#005129'
const DARK = '#002111'
const MID = '#006d36'

export default function AccountSettingsScreen() {
  const navigation = useNavigation<any>()
  const [section, setSection] = useState<'main' | 'password'>('main')

  // Change password
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Missing fields', 'Please fill in all fields.')
      return
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New passwords do not match.')
      return
    }
    if (newPassword.length < 8) {
      Alert.alert('Too short', 'Password must be at least 8 characters.')
      return
    }
    setSavingPassword(true)
    try {
      await apiFetch('/api/places/change-password', { currentPassword, newPassword })
      Alert.alert('Done', 'Password changed successfully.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSection('main')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSavingPassword(false)
    }
  }

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'Type DELETE to confirm.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, delete my account', style: 'destructive',
                  onPress: async () => {
                    try {
                      await apiFetch('/api/places/delete-account', {})
                      await signOut()
                      navigation.reset({ index: 0, routes: [{ name: 'Landing' }] })
                    } catch (e: any) {
                      Alert.alert('Error', e.message)
                    }
                  },
                },
              ]
            )
          },
        },
      ]
    )
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => section === 'password' ? setSection('main') : navigation.goBack()} style={s.backBtn}>
          <Text style={s.backTxt}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>
          {section === 'password' ? 'Change Password' : 'Account Settings'}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>

        {section === 'main' && (
          <>
            {/* Security section */}
            <Text style={s.sectionLabel}>SECURITY</Text>
            <View style={s.card}>
              <TouchableOpacity style={s.row} onPress={() => setSection('password')}>
                <View style={s.rowLeft}>
                  <Text style={s.rowIcon}>🔑</Text>
                  <View>
                    <Text style={s.rowTitle}>Change Password</Text>
                    <Text style={s.rowSub}>Update your account password</Text>
                  </View>
                </View>
                <Text style={s.arrow}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Danger zone */}
            <Text style={[s.sectionLabel, { color: '#ba1a1a', marginTop: 24 }]}>DANGER ZONE</Text>
            <View style={[s.card, s.dangerCard]}>
              <TouchableOpacity style={s.row} onPress={handleDeleteAccount}>
                <View style={s.rowLeft}>
                  <Text style={s.rowIcon}>🗑️</Text>
                  <View>
                    <Text style={[s.rowTitle, { color: '#ba1a1a' }]}>Delete Account</Text>
                    <Text style={s.rowSub}>Permanently remove your account</Text>
                  </View>
                </View>
                <Text style={[s.arrow, { color: '#ba1a1a' }]}>›</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {section === 'password' && (
          <View style={s.card}>
            <Text style={s.fieldLabel}>Current Password</Text>
            <TextInput
              style={s.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Enter current password"
              placeholderTextColor="rgba(0,109,54,0.4)"
              secureTextEntry
            />

            <Text style={[s.fieldLabel, { marginTop: 16 }]}>New Password</Text>
            <TextInput
              style={s.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="At least 8 characters"
              placeholderTextColor="rgba(0,109,54,0.4)"
              secureTextEntry
            />

            <Text style={[s.fieldLabel, { marginTop: 16 }]}>Confirm New Password</Text>
            <TextInput
              style={s.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repeat new password"
              placeholderTextColor="rgba(0,109,54,0.4)"
              secureTextEntry
            />

            <TouchableOpacity style={s.saveBtn} onPress={handleChangePassword} disabled={savingPassword}>
              {savingPassword
                ? <ActivityIndicator color="white" />
                : <Text style={s.saveBtnTxt}>Update Password</Text>}
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e9ffed' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(191,201,190,0.3)' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: G },
  backBtn: { width: 60 },
  backTxt: { color: G, fontWeight: '700', fontSize: 15 },
  scroll: { padding: 20, paddingBottom: 48 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: MID, letterSpacing: 1.5, marginBottom: 10, marginLeft: 4 },
  card: { backgroundColor: 'white', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(191,201,190,0.3)', overflow: 'hidden', marginBottom: 8 },
  dangerCard: { borderColor: 'rgba(186,26,26,0.2)' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowIcon: { fontSize: 22 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: DARK },
  rowSub: { fontSize: 12, color: MID, marginTop: 2 },
  arrow: { fontSize: 22, color: MID },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: MID, marginBottom: 8, letterSpacing: 0.5 },
  input: { backgroundColor: '#f0faf0', borderRadius: 12, padding: 14, fontSize: 15, color: DARK, borderWidth: 1, borderColor: 'rgba(191,201,190,0.4)' },
  saveBtn: { backgroundColor: G, borderRadius: 50, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  saveBtnTxt: { color: 'white', fontWeight: '700', fontSize: 15 },
})
