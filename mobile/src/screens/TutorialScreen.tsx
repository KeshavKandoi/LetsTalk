import { useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { useNavigation } from '@react-navigation/native'
import { Feather, MaterialIcons } from '@expo/vector-icons'
import { getSession, markOnboardingCompleted } from '../lib/auth'

const { width } = Dimensions.get('window')

const CARDS = [
  {
    key: 'meet',
    icon: <Feather name="users" size={40} color="#8B5CF6" />,
    accent: '#8B5CF6',
    title: 'Meet new people',
    desc: 'Let\'s Talk helps you discover and make new friends through real, in-person interactions.',
  },
  {
    key: 'nearby',
    icon: <Feather name="map-pin" size={40} color="#e8824a" />,
    accent: '#e8824a',
    title: "See who's nearby",
    desc: 'Find people and places around you who are ready to talk right now.',
  },
  {
    key: 'qr',
    icon: <MaterialIcons name="qr-code-scanner" size={40} color="#3dbf7a" />,
    accent: '#3dbf7a',
    title: 'Connect with a scan',
    desc: "When you meet someone, scan each other's QR code to send a connection request instantly.",
  },
  {
    key: 'chat',
    icon: <Feather name="message-circle" size={40} color="#5b8dee" />,
    accent: '#5b8dee',
    title: 'Start talking',
    desc: "Once you're connected, jump into a conversation right inside the app.",
  },
]

export default function TutorialScreen() {
  const navigation = useNavigation<any>()
  const listRef = useRef<FlatList>(null)
  const [index, setIndex] = useState(0)

  const goToIndex = (i: number) => {
    listRef.current?.scrollToOffset({ offset: i * width, animated: true })
    setIndex(i)
  }

  const handleGetStarted = async () => {
    try {
      const session = await getSession()
      const email = session?.user?.email
      if (email) await markOnboardingCompleted(email)
    } catch {}
    navigation.reset({ index: 0, routes: [{ name: 'Landing' }] })
  }

  const onMomentumScrollEnd = (e: any) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / width)
    setIndex(newIndex)
  }

  const isLast = index === CARDS.length - 1

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      <FlatList
        ref={listRef}
        data={CARDS}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        renderItem={({ item }) => (
          <View style={[s.card, { width }]}>
            <View style={[s.iconCircle, { backgroundColor: item.accent + '22', borderColor: item.accent + '55' }]}>
              {item.icon}
            </View>
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.desc}>{item.desc}</Text>
          </View>
        )}
      />

      <View style={s.dotsRow}>
        {CARDS.map((c, i) => (
          <View
            key={c.key}
            style={[s.dot, i === index && [s.dotActive, { backgroundColor: c.accent }]]}
          />
        ))}
      </View>

      <TouchableOpacity
        style={s.nextBtn}
        activeOpacity={0.85}
        onPress={() => (isLast ? handleGetStarted() : goToIndex(index + 1))}
      >
        <Text style={s.nextBtnText}>{isLast ? 'Get Started' : 'Next'}</Text>
        {!isLast && <Feather name="arrow-right" size={18} color="#fff" style={{ marginLeft: 8 }} />}
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  card: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  iconCircle: {
    width: 96, height: 96, borderRadius: 48, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginBottom: 28,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 12 },
  desc: { fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 21 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 24 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotActive: { width: 22 },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#8B5CF6', height: 54, borderRadius: 999,
    marginHorizontal: 24, marginBottom: 12,
  },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
