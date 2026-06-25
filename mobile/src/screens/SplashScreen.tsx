import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native'

const { width } = Dimensions.get('window')

export default function SplashScreen({ onComplete, duration = 4000 }: any) {
  const leftX = useRef(new Animated.Value(-width / 2)).current
  const rightX = useRef(new Animated.Value(width / 2)).current
  const leftArmRotate = useRef(new Animated.Value(0)).current
  const rightArmRotate = useRef(new Animated.Value(0)).current
  const glowOpacity = useRef(new Animated.Value(0)).current
  const textOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(leftX, { toValue: -40, duration: 1500, useNativeDriver: true }),
        Animated.timing(rightX, { toValue: 40, duration: 1500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(leftArmRotate, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(rightArmRotate, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
      Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start()

    const timer = setTimeout(() => { if (onComplete) onComplete() }, duration)
    return () => clearTimeout(timer)
  }, [])

  const leftArmStyle = {
    transform: [
      { translateX: leftX },
      { rotate: leftArmRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) },
    ],
  }

  const rightArmStyle = {
    transform: [
      { translateX: rightX },
      { rotate: rightArmRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-45deg'] }) },
    ],
  }

  return (
    <View style={styles.container}>
      <View style={styles.scene}>
        {/* Left Figure */}
        <Animated.View style={[styles.figure, leftArmStyle]}>
          <View style={[styles.head, styles.headLeft]} />
          <View style={[styles.body, styles.bodyLeft]} />
          <View style={[styles.arm, styles.armLeft]} />
          <View style={[styles.leg, styles.legLeft]} />
          <View style={[styles.leg, styles.legLeftRight]} />
        </Animated.View>

        {/* Right Figure */}
        <Animated.View style={[styles.figure, rightArmStyle]}>
          <View style={[styles.head, styles.headRight]} />
          <View style={[styles.body, styles.bodyRight]} />
          <View style={[styles.arm, styles.armRight]} />
          <View style={[styles.leg, styles.legRight]} />
          <View style={[styles.leg, styles.legRightRight]} />
        </Animated.View>

        {/* Center Glow */}
        <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />
      </View>

      <Animated.View style={{ opacity: textOpacity }}>
        <Text style={styles.title}>Let's Talk</Text>
        <Text style={styles.subtitle}>Real conversations. Real places.</Text>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a1628', justifyContent: 'center', alignItems: 'center' },
  scene: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 280, marginBottom: 80, position: 'relative' },
  figure: { alignItems: 'center', marginHorizontal: 30 },
  head: { width: 40, height: 40, borderRadius: 20, marginBottom: 8 },
  headLeft: { backgroundColor: '#ff5c7a' },
  headRight: { backgroundColor: '#00c8ff' },
  body: { width: 32, height: 60, borderRadius: 6, marginBottom: 8 },
  bodyLeft: { backgroundColor: '#ff5c7a' },
  bodyRight: { backgroundColor: '#00c8ff' },
  arm: { position: 'absolute', width: 8, height: 50, borderRadius: 4, top: 50 },
  armLeft: { left: -12, backgroundColor: '#ff5c7a' },
  armRight: { right: -12, backgroundColor: '#00c8ff' },
  leg: { width: 8, height: 55, borderRadius: 4 },
  legLeft: { marginRight: 8 },
  legLeftRight: { marginLeft: 8 },
  legRight: { marginLeft: 8 },
  legRightRight: { marginRight: 8 },
  glow: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: '#1a8fff', shadowColor: '#1a8fff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 40, elevation: 15 },
  title: { fontSize: 32, fontWeight: '800', color: '#ffffff', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 12, color: '#00c8ff', textAlign: 'center', letterSpacing: 1.5 },
})
