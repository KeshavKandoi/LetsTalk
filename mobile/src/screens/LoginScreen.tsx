import { useState, useEffect, useRef } from 'react'
import { useNavigation } from '@react-navigation/native'
import { useNetworkCheck } from '../hooks/useNetworkCheck'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Animated, Dimensions
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
const { width, height } = Dimensions.get('window')

export default function LoginScreen() {
  const navigation = useNavigation<any>()
  const isConnected = useNetworkCheck()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  const embersAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.loop(
      Animated.timing(embersAnim, { toValue: 1, duration: 8000, useNativeDriver: true })
    ).start()
  }, [])

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
    <SafeAreaView style={styles.safeContainer}>
      {!isConnected && (
        <View style={{ backgroundColor: '#b00020', padding: 10, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>No internet connection</Text>
        </View>
      )}

      <View style={styles.bgContainer}>
        <View style={[styles.bgGradient, { backgroundColor: '#121414' }]} />
        <View style={[styles.bgGradient, { backgroundColor: '#D84315', opacity: 0.85 }]} />
      </View>

      <View style={styles.embersContainer}>
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
  style={styles.flex}
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  keyboardVerticalOffset={0}
>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="chevron-left" size={28} color="#ff525f" />
          </TouchableOpacity>

          <View style={styles.headerSection}>
            <Text style={styles.authBadgeText}>AUTHORIZATION REQUIRED</Text>
            <Text style={styles.mainTitle}>Welcome{'\n'}back</Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.formContent}>
            {error && (
              <View style={styles.errorBox}>
                <MaterialIcons name="error-outline" size={16} color="#ff5555" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email</Text>
              <View style={styles.inputContainer}>
                <View style={styles.ghostOffset}>
                  <View style={styles.inputBox}>
                    <MaterialIcons name="alternate-email" size={20} color="#121414" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="identity@gmail.com"
                      placeholderTextColor="#999999"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      editable={!loading}
                      allowFontScaling={false}
                      autoCorrect={false}
                      secureTextEntry={false}
                    />
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.passwordHeader}>
                <Text style={styles.fieldLabel}>Password</Text>
                <TouchableOpacity disabled={!email} onPress={() => navigation.navigate('ForgotPassword', { email })}>
                  <Text style={styles.lostAccessText}>Lost access?</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputContainer}>
                <View style={styles.ghostOffset}>
                  <View style={styles.inputBox}>
                    <MaterialIcons name="lock-open" size={20} color="#121414" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="••••••••"
                      placeholderTextColor="#999999"
                      secureTextEntry={!showPassword}
                      allowFontScaling={false}
                      editable={!loading}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#121414" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.initiateButton, { transform: [{ skewX: '12deg' }] }]}
              onPress={handleLogin}
              disabled={loading || googleLoading}
            >
              <View style={[styles.buttonShade, { position: 'absolute', left: -15, backgroundColor: '#ff525f' }]} />
              {loading ? (
                <ActivityIndicator color="#121414" size="small" />
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonText}>Initiate Session</Text>
                  <MaterialIcons name="arrow-forward-ios" size={18} color="#121414" style={{ marginLeft: 12 }} />
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.dividerLine} />

            <View style={styles.signupSection}>
              <Text style={styles.signupText}>New operative?</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Signup')} disabled={loading}>
                <Text style={styles.createText}>Create Identity</Text>
              </TouchableOpacity>
              <MaterialIcons name="bolt" size={14} color="#00e3fd" style={{ marginLeft: 6 }} />
            </View>

            <TouchableOpacity
              style={[styles.googleButton, { transform: [{ skewX: '12deg' }] }]}
              onPress={handleGoogleLogin}
              disabled={loading || googleLoading || !request}
            >
              
              {googleLoading ? (
                <ActivityIndicator color="#00e3fd" size="small" />
              ) : (
                <View style={styles.googleContent}>
                  <Text style={styles.googleLetter}>G</Text>
                  <Text style={styles.googleText}>Continue with Google</Text>
                </View>
              )}
            </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.accentBars, { transform: [{ skewX: '-12deg' }] }]}>
            <View style={[styles.bar, { width: '20%', backgroundColor: '#ff525f' }]} />
            <View style={[styles.bar, { width: '8%', backgroundColor: '#00e3fd' }]} />
            <View style={[styles.bar, { width: '40%', backgroundColor: 'rgba(255,255,255,0.08)' }]} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.bottomStatus}>
        <Text style={styles.statusText}>UPLINK: ACTIVE [99.2%]</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: '#121414', overflow: 'hidden' },
  bgContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 },
  bgGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  embersContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 },
  ember: { position: 'absolute', width: 2, height: 2, backgroundColor: '#ff525f', borderRadius: 1 },
  topLeftHUD: { position: 'absolute', top: 32, left: 16, zIndex: 10 },
  hudText: { fontSize: 10, color: 'rgba(0, 227, 253, 0.6)', fontWeight: '600', letterSpacing: 0.5, fontFamily: 'monospace', marginBottom: 4 },
  flex: { flex: 1, zIndex: 5 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 20 },
  backButton: { position: 'absolute', top: 16, left: 16, width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start', zIndex: 20, marginBottom: 0 },
  headerSection: { marginBottom: 40, paddingTop: 8, paddingLeft: 12, position: 'relative', zIndex: 100 },

  authBadgeText: { fontSize: 12, fontWeight: '900', color: '#ff525f', letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 12 },
  mainTitle: { fontSize: 56, fontWeight: '900', color: '#e2e2e2', letterSpacing: -2, textTransform: 'uppercase', lineHeight: 60, fontStyle: 'italic', marginBottom: -35, zIndex: 200 },
  formCard: { backgroundColor: 'rgba(18, 20, 20, 0.85)', borderWidth: 1, marginTop: -30, zIndex: 1, borderColor: 'rgba(255, 179, 179, 0.15)', padding: 28, marginBottom: 28, transform: [{ rotateZ: '-4deg' },{ translateX: -8 }] },
  formContent: {
  transform: [{ rotateZ: '4deg' }],
},
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255, 82, 95, 0.12)', borderLeftWidth: 4, borderLeftColor: '#ff525f', padding: 12, marginBottom: 28 },
  errorText: { fontSize: 12, color: '#ff9999', fontWeight: '600', flex: 1, textTransform: 'uppercase' },
  fieldGroup: { marginBottom: 24 },
  fieldLabel: { fontSize: 11, fontWeight: '800', color: '#ae8787', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  passwordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  lostAccessText: { fontSize: 10, fontWeight: '700', color: '#ff525f', letterSpacing: 1, textTransform: 'uppercase' },
  inputContainer: { marginBottom: 0 },
  ghostOffset: { position: 'relative' },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e2e2e2', paddingHorizontal: 12, paddingVertical: 12, height: 52, justifyContent: 'flex-start', width: '100%' },
  inputIcon: { marginRight: 10, marginLeft: 4 },
  input: {
  flex: 1,
  fontSize: 15,
  color: '#121414',
  fontWeight: '500',
  letterSpacing: 0.3,
  paddingVertical: 0,
  paddingHorizontal: 8,
  margin: 0,
  includeFontPadding: false,
  textAlignVertical: 'center',
},
  eyeButton: { padding: 6 },
  initiateButton: { backgroundColor: '#e2e2e2', paddingVertical: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24, position: 'relative', overflow: 'visible' },
  buttonShade: { top: 0, height: '100%', width: 12, zIndex: -1 },
  buttonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#121414', fontWeight: '900', fontSize: 15, letterSpacing: 1.2, textTransform: 'uppercase' },
  dividerLine: { height: 1, backgroundColor: 'rgba(255, 255, 255, 0.12)', marginVertical: 20 },
  signupSection: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  signupText: { fontSize: 12, color: '#ae8787', fontWeight: '600', textTransform: 'uppercase' },
  createText: { fontSize: 12, fontWeight: '800', color: '#00e3fd', letterSpacing: 0.6, textTransform: 'uppercase', marginLeft: 4 },
  googleButton: { borderWidth: 2, borderColor: '#00e3fd', backgroundColor: 'transparent', paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  googleContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  googleLetter: { fontSize: 16, fontWeight: '900', color: '#00e3fd' },
  googleText: { fontSize: 13, fontWeight: '700', color: '#00e3fd', letterSpacing: 0.6, textTransform: 'uppercase' },
  accentBars: { flexDirection: 'row', gap: 8 },
  bar: { height: 3, borderRadius: 1.5 },
  bottomStatus: { position: 'absolute', bottom: 20, right: 20, zIndex: 10 },
  statusText: { fontSize: 10, color: '#ff525f', fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'monospace' },
})
