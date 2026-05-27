import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { AuthScreen } from '../components/AuthScreen'
import { LandingPage } from '../components/LandingPage'
import { OnboardingScreen } from '../components/OnboardingScreen'
import { PlaceViewScreen } from '../components/PlaceViewScreen'
import { ScanJoinScreen } from '../components/ScanJoinScreen'
import {
  connectFromScan,
  endCurrentConnection,
  getAppState,
  getGoogleMapsBrowserConfig,
  getNearbyPlacePreview,
  leaveCurrentPlace,
  joinPlaceAndConnectFromScan,
  pingFindableUser,
  previewScanJoin,
  resolveScanToken,
  saveFinderProfile,
  saveUserProfile,
  setReadyState,
  searchNearbyPlacesForLocation,
} from '@backend/lib/app-state'

const loadAppState = createServerFn({ method: 'GET' }).handler(async () => {
  const appState = await getAppState()
  return {
    ...appState,
    googleMapsConfig: appState.session ? await getGoogleMapsBrowserConfig() : null,
  }
})

const searchNearbyPlaces = createServerFn({ method: 'POST' })
  .inputValidator((input: { latitude: number; longitude: number }) => input)
  .handler(async ({ data }) => searchNearbyPlacesForLocation(data))

const loadNearbyPlacePreview = createServerFn({ method: 'POST' })
  .inputValidator((input: { placeId: string }) => input)
  .handler(async ({ data }) => getNearbyPlacePreview(data))

const upsertUserProfile = createServerFn({ method: 'POST' })
  .inputValidator((input: { moodEmoji: string; intentText: string; currentPlaceId: string }) => input)
  .handler(async ({ data }) => saveUserProfile(data))

const updateReadyState = createServerFn({ method: 'POST' })
  .inputValidator((input: { ready: boolean }) => input)
  .handler(async ({ data }) => setReadyState(data))

const updateFinderProfile = createServerFn({ method: 'POST' })
  .inputValidator((input: { isFindable: boolean; locationHint: string | null }) => input)
  .handler(async ({ data }) => saveFinderProfile(data))

const clearCurrentPlace = createServerFn({ method: 'POST' }).handler(async () => leaveCurrentPlace())

const pingParticipant = createServerFn({ method: 'POST' })
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data }) => pingFindableUser(data))

const loadScanPreview = createServerFn({ method: 'POST' })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => resolveScanToken(data))

const connectScannedQr = createServerFn({ method: 'POST' })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => connectFromScan(data))

const endConversation = createServerFn({ method: 'POST' }).handler(async () => endCurrentConnection())

const loadScanJoinPreview = createServerFn({ method: 'POST' })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => previewScanJoin(data))

const joinScannedPlace = createServerFn({ method: 'POST' })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => joinPlaceAndConnectFromScan(data))

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>) => ({
    scan: typeof search.scan === 'string' ? search.scan : undefined,
  }),
  loader: async () => loadAppState(),
  component: App,
})

function App() {
  const { session, profile, currentPlace, qrHandoff, activeConnection, googleMapsConfig } = Route.useLoaderData()
  const { scan } = Route.useSearch()
  const router = useRouter()
  const { auth: authParam } = Route.useSearch()
  const [showAuth, setShowAuth] = useState<'login' | 'signup' | null>(authParam === 'login' || authParam === 'signup' ? authParam : null)

  const refreshSession = async () => { await router.invalidate(); setShowAuth(null) }
  const clearScanToken = async () => { await router.navigate({ to: '/', search: { scan: undefined } }) }

  if (!session && showAuth) {
    return (
      <AuthScreen onBack={() => setShowAuth(null)}
        refreshSession={refreshSession}
        initialMode={showAuth === 'login' ? 'sign-in' : 'sign-up'}
      />
    )
  }

  if (!session) {
    
    return <LandingPage onLogin={() => router.navigate({ to: "/login" })} onSignup={() => router.navigate({ to: "/signup" })} />
  }

  if (scan && !profile?.currentPlaceId) {
    return (
      <ScanJoinScreen
        session={session} scanToken={scan} refreshSession={refreshSession}
        clearScanToken={clearScanToken} loadPreview={loadScanJoinPreview}
        joinAndConnect={joinScannedPlace}
      />
    )
  }

  if (profile && currentPlace && qrHandoff) {
    return (
      <PlaceViewScreen
        session={session} profile={profile} currentPlace={currentPlace}
        qrHandoff={qrHandoff} activeConnection={activeConnection}
        initialScanToken={scan ?? null} refreshSession={refreshSession}
        clearScanToken={clearScanToken} setReady={updateReadyState}
        saveFinderProfile={updateFinderProfile} leavePlace={clearCurrentPlace}
        pingParticipant={pingParticipant} loadScanPreview={loadScanPreview}
        connectScan={connectScannedQr} endConversation={endConversation}
      />
    )
  }

  return (
    <OnboardingScreen
      session={session} profile={profile} refreshSession={refreshSession}
      searchNearbyPlaces={searchNearbyPlaces} loadNearbyPlacePreview={loadNearbyPlacePreview}
      googleMapsConfig={googleMapsConfig} saveProfile={upsertUserProfile}
    />
  )
}
