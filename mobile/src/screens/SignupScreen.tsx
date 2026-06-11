import { useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons, Ionicons } from '@expo/vector-icons'
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
  const [attempted, setAttempted] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  const passwordMatch = confirmPassword.length > 0 && confirmPassword === password
  
  const getFieldBorder = (fieldValue: string) => {
    if (!attempted) return 'rgba(220,193,181,0.6)'
    return fieldValue ? '#22c55e' : '#ba1a1a'
  }

  const handleSignup = async () => {
    setAttempted(true)
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
      const dob = `${dobYear}-${dobMonth}-${dobDay}`
      await signUp(email, username, password, dob, gender)
      const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.29.59:3000'
      await fetch(`${BASE_URL}/api/auth/email-otp/send-verification-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type: "email-verification" }),
      })
      navigation.navigate('OTP', { email })
    } catch (e: any) {
      setError(e.message || 'Signup failed')
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
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Join Let's Talk and connect with people around you.</Text>
            {error ? (
              <View style={styles.errorBox}>
                <MaterialIcons name="error-outline" size={16} color="#93000a" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <View style={[styles.inputWrap, { borderColor: getFieldBorder(email) }]}>
              <MaterialIcons name="mail-outline" size={20} color="#897268" style={styles.inputIcon} />
              <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="name@gmail.com" placeholderTextColor="#b0978a" keyboardType="email-address" autoCapitalize="none" editable={!loading} />
            </View>
            <Text style={styles.label}>USERNAME</Text>
            <View style={[styles.inputWrap, { borderColor: getFieldBorder(username) }]}>
              <MaterialIcons name="person-outline" size={20} color="#897268" style={styles.inputIcon} />
              <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder="username" placeholderTextColor="#b0978a" autoCapitalize="none" editable={!loading} />
            </View>
            <Text style={styles.label}>PASSWORD</Text>
            <View style={[styles.inputWrap, { borderColor: getFieldBorder(password) }]}>
              <MaterialIcons name="lock-outline" size={20} color="#897268" style={styles.inputIcon} />
              <TextInput style={[styles.input, { paddingRight: 8 }]} value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor="#b0978a" secureTextEntry={!showPassword} editable={!loading} />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#897268" />
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>CONFIRM PASSWORD</Text>
            <View style={[styles.inputWrap, { borderColor: !attempted ? 'rgba(220,193,181,0.6)' : confirmPassword ? (passwordMatch ? '#22c55e' : '#ba1a1a') : '#ba1a1a' }]}>
              <MaterialIcons name="lock-outline" size={20} color="#897268" style={styles.inputIcon} />
              <TextInput style={[styles.input, { paddingRight: 8 }]} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="••••••••" placeholderTextColor="#b0978a" secureTextEntry={!showConfirm} editable={!loading} />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
                <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color="#897268" />
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>DATE OF BIRTH</Text>
            <View style={styles.dobRow}>
              <View style={{ flex: 1.6 }}>
                <TouchableOpacity style={[styles.inputWrap, { borderColor: getFieldBorder(dobMonth) }]} onPress={() => { setShowMonthDrop(!showMonthDrop); setShowDayDrop(false); setShowYearDrop(false) }} disabled={loading}>
                  <Text style={[styles.dropText, { color: dobMonth ? '#201b0e' : '#b0978a' }]} numberOfLines={1}>{dobMonth || 'Mon'}</Text>
                  <MaterialIcons name="keyboard-arrow-down" size={20} color="#897268" />
                </TouchableOpacity>
                {showMonthDrop && (<View style={styles.dropdown}><ScrollView nestedScrollEnabled style={{ maxHeight: 180 }}>{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, idx) => (<TouchableOpacity key={m} style={[styles.dropItem, { backgroundColor: dobMonth === m ? '#e8eeff' : idx % 2 === 0 ? '#fdf3dc' : '#fff8f0' }]} onPress={() => { setDobMonth(m); setShowMonthDrop(false) }}><Text style={[styles.dropItemText, dobMonth === m && styles.dropItemTextSelected]}>{m}</Text>{dobMonth === m && <MaterialIcons name="check" size={14} color="#405e98" />}</TouchableOpacity>))}</ScrollView></View>)}
              </View>
              <View style={{ flex: 1.2 }}>
                <TouchableOpacity style={[styles.inputWrap, { borderColor: getFieldBorder(dobDay) }]} onPress={() => { setShowDayDrop(!showDayDrop); setShowMonthDrop(false); setShowYearDrop(false) }} disabled={loading}>
                  <Text style={[styles.dropText, { color: dobDay ? '#201b0e' : '#b0978a' }]} numberOfLines={1}>{dobDay || 'DD'}</Text>
                  <MaterialIcons name="keyboard-arrow-down" size={20} color="#897268" />
                </TouchableOpacity>
                {showDayDrop && (<View style={styles.dropdown}><ScrollView nestedScrollEnabled style={{ maxHeight: 180 }}>{Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map((d, idx) => (<TouchableOpacity key={d} style={[styles.dropItem, { backgroundColor: dobDay === d ? '#e8eeff' : idx % 2 === 0 ? '#fdf3dc' : '#fff8f0' }]} onPress={() => { setDobDay(d); setShowDayDrop(false) }}><Text style={[styles.dropItemText, dobDay === d && styles.dropItemTextSelected]}>{d}</Text>{dobDay === d && <MaterialIcons name="check" size={14} color="#405e98" />}</TouchableOpacity>))}</ScrollView></View>)}
              </View>
              <View style={{ flex: 1.4 }}>
                <TouchableOpacity style={[styles.inputWrap, { borderColor: getFieldBorder(dobYear) }]} onPress={() => { setShowYearDrop(!showYearDrop); setShowMonthDrop(false); setShowDayDrop(false) }} disabled={loading}>
                  <Text style={[styles.dropText, { color: dobYear ? '#201b0e' : '#b0978a' }]} numberOfLines={1}>{dobYear || 'YYYY'}</Text>
                  <MaterialIcons name="keyboard-arrow-down" size={20} color="#897268" />
                </TouchableOpacity>
                {showYearDrop && (<View style={styles.dropdown}><ScrollView nestedScrollEnabled style={{ maxHeight: 180 }}>{Array.from({ length: 80 }, (_, i) => String(new Date().getFullYear() - 18 - i)).map((y, idx) => (<TouchableOpacity key={y} style={[styles.dropItem, { backgroundColor: dobYear === y ? '#e8eeff' : idx % 2 === 0 ? '#fdf3dc' : '#fff8f0' }]} onPress={() => { setDobYear(y); setShowYearDrop(false) }}><Text style={[styles.dropItemText, dobYear === y && styles.dropItemTextSelected]}>{y}</Text>{dobYear === y && <MaterialIcons name="check" size={14} color="#405e98" />}</TouchableOpacity>))}</ScrollView></View>)}
              </View>
            </View>
            <Text style={styles.label}>GENDER</Text>
            <TouchableOpacity style={[styles.inputWrap, { borderColor: getFieldBorder(gender) }]} onPress={() => setShowGenderDrop(!showGenderDrop)} disabled={loading}>
              <MaterialIcons name="person-outline" size={20} color="#897268" style={styles.inputIcon} />
              <Text style={[styles.input, { paddingVertical: 13, color: gender ? '#201b0e' : '#b0978a' }]}>{gender || 'Select gender'}</Text>
              <MaterialIcons name="keyboard-arrow-down" size={22} color="#897268" />
            </TouchableOpacity>
            {showGenderDrop && (<View style={[styles.dropdown, { marginTop: -10, marginBottom: 16 }]}>{['Male', 'Female', 'Other'].map((g) => (<TouchableOpacity key={g} style={[styles.dropItem, { backgroundColor: gender === g ? '#e8eeff' : g === 'Male' ? '#fdf3dc' : g === 'Female' ? '#fff8f0' : '#f7edd7' }]} onPress={() => { setGender(g); setShowGenderDrop(false) }}><Text style={[styles.dropItemText, gender === g && styles.dropItemTextSelected]}>{g}</Text>{gender === g && <MaterialIcons name="check" size={16} color="#405e98" />}</TouchableOpacity>))}</View>)}
            <TouchableOpacity style={styles.checkboxRow} onPress={() => setAgreedToTerms(!agreedToTerms)} disabled={loading}>
              <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                {agreedToTerms && <MaterialIcons name="check" size={16} color="#fff" />}
              </View>
              <Text style={styles.checkboxLabel}>I agree to the <Text style={styles.linkText}>Terms & Conditions</Text> and <Text style={styles.linkText}>Privacy Policy</Text></Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSignup} disabled={loading}>
              {loading ? <ActivityIndicator color="white" /> : <><Text style={styles.primaryText}>Create account</Text><MaterialIcons name="arrow-forward" size={20} color="white" style={{ marginLeft: 8 }} /></>}
            </TouchableOpacity>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.googleBtn} disabled={loading}>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleText}>Continue with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginTop: 20 }} disabled={loading}>
              <Text style={styles.switchText}>Already have an account? <Text style={styles.switchLink}>Log in</Text></Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>© 2024 Let's Talk</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: '#E9DFC9' },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 50 : 60, paddingBottom: 48 },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start', marginBottom: 8 },
  brandContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 },
  brandName: { fontSize: 24, fontWeight: '800', color: '#813400', letterSpacing: -0.5 },
  card: { backgroundColor: 'rgba(253,243,220,0.88)', borderRadius: 24, padding: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
  title: { fontSize: 26, fontWeight: '700', color: '#201b0e', marginBottom: 8, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: '#55433a', lineHeight: 21, marginBottom: 20 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ffdad6', borderRadius: 12, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: '#ffb4ab' },
  errorText: { color: '#93000a', fontSize: 13, flex: 1 },
  label: { fontSize: 11, fontWeight: '500', color: '#897268', letterSpacing: 0.8, marginBottom: 8, marginLeft: 2 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fdf3dc', borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(220,193,181,0.6)', marginBottom: 16, paddingHorizontal: 14 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 13, fontSize: 15, color: '#201b0e' },
  eyeBtn: { padding: 4 },
  dobRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  dropText: { flex: 1, paddingVertical: 13, fontSize: 14 },
  dropdown: { borderRadius: 14, borderWidth: 1, borderColor: 'rgba(220,193,181,0.6)', marginBottom: 16, overflow: 'hidden', shadowColor: '#405e98', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 6, zIndex: 999 },
  dropItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(220,193,181,0.2)' },
  dropItemTextSelected: { color: '#405e98', fontWeight: '600' },
  dropItemText: { fontSize: 14, color: '#201b0e' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20, paddingHorizontal: 4 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#405e98', justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#405e98', borderColor: '#405e98' },
  checkboxLabel: { flex: 1, fontSize: 13, color: '#55433a', lineHeight: 20 },
  linkText: { color: '#813400', fontWeight: '700' },
  primaryBtn: { backgroundColor: '#405e98', borderRadius: 50, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, shadowColor: '#405e98', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  primaryText: { color: 'white', fontWeight: '700', fontSize: 16 },
  footer: { alignItems: 'center', marginTop: 20, marginBottom: 20 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(220,193,181,0.5)' },
  dividerText: { fontSize: 11, fontWeight: '500', color: '#897268', letterSpacing: 0.8 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 13, borderWidth: 1.5, borderColor: 'rgba(220,193,181,0.8)' },
  googleIcon: { fontSize: 16, fontWeight: '700', color: '#4285F4' },
  googleText: { fontSize: 15, color: '#201b0e', fontWeight: '500' },
  switchText: { textAlign: 'center', color: '#55433a', fontSize: 13 },
  switchLink: { fontWeight: '700', color: '#813400' },
  footerText: { fontSize: 12, color: '#897268' },
})
