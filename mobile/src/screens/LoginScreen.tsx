import { useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import { useNetworkCheck } from '../hooks/useNetworkCheck'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons, Ionicons } from '@expo/vector-icons'
import * as WebBrowser from 'expo-web-browser'
import * as Google from 'expo-auth-session/providers/google'
import { signIn } from '../lib/auth'
import AsyncStorage from '@react-native-async-storage/async-storage'

WebBrowser.maybeCompleteAuthSession()

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.29.59:3000'
const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || ''
const WEB_CLIENT_ID = '70674819769-vu8ecco5ri04c4ob9b64jnn64eujrnpk.apps.googleusercontent.com'

export default function LoginScreen() {
  const navigation = useNavigation<any>()
  const isConnected = useNetworkCheck()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: ANDROID_CLIENT_ID,
    webClientId: WEB_CLIENT_ID,
  })

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setError('')
    try {
      const result = await promptAsync()
      if (result?.type === 'success') {
        const { authentication } = result
        const res = await fetch(`${BASE_URL}/api/auth/sign-in/social`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL },
          body: JSON.stringify({
            provider: 'google',
            idToken: authentication?.idToken,
            accessToken: authentication?.accessToken,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || 'Google login failed')
        if (data.token) await AsyncStorage.setItem('session_token', data.token)
        navigation.navigate('Landing')
      }
    } catch (e: any) {
      setError(e.message || 'Google login failed')
    } finally {
      setGoogleLoading(false)
    }
  }

  const doLogin = async () => {
    setLoading(true)
    setError('')
    try {
      await signIn(email, password)
      navigation.navigate('Landing')
    } catch (e: any) {
      setError(e.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    if (!isConnected) { setError('No internet connection. Please check your network.'); return }
    if (!email || !password) { setError('Please fill in all fields'); return }
    try {
      const res = await fetch(`${BASE_URL}/api/auth/check-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const { hasSession } = await res.json()
      if (hasSession) {
        Alert.alert(
          'Already Logged In',
          'This account is already logged in on another device. Logging in here will log out the other device.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log In Here', style: 'destructive', onPress: doLogin },
          ]
        )
      } else {
        await doLogin()
      }
    } catch {
      await doLogin()
    }
  }

  return (
    <SafeAreaView style={styles.safeContainer}>
      {!isConnected && (
        <View style={{ backgroundColor: '#b00020', padding: 10, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>No internet connection</Text>
        </View>
      )}
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
            <Text style={styles.label}>EMAIL</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="email" size={20} color="#897268" style={styles.inputIcon} />
              <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#b0978a" autoCapitalize="none" keyboardType="email-address" editable={!loading} />
            </View>
            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="lock-outline" size={20} color="#897268" style={styles.inputIcon} />
              <TextInput style={[styles.input, { paddingRight: 8 }]} value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor="#b0978a" secureTextEntry={!showPassword} editable={!loading} />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#897268" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.forgotBtn, !email && { opacity: 0.4 }]} disabled={!email} onPress={() => navigation.navigate('ForgotPassword', { email })}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin} disabled={loading || googleLoading}>
              {loading ? <ActivityIndicator color="white" /> : <><Text style={styles.primaryText}>Log in</Text><MaterialIcons name="arrow-forward" size={20} color="white" style={{ marginLeft: 8 }} /></>}
            </TouchableOpacity>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>
            <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleLogin} disabled={loading || googleLoading || !request}>
              {googleLoading
                ? <ActivityIndicator color="#4285F4" size="small" />
                : <><Text style={styles.googleIcon}>G</Text><Text style={styles.googleText}>Continue with Google</Text></>
              }
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')} style={{ marginTop: 20 }} disabled={loading}>
              <Text style={styles.switchText}>Don't have an account? <Text style={styles.switchLink}>Sign up</Text></Text>
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
  errorText: { fontSize: 13, color: '#93000a', fontWeight: '500', flex: 1 },
  label: { fontSize: 11, fontWeight: '600', color: '#897268', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbf3', borderWidth: 1, borderColor: '#dcc9b6', borderRadius: 12, paddingHorizontal: 12, marginBottom: 20, height: 48 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 13, fontSize: 15, color: '#201b0e' },
  eyeBtn: { padding: 4 },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 24, marginTop: -8 },
  forgotText: { fontSize: 13, color: '#813400', fontWeight: '600' },
  primaryBtn: { backgroundColor: '#405e98', borderRadius: 50, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#405e98', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  primaryText: { color: 'white', fontWeight: '700', fontSize: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#dcc9b6' },
  dividerText: { fontSize: 12, color: '#897268', fontWeight: '600' },
  googleBtn: { borderWidth: 1.5, borderColor: '#dcc9b6', borderRadius: 12, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fffbf3' },
  googleIcon: { fontSize: 18, fontWeight: '700', color: '#4285F4' },
  googleText: { fontSize: 15, color: '#201b0e', fontWeight: '600' },
  switchText: { fontSize: 14, color: '#55433a', textAlign: 'center' },
  switchLink: { color: '#813400', fontWeight: '700' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 32 },
  footerText: { fontSize: 11, color: '#897268' },
})
