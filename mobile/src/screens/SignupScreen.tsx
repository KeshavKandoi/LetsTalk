import { useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native'
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

  const passwordMatch = confirmPassword.length > 0 && confirmPassword === password
  const passwordStrength = () => {
    let s = 0
    if (password.length > 7) s++
    if (/[A-Z]/.test(password)) s++
    if (/[0-9]/.test(password)) s++
    return s
  }
  const strength = passwordStrength()
  const strengthColor = strength === 0 ? '#dcc1b5' : strength === 1 ? '#ba1a1a' : strength === 2 ? '#f97316' : '#22c55e'
  const strengthLabel = strength === 0 ? 'Minimum 8 characters with letters & numbers.' : strength === 1 ? 'Weak — add numbers and uppercase.' : strength === 2 ? 'Medium — almost there!' : 'Strong password!'

  const handleSignup = async () => {
    if (!email || !username || !password || !dobMonth || !dobDay || !dobYear || !gender) { setError('Please fill in all fields'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    setLoading(true)
    setError('')
    try {
      await signUp(email, username, password)
      navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] })
    } catch (e: any) {
      setError(e.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Back */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={20} color="#813400" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          {/* Brand */}
          <View style={styles.brandRow}>
            <MaterialIcons name="forum" size={26} color="#813400" />
            <Text style={styles.brandName}>Let's Talk</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Join Let's Talk and connect with people around you.</Text>

            {error ? (
              <View style={styles.errorBox}>
                <MaterialIcons name="error-outline" size={16} color="#93000a" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Email */}
            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="mail-outline" size={20} color="#897268" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="name@gmail.com"
                placeholderTextColor="#b0978a"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {email.includes('@') && (
                <MaterialIcons name="check-circle" size={18} color="#22c55e" />
              )}
            </View>

            {/* Username */}
            <Text style={styles.label}>USERNAME</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="person-outline" size={20} color="#897268" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="letstalk"
                placeholderTextColor="#b0978a"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <Text style={styles.hint}>This is how others will see you in the app.</Text>

            {/* Password */}
            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="lock-outline" size={20} color="#897268" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { paddingRight: 8 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#b0978a"
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#897268" />
              </TouchableOpacity>
            </View>
            <View style={styles.strengthBg}>
              <View style={[styles.strengthFill, { width: `${(strength / 3) * 100}%` as any, backgroundColor: strengthColor }]} />
            </View>
            <Text style={[styles.hint, { color: strength === 0 ? '#897268' : strengthColor }]}>{strengthLabel}</Text>

            {/* Confirm Password */}
            <Text style={styles.label}>CONFIRM PASSWORD</Text>
            <View style={[styles.inputWrap, confirmPassword.length > 0 && { borderColor: passwordMatch ? '#22c55e' : '#ba1a1a' }]}>
              <MaterialIcons name="lock-outline" size={20} color="#897268" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { paddingRight: 8 }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••"
                placeholderTextColor="#b0978a"
                secureTextEntry={!showConfirm}
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
                <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color="#897268" />
              </TouchableOpacity>
              {confirmPassword.length > 0 && (
                <MaterialIcons
                  name={passwordMatch ? 'check-circle' : 'cancel'}
                  size={18}
                  color={passwordMatch ? '#22c55e' : '#ba1a1a'}
                  style={{ marginLeft: 4 }}
                />
              )}
            </View>

            {/* Date of Birth */}
            <Text style={styles.label}>DATE OF BIRTH</Text>
            <View style={styles.dobRow}>
              {/* Month */}
              <View style={{ flex: 1.6 }}>
                <TouchableOpacity style={styles.inputWrap} onPress={() => { setShowMonthDrop(!showMonthDrop); setShowDayDrop(false); setShowYearDrop(false) }}>
                  <Text style={[styles.dropText, { color: dobMonth ? '#201b0e' : '#b0978a' }]} numberOfLines={1} ellipsizeMode='clip'>{dobMonth || 'Mon'}</Text>
                  <MaterialIcons name="keyboard-arrow-down" size={20} color="#897268" />
                </TouchableOpacity>
                {showMonthDrop && (
                  <View style={styles.dropdown}>
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 180 }}>
                      {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, idx) => (
                        <TouchableOpacity key={m} style={[styles.dropItem, { backgroundColor: dobMonth === m ? '#e8eeff' : idx % 2 === 0 ? '#fdf3dc' : '#fff8f0' }]} onPress={() => { setDobMonth(m); setShowMonthDrop(false) }}>
                          <Text style={[styles.dropItemText, dobMonth === m && styles.dropItemTextSelected]}>{m}</Text>
                          {dobMonth === m && <MaterialIcons name="check" size={14} color="#405e98" />}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
              {/* Day */}
              <View style={{ flex: 1.4 }}>
                <TouchableOpacity style={styles.inputWrap} onPress={() => { setShowDayDrop(!showDayDrop); setShowMonthDrop(false); setShowYearDrop(false) }}>
                  <Text style={[styles.dropText, { color: dobDay ? '#201b0e' : '#b0978a' }]} numberOfLines={1} ellipsizeMode='clip'>{dobDay || 'DD'}</Text>
                  <MaterialIcons name="keyboard-arrow-down" size={20} color="#897268" />
                </TouchableOpacity>
                {showDayDrop && (
                  <View style={styles.dropdown}>
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 180 }}>
                      {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map((d, idx) => (
                        <TouchableOpacity key={d} style={[styles.dropItem, { backgroundColor: dobDay === d ? '#e8eeff' : idx % 2 === 0 ? '#fdf3dc' : '#fff8f0' }]} onPress={() => { setDobDay(d); setShowDayDrop(false) }}>
                          <Text style={[styles.dropItemText, dobDay === d && styles.dropItemTextSelected]}>{d}</Text>
                          {dobDay === d && <MaterialIcons name="check" size={14} color="#405e98" />}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
              {/* Year */}
              <View style={{ flex: 1.4 }}>
                <TouchableOpacity style={styles.inputWrap} onPress={() => { setShowYearDrop(!showYearDrop); setShowMonthDrop(false); setShowDayDrop(false) }}>
                  <Text style={[styles.dropText, { color: dobYear ? '#201b0e' : '#b0978a' }]} numberOfLines={1} ellipsizeMode='clip'>{dobYear || 'YYYY'}</Text>
                  <MaterialIcons name="keyboard-arrow-down" size={20} color="#897268" />
                </TouchableOpacity>
                {showYearDrop && (
                  <View style={styles.dropdown}>
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 180 }}>
                      {Array.from({ length: 80 }, (_, i) => String(new Date().getFullYear() - 18 - i)).map((y, idx) => (
                        <TouchableOpacity key={y} style={[styles.dropItem, { backgroundColor: dobYear === y ? '#e8eeff' : idx % 2 === 0 ? '#fdf3dc' : '#fff8f0' }]} onPress={() => { setDobYear(y); setShowYearDrop(false) }}>
                          <Text style={[styles.dropItemText, dobYear === y && styles.dropItemTextSelected]}>{y}</Text>
                          {dobYear === y && <MaterialIcons name="check" size={14} color="#405e98" />}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            {/* Gender */}
            <Text style={styles.label}>GENDER</Text>
            <TouchableOpacity style={styles.inputWrap} onPress={() => setShowGenderDrop(!showGenderDrop)}>
              <MaterialIcons name="person-outline" size={20} color="#897268" style={styles.inputIcon} />
              <Text style={[styles.input, { paddingVertical: 13, color: gender ? '#201b0e' : '#b0978a' }]}>
                {gender || 'Select gender'}
              </Text>
              <MaterialIcons name="keyboard-arrow-down" size={22} color="#897268" />
            </TouchableOpacity>
            {showGenderDrop && (
              <View style={[styles.dropdown, { marginTop: -10, marginBottom: 16 }]}>
                {[
                  { label: 'Male', icon: 'male' },
                  { label: 'Female', icon: 'female' },
                  { label: 'Other', icon: 'transgender' },
                ].map((g) => (
                  <TouchableOpacity
                    key={g.label}
                    style={[styles.dropItem, { backgroundColor: gender === g.label ? '#e8eeff' : g.label === 'Male' ? '#fdf3dc' : g.label === 'Female' ? '#fff8f0' : '#f7edd7' }]}
                    onPress={() => { setGender(g.label); setShowGenderDrop(false) }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <MaterialIcons name={g.icon as any} size={18} color={gender === g.label ? '#405e98' : '#55433a'} />
                      <Text style={[styles.dropItemText, gender === g.label && styles.dropItemTextSelected]}>{g.label}</Text>
                    </View>
                    {gender === g.label && <MaterialIcons name="check" size={16} color="#405e98" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Submit */}
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSignup} disabled={loading}>
              {loading
                ? <ActivityIndicator color="white" />
                : <>
                    <Text style={styles.primaryText}>Create account</Text>
                    <MaterialIcons name="arrow-forward" size={20} color="white" style={{ marginLeft: 8 }} />
                  </>
              }
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google */}
            <TouchableOpacity style={styles.googleBtn}>
              <MaterialIcons name="language" size={20} color="#555" />
              <Text style={styles.googleText}>Continue with Google</Text>
            </TouchableOpacity>

            {/* Switch */}
            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginTop: 24 }}>
              <Text style={styles.switchText}>
                Already have an account? <Text style={styles.switchLink}>Log in</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <MaterialIcons name="forum" size={16} color="#897268" />
            <Text style={styles.footerText}>© 2024 Let's Talk. All rights reserved.</Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E9DFC9' },
  scroll: { padding: 24, paddingBottom: 48 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 20 },
  backText: { color: '#813400', fontWeight: '600', fontSize: 16 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 },
  brandName: { fontSize: 22, fontWeight: '800', color: '#813400', letterSpacing: -0.3 },
  card: { backgroundColor: 'rgba(253,243,220,0.88)', borderRadius: 24, padding: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
  title: { fontSize: 26, fontWeight: '700', color: '#201b0e', marginBottom: 6, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: '#55433a', lineHeight: 21, marginBottom: 24 },
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffdad6', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#ffb4ab' },
  errorText: { color: '#93000a', fontSize: 13, flex: 1 },
  label: { fontSize: 11, fontWeight: '500', color: '#897268', letterSpacing: 0.8, marginBottom: 6, marginLeft: 2 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fdf3dc', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(220,193,181,0.6)', marginBottom: 16, paddingHorizontal: 14, overflow: 'hidden' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 13, fontSize: 15, color: '#201b0e' },
  eyeBtn: { padding: 4 },
  strengthBg: { height: 4, backgroundColor: '#ece2cc', borderRadius: 4, marginTop: -10, marginBottom: 6, overflow: 'hidden' },
  strengthFill: { height: '100%', borderRadius: 4 },
  hint: { fontSize: 11, color: '#897268', marginBottom: 16, marginLeft: 2 },
  primaryBtn: { backgroundColor: '#405e98', borderRadius: 50, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, shadowColor: '#405e98', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  primaryText: { color: 'white', fontWeight: '700', fontSize: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(220,193,181,0.5)' },
  dividerText: { fontSize: 11, fontWeight: '500', color: '#897268', letterSpacing: 0.8 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 14, paddingVertical: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' },
  googleText: { fontSize: 15, color: '#201b0e', fontWeight: '500' },
  switchText: { textAlign: 'center', color: '#55433a', fontSize: 13 },
  switchLink: { fontWeight: '700', color: '#813400' },
  dobRow: { flexDirection: 'row', gap: 8, marginBottom: 0 },
  dropText: { flex: 1, paddingVertical: 13, fontSize: 14, overflow: 'hidden' },
  dropdown: { borderRadius: 14, borderWidth: 1, borderColor: 'rgba(220,193,181,0.6)', marginBottom: 16, overflow: 'hidden', shadowColor: '#405e98', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 6, zIndex: 999 },
  dropItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(220,193,181,0.2)', backgroundColor: '#fdf3dc' },
  dropItemSelected: { backgroundColor: '#e8eeff' },
  dropItemText: { fontSize: 14, color: '#201b0e' },
  dropItemTextSelected: { color: '#405e98', fontWeight: '600' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 32 },
  footerText: { fontSize: 12, color: '#897268' },
})
