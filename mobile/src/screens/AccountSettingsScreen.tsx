import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { MaterialIcons } from '@expo/vector-icons'
import { apiFetch } from '../lib/api'
import { getSession, signOut } from '../lib/auth'

const YELLOW = '#F5C500'
const DARK = '#151515'

export default function AccountSettingsScreen() {
  const navigation = useNavigation<any>()
  const [section, setSection] = useState<'main' | 'password'>('main')
  const [step, setStep] = useState<'request' | 'verify' | 'newpass'>('request')

  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSendOtp = async () => {
    setLoading(true)
    try {
      const session = await getSession()
      const userEmail = session?.user?.email || ''
      if (!userEmail) { Alert.alert('Error', 'Could not find your email.'); setLoading(false); return }
      setEmail(userEmail)
      const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.29.59:3000'
      const res = await fetch(`${BASE_URL}/api/auth/email-otp/send-verification-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'http://192.168.29.59:3000' },
        body: JSON.stringify({ email: userEmail, type: 'forget-password' }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      Alert.alert('OTP Sent!', `A 6-digit code was sent to ${userEmail}`)
      setStep('verify')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    }
    setLoading(false)
  }

  const handleVerifyOtp = () => {
    if (otp.length !== 6) { Alert.alert('Invalid', 'Enter the 6-digit OTP.'); return }
    setStep('newpass')
  }

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) { Alert.alert('Missing', 'Fill in all fields.'); return }
    if (newPassword !== confirmPassword) { Alert.alert('Mismatch', 'Passwords do not match.'); return }
    if (newPassword.length < 8) { Alert.alert('Too short', 'Password must be at least 8 characters.'); return }
    setLoading(true)
    try {
      const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.29.59:3000'
      const res = await fetch(`${BASE_URL}/api/auth/email-otp/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'http://192.168.29.59:3000' },
        body: JSON.stringify({ email, otp, password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to change password')
      Alert.alert('Done! 🎉', 'Password changed successfully.')
      setSection('main')
      setStep('request')
      setOtp('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    }
    setLoading(false)
  }

  const handleDeleteAccount = () => {
    Alert.alert('Delete Account', 'This will permanently delete your account and all your data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          Alert.alert('Are you sure?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Yes, delete', style: 'destructive', onPress: async () => {
                try {
                  await apiFetch('/api/places/delete-account', {})
                  await signOut()
                  navigation.reset({ index: 0, routes: [{ name: 'Landing' }] })
                } catch (e: any) { Alert.alert('Error', e.message) }
              },
            },
          ])
        },
      },
    ])
  }

  const goBack = () => {
    if (section === 'password') {
      if (step === 'verify') { setStep('request'); setOtp('') }
      else if (step === 'newpass') setStep('verify')
      else { setSection('main'); setStep('request') }
    } else {
      navigation.goBack()
    }
  }

  const stepTitle = step === 'request' ? 'Change Password' : step === 'verify' ? 'Enter OTP' : 'New Password'

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={goBack} style={s.backBtn}>
            <MaterialIcons name="chevron-left" size={26} color={DARK} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>
            {section === 'main' ? 'Account Settings' : stepTitle}
          </Text>
          <View style={{ width: 44 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {section === 'main' && (
          <>
            <Text style={s.sectionLabel}>SECURITY</Text>
            <View style={s.card}>
              <TouchableOpacity style={s.row} onPress={() => setSection('password')}>
                <View style={s.rowLeft}>
                  <Text style={s.rowIcon}>🔐</Text>
                  <View>
                    <Text style={s.rowTitle}>Change Password</Text>
                    <Text style={s.rowSub}>Update your account password</Text>
                  </View>
                </View>
                <MaterialIcons name="chevron-right" size={22} color="rgba(0,0,0,0.4)" />
              </TouchableOpacity>
            </View>

            <Text style={[s.sectionLabel, { color: '#151515', marginTop: 24 }]}>DANGER ZONE</Text>
            <View style={[s.card, { borderColor: 'rgba(186,26,26,0.2)' }]}>
              <TouchableOpacity style={s.row} onPress={handleDeleteAccount}>
                <View style={s.rowLeft}>
                  <Text style={s.rowIcon}>⚠️</Text>
                  <View>
                    <Text style={[s.rowTitle, { color: '#151515' }]}>Delete Account</Text>
                    <Text style={s.rowSub}>Permanently remove your account</Text>
                  </View>
                </View>
                <MaterialIcons name="chevron-right" size={22} color="rgba(0,0,0,0.4)" />
              </TouchableOpacity>
            </View>
          </>
        )}

        {section === 'password' && (
          <View style={s.darkCard}>

            {/* Step 1 - Send OTP */}
            {step === 'request' && (
              <>
                <View style={s.stepIcon}>
                  <MaterialIcons name="mark-email-unread" size={40} color={YELLOW} />
                </View>
                <Text style={s.stepTitle}>Verify Your Identity</Text>
                <Text style={s.stepSub}>We'll send a 6-digit OTP to your registered email address.</Text>
                <TouchableOpacity style={s.yellowBtn} onPress={handleSendOtp} disabled={loading}>
                  {loading ? <ActivityIndicator color={DARK} /> : <Text style={s.yellowBtnText}>Send OTP to Email</Text>}
                </TouchableOpacity>
              </>
            )}

            {/* Step 2 - Enter OTP */}
            {step === 'verify' && (
              <>
                <View style={s.stepIcon}>
                  <MaterialIcons name="security" size={40} color={YELLOW} />
                </View>
                <Text style={s.stepTitle}>Enter OTP</Text>
                <Text style={s.stepSub}>Enter the 6-digit code sent to{'\n'}{email}</Text>
                <TextInput
                  style={s.otpInput}
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="• • • • • •"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  textAlign="center"
                />
                <TouchableOpacity style={s.yellowBtn} onPress={handleVerifyOtp} disabled={loading}>
                  {loading ? <ActivityIndicator color={DARK} /> : <Text style={s.yellowBtnText}>Verify OTP</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSendOtp} style={{ marginTop: 12, alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Resend OTP</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Step 3 - New Password */}
            {step === 'newpass' && (
              <>
                <View style={s.stepIcon}>
                  <Text style={{ fontSize: 40 }}></Text>
                </View>
                <Text style={s.stepTitle}>Set New Password</Text>
                <Text style={s.stepSub}>Choose a strong password with at least 8 characters.</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 0 }}>
                  <TextInput
                    style={[s.input, { flex: 1, marginBottom: 0 }]}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="New password"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    secureTextEntry={!showNewPassword}
                  />
                  <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={{ position: 'absolute', right: 12 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{showNewPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                  <TextInput
                    style={[s.input, { flex: 1, marginBottom: 0 }]}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm new password"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={{ position: 'absolute', right: 12 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={s.yellowBtn} onPress={handleChangePassword} disabled={loading}>
                  {loading ? <ActivityIndicator color={DARK} /> : <Text style={s.yellowBtnText}>Update Password</Text>}
                </TouchableOpacity>
              </>
            )}

          </View>
        )}

      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: YELLOW },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: DARK },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  scroll: { padding: 20, paddingTop: 10, paddingBottom: 60 },
  sectionLabel: { fontSize: 15, fontWeight: '900', color: DARK, letterSpacing: 1.5, marginBottom: 10, marginLeft: 4 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20,
    borderWidth: 0, overflow: 'hidden', marginBottom: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowIcon: { fontSize: 22 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: DARK },
  rowSub: { fontSize: 12, color: 'rgba(0,0,0,0.5)', marginTop: 2 },

  darkCard: {
    backgroundColor: '#151515', borderRadius: 24,
    padding: 28, alignItems: 'center',
  },
  stepIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  stepTitle: { fontSize: 22, fontWeight: '900', color: '#fff', marginBottom: 10 },
  stepSub: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 22, marginBottom: 28 },

  otpInput: {
    width: '100%', backgroundColor: '#2a2a2a', borderRadius: 16,
    padding: 18, fontSize: 32, fontWeight: '900',
    color: '#fff', letterSpacing: 12, marginBottom: 20,
  },
  input: {
    width: '100%', backgroundColor: '#2a2a2a', borderRadius: 14,
    padding: 16, fontSize: 15, color: '#fff',
  },
  yellowBtn: {
    width: '100%', backgroundColor: YELLOW, borderRadius: 50,
    paddingVertical: 16, alignItems: 'center', marginTop: 20,
  },
  yellowBtnText: { color: DARK, fontWeight: '900', fontSize: 16 },
})
