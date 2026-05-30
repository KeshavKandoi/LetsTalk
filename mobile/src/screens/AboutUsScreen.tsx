import { useState } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'

const G = '#005129'
const DARK = '#002111'
const MID = '#006d36'

const TERMS = `Terms of Service

Last updated: May 30, 2026

1. Acceptance of Terms
By using LetsTalk, you agree to these Terms of Service. If you do not agree, please do not use the app.

2. Description of Service
LetsTalk is a location-based app that helps people connect and have real conversations at physical places around them.

3. User Accounts
You must provide accurate information when creating an account. You are responsible for maintaining the security of your account and password. You must be at least 13 years old to use this service.

4. User Conduct
You agree not to:
- Harass, abuse, or harm other users
- Use the app for any illegal purpose
- Share false or misleading information
- Attempt to gain unauthorized access to the service

5. Privacy
Your use of LetsTalk is also governed by our Privacy Policy, which is incorporated into these Terms.

6. Termination
We reserve the right to suspend or terminate your account at any time for violation of these Terms.

7. Disclaimer
LetsTalk is provided "as is" without warranties of any kind. We are not responsible for any harm resulting from your use of the app.

8. Changes to Terms
We may update these Terms at any time. Continued use of the app constitutes acceptance of the new Terms.

9. Contact
For questions about these Terms, contact us at support@letstalk.app`

const PRIVACY = `Privacy Policy

Last updated: May 30, 2026

1. Information We Collect
- Account information: email, username, password (encrypted)
- Profile information: mood, bio, age, gender (optional)
- Location data: only the place you check into, not your GPS location
- Usage data: how you interact with the app

2. How We Use Your Information
- To provide and improve the LetsTalk service
- To match you with people at the same place
- To send notifications (only if you enable them)
- To ensure safety and prevent abuse

3. Information Sharing
We do not sell your personal information. We share data only:
- With other users as part of the app's core functionality
- With service providers who help us run the app (e.g. Supabase for database)
- When required by law

4. Data Storage
Your data is stored securely on Supabase servers. Passwords are encrypted and never stored in plain text.

5. Your Rights
You can:
- Access your personal data at any time
- Edit or update your profile
- Delete your account and all associated data
- Opt out of notifications

6. Profile Visibility
Your username, mood, and bio are visible to other users at the same place. Your email is never shown publicly.

7. Children's Privacy
LetsTalk is not intended for children under 13. We do not knowingly collect data from children under 13.

8. Changes to This Policy
We may update this Privacy Policy from time to time. We will notify you of significant changes.

9. Contact
For privacy concerns, contact us at privacy@letstalk.app`

export default function AboutUsScreen() {
  const navigation = useNavigation<any>()
  const [section, setSection] = useState<'main' | 'terms' | 'privacy'>('main')

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => section === 'main' ? navigation.goBack() : setSection('main')}
          style={s.backBtn}
        >
          <Text style={s.backTxt}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>
          {section === 'main' ? 'About Us' : section === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      {section === 'main' && (
        <ScrollView contentContainerStyle={s.scroll}>

          {/* App info */}
          <View style={s.heroCard}>
            <Text style={s.appIcon}>💬</Text>
            <Text style={s.appName}>LetsTalk</Text>
            <Text style={s.appVersion}>Version 1.0.0</Text>
            <Text style={s.appTagline}>Connecting people through real conversations at real places.</Text>
          </View>

          {/* Legal links */}
          <Text style={s.sectionLabel}>LEGAL</Text>
          <View style={s.card}>
            <TouchableOpacity style={s.row} onPress={() => setSection('terms')}>
              <View style={s.rowLeft}>
                <Text style={s.rowIcon}>📄</Text>
                <View>
                  <Text style={s.rowTitle}>Terms of Service</Text>
                  <Text style={s.rowSub}>Rules and guidelines for using LetsTalk</Text>
                </View>
              </View>
              <Text style={s.arrow}>›</Text>
            </TouchableOpacity>

            <View style={s.divider} />

            <TouchableOpacity style={s.row} onPress={() => setSection('privacy')}>
              <View style={s.rowLeft}>
                <Text style={s.rowIcon}>🔒</Text>
                <View>
                  <Text style={s.rowTitle}>Privacy Policy</Text>
                  <Text style={s.rowSub}>How we handle your data</Text>
                </View>
              </View>
              <Text style={s.arrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Contact */}
          <Text style={s.sectionLabel}>CONTACT</Text>
          <View style={s.card}>
            <View style={s.row}>
              <View style={s.rowLeft}>
                <Text style={s.rowIcon}>✉️</Text>
                <View>
                  <Text style={s.rowTitle}>support@letstalk.app</Text>
                  <Text style={s.rowSub}>Get help or send feedback</Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={s.footer}>Made with ❤️ by the LetsTalk team</Text>
        </ScrollView>
      )}

      {(section === 'terms' || section === 'privacy') && (
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.legalCard}>
            <Text style={s.legalText}>{section === 'terms' ? TERMS : PRIVACY}</Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e9ffed' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(191,201,190,0.3)' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: G },
  backBtn: { width: 60 },
  backTxt: { color: G, fontWeight: '700', fontSize: 15 },
  scroll: { padding: 20, paddingBottom: 48 },
  heroCard: { backgroundColor: 'white', borderRadius: 24, padding: 28, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(191,201,190,0.3)' },
  appIcon: { fontSize: 48, marginBottom: 8 },
  appName: { fontSize: 28, fontWeight: '900', color: G, marginBottom: 4 },
  appVersion: { fontSize: 13, color: MID, marginBottom: 12 },
  appTagline: { fontSize: 14, color: DARK, textAlign: 'center', lineHeight: 22, opacity: 0.7 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: MID, letterSpacing: 1.5, marginBottom: 10, marginLeft: 4 },
  card: { backgroundColor: 'white', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(191,201,190,0.3)', overflow: 'hidden', marginBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  rowIcon: { fontSize: 22 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: DARK },
  rowSub: { fontSize: 12, color: MID, marginTop: 2 },
  arrow: { fontSize: 22, color: MID },
  divider: { height: 1, backgroundColor: 'rgba(191,201,190,0.4)', marginHorizontal: 18 },
  footer: { textAlign: 'center', color: MID, fontSize: 13, marginTop: 8, opacity: 0.7 },
  legalCard: { backgroundColor: 'white', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(191,201,190,0.3)' },
  legalText: { fontSize: 14, color: DARK, lineHeight: 24 },
})
