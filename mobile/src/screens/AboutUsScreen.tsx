import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Dimensions, Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { MaterialIcons } from '@expo/vector-icons'

const { width, height } = Dimensions.get('window')
const WHITE = '#ffffff'
const MUTED = 'rgba(255,255,255,0.6)'
const CARD = 'rgba(20,12,6,0.9)'

export default function AboutUsScreen() {
  const navigation = useNavigation<any>()

  return (
    <View style={s.root}>


      <SafeAreaView edges={['top']} style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.backBtn}
        >
          <MaterialIcons name="chevron-left" size={28} color="#ffffff" />
        </TouchableOpacity>
      </SafeAreaView>

      <View style={s.mainContent}>
          {/* Big hero text at bottom like the reference */}
          <View style={s.heroText}>
            <Text style={s.tagSmall}>Real People. Real Places.</Text>
            <Text style={s.heroTitle}>Connect with{'\n'}Clarity &{'\n'}Purpose.</Text>
            <Text style={s.heroSub}>Every conversation should have meaning. LetsTalk brings people together at real places for real conversations.</Text>
          </View>

          {/* Bottom links */}
          <View style={s.bottomLinks}>
            <TouchableOpacity style={s.linkRow} onPress={() => Linking.openURL('https://policy-2epo.onrender.com/Terms_condition.html')}>
              <MaterialIcons name="description" size={16} color={MUTED} />
              <Text style={s.linkText}>Terms of Service</Text>
              <MaterialIcons name="chevron-right" size={16} color={MUTED} />
            </TouchableOpacity>
            <View style={s.linkDivider} />
            <TouchableOpacity style={s.linkRow} onPress={() => Linking.openURL('https://policy-2epo.onrender.com/Privacy_policy.html')}>
              <MaterialIcons name="lock" size={16} color={MUTED} />
              <Text style={s.linkText}>Privacy Policy</Text>
              <MaterialIcons name="chevron-right" size={16} color={MUTED} />
            </TouchableOpacity>
            <View style={s.linkDivider} />
            <View style={s.linkRow}>
              <MaterialIcons name="email" size={16} color={MUTED} />
              <Text style={s.linkText}>letstalks.support@gmail.com</Text>
            </View>
          </View>

          <Text style={s.versionText}>LetsTalk v1.0.0 </Text>
        </View>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0704' },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
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
    lineHeight: 54, letterSpacing: -1, marginBottom: 28,
  },
  heroSub: {
    fontSize: 14, color: MUTED, lineHeight: 22, maxWidth: 300,
  },
  bottomLinks: {
    marginHorizontal: 20,
    backgroundColor: CARD,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
    overflow: 'hidden',
    marginBottom: 20,
  },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16,
  },
  linkText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#fff' },
  linkDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 16 },
  versionText: { textAlign: 'center', color: MUTED, fontSize: 12, marginTop: 8, paddingBottom: 20 },

  legalScroll: { padding: 20, paddingBottom: 60 },
  legalTitle: { fontSize: 28, fontWeight: '900', color: WHITE, marginBottom: 20 },
  legalCard: {
    backgroundColor: CARD, borderRadius: 20, padding: 20,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)',
  },
  legalText: { fontSize: 14, color: '#fff', lineHeight: 24 },
})
