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
import AboutUsScreen from './src/screens/AboutUsScreen'
import FriendsScreen from './src/screens/FriendsScreen'
import ConversationScreen from './src/screens/ConversationScreen'
import OTPScreen from './src/screens/OTPScreen'

const Stack = createNativeStackNavigator()

export default function App() {
  const [loading, setLoading] = useState(true)
  const [initialRoute, setInitialRoute] = useState('Landing')

  useEffect(() => {
    const init = async () => {
      try {
        const session = await getSession()
        if (session?.session) {
          setInitialRoute('Onboarding')
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#d4f5d4' }}>
        <ActivityIndicator size="large" color="#1a6b3c" />
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
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="PlaceView" component={PlaceViewScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
        <Stack.Screen name="AboutUs" component={AboutUsScreen} />
        <Stack.Screen name="Friends" component={FriendsScreen} />
        <Stack.Screen name="Conversation" component={ConversationScreen} />
        <Stack.Screen name="OTP" component={OTPScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
