import { useState, useEffect, useRef } from 'react'
import { useNavigation } from '@react-navigation/native'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, Dimensions
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons, Ionicons } from '@expo/vector-icons'
import { signUp } from '../lib/auth'

const { width, height } = Dimensions.get('window')

export default function SignupScreen() {
  const navigation = useNavigation<any>()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [dobMonth, setDobMonth] = useState('')
  const [dobDay, setDobDay] = useState('')
  const [dobYear, setDobYear] = useState('')
  const [showMonthDrop, setShowMonthDrop] = useState(false)
  const [showDayDrop, setShowDayDrop] = useState(false)
  const [showYearDrop, setShowYearDrop] = useState(false)
  const [gender, setGender] = useState('')
  const [showGenderDrop, setShowGenderDrop] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  const embersAnim = useRef(new Animated.Value(0)).current
  const emailRef = useRef<TextInput>(null)
  const usernameRef = useRef<TextInput>(null)
  const passwordRef = useRef<TextInput>(null)
  const confirmRef = useRef<TextInput>(null)

  useEffect(() => {
    Animated.loop(
      Animated.timing(embersAnim, { toValue: 1, duration: 8000, useNativeDriver: true })
    ).start()
  }, [])

  const handleSignup = async () => {
    if (!email || !username || !password || !confirmPassword || !dobMonth || !dobDay || !dobYear || !gender) {
      setError('Please fill in all fields')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (!agreedToTerms) {
      setError('Please agree to Terms & Conditions')
      return
    }
    setLoading(true)
    setError('')
    try {
      const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.29.59:3000'
      const checkRes = await fetch(`${BASE_URL}/api/auth/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const { exists } = await checkRes.json()
      if (exists) {
        setError('An account with this email already exists. Please log in.')
        return
      }
      const dob = `${dobYear}-${dobMonth}-${dobDay}`
      await signUp(email, username, password, dob, gender)
      navigation.navigate('OTP', { email })
    } catch (e: any) {
      setError(e.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.bgContainer}>
        <View style={[styles.bgGradient, { backgroundColor: '#121414' }]} />
        <View style={[styles.bgGradient, { backgroundColor: '#D84315', opacity: 0.85 }]} />
      </View>

      <View
  pointerEvents="none"
  style={styles.embersContainer}
>
        {[...Array(15)].map((_, i) => (
          <Animated.View
            key={i}
            style={[
              styles.ember,
              {
                left: `${Math.random() * 100}%`,
                opacity: embersAnim.interpolate({
                  inputRange: [0, 0.2, 0.8, 1],
                  outputRange: [0, 0.8, 0.8, 0],
                }),
                transform: [
                  {
                    translateY: embersAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [height, -height],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>



      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          scrollEnabled={true}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.backButtonScroll} onPress={() => navigation.goBack()}>
            <MaterialIcons name="chevron-left" size={28} color="#ff525f" />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.badgeText}>IDENTITY CREATION</Text>
            <Text style={styles.titleText}>CREATE{'\n'}IDENTITY</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardContent}>
            {error ? (
              <View style={styles.errorBox}>
                <MaterialIcons name="error-outline" size={16} color="#ff5555" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <TextInput
              ref={emailRef}
              style={styles.input}
              placeholder="name@gmail.com"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
            />

            <Text style={styles.label}>USERNAME</Text>
            <TextInput
              ref={usernameRef}
              style={styles.input}
              placeholder="username"
              placeholderTextColor="#999"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              editable={!loading}
            />

            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.passwordRow}>
              <TextInput
                ref={passwordRef}
                style={[styles.input, { flex: 1 }]}
                placeholder="••••••••"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="#121414"
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>CONFIRM PASSWORD</Text>
            <View style={styles.passwordRow}>
              <TextInput
                ref={confirmRef}
                style={[styles.input, { flex: 1 }]}
                placeholder="••••••••"
                placeholderTextColor="#999"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirm(!showConfirm)}
              >
                <Ionicons
                  name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="#121414"
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>DATE OF BIRTH</Text>
            <View style={styles.dobRow}>
              <TouchableOpacity style={styles.dobBtn} onPress={() => { setShowMonthDrop(!showMonthDrop); setShowDayDrop(false); setShowYearDrop(false); setShowGenderDrop(false) }}>
                <Text style={{ color: dobMonth ? '#121414' : '#999' }}>{dobMonth || 'Mon'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dobBtn} onPress={() => { setShowDayDrop(!showDayDrop); setShowMonthDrop(false); setShowYearDrop(false); setShowGenderDrop(false) }}>
                <Text style={{ color: dobDay ? '#121414' : '#999' }}>{dobDay || 'DD'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dobBtn} onPress={() => { setShowYearDrop(!showYearDrop); setShowMonthDrop(false); setShowDayDrop(false); setShowGenderDrop(false) }}>
                <Text style={{ color: dobYear ? '#121414' : '#999' }}>{dobYear || 'YYYY'}</Text>
              </TouchableOpacity>
            </View>

            {showMonthDrop && (
              <ScrollView nestedScrollEnabled style={styles.dropdownList}>
                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={styles.dropdownItem}
                    onPress={() => { setDobMonth(m); setShowMonthDrop(false) }}
                  >
                    <Text style={dobMonth === m ? styles.selectedText : styles.dropdownText}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {showDayDrop && (
              <ScrollView nestedScrollEnabled style={styles.dropdownList}>
                {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={styles.dropdownItem}
                    onPress={() => { setDobDay(d); setShowDayDrop(false) }}
                  >
                    <Text style={dobDay === d ? styles.selectedText : styles.dropdownText}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {showYearDrop && (
              <ScrollView nestedScrollEnabled style={styles.dropdownList}>
                {Array.from({ length: 80 }, (_, i) => String(new Date().getFullYear() - 18 - i)).map((y) => (
                  <TouchableOpacity
                    key={y}
                    style={styles.dropdownItem}
                    onPress={() => { setDobYear(y); setShowYearDrop(false) }}
                  >
                    <Text style={dobYear === y ? styles.selectedText : styles.dropdownText}>{y}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <Text style={styles.label}>GENDER</Text>
            <TouchableOpacity style={styles.genderButton} onPress={() => { setShowGenderDrop(!showGenderDrop); setShowMonthDrop(false); setShowDayDrop(false); setShowYearDrop(false) }}>
              <Text style={{ color: gender ? '#121414' : '#999', fontSize: 14 }}>
                {gender || 'Select gender'}
              </Text>
            </TouchableOpacity>

            {showGenderDrop && (
              <View style={styles.dropdownList}>
                {['Male', 'Female', 'Other'].map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setGender(g)
                      setShowGenderDrop(false)
                    }}
                  >
                    <Text style={gender === g ? styles.selectedText : styles.dropdownText}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.checkboxRow} onPress={() => setAgreedToTerms(!agreedToTerms)}>
              <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                {agreedToTerms && <MaterialIcons name="check" size={12} color="#121414" />}
              </View>
              <Text style={styles.checkboxLabel}>
                I agree to the <Text style={styles.linkText}>Terms & Conditions</Text> and{' '}
                <Text style={styles.linkText}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, loading && { opacity: 0.6 }]}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#121414" size="small" />
              ) : (
                <Text style={styles.submitText}>CREATE ACCOUNT</Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider} />

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>ALREADY AN OPERATIVE?</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLink}> SIGN IN</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.googleButton}>
              <Text style={styles.googleLetter}>G</Text>
              <Text style={styles.googleText}>CONTINUE WITH GOOGLE</Text>
            </TouchableOpacity>
            </View>
          </View>

          <View style={styles.accentBars}>
            <View style={[styles.bar, { width: '20%', backgroundColor: '#ff525f' }]} />
            <View style={[styles.bar, { width: '8%', backgroundColor: '#00e3fd' }]} />
            <View style={[styles.bar, { width: '40%', backgroundColor: 'rgba(255,255,255,0.08)' }]} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121414',
    overflow: 'hidden',
  },
  bgContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  bgGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  embersContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
    pointerEvents: 'none',
  },
  ember: {
    position: 'absolute',
    width: 2,
    height: 2,
    backgroundColor: '#ff525f',
    borderRadius: 1,
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
    zIndex: 20,
  },
  backButtonScroll: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: 2,
    marginTop: -35,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 300,
    flexGrow: 1,
  },
  header: {
    marginBottom: 30,
    paddingTop: 0,
    paddingLeft: 8,
    zIndex: 100,
  elevation: 100,
  },
  badgeText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ff525f',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  titleText: {
    fontSize: 52,
    fontWeight: '900',
    color: '#e2e2e2',
    letterSpacing: -1,
    lineHeight: 56,
    fontStyle: 'italic',
    textTransform: 'uppercase',
     zIndex: 100,
  elevation: 100,
  },
  card: {
    backgroundColor: 'rgba(18, 20, 20, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 179, 179, 0.15)',
    padding: 24,
    zIndex: 50,
     marginTop: -50,  
  paddingTop: 50,   
    marginBottom: 40,
    transform: [
    { rotateZ: '-4deg' },
    { translateX: 2},
  ],
  },
  genderButton: {
  height: 48,
  backgroundColor: '#e2e2e2',
  paddingHorizontal: 12,
  justifyContent: 'center',
  marginBottom: 8,
},
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 82, 95, 0.12)',
    borderLeftWidth: 4,
    borderLeftColor: '#ff525f',
    padding: 12,
    marginBottom: 20,
    gap: 10,
  },
  errorText: {
    fontSize: 11,
    color: '#ff9999',
    fontWeight: '600',
    flex: 1,
    textTransform: 'uppercase',
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ae8787',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    height: 48,
    backgroundColor: '#e2e2e2',
    paddingHorizontal: 12,
    borderRadius: 2,
    fontSize: 14,
    color: '#121414',
    marginBottom: 4,
  },
  passwordRow: {
    height: 48,
    backgroundColor: '#e2e2e2',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 2,
    marginBottom: 4,
    gap: 8,
  },
  eyeButton: {
    padding: 8,
  },
  dobRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  dobBtn: {
    flex: 1,
    height: 48,
    backgroundColor: '#e2e2e2',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 2,
  },
  dropdownList: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255, 179, 179, 0.2)',
    marginBottom: 12,
    maxHeight: 160,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  dropdownText: {
    fontSize: 13,
    color: '#e2e2e2',
  },
  selectedText: {
    fontSize: 13,
    color: '#ff525f',
    fontWeight: '700',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#ff525f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#ff525f',
  },
  checkboxLabel: {
    fontSize: 12,
    color: '#ae8787',
    flex: 1,
    lineHeight: 18,
  },
  linkText: {
    color: '#00e3fd',
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: '#e2e2e2',
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
    borderRadius: 2,
  },
  submitText: {
    color: '#121414',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 16,
  },
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loginText: {
    fontSize: 10,
    color: '#ae8787',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  loginLink: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00e3fd',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  googleButton: {
    borderWidth: 2,
    borderColor: '#00e3fd',
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 2,
  },
  googleLetter: {
    fontSize: 16,
    fontWeight: '900',
    color: '#00e3fd',
  },
  googleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00e3fd',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  cardContent: {
    zIndex: 5,
  },
  accentBars: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  bar: {
    height: 3,
    borderRadius: 1.5,
  },
})
