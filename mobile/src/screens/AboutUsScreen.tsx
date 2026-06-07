import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation } from '@react-navigation/native'
import { MaterialIcons } from '@expo/vector-icons'

const { width, height } = Dimensions.get('window')
const WHITE = '#FFFFFF'
const MUTED = 'rgba(255,255,255,0.6)'
const CARD = 'rgba(255,255,255,0.08)'

const TERMS = `Terms of Service\n\nLast updated: May 30, 2026\n\n1. Acceptance of Terms\nBy using LetsTalk, you agree to these Terms of Service. If you do not agree, please do not use the app.\n\n2. Description of Service\nLetsTalk is a location-based app that helps people connect and have real conversations at physical places around them.\n\n3. User Accounts\nYou must provide accurate information when creating an account. You are responsible for maintaining the security of your account and password. You must be at least 13 years old to use this service.\n\n4. User Conduct\nYou agree not to:\n- Harass, abuse, or harm other users\n- Use the app for any illegal purpose\n- Share false or misleading information\n- Attempt to gain unauthorized access to the service\n\n5. Privacy\nYour use of LetsTalk is also governed by our Privacy Policy.\n\n6. Termination\nWe reserve the right to suspend or terminate your account at any time for violation of these Terms.\n\n7. Disclaimer\nLetsTalk is provided "as is" without warranties of any kind.\n\n8. Contact\nFor questions, contact us at support@letstalk.app`

const PRIVACY = `Privacy Policy\n\nLast updated: May 30, 2026\n\n1. Information We Collect\n- Account information: email, username, password (encrypted)\n- Profile information: mood, bio, age, gender (optional)\n- Location data: only the place you check into, not your GPS location\n- Usage data: how you interact with the app\n\n2. How We Use Your Information\n- To provide and improve the LetsTalk service\n- To match you with people at the same place\n- To send notifications (only if you enable them)\n- To ensure safety and prevent abuse\n\n3. Information Sharing\nWe do not sell your personal information. We share data only with service providers and when required by law.\n\n4. Data Storage\nYour data is stored securely. Passwords are encrypted and never stored in plain text.\n\n5. Your Rights\nYou can access, edit, or delete your personal data at any time.\n\n6. Contact\nFor privacy concerns, contact us at privacy@letstalk.app`

export default function AboutUsScreen() {
  const navigation = useNavigation<any>()
  const [section, setSection] = useState<'main' | 'terms' | 'privacy'>('main')

  return (
    <View style={s.root}>
      <LinearGradient
        colors={['#1a0000', '#6B1500', '#C4400A', '#E05010', '#8B2000', '#1a0000']}
        locations={[0, 0.15, 0.35, 0.55, 0.8, 1]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Glow effect */}
      <View style={s.glow} />

      <SafeAreaView edges={['top']} style={s.header}>
        <TouchableOpacity
          onPress={() => section === 'main' ? navigation.goBack() : setSection('main')}
          style={s.backBtn}
        >
          <MaterialIcons name="chevron-left" size={28} color={WHITE} />
        </TouchableOpacity>
      </SafeAreaView>

      {section === 'main' && (
        <View style={s.mainContent}>
          {/* Big hero text at bottom like the reference */}
          <View style={s.heroText}>
            <Text style={s.tagSmall}>Real People. Real Places.</Text>
            <Text style={s.heroTitle}>Connect with{'\n'}Clarity &{'\n'}Purpose.</Text>
            <Text style={s.heroSub}>Every conversation should have meaning. LetsTalk brings people together at real places for real conversations.</Text>
          </View>

          {/* Bottom links */}
          <View style={s.bottomLinks}>
            <TouchableOpacity style={s.linkRow} onPress={() => setSection('terms')}>
              <MaterialIcons name="description" size={16} color={MUTED} />
              <Text style={s.linkText}>Terms of Service</Text>
              <MaterialIcons name="chevron-right" size={16} color={MUTED} />
            </TouchableOpacity>
            <View style={s.linkDivider} />
            <TouchableOpacity style={s.linkRow} onPress={() => setSection('privacy')}>
              <MaterialIcons name="lock" size={16} color={MUTED} />
              <Text style={s.linkText}>Privacy Policy</Text>
              <MaterialIcons name="chevron-right" size={16} color={MUTED} />
            </TouchableOpacity>
            <View style={s.linkDivider} />
            <View style={s.linkRow}>
              <MaterialIcons name="email" size={16} color={MUTED} />
              <Text style={s.linkText}>support@letstalk.app</Text>
            </View>
          </View>

          <Text style={s.versionText}>LetsTalk v1.0.0 </Text>
        </View>
      )}

      {(section === 'terms' || section === 'privacy') && (
        <ScrollView contentContainerStyle={s.legalScroll} showsVerticalScrollIndicator={false}>
          <Text style={s.legalTitle}>{section === 'terms' ? 'Terms of Service' : 'Privacy Policy'}</Text>
          <View style={s.legalCard}>
            <Text style={s.legalText}>{section === 'terms' ? TERMS : PRIVACY}</Text>
          </View>
        </ScrollView>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a0000' },
  glow: {
    position: 'absolute',
    top: height * 0.15,
    left: width * 0.1,
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: '#E05010',
    opacity: 0.35,
    transform: [{ scaleY: 1.4 }],
  },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  mainContent: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 80,
  },
  heroText: {
    paddingHorizontal: 28,
    marginBottom: 40,
  },
  tagSmall: {
    fontSize: 12, fontWeight: '700', color: MUTED,
    letterSpacing: 2, marginBottom: 12, textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 48, fontWeight: '900', color: WHITE,
    lineHeight: 54, letterSpacing: -1, marginBottom: 20,
  },
  heroSub: {
    fontSize: 14, color: MUTED, lineHeight: 22, maxWidth: 300,
  },
  bottomLinks: {
    marginHorizontal: 20,
    backgroundColor: CARD,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    marginBottom: 20,
  },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16,
  },
  linkText: { flex: 1, fontSize: 14, fontWeight: '600', color: WHITE },
  linkDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 16 },
  versionText: { textAlign: 'center', color: MUTED, fontSize: 12, marginTop: 8, paddingBottom: 20 },

  legalScroll: { padding: 20, paddingBottom: 60 },
  legalTitle: { fontSize: 28, fontWeight: '900', color: WHITE, marginBottom: 20 },
  legalCard: {
    backgroundColor: CARD, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  legalText: { fontSize: 14, color: WHITE, lineHeight: 24 },
})
