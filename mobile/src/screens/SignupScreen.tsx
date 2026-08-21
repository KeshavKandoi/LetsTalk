import { useState, useRef } from 'react'
import { useNavigation } from '@react-navigation/native'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Linking, Pressable, Keyboard,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { MaterialIcons, Ionicons, Feather } from '@expo/vector-icons'
import { signUp } from '../lib/auth'

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

  const emailRef = useRef<TextInput>(null)
  const usernameRef = useRef<TextInput>(null)
  const passwordRef = useRef<TextInput>(null)
  const confirmRef = useRef<TextInput>(null)
  const [emailFocused, setEmailFocused] = useState(false)
  const [usernameFocused, setUsernameFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [confirmFocused, setConfirmFocused] = useState(false)

  const toggleDismiss = (ref: React.RefObject<TextInput>) => {
    ref.current?.blur()
    Keyboard.dismiss()
  }

  const handleSignup = async () => {
    if (!email || !username || !password || !confirmPassword || !dobMonth || !dobDay || !dobYear || !gender) {
      setError('Please fill in all fields')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
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
      const BASE_URL = process.env.EXPO_PUBLIC_API_URL
      const checkRes = await fetch(`${BASE_URL}/api/auth/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const { exists, emailVerified } = await checkRes.json()
      if (exists && emailVerified) {
        setError('An account with this email already exists. Please log in.')
        return
      }
      if (exists && !emailVerified) {
        navigation.navigate('OTP', { email, password })
        return
      }
      const dob = `${dobYear}-${dobMonth}-${dobDay}`
      await signUp(email, username, password, dob, gender)
      navigation.navigate('OTP', { email, password })
    } catch (e: any) {
      setError(e.message || 'Signup failed')
    } finally {
      setLoading(false)
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

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandBlock}>
            <Feather name="message-circle" size={32} color="#8B5CF6" />
            <Text style={styles.brandName}>Let's Talk</Text>
          </View>

          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join to get started</Text>

          {error ? (
            <View style={styles.errorBox}>
              <MaterialIcons name="error-outline" size={16} color="#ff6b6b" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <View style={{ position: 'relative' }}>
              <TextInput
                ref={emailRef}
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
              {emailFocused && (
                <Pressable style={StyleSheet.absoluteFill} onPress={() => toggleDismiss(emailRef)} />
              )}
            </View>
          </View>

          <View style={styles.field}>
            <View style={{ position: 'relative' }}>
              <TextInput
                ref={usernameRef}
                style={styles.input}
                placeholder="Username"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                editable={!loading}
                onFocus={() => setUsernameFocused(true)}
                onBlur={() => setUsernameFocused(false)}
              />
              {usernameFocused && (
                <Pressable style={StyleSheet.absoluteFill} onPress={() => toggleDismiss(usernameRef)} />
              )}
            </View>
          </View>

          <View style={styles.field}>
            <View style={[styles.passwordRow, { position: 'relative' }]}>
              <TextInput
                ref={passwordRef}
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Password"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
              <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
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
                placeholder="Confirm password"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                editable={!loading}
                onFocus={() => setConfirmFocused(true)}
                onBlur={() => setConfirmFocused(false)}
              />
              <TouchableOpacity style={styles.eyeButton} onPress={() => setShowConfirm(!showConfirm)}>
                <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
              {confirmFocused && (
                <Pressable style={[StyleSheet.absoluteFill, { right: 44 }]} onPress={() => toggleDismiss(confirmRef)} />
              )}
            </View>
          </View>

          <Text style={styles.fieldLabel}>Date of birth</Text>
          <View style={styles.dobRow}>
            <TouchableOpacity style={styles.dobBtn} onPress={() => { setShowMonthDrop(!showMonthDrop); setShowDayDrop(false); setShowYearDrop(false); setShowGenderDrop(false) }}>
              <Text style={{ color: dobMonth ? '#fff' : 'rgba(255,255,255,0.4)' }}>{dobMonth || 'Mon'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dobBtn} onPress={() => { setShowDayDrop(!showDayDrop); setShowMonthDrop(false); setShowYearDrop(false); setShowGenderDrop(false) }}>
              <Text style={{ color: dobDay ? '#fff' : 'rgba(255,255,255,0.4)' }}>{dobDay || 'DD'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dobBtn} onPress={() => { setShowYearDrop(!showYearDrop); setShowMonthDrop(false); setShowDayDrop(false); setShowGenderDrop(false) }}>
              <Text style={{ color: dobYear ? '#fff' : 'rgba(255,255,255,0.4)' }}>{dobYear || 'YYYY'}</Text>
            </TouchableOpacity>
          </View>

          {showMonthDrop && (
            <ScrollView nestedScrollEnabled style={styles.dropdownList}>
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m) => (
                <TouchableOpacity key={m} style={styles.dropdownItem} onPress={() => { setDobMonth(m); setShowMonthDrop(false) }}>
                  <Text style={dobMonth === m ? styles.selectedText : styles.dropdownText}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {showDayDrop && (
            <ScrollView nestedScrollEnabled style={styles.dropdownList}>
              {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map((d) => (
                <TouchableOpacity key={d} style={styles.dropdownItem} onPress={() => { setDobDay(d); setShowDayDrop(false) }}>
                  <Text style={dobDay === d ? styles.selectedText : styles.dropdownText}>{d}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {showYearDrop && (
            <ScrollView nestedScrollEnabled style={styles.dropdownList}>
              {Array.from({ length: 80 }, (_, i) => String(new Date().getFullYear() - 18 - i)).map((y) => (
                <TouchableOpacity key={y} style={styles.dropdownItem} onPress={() => { setDobYear(y); setShowYearDrop(false) }}>
                  <Text style={dobYear === y ? styles.selectedText : styles.dropdownText}>{y}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <Text style={styles.fieldLabel}>Gender</Text>
          <TouchableOpacity style={styles.input} onPress={() => { setShowGenderDrop(!showGenderDrop); setShowMonthDrop(false); setShowDayDrop(false); setShowYearDrop(false) }}>
            <Text style={{ color: gender ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: 15 }}>
              {gender || 'Select gender'}
            </Text>
          </TouchableOpacity>

          {showGenderDrop && (
            <View style={styles.dropdownList}>
              {['Male', 'Female', 'Other'].map((g) => (
                <TouchableOpacity key={g} style={styles.dropdownItem} onPress={() => { setGender(g); setShowGenderDrop(false) }}>
                  <Text style={gender === g ? styles.selectedText : styles.dropdownText}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.checkboxRow}>
            <TouchableOpacity onPress={() => setAgreedToTerms(!agreedToTerms)}>
              <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                {agreedToTerms && <MaterialIcons name="check" size={12} color="#000" />}
              </View>
            </TouchableOpacity>
            <View style={styles.checkboxLabelRow}>
              <TouchableOpacity onPress={() => setAgreedToTerms(!agreedToTerms)}>
                <Text style={styles.checkboxLabel}>I agree to the </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Linking.openURL('https://policy-2epo.onrender.com/Terms_condition.html')}>
                <Text style={styles.linkTextAccent}>Terms & Conditions</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAgreedToTerms(!agreedToTerms)}>
                <Text style={styles.checkboxLabel}> and </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Linking.openURL('https://policy-2epo.onrender.com/Privacy_policy.html')}>
                <Text style={styles.linkTextAccent}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSignup}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Create account</Text>}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.googleButton} activeOpacity={0.85}>
            <View style={styles.googleContent}>
              <Text style={styles.googleLetter}>G</Text>
              <Text style={styles.googleText}>Continue with Google</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Log in</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  flex: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },

  brandBlock: { alignItems: 'center', marginBottom: 28 },
  brandName: { fontSize: 18, fontWeight: '800', color: '#fff', marginTop: 8 },

  title: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.55)', marginBottom: 24 },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,107,107,0.1)', borderRadius: 10, padding: 12, marginBottom: 20 },
  errorText: { color: '#ff9b9b', fontSize: 13, flex: 1 },

  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.55)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#fff',
    justifyContent: 'center',
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingRight: 8 },
  eyeButton: { padding: 8 },

  dobRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  dobBtn: { flex: 1, height: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  dropdownList: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    marginBottom: 16,
    maxHeight: 160,
  },
  dropdownItem: { paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  dropdownText: { fontSize: 14, color: '#fff' },
  selectedText: { fontSize: 14, color: '#8B5CF6', fontWeight: '700' },

  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 24 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
  checkboxLabelRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  checkboxLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 18 },
  linkTextAccent: { fontSize: 12, color: '#8B5CF6', fontWeight: '700', lineHeight: 18 },

  submitButton: { backgroundColor: '#8B5CF6', height: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  dividerText: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '700', letterSpacing: 1 },

  googleButton: { height: 50, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  googleContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  googleLetter: { fontSize: 15, fontWeight: '900', color: '#fff' },
  googleText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  loginText: { fontSize: 13, color: 'rgba(255,255,255,0.55)' },
  loginLink: { fontSize: 13, color: '#8B5CF6', fontWeight: '700' },
})
