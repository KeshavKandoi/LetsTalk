import React, { useState, useEffect, useRef } from 'react'
import { useNavigation } from '@react-navigation/native'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Keyboard,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { MaterialIcons, Ionicons, Feather } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL

export default function ForgotPasswordScreen({ route }: any) {
  const navigation = useNavigation<any>()
  const [email] = useState(route?.params?.email || '')
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [step, setStep] = useState('otp')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(60)
  const [canResend, setCanResend] = useState(false)

  const otpInputs = useRef<any[]>([])
  const passwordRef = useRef<TextInput>(null)
  const confirmRef = useRef<TextInput>(null)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [confirmFocused, setConfirmFocused] = useState(false)

  const toggleDismiss = (ref: React.RefObject<TextInput>) => {
    ref.current?.blur()
    Keyboard.dismiss()
  }

  const otp = otpDigits.join('')

  const handleOtpChange = (text: string, index: number) => {
    const next = [...otpDigits]
    next[index] = text
    setOtpDigits(next)
    if (text && index < 5) otpInputs.current[index + 1]?.focus()
  }

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputs.current[index - 1]?.focus()
    }
  }

  useEffect(() => {
    if (countdown <= 0) { setCanResend(true); return }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const handleResendOTP = async () => {
    setCanResend(false); setCountdown(60); setError('')
    setOtpDigits(['', '', '', '', '', ''])
    otpInputs.current[0]?.focus()
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
    } finally { setLoading(false) }
  }

  useEffect(() => { if (email) handleSendOTP() }, [])

  const handleVerifyOTP = () => {
    if (otp.length < 6) { setError('Please enter the 6-digit OTP'); return }
    setError(''); setStep('password')
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
    } finally { setLoading(false) }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          <View style={styles.titleAccent} />
          <Text style={styles.title}>{step === 'otp' ? 'Verify identity' : 'Set new password'}</Text>
          <Text style={styles.subtitle}>
            {step === 'otp' ? (
              <>OTP sent to <Text style={styles.subtitleHighlight}>{email}</Text></>
            ) : (
              'Choose a new password for your account'
            )}
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <MaterialIcons name="info-outline" size={16} color="#ffb020" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {step === 'otp' && (
            <>
              <View style={styles.otpRow}>
                {otpDigits.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(r) => (otpInputs.current[index] = r)}
                    style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                    value={digit}
                    onChangeText={(t) => handleOtpChange(t.slice(-1), index)}
                    onKeyPress={(e) => handleOtpKeyPress(e, index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                    editable={!loading}
                  />
                ))}
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={handleVerifyOTP} disabled={loading} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Verify code</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={handleResendOTP} disabled={!canResend} style={styles.resendWrap}>
                <Text style={[styles.resendText, canResend && styles.resendTextActive]}>
                  {canResend ? 'Resend code' : `Resend in ${countdown}s`}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'password' && (
            <>
              <View style={styles.field}>
                <View style={[styles.passwordRow, { position: 'relative' }]}>
                  <TextInput
                    ref={passwordRef}
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="New password"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    secureTextEntry={!showPassword}
                    editable={!loading}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(255,255,255,0.6)" />
                  </TouchableOpacity>
                  {passwordFocused && (
                    <Pressable style={[StyleSheet.absoluteFill, { right: 44 }]} onPress={() => toggleDismiss(passwordRef)} />
                  )}
                </View>
              </View>

              <View style={styles.field}>
                <View style={[styles.passwordRow, { position: 'relative' }]}>
                  <TextInput
                    ref={confirmRef}
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm password"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    secureTextEntry={!showConfirmPassword}
                    editable={!loading}
                    onFocus={() => setConfirmFocused(true)}
                    onBlur={() => setConfirmFocused(false)}
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeButton}>
                    <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(255,255,255,0.6)" />
                  </TouchableOpacity>
                  {confirmFocused && (
                    <Pressable style={[StyleSheet.absoluteFill, { right: 44 }]} onPress={() => toggleDismiss(confirmRef)} />
                  )}
                </View>
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={handleResetPassword} disabled={loading} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Reset password</Text>}
              </TouchableOpacity>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  flex: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40 },

  titleAccent: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#8B5CF6', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 8, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.55)', marginBottom: 24, lineHeight: 20 },
  subtitleHighlight: { color: '#fff', fontWeight: '700' },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,176,32,0.35)', borderRadius: 10, padding: 12, marginBottom: 20 },
  errorText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, flex: 1 },

  otpRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  otpBox: { flex: 1, height: 56, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 10, textAlign: 'center', fontSize: 20, fontWeight: '700', color: '#fff' },
  otpBoxFilled: { borderColor: '#8B5CF6', backgroundColor: 'rgba(139,92,246,0.08)' },

  field: { marginBottom: 16 },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#fff',
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingRight: 8 },
  eyeButton: { padding: 8 },

  primaryButton: { backgroundColor: '#8B5CF6', height: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  resendWrap: { alignItems: 'center', marginTop: 16 },
  resendText: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  resendTextActive: { color: '#8B5CF6' },
})
