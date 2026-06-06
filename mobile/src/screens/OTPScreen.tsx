import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { MaterialIcons } from '@expo/vector-icons'
import { apiFetch } from '../lib/api'

export default function OTPScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const { email } = route.params || {}

  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(60)
  const inputs = useRef<any[]>([])

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
    if (text && index < 5) {
      inputs.current[index + 1]?.focus()
    }
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
      const result = await apiFetch('/api/auth/verify-otp', { email, otp: code })
      if (result.success) {
        navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] })
      }
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
      await apiFetch('/api/auth/send-otp', { email })
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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.scroll}>

          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={20} color="#813400" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.brandRow}>
            <MaterialIcons name="forum" size={26} color="#813400" />
            <Text style={styles.brandName}>Let's Talk</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <MaterialIcons name="mark-email-unread" size={36} color="#405e98" />
            </View>

            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.subtitle}>We sent a 6-digit verification code to</Text>
            <Text style={styles.email}>{email}</Text>

            {error ? (
              <View style={styles.errorBox}>
                <MaterialIcons name="error-outline" size={16} color="#93000a" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* OTP Boxes */}
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
                />
              ))}
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleVerify} disabled={loading}>
              {loading
                ? <ActivityIndicator color="white" />
                : <>
                    <Text style={styles.primaryText}>Verify Email</Text>
                    <MaterialIcons name="verified" size={20} color="white" style={{ marginLeft: 8 }} />
                  </>
              }
            </TouchableOpacity>

            <View style={styles.resendRow}>
              <Text style={styles.resendLabel}>Didn't receive the code? </Text>
              {countdown > 0 ? (
                <Text style={styles.countdown}>Resend in {countdown}s</Text>
              ) : (
                <TouchableOpacity onPress={handleResend} disabled={resending}>
                  <Text style={styles.resendLink}>{resending ? 'Sending...' : 'Resend'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E9DFC9' },
  scroll: { flex: 1, padding: 24 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 20 },
  backText: { color: '#813400', fontWeight: '600', fontSize: 16 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 },
  brandName: { fontSize: 22, fontWeight: '800', color: '#813400', letterSpacing: -0.3 },
  card: { backgroundColor: 'rgba(253,243,220,0.88)', borderRadius: 24, padding: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', alignItems: 'center' },
  iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#e8eeff', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#201b0e', marginBottom: 8, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: '#55433a', textAlign: 'center' },
  email: { fontSize: 15, fontWeight: '700', color: '#405e98', marginBottom: 24, textAlign: 'center' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ffdad6', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#ffb4ab', alignSelf: 'stretch' },
  errorText: { color: '#93000a', fontSize: 13, flex: 1 },
  otpRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  otpBox: { width: 46, height: 56, borderRadius: 14, borderWidth: 2, borderColor: 'rgba(220,193,181,0.6)', backgroundColor: '#fdf3dc', textAlign: 'center', fontSize: 22, fontWeight: '700', color: '#201b0e' },
  otpBoxFilled: { borderColor: '#405e98', backgroundColor: '#e8eeff' },
  primaryBtn: { backgroundColor: '#405e98', borderRadius: 50, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', shadowColor: '#405e98', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  primaryText: { color: 'white', fontWeight: '700', fontSize: 16 },
  resendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  resendLabel: { fontSize: 13, color: '#55433a' },
  countdown: { fontSize: 13, color: '#897268', fontWeight: '600' },
  resendLink: { fontSize: 13, color: '#813400', fontWeight: '700' },
})
