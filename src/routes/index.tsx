import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { AuthScreen } from '../components/AuthScreen'
import { OnboardingScreen } from '../components/OnboardingScreen'
import { PlaceViewScreen } from '../components/PlaceViewScreen'
import {
  getAppState,
  leaveCurrentPlace,
  saveUserProfile,
  setReadyState,
  searchNearbyPlacesForLocation,
} from '../lib/server/app-state'

const loadAppState = createServerFn({ method: 'GET' }).handler(async () => {
  return getAppState()
})

const searchNearbyPlaces = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: { latitude: number; longitude: number }) => input,
  )
  .handler(async ({ data }) => {
    return searchNearbyPlacesForLocation(data)
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

const clearCurrentPlace = createServerFn({ method: 'POST' }).handler(async () => {
  return leaveCurrentPlace()
})

export const Route = createFileRoute('/')({
  loader: async () => loadAppState(),
  component: App,
})

function App() {
  const { session, profile, currentPlace } = Route.useLoaderData()
  const router = useRouter()

  const refreshSession = async () => {
    await router.invalidate()
  }

  if (!session) {
    return <AuthScreen refreshSession={refreshSession} />
  }

  if (profile && currentPlace) {
    return (
      <PlaceViewScreen
        session={session}
        profile={profile}
        currentPlace={currentPlace}
        refreshSession={refreshSession}
        setReady={updateReadyState}
        leavePlace={clearCurrentPlace}
      />
    )
  }

  return (
    <OnboardingScreen
      session={session}
      profile={profile}
      refreshSession={refreshSession}
      searchNearbyPlaces={searchNearbyPlaces}
      saveProfile={upsertUserProfile}
    />
  )
}
