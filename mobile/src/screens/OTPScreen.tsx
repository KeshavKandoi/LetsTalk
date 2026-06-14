import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Animated, Dimensions
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import { MaterialIcons } from '@expo/vector-icons'
import { verifyOTP, sendOTP, signIn } from '../lib/auth'

const { height } = Dimensions.get('window')

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
  const embersAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.loop(
      Animated.timing(embersAnim, { toValue: 1, duration: 8000, useNativeDriver: true })
    ).start()
  }, [])

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
      navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] })
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
    <SafeAreaView style={styles.container}>
      <View style={styles.bgContainer}>
        <View style={[styles.bgGradient, { backgroundColor: '#121414' }]} />
        <View style={[styles.bgGradient, { backgroundColor: '#D84315', opacity: 0.85 }]} />
      </View>
      <View pointerEvents="none" style={styles.embersContainer}>
        {[...Array(15)].map((_, i) => (
          <Animated.View
            key={i}
            style={[styles.ember, {
              left: `${Math.random() * 100}%`,
              opacity: embersAnim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.8, 0.8, 0] }),
              transform: [{ translateY: embersAnim.interpolate({ inputRange: [0, 1], outputRange: [height, -height] }) }],
            }]}
          />
        ))}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <View style={styles.inner}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="chevron-left" size={28} color="#ff525f" />
          </TouchableOpacity>

          <View style={styles.headerSection}>
            <Text style={styles.badgeText}>EMAIL VERIFICATION</Text>
            <Text style={styles.mainTitle}>Check{'\n'}your{'\n'}email</Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.formContent}>
              <Text style={styles.subtitle}>We sent a 6-digit code to</Text>
              <Text style={styles.emailText}>{email}</Text>

              {error ? (
                <View style={styles.errorBox}>
                  <MaterialIcons name="error-outline" size={16} color="#ff5555" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Text style={styles.fieldLabel}>VERIFICATION CODE</Text>
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

              <TouchableOpacity
                style={[styles.verifyButton, { transform: [{ skewX: '12deg' }] }]}
                onPress={handleVerify}
                disabled={loading}
              >
                <View style={[styles.buttonShade, { position: 'absolute', left: -15, backgroundColor: '#ff525f' }]} />
                {loading ? (
                  <ActivityIndicator color="#121414" size="small" />
                ) : (
                  <View style={styles.buttonContent}>
                    <Text style={styles.buttonText}>Verify Email</Text>
                    <MaterialIcons name="verified" size={18} color="#121414" style={{ marginLeft: 12 }} />
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.dividerLine} />

              <View style={styles.resendRow}>
                <Text style={styles.resendLabel}>DIDN'T RECEIVE CODE? </Text>
                {countdown > 0 ? (
                  <Text style={styles.countdown}>RESEND IN {countdown}S</Text>
                ) : (
                  <TouchableOpacity onPress={handleResend} disabled={resending}>
                    <Text style={styles.resendLink}>{resending ? 'SENDING...' : 'RESEND'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          <View style={[styles.accentBars, { transform: [{ skewX: '-12deg' }] }]}>
            <View style={[styles.bar, { width: '20%', backgroundColor: '#ff525f' }]} />
            <View style={[styles.bar, { width: '8%', backgroundColor: '#00e3fd' }]} />
            <View style={[styles.bar, { width: '40%', backgroundColor: 'rgba(255,255,255,0.08)' }]} />
          </View>
        </View>
      </KeyboardAvoidingView>

      <View style={styles.bottomStatus}>
        <Text style={styles.statusText}>UPLINK: ACTIVE [99.2%]</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121414', overflow: 'hidden' },
  bgContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 },
  bgGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  embersContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 },
  ember: { position: 'absolute', width: 2, height: 2, backgroundColor: '#ff525f', borderRadius: 1 },
  flex: { flex: 1, zIndex: 5 },
  inner: { flex: 1, paddingHorizontal: 16, paddingTop: 60, paddingBottom: 20 },
  backButton: { position: 'absolute', top: 16, left: 16, width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start', zIndex: 20 },
  headerSection: { marginBottom: 40, paddingTop: 8, paddingLeft: 12 },
  badgeText: { fontSize: 16, fontWeight: '900', color: '#ff525f', letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 12 },
  mainTitle: { fontSize: 52, fontWeight: '900', color: '#e2e2e2', letterSpacing: -2, textTransform: 'uppercase', lineHeight: 56, fontStyle: 'italic', marginBottom: -35, zIndex: 200 },
  formCard: { backgroundColor: 'rgba(18,20,20,0.85)', borderWidth: 1, marginTop: -30, zIndex: 1, borderColor: 'rgba(255,179,179,0.15)', padding: 28, marginBottom: 28, transform: [{ rotateZ: '-4deg' }, { translateX: -8 }] },
  formContent: { transform: [{ rotateZ: '4deg' }] },
  subtitle: { fontSize: 13, color: '#ae8787', marginBottom: 4 },
  emailText: { fontSize: 14, fontWeight: '700', color: '#ff525f', marginBottom: 24, letterSpacing: 0.3 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,82,95,0.12)', borderLeftWidth: 4, borderLeftColor: '#ff525f', padding: 12, marginBottom: 20 },
  errorText: { fontSize: 12, color: '#ff9999', fontWeight: '600', flex: 1, textTransform: 'uppercase' },
  fieldLabel: { fontSize: 11, fontWeight: '800', color: '#ae8787', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 },
  otpRow: { flexDirection: 'row', gap: 8, marginBottom: 28 },
  otpBox: { flex: 1, height: 56, borderWidth: 2, borderColor: 'rgba(255,179,179,0.3)', backgroundColor: '#1a1a1a', textAlign: 'center', fontSize: 22, fontWeight: '700', color: '#e2e2e2' },
  otpBoxFilled: { borderColor: '#ff525f', backgroundColor: '#2a1a1a' },
  verifyButton: { backgroundColor: '#e2e2e2', paddingVertical: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24, position: 'relative', overflow: 'visible' },
  buttonShade: { top: 0, height: '100%', width: 12, zIndex: -1 },
  buttonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#121414', fontWeight: '900', fontSize: 15, letterSpacing: 1.2, textTransform: 'uppercase' },
  dividerLine: { height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 16 },
  resendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  resendLabel: { fontSize: 11, color: '#ae8787', fontWeight: '600' },
  countdown: { fontSize: 11, color: '#ae8787', fontWeight: '700' },
  resendLink: { fontSize: 11, color: '#00e3fd', fontWeight: '800', letterSpacing: 0.5 },
  accentBars: { flexDirection: 'row', gap: 8 },
  bar: { height: 3, borderRadius: 1.5 },
  bottomStatus: { position: 'absolute', bottom: 20, right: 20, zIndex: 10 },
  statusText: { fontSize: 10, color: '#ff525f', fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'monospace' },
})
