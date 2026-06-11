import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation } from '@react-navigation/native'
import { MaterialIcons } from '@expo/vector-icons'

export default function NotificationsScreen() {
  const navigation = useNavigation<any>()
  return (
    <View style={s.root}>
      <LinearGradient
        colors={['#1a0000', '#6B1500', '#C4400A', '#E05010', '#8B2000', '#1a0000']}
        locations={[0, 0.15, 0.35, 0.55, 0.8, 1]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <MaterialIcons name="chevron-left" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={s.title}>Notifications</Text>
          <View style={{ width: 36 }} />
        </View>
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={s.emptyContainer}>
            <MaterialIcons name="notifications-none" size={64} color="rgba(255,255,255,0.2)" />
            <Text style={s.emptyTitle}>No notifications yet</Text>
            <Text style={s.emptySub}>When you get notifications, they'll show up here.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#fff' },
  content: { flexGrow: 1, padding: 20 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 120 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.6)', marginTop: 16 },
  emptySub: { fontSize: 14, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 8, lineHeight: 20 },
})
