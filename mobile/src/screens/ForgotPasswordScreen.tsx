import React, { useState, useEffect } from 'react'
import { useNavigation } from '@react-navigation/native'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons, Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.29.59:3000'

export default function ForgotPasswordScreen({ route }: any) {
  const navigation = useNavigation<any>()
  const [email] = useState(route?.params?.email || '')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [step, setStep] = useState('otp')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(60)
  const [canResend, setCanResend] = useState(false)

  React.useEffect(() => {
    if (countdown <= 0) { setCanResend(true); return }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const handleResendOTP = async () => {
    setCanResend(false); setCountdown(60); setError('')
    setLoading(true)
    try {
      const res = await fetch(`${BASE_URL}/api/auth/email-otp/send-verification-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL },
        body: JSON.stringify({ email, type: 'forget-password' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to resend OTP')
    } catch (e: any) {
      setError(e.message || 'Failed to resend OTP')
    } finally { setLoading(false) }
  }

  const handleSendOTP = async () => {
    if (!email.trim()) { setError('No email provided'); return }
    setLoading(true); setError('')
    try {
      const checkRes = await fetch(`${BASE_URL}/api/auth/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL },
        body: JSON.stringify({ email }),
      })
      const checkData = await checkRes.json()
      if (!checkData.exists) throw new Error('No account found with this email')
      const res = await fetch(`${BASE_URL}/api/auth/email-otp/send-verification-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL },
        body: JSON.stringify({ email, type: 'forget-password' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to send OTP')
    } catch (e: any) {
      setError(e.message || 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (email) handleSendOTP()
  }, [])

  const handleVerifyOTP = () => {
    if (!otp.trim() || otp.length < 6) { setError('Please enter the 6-digit OTP'); return }
    setError('')
    setStep('password')
  }

  const handleResetPassword = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) { setError('Please fill in all fields'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`${BASE_URL}/api/auth/email-otp/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL },
        body: JSON.stringify({ email, otp, password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to reset password')
      await AsyncStorage.removeItem('session_token')
      navigation.navigate('Login')
    } catch (e: any) {
      setError(e.message || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeContainer}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'none'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="chevron-left" size={28} color="#405e98" />
          </TouchableOpacity>
          <View style={styles.brandContainer}>
            <MaterialIcons name="forum" size={28} color="#813400" />
            <Text style={styles.brandName}>Let's Talk</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>A verification code has been sent to {email}</Text>
            {error ? (
              <View style={styles.errorBox}>
                <MaterialIcons name="error-outline" size={16} color="#93000a" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {step === 'otp' && (
              <>
                <Text style={styles.label}>VERIFICATION CODE</Text>
                <View style={styles.inputWrap}>
                  <MaterialIcons name="code" size={20} color="#897268" style={styles.inputIcon} />
                  <TextInput style={styles.input} value={otp} onChangeText={setOtp} placeholder="000000" placeholderTextColor="#b0978a" keyboardType="number-pad" maxLength={6} editable={!loading} />
                </View>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleVerifyOTP} disabled={loading}>
                  {loading ? <ActivityIndicator color="white" /> : <><Text style={styles.primaryText}>Next</Text><MaterialIcons name="arrow-forward" size={20} color="white" style={{ marginLeft: 8 }} /></>}
                </TouchableOpacity>
                <TouchableOpacity onPress={handleResendOTP} disabled={!canResend} style={{ marginTop: 16, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: canResend ? '#813400' : '#b0978a', fontWeight: '600' }}>
                    {canResend ? 'Resend OTP' : `Resend in ${countdown}s`}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {step === 'password' && (
              <>
                <Text style={styles.label}>NEW PASSWORD</Text>
                <View style={styles.inputWrap}>
                  <MaterialIcons name="lock-outline" size={20} color="#897268" style={styles.inputIcon} />
                  <TextInput style={[styles.input, { paddingRight: 8 }]} value={newPassword} onChangeText={setNewPassword} placeholder="••••••••" placeholderTextColor="#b0978a" secureTextEntry={!showPassword} editable={!loading} />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#897268" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.label}>CONFIRM PASSWORD</Text>
                <View style={styles.inputWrap}>
                  <MaterialIcons name="lock-outline" size={20} color="#897268" style={styles.inputIcon} />
                  <TextInput style={[styles.input, { paddingRight: 8 }]} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="••••••••" placeholderTextColor="#b0978a" secureTextEntry={!showConfirmPassword} editable={!loading} />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeBtn}>
                    <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#897268" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleResetPassword} disabled={loading}>
                  {loading ? <ActivityIndicator color="white" /> : <><Text style={styles.primaryText}>Reset Password</Text><MaterialIcons name="arrow-forward" size={20} color="white" style={{ marginLeft: 8 }} /></>}
                </TouchableOpacity>
              </>
            )}
          </View>
          <View style={styles.footer}>
            <MaterialIcons name="forum" size={14} color="#897268" />
            <Text style={styles.footerText}>© 2024 Let's Talk</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: '#E9DFC9' },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start', marginBottom: 8 },
  brandContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 28 },
  brandName: { fontSize: 24, fontWeight: '800', color: '#813400', letterSpacing: -0.5 },
  card: { backgroundColor: 'rgba(253,243,220,0.88)', borderRadius: 24, padding: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
  title: { fontSize: 26, fontWeight: '700', color: '#201b0e', marginBottom: 8, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: '#55433a', lineHeight: 21, marginBottom: 24 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ffdad6', borderRadius: 12, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: '#ffb4ab' },
  errorText: { fontSize: 13, color: '#93000a', fontWeight: '500', flex: 1 },
  label: { fontSize: 11, fontWeight: '600', color: '#897268', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbf3', borderWidth: 1, borderColor: '#dcc9b6', borderRadius: 12, paddingHorizontal: 12, marginBottom: 20, height: 48 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 13, fontSize: 15, color: '#201b0e' },
  eyeBtn: { padding: 4 },
  primaryBtn: { backgroundColor: '#405e98', borderRadius: 50, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#405e98', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  primaryText: { color: 'white', fontWeight: '700', fontSize: 16 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 32 },
  footerText: { fontSize: 11, color: '#897268' },
})
