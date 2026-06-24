import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'

const { width, height } = Dimensions.get('window')

export default function SplashScreen({ onComplete, duration = 3000 }) {
  const [isVisible, setIsVisible] = useState(true)
  const ringRotation = React.useRef(new Animated.Value(0)).current
  const glowOpacity = React.useRef(new Animated.Value(0.3)).current
  const logoScale = React.useRef(new Animated.Value(0.8)).current

  useEffect(() => {
    // Logo pop animation
    Animated.sequence([
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1.1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start()

    // Ring rotation - continuous
    Animated.loop(
      Animated.timing(ringRotation, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    ).start()

    // Glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.8,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.3,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start()

    const timer = setTimeout(() => {
      setIsVisible(false)
      if (onComplete) onComplete()
    }, duration)

    return () => clearTimeout(timer)
  }, [])

  if (!isVisible) return null

  const ringRotate = ringRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  return (
    <SafeAreaView style={styles.container}>
      {/* Background */}
      <View style={styles.bgContainer}>
        <View style={styles.bgGradient} />
      </View>

      {/* Center Glow Effect */}
      <Animated.View style={[styles.glowCenter, { opacity: glowOpacity }]} />

      {/* Main Content */}
      <View style={styles.content}>
        {/* Outer Rings Container */}
        <View style={styles.ringsContainer}>
          {/* Rotating Ring 1 - Cyan */}
          <Animated.View
            style={[
              styles.ring,
              styles.ring1,
              {
                transform: [{ rotate: ringRotate }],
              },
            ]}
          >
            <Svg height="280" width="280" viewBox="0 0 280 280">
              <Defs>
                <RadialGradient id="grad1" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor="#00d4ff" stopOpacity="0" />
                  <Stop offset="50%" stopColor="#00d4ff" stopOpacity="0.4" />
                  <Stop offset="100%" stopColor="#00d4ff" stopOpacity="0.8" />
                </RadialGradient>
              </Defs>
              <Circle cx="140" cy="140" r="130" fill="none" stroke="url(#grad1)" strokeWidth="3" />
            </Svg>
          </Animated.View>

          {/* Rotating Ring 2 - Pink (Opposite Direction) */}
          <Animated.View
            style={[
              styles.ring,
              styles.ring2,
              {
                transform: [
                  {
                    rotate: ringRotation.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '-360deg'],
                    }),
                  },
                ],
              },
            ]}
          >
            <Svg height="320" width="320" viewBox="0 0 320 320">
              <Defs>
                <RadialGradient id="grad2" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor="#ff4080" stopOpacity="0" />
                  <Stop offset="50%" stopColor="#ff4080" stopOpacity="0.3" />
                  <Stop offset="100%" stopColor="#ff4080" stopOpacity="0.7" />
                </RadialGradient>
              </Defs>
              <Circle cx="160" cy="160" r="150" fill="none" stroke="url(#grad2)" strokeWidth="2" />
            </Svg>
          </Animated.View>

          {/* Static outer ring - Orange */}
          <View style={styles.ring3}>
            <Svg height="360" width="360" viewBox="0 0 360 360">
              <Defs>
                <RadialGradient id="grad3" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor="#ffa500" stopOpacity="0" />
                  <Stop offset="70%" stopColor="#ffa500" stopOpacity="0.2" />
                  <Stop offset="100%" stopColor="#ffa500" stopOpacity="0.5" />
                </RadialGradient>
              </Defs>
              <Circle cx="180" cy="180" r="170" fill="none" stroke="url(#grad3)" strokeWidth="1.5" />
            </Svg>
          </View>
        </View>

        {/* Center Logo Circle */}
        <Animated.View
          style={[
            styles.logoCircle,
            {
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Text style={styles.logoIcon}>💬</Text>
        </Animated.View>
      </View>

      {/* Text */}
      <View style={styles.textContainer}>
        <Text style={styles.title}>LET'S TALK</Text>
        <Text style={styles.subtitle}>Initializing connection...</Text>
      </View>

      {/* Loading Dots */}
      <View style={styles.loader}>
        <Animated.View
          style={[
            styles.loaderDot,
            {
              opacity: ringRotation.interpolate({
                inputRange: [0, 0.33, 0.66, 1],
                outputRange: [0.3, 1, 0.3, 0.3],
              }),
            },
          ]}
        />
        <Animated.View
          style={[
            styles.loaderDot,
            {
              opacity: ringRotation.interpolate({
                inputRange: [0, 0.33, 0.66, 1],
                outputRange: [0.3, 0.3, 1, 0.3],
              }),
            },
          ]}
        />
        <Animated.View
          style={[
            styles.loaderDot,
            {
              opacity: ringRotation.interpolate({
                inputRange: [0, 0.33, 0.66, 1],
                outputRange: [0.3, 0.3, 0.3, 1],
              }),
            },
          ]}
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e27',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bgContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bgGradient: {
    flex: 1,
    backgroundColor: '#0a0e27',
  },
  glowCenter: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: '#00d4ff',
    opacity: 0.1,
  },
  content: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 60,
  },
  ringsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 360,
    height: 360,
    marginBottom: 20,
  },
  ring: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring1: {
    width: 280,
    height: 280,
  },
  ring2: {
    width: 320,
    height: 320,
  },
  ring3: {
    position: 'absolute',
    width: 360,
    height: 360,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoCircle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(0, 212, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0, 212, 255, 0.4)',
    shadowColor: '#00d4ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  logoIcon: {
    fontSize: 70,
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(0, 212, 255, 0.6)',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  loader: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 40,
  },
  loaderDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00d4ff',
    shadowColor: '#00d4ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },
})
