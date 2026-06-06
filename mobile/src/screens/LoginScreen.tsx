import { useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons, Ionicons } from '@expo/vector-icons'
import { signIn } from '../lib/auth'

export default function LoginScreen() {
  const navigation = useNavigation<any>()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    if (!username || !password) { setError('Please fill in all fields'); return }
    setLoading(true)
    setError('')
    try {
      await signIn(username, password)
      navigation.navigate('Onboarding')
    } catch (e: any) {
      setError(e.message || 'Login failed')
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
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to continue connecting with people around you.</Text>

            {error ? (
              <View style={styles.errorBox}>
                <MaterialIcons name="error-outline" size={16} color="#93000a" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>USERNAME</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="person-outline" size={20} color="#897268" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="username"
                placeholderTextColor="#b0978a"
                autoCapitalize="none"
                editable={!loading}
              />
            </View>

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
                editable={!loading}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#897268" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.forgotBtn}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin} disabled={loading}>
              {loading
                ? <ActivityIndicator color="white" />
                : <>
                    <Text style={styles.primaryText}>Log in</Text>
                    <MaterialIcons name="arrow-forward" size={20} color="white" style={{ marginLeft: 8 }} />
                  </>
              }
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

            <TouchableOpacity onPress={() => navigation.navigate('Signup')} style={{ marginTop: 20 }} disabled={loading}>
              <Text style={styles.switchText}>
                Don't have an account? <Text style={styles.switchLink}>Sign up</Text>
              </Text>
            </TouchableOpacity>
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
  errorText: { color: '#93000a', fontSize: 13, flex: 1 },
  label: { fontSize: 11, fontWeight: '500', color: '#897268', letterSpacing: 0.8, marginBottom: 8, marginLeft: 2 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fdf3dc', borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(220,193,181,0.6)', marginBottom: 16, paddingHorizontal: 14 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 13, fontSize: 15, color: '#201b0e' },
  eyeBtn: { padding: 4 },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 24, marginTop: -8 },
  forgotText: { fontSize: 13, color: '#813400', fontWeight: '600' },
  primaryBtn: { backgroundColor: '#405e98', borderRadius: 50, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#405e98', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  primaryText: { color: 'white', fontWeight: '700', fontSize: 16 },
  switchText: { textAlign: 'center', color: '#55433a', fontSize: 13 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(220,193,181,0.5)' },
  dividerText: { fontSize: 11, fontWeight: '500', color: '#897268', letterSpacing: 0.8 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 13, borderWidth: 1.5, borderColor: 'rgba(220,193,181,0.8)' },
  googleIcon: { fontSize: 16, fontWeight: '700', color: '#4285F4' },
  googleText: { fontSize: 15, color: '#201b0e', fontWeight: '500' },
  switchLink: { fontWeight: '700', color: '#813400' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 32 },
  footerText: { fontSize: 12, color: '#897268' },
})
