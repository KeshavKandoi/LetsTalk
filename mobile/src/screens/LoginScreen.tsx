import { useState, useCallback, useRef } from 'react'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { useNetworkCheck } from '../hooks/useNetworkCheck'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Pressable, Keyboard,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { MaterialIcons, Ionicons, Feather } from '@expo/vector-icons'
import * as WebBrowser from 'expo-web-browser'
import * as Google from 'expo-auth-session/providers/google'
import { signIn } from '../lib/auth'
import AsyncStorage from '@react-native-async-storage/async-storage'

WebBrowser.maybeCompleteAuthSession()

const BASE_URL = process.env.EXPO_PUBLIC_API_URL
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

  const emailRef = useRef<TextInput>(null)
  const passwordRef = useRef<TextInput>(null)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)

  const toggleDismiss = (ref: React.RefObject<TextInput>) => {
    ref.current?.blur()
    Keyboard.dismiss()
  }

  useFocusEffect(
    useCallback(() => {
      return () => {
        setEmail('')
        setPassword('')
        setError('')
        setShowPassword(false)
      }
    }, [])
  )

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
        navigation.reset({ index: 0, routes: [{ name: 'Landing' }] })
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
      navigation.reset({ index: 0, routes: [{ name: 'Landing' }] })
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
      const currentToken = await AsyncStorage.getItem('session_token')
      const res = await fetch(`${BASE_URL}/api/auth/check-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, currentToken }),
      })
      const { hasSession } = await res.json()
      if (hasSession) {
        Alert.alert('Already Logged In', 'This account is already logged in on another device. Logging in here will log out the other device.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In Here', style: 'destructive', onPress: doLogin },
        ])
      } else {
        await doLogin()
      }
    } catch {
      await doLogin()
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      {!isConnected && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>No internet connection</Text>
        </View>
      )}

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          <View style={styles.brandBlock}>
            <Feather name="message-circle" size={32} color="#8B5CF6" />
            <Text style={styles.brandName}>Let's Talk</Text>
          </View>

          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Log in to continue</Text>

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
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor="rgba(255,255,255,0.4)"
                autoCapitalize="none"
                keyboardType="email-address"
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
            <View style={[styles.passwordRow, { position: 'relative' }]}>
              <TextInput
                ref={passwordRef}
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor="rgba(255,255,255,0.4)"
                secureTextEntry={!showPassword}
                editable={!loading}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
              {passwordFocused && (
                <Pressable
                  style={[StyleSheet.absoluteFill, { right: 44 }]}
                  onPress={() => toggleDismiss(passwordRef)}
                />
              )}
            </View>
          </View>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={loading || googleLoading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.loginButtonText}>Log in</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            disabled={!email}
            onPress={() => navigation.navigate('ForgotPassword', { email })}
            style={styles.forgotWrap}
          >
            <Text style={styles.forgotText}>Forgotten password?</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleLogin}
            disabled={loading || googleLoading || !request}
            activeOpacity={0.85}
          >
            {googleLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <View style={styles.googleContent}>
                <Text style={styles.googleLetter}>G</Text>
                <Text style={styles.googleText}>Continue with Google</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.signupRow}>
            <Text style={styles.signupText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')} disabled={loading}>
              <Text style={styles.signupLink}>Sign up</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  offlineBanner: { backgroundColor: '#b00020', paddingVertical: 8, alignItems: 'center' },
  offlineText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  flex: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },

  brandBlock: { alignItems: 'center', marginBottom: 36 },
  brandName: { fontSize: 18, fontWeight: '800', color: '#fff', marginTop: 8 },

  title: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.55)', marginBottom: 24 },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,107,107,0.1)', borderRadius: 10, padding: 12, marginBottom: 20 },
  errorText: { color: '#ff9b9b', fontSize: 13, flex: 1 },

  field: { marginBottom: 16 },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#fff',
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingRight: 8 },
  eyeButton: { padding: 8 },

  loginButton: { backgroundColor: '#8B5CF6', height: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  loginButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  forgotWrap: { alignItems: 'center', marginTop: 16, marginBottom: 8 },
  forgotText: { fontSize: 13, color: 'rgba(255,255,255,0.55)' },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  dividerText: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '700', letterSpacing: 1 },

  googleButton: { height: 50, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  googleContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  googleLetter: { fontSize: 15, fontWeight: '900', color: '#fff' },
  googleText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  signupRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  signupText: { fontSize: 13, color: 'rgba(255,255,255,0.55)' },
  signupLink: { fontSize: 13, color: '#8B5CF6', fontWeight: '700' },
})
