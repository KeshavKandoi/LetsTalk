import React, { useState, useEffect, useRef } from 'react'
import { useNavigation } from '@react-navigation/native'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, Dimensions
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons, Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.29.59:3000'
const { width, height } = Dimensions.get('window')

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
  const embersAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.loop(
      Animated.timing(embersAnim, { toValue: 1, duration: 8000, useNativeDriver: true })
    ).start()
  }, [])

  useEffect(() => {
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
    } finally { setLoading(false) }
  }

  useEffect(() => { if (email) handleSendOTP() }, [])

  const handleVerifyOTP = () => {
    if (!otp.trim() || otp.length < 6) { setError('Please enter the 6-digit OTP'); return }
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
    <SafeAreaView style={styles.safeContainer}>
      <View style={styles.bgContainer}>
        <View style={[styles.bgGradient, { backgroundColor: '#121414' }]} />
        <View style={[styles.bgGradient, { backgroundColor: '#D84315', opacity: 0.85 }]} />
      </View>

      <View pointerEvents="none" style={styles.embersContainer}>
        {[...Array(15)].map((_, i) => (
          <Animated.View key={i} style={[styles.ember, {
            left: `${Math.random() * 100}%`,
            opacity: embersAnim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.8, 0.8, 0] }),
            transform: [{ translateY: embersAnim.interpolate({ inputRange: [0, 1], outputRange: [height, -height] }) }],
          }]} />
        ))}
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="chevron-left" size={28} color="#ff525f" />
          </TouchableOpacity>

          <View style={styles.headerSection}>
            <Text style={styles.authBadgeText}>SECURE ACCESS</Text>
            <Text style={styles.mainTitle}>{step === 'otp' ? 'Verify\nIdentity' : 'New\nAccess'}</Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.formContent}>
              <Text style={styles.subtitle}>
                {step === 'otp' ? `Code sent to ${email}` : 'Set your new password'}
              </Text>

              {error ? (
                <View style={styles.errorBox}>
                  <MaterialIcons name="error-outline" size={16} color="#ff5555" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {step === 'otp' && (
                <>
                  <Text style={styles.fieldLabel}>VERIFICATION CODE</Text>
                  <View style={styles.inputBox}>
                    <MaterialIcons name="code" size={20} color="#121414" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={otp}
                      onChangeText={setOtp}
                      placeholder="000000"
                      placeholderTextColor="#999"
                      keyboardType="number-pad"
                      maxLength={6}
                      editable={!loading}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.initiateButton, { transform: [{ skewX: '12deg' }] }]}
                    onPress={handleVerifyOTP}
                    disabled={loading}
                  >
                    <View style={[styles.buttonShade, { position: 'absolute', left: -15, backgroundColor: '#ff525f' }]} />
                    {loading ? <ActivityIndicator color="#121414" /> : (
                      <View style={styles.buttonContent}>
                        <Text style={styles.buttonText}>Verify Code</Text>
                        <MaterialIcons name="arrow-forward-ios" size={18} color="#121414" style={{ marginLeft: 12 }} />
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={handleResendOTP} disabled={!canResend} style={{ marginTop: 16, alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: canResend ? '#ff525f' : '#ae8787', fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' }}>
                      {canResend ? 'Resend Code' : `Resend in ${countdown}s`}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {step === 'password' && (
                <>
                  <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
                  <View style={[styles.inputBox, { marginBottom: 20 }]}>
                    <MaterialIcons name="lock-outline" size={20} color="#121414" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="••••••••"
                      placeholderTextColor="#999"
                      secureTextEntry={!showPassword}
                      editable={!loading}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 6 }}>
                      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#121414" />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
                  <View style={styles.inputBox}>
                    <MaterialIcons name="lock-outline" size={20} color="#121414" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="••••••••"
                      placeholderTextColor="#999"
                      secureTextEntry={!showConfirmPassword}
                      editable={!loading}
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={{ padding: 6 }}>
                      <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#121414" />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[styles.initiateButton, { transform: [{ skewX: '12deg' }] }]}
                    onPress={handleResetPassword}
                    disabled={loading}
                  >
                    <View style={[styles.buttonShade, { position: 'absolute', left: -15, backgroundColor: '#ff525f' }]} />
                    {loading ? <ActivityIndicator color="#121414" /> : (
                      <View style={styles.buttonContent}>
                        <Text style={styles.buttonText}>Reset Password</Text>
                        <MaterialIcons name="arrow-forward-ios" size={18} color="#121414" style={{ marginLeft: 12 }} />
                      </View>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          <View style={[styles.accentBars, { transform: [{ skewX: '-12deg' }] }]}>
            <View style={[styles.bar, { width: '20%', backgroundColor: '#ff525f' }]} />
            <View style={[styles.bar, { width: '8%', backgroundColor: '#00e3fd' }]} />
            <View style={[styles.bar, { width: '40%', backgroundColor: 'rgba(255,255,255,0.08)' }]} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.bottomStatus}>
        <Text style={styles.statusText}>RECOVERY MODE: ACTIVE</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: '#121414', overflow: 'hidden' },
  bgContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 },
  bgGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  embersContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 },
  ember: { position: 'absolute', width: 2, height: 2, backgroundColor: '#ff525f', borderRadius: 1 },
  flex: { flex: 1, zIndex: 5 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 40 },
  backButton: { position: 'absolute', top: 16, left: 16, width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start', zIndex: 20 },
  headerSection: { marginBottom: 40, paddingTop: 8, paddingLeft: 12 },
  authBadgeText: { fontSize: 12, fontWeight: '900', color: '#ff525f', letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 12 },
  mainTitle: { fontSize: 56, fontWeight: '900', color: '#e2e2e2', letterSpacing: -2, textTransform: 'uppercase', lineHeight: 60, fontStyle: 'italic', marginBottom: -35, zIndex: 200 },
  formCard: { backgroundColor: 'rgba(18, 20, 20, 0.85)', borderWidth: 1, marginTop: -30, zIndex: 1, borderColor: 'rgba(255, 179, 179, 0.15)', padding: 28, marginBottom: 28, transform: [{ rotateZ: '-4deg' }, { translateX: -8 }] },
  formContent: { transform: [{ rotateZ: '4deg' }] },
  subtitle: { fontSize: 12, color: '#ae8787', fontWeight: '600', letterSpacing: 0.5, marginBottom: 20, textTransform: 'uppercase' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255, 82, 95, 0.12)', borderLeftWidth: 4, borderLeftColor: '#ff525f', padding: 12, marginBottom: 20 },
  errorText: { fontSize: 12, color: '#ff9999', fontWeight: '600', flex: 1, textTransform: 'uppercase' },
  fieldLabel: { fontSize: 11, fontWeight: '800', color: '#ae8787', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e2e2e2', paddingHorizontal: 12, height: 52, marginBottom: 20 },
  inputIcon: { marginRight: 10, marginLeft: 4 },
  input: { flex: 1, fontSize: 15, color: '#121414', fontWeight: '500', paddingVertical: 0, paddingHorizontal: 8 },
  initiateButton: { backgroundColor: '#e2e2e2', paddingVertical: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 8, position: 'relative', overflow: 'visible' },
  buttonShade: { top: 0, height: '100%', width: 12, zIndex: -1 },
  buttonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#121414', fontWeight: '900', fontSize: 15, letterSpacing: 1.2, textTransform: 'uppercase' },
  accentBars: { flexDirection: 'row', gap: 8 },
  bar: { height: 3, borderRadius: 1.5 },
  bottomStatus: { position: 'absolute', bottom: 20, right: 20, zIndex: 10 },
  statusText: { fontSize: 10, color: '#ff525f', fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'monospace' },
})
