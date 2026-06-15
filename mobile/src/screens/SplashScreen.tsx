import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const { width, height } = Dimensions.get('window')

export default function SplashScreen({ onComplete, duration = 3000 }) {
  const [isVisible, setIsVisible] = useState(true)
  const embersAnim = React.useRef(new Animated.Value(0)).current
  const logoScale = React.useRef(new Animated.Value(0.8)).current

  useEffect(() => {
    Animated.sequence([
      Animated.timing(logoScale, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(logoScale, { toValue: 1.05, duration: 600, useNativeDriver: true }),
    ]).start()

    Animated.loop(Animated.timing(embersAnim, { toValue: 1, duration: 8000, useNativeDriver: true })).start()

    const timer = setTimeout(() => {
      setIsVisible(false)
      if (onComplete) onComplete()
    }, duration)

    return () => clearTimeout(timer)
  }, [])

  if (!isVisible) return null

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.bgContainer}>
        <View style={[styles.bgGradient, { backgroundColor: '#121414' }]} />
        <View style={[styles.bgGradient, { backgroundColor: '#D84315', opacity: 0.85 }]} />
      </View>

      <View style={styles.embersContainer}>
        {[...Array(15)].map((_, i) => (
          <Animated.View key={i} style={[styles.ember, { left: `${Math.random() * 100}%`, opacity: embersAnim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.8, 0.8, 0] }), transform: [{ translateY: embersAnim.interpolate({ inputRange: [0, 1], outputRange: [height, -height] }) }] }]} />
        ))}
      </View>

      <View style={styles.content}>
        <Animated.View style={[styles.logoCircle, { transform: [{ scale: logoScale }] }]}>
          <Text style={styles.logoIcon}>💬</Text>
        </Animated.View>
        <Text style={styles.title}>LET'S TALK</Text>
        <Text style={styles.subtitle}>Initializing...</Text>
        <View style={styles.loader}>
          <Animated.View style={[styles.loaderDot, { opacity: embersAnim.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: [0.3, 1, 0.3, 0.3] }) }]} />
          <Animated.View style={[styles.loaderDot, { opacity: embersAnim.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: [0.3, 0.3, 1, 0.3] }) }]} />
          <Animated.View style={[styles.loaderDot, { opacity: embersAnim.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: [0.3, 0.3, 0.3, 1] }) }]} />
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121414', justifyContent: 'center', alignItems: 'center' },
  bgContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  bgGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  embersContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  ember: { position: 'absolute', width: 2, height: 2, backgroundColor: '#ff525f', borderRadius: 1 },
  content: { zIndex: 10, alignItems: 'center', justifyContent: 'center' },
  logoCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255, 82, 95, 0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 30, borderWidth: 2, borderColor: '#ff525f' },
  logoIcon: { fontSize: 50 },
  title: { fontSize: 36, fontWeight: '900', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 14, color: 'rgba(255, 255, 255, 0.6)', marginBottom: 40 },
  loader: { flexDirection: 'row', gap: 8 },
  loaderDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff525f' },
})
