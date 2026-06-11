import { useEffect, useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { getSession, signOut } from './src/lib/auth'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { StatusBar } from 'expo-status-bar'
import { View, ActivityIndicator } from 'react-native'
import LandingScreen from './src/screens/LandingScreen'
import LoginScreen from './src/screens/LoginScreen'
import SignupScreen from './src/screens/SignupScreen'
import OnboardingScreen from './src/screens/OnboardingScreen'
import PlaceViewScreen from './src/screens/PlaceViewScreen'
import ProfileScreen from './src/screens/ProfileScreen'
import EditProfileScreen from './src/screens/EditProfileScreen'
import AccountSettingsScreen from './src/screens/AccountSettingsScreen'
import NotificationsScreen from './src/screens/NotificationsScreen'
import AboutUsScreen from './src/screens/AboutUsScreen'
import FriendsScreen from './src/screens/FriendsScreen'
import ConversationScreen from './src/screens/ConversationScreen'
import OTPScreen from './src/screens/OTPScreen'
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen'

const Stack = createNativeStackNavigator()

export default function App() {
  const [loading, setLoading] = useState(true)
  const [initialRoute, setInitialRoute] = useState('Landing')

  useEffect(() => {
    const init = async () => {
      try {
        const session = await getSession()
        // ✅ Only auto-login if session exists AND email is verified
        if (session?.session && session?.user?.emailVerified) {
          setInitialRoute('Landing')
        } else {
          await signOut()
          setInitialRoute('Landing')
        }
      } catch {
        await signOut()
        setInitialRoute('Landing')
      }
      setLoading(false)
    }
    init()
  }, [])

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E9DFC9' }}>
        <ActivityIndicator size="large" color="#405e98" />
      </View>
    )
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
          <Stack.Screen name="Landing" component={LandingScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen name="OTP" component={OTPScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="PlaceView" component={PlaceViewScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="AboutUs" component={AboutUsScreen} />
          <Stack.Screen name="Friends" component={FriendsScreen} />
          <Stack.Screen name="Conversation" component={ConversationScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
