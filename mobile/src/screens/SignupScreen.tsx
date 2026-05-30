import { useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native'
import { signUp, signIn } from '../lib/auth'

export default function SignupScreen() {
  const navigation = useNavigation<any>()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSignup = async () => {
    if (!email || !username || !password) { setError('Please fill in all fields'); return }
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
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Create a pseudonym-first account, then check live nearby places.</Text>
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        <Text style={styles.hint}>Required for account recovery. Never shown in the app.</Text>
        <Text style={styles.label}>Pseudonym</Text>
        <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder="letstalk" autoCapitalize="none" autoCorrect={false} />
        <Text style={styles.label}>Password</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Create a strong password" secureTextEntry />
        <TouchableOpacity style={styles.primaryBtn} onPress={handleSignup} disabled={loading}>
          {loading ? <ActivityIndicator color="white" /> : <Text style={styles.primaryText}>Create account</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.switchText}>Already have an account? <Text style={styles.switchLink}>Log in</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#d4f5d4' },
  scroll: { padding: 24 },
  backBtn: { marginTop: 10, marginBottom: 24 },
  backText: { color: '#1a6b3c', fontWeight: '600', fontSize: 16 },
  title: { fontSize: 32, fontWeight: '900', color: '#0f3320', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#2d6e3e', lineHeight: 22, marginBottom: 28 },
  label: { fontSize: 14, fontWeight: '600', color: '#2d6e3e', marginBottom: 8 },
  hint: { fontSize: 12, color: '#2d6e3e', marginBottom: 16, marginTop: -8 },
  input: { backgroundColor: 'white', borderRadius: 16, padding: 14, fontSize: 16, borderWidth: 1, borderColor: 'rgba(144,212,144,0.6)', marginBottom: 16, color: '#0f3320' },
  errorBox: { backgroundColor: '#fee2e2', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#fca5a5' },
  errorText: { color: '#dc2626', fontSize: 14 },
  primaryBtn: { backgroundColor: '#1a6b3c', borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 20 },
  primaryText: { color: 'white', fontWeight: '700', fontSize: 17 },
  switchText: { textAlign: 'center', color: '#2d6e3e', fontSize: 14 },
  switchLink: { fontWeight: '700', color: '#1a6b3c' },
})
