import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import { StatusBar } from 'expo-status-bar'
import { MaterialIcons, Feather } from '@expo/vector-icons'
import { verifyOTP, sendOTP, signIn, hasCompletedOnboarding } from '../lib/auth'

export default function OTPScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const { email, password } = route.params || {}
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(60)
  const inputs = useRef<any[]>([])

  useEffect(() => {
    sendOTP(email).catch(() => {})
  }, [])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleChange = (text: string, index: number) => {
    const newOtp = [...otp]
    newOtp[index] = text
    setOtp(newOtp)
    if (text && index < 5) inputs.current[index + 1]?.focus()
  }

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus()
    }
  }

  const handleVerify = async () => {
    const code = otp.join('')
    if (code.length < 6) { setError('Please enter the complete 6-digit code'); return }
    setLoading(true)
    setError('')
    try {
      await verifyOTP(email, code)
      if (password) {
        try { await signIn(email, password) } catch {}
      }
      const alreadyOnboarded = await hasCompletedOnboarding(email)
      navigation.reset({ index: 0, routes: [{ name: alreadyOnboarded ? 'Landing' : 'Tutorial' }] })
    } catch (e: any) {
      setError(e.message || 'Invalid OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    setError('')
    try {
      await sendOTP(email)
      setCountdown(60)
      setOtp(['', '', '', '', '', ''])
      inputs.current[0]?.focus()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setResending(false)
    }
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

          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to <Text style={styles.subtitleHighlight}>{email}</Text>
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <MaterialIcons name="info-outline" size={16} color="#ffb020" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.otpRow}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(r) => (inputs.current[index] = r)}
                style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                value={digit}
                onChangeText={(t) => handleChange(t.slice(-1), index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="numeric"
                maxLength={1}
                selectTextOnFocus
                editable={!loading}
              />
            ))}
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleVerify} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Verify email</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleResend} disabled={countdown > 0 || resending} style={styles.resendWrap}>
            <Text style={[styles.resendText, countdown === 0 && styles.resendTextActive]}>
              {resending ? 'Sending...' : countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
            </Text>
          </TouchableOpacity>

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

  title: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 8, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.55)', marginBottom: 24, lineHeight: 20 },
  subtitleHighlight: { color: '#fff', fontWeight: '700' },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,176,32,0.35)', borderRadius: 10, padding: 12, marginBottom: 20 },
  errorText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, flex: 1 },

  otpRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  otpBox: { flex: 1, height: 56, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 10, textAlign: 'center', fontSize: 20, fontWeight: '700', color: '#fff' },
  otpBoxFilled: { borderColor: '#8B5CF6', backgroundColor: 'rgba(139,92,246,0.08)' },

  primaryButton: { backgroundColor: '#8B5CF6', height: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  resendWrap: { alignItems: 'center', marginTop: 16 },
  resendText: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  resendTextActive: { color: '#8B5CF6' },
})
