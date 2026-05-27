import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { AuthScreen } from '../components/AuthScreen'
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
    googleMapsConfig: appState.session
      ? await getGoogleMapsBrowserConfig()
      : null,
  }
})

const searchNearbyPlaces = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: { latitude: number; longitude: number }) => input,
  )
  .handler(async ({ data }) => {
    return searchNearbyPlacesForLocation(data)
  })

const loadNearbyPlacePreview = createServerFn({ method: 'POST' })
  .inputValidator((input: { placeId: string }) => input)
  .handler(async ({ data }) => {
    return getNearbyPlacePreview(data)
  })

const upsertUserProfile = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: {
      moodEmoji: string
      intentText: string
      currentPlaceId: string
    }) => input,
  )
  .handler(async ({ data }) => {
    return saveUserProfile(data)
  })

const updateReadyState = createServerFn({ method: 'POST' })
  .inputValidator((input: { ready: boolean }) => input)
  .handler(async ({ data }) => {
    return setReadyState(data)
  })

const updateFinderProfile = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: { isFindable: boolean; locationHint: string | null }) => input,
  )
  .handler(async ({ data }) => {
    return saveFinderProfile(data)
  })

const clearCurrentPlace = createServerFn({ method: 'POST' }).handler(async () => {
  return leaveCurrentPlace()
})

const pingParticipant = createServerFn({ method: 'POST' })
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data }) => {
    return pingFindableUser(data)
  })

const loadScanPreview = createServerFn({ method: 'POST' })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    return resolveScanToken(data)
  })

const connectScannedQr = createServerFn({ method: 'POST' })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    return connectFromScan(data)
  })

const endConversation = createServerFn({ method: 'POST' }).handler(async () => {
  return endCurrentConnection()
})

const loadScanJoinPreview = createServerFn({ method: 'POST' })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    return previewScanJoin(data)
  })

const joinScannedPlace = createServerFn({ method: 'POST' })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    return joinPlaceAndConnectFromScan(data)
  })

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>) => ({
    scan: typeof search.scan === 'string' ? search.scan : undefined,
  }),
  loader: async () => loadAppState(),
  component: App,
})

function App() {
  const {
    session,
    profile,
    currentPlace,
    qrHandoff,
    activeConnection,
    googleMapsConfig,
  } = Route.useLoaderData()
  const { scan } = Route.useSearch()
  const router = useRouter()

  const refreshSession = async () => {
    await router.invalidate()
  }

  const clearScanToken = async () => {
    await router.navigate({
      to: '/',
      search: {
        scan: undefined,
      },
    })
  }

  if (!session) {
    return <AuthScreen refreshSession={refreshSession} />
  }

  if (scan && !profile?.currentPlaceId) {
    return (
      <ScanJoinScreen
        session={session}
        scanToken={scan}
        refreshSession={refreshSession}
        clearScanToken={clearScanToken}
        loadPreview={loadScanJoinPreview}
        joinAndConnect={joinScannedPlace}
      />
    )
  }

  if (profile && currentPlace && qrHandoff) {
    return (
      <PlaceViewScreen
        session={session}
        profile={profile}
        currentPlace={currentPlace}
        qrHandoff={qrHandoff}
        activeConnection={activeConnection}
        initialScanToken={scan ?? null}
        refreshSession={refreshSession}
        clearScanToken={clearScanToken}
        setReady={updateReadyState}
        saveFinderProfile={updateFinderProfile}
        leavePlace={clearCurrentPlace}
        pingParticipant={pingParticipant}
        loadScanPreview={loadScanPreview}
        connectScan={connectScannedQr}
        endConversation={endConversation}
      />
    )
  }

  return (
    <OnboardingScreen
      session={session}
      profile={profile}
      refreshSession={refreshSession}
      searchNearbyPlaces={searchNearbyPlaces}
      loadNearbyPlacePreview={loadNearbyPlacePreview}
      googleMapsConfig={googleMapsConfig}
      saveProfile={upsertUserProfile}
    />
  )
}
