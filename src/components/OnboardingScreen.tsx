import { useState } from 'react'
import type { ReactNode } from 'react'
import { Compass, MapPin, QrCode, Sparkles } from 'lucide-react'
import { authClient } from '../lib/auth-client'
import type {
  AppSession,
  NearbyPlace,
  UserProfileState,
} from '../lib/app-types'

type AuthResult = {
  error?: {
    message?: string | null
  } | null
}

type OnboardingClientLike = {
  signOut: () => Promise<AuthResult>
}

type LocationStatus =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unsupported'

const MOOD_OPTIONS = ['🙂', '😌', '☕', '🤝', '💬', '🌿']

export function OnboardingScreen({
  session,
  profile,
  refreshSession,
  searchNearbyPlaces,
  saveProfile,
  client = authClient,
}: {
  session: AppSession
  profile: UserProfileState | null
  refreshSession: () => Promise<void>
  searchNearbyPlaces: (input: {
    data: {
      latitude: number
      longitude: number
    }
  }) => Promise<NearbyPlace[]>
  saveProfile: (input: {
    data: {
      moodEmoji: string
      intentText: string
      currentPlaceId: string
    }
  }) => Promise<UserProfileState>
  client?: OnboardingClientLike
}) {
  const [pendingAction, setPendingAction] = useState<'sign-out' | 'save' | null>(
    null,
  )
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle')
  const [locationError, setLocationError] = useState<string | null>(null)
  const [places, setPlaces] = useState<NearbyPlace[]>([])
  const [placesError, setPlacesError] = useState<string | null>(null)
  const [placesLoading, setPlacesLoading] = useState(false)
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [moodEmoji, setMoodEmoji] = useState(profile?.moodEmoji ?? '🙂')
  const [intentText, setIntentText] = useState(profile?.intentText ?? '')
  const [saveError, setSaveError] = useState<string | null>(null)

  const username =
    session.user.displayUsername || session.user.username || session.user.name
  const selectedPlace =
    places.find((place) => place.placeId === selectedPlaceId) ?? null

  const handleSignOut = async () => {
    setPendingAction('sign-out')
    setSaveError(null)

    const result = await client.signOut()

    if (result.error) {
      setSaveError(result.error.message || 'Unable to sign out right now.')
      setPendingAction(null)
      return
    }

    await refreshSession()
    setPendingAction(null)
  }

  const loadNearbyPlaces = async (coords: {
    latitude: number
    longitude: number
  }) => {
    setPlacesLoading(true)
    setPlacesError(null)

    try {
      const result = await searchNearbyPlaces({
        data: coords,
      })

      setPlaces(result)
      setSelectedPlaceId(
        (currentSelection) => currentSelection || result[0]?.placeId || null,
      )
    } catch (error) {
      setPlacesError(
        error instanceof Error
          ? error.message
          : 'Unable to load nearby places right now.',
      )
    } finally {
      setPlacesLoading(false)
    }
  }

  const handleEnableLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('unsupported')
      setLocationError('This browser cannot share location yet.')
      return
    }

    setLocationStatus('requesting')
    setLocationError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationStatus('granted')
        void loadNearbyPlaces({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      (error) => {
        setLocationStatus('denied')
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? 'Location is required before you can use Ready to Talk.'
            : 'We could not read your location. Try again nearby.',
        )
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    )
  }

  const handleSaveProfile = async () => {
    if (!selectedPlace) {
      setSaveError('Choose your place before saving your intro.')
      return
    }

    setPendingAction('save')
    setSaveError(null)

    try {
      const nextProfile = await saveProfile({
        data: {
          moodEmoji,
          intentText,
          currentPlaceId: selectedPlace.placeId,
        },
      })
      if (nextProfile.userId) {
        await refreshSession()
      }
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : 'Unable to save your intro right now.',
      )
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <main className="min-h-screen bg-[#f4efe6] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-5 py-8 sm:px-6 lg:flex-row lg:items-start lg:justify-between lg:gap-12 lg:px-8">
        <section className="w-full max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/80 px-4 py-2 text-sm font-medium text-amber-800 shadow-sm">
            <Compass className="h-4 w-4" />
            Same place. Same moment. Consent first.
          </div>

          <h1 className="mt-5 text-4xl font-black leading-none tracking-[-0.05em] sm:text-5xl">
            Ready when you are, {username}.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-700 sm:text-lg">
            Turn on location, confirm where you are, then set the tone before
            you show your QR code. Email stays out of the product.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <StepCard
              icon={<MapPin className="h-5 w-5" />}
              title="1. Share location"
              description="You can sign up without it, but scans and ready state stay locked until location is enabled."
            />
            <StepCard
              icon={<Sparkles className="h-5 w-5" />}
              title="2. Set the vibe"
              description="Pick a mood and write a short line about what you want to talk about right now."
            />
            <StepCard
              icon={<QrCode className="h-5 w-5" />}
              title="3. Show your QR"
              description="Nearby people can only connect by scanning when you are in the same place."
            />
          </div>

          <div className="mt-8 rounded-[2rem] border border-stone-200 bg-white/78 p-5 text-sm text-slate-700 shadow-sm">
            <p className="font-semibold text-slate-950">What happens next</p>
            <p className="mt-2 leading-6">
              Saving your intro now also checks you into the selected place as
              <span className="font-medium text-slate-950"> present</span>.
              The next screen is your live place view.
            </p>
          </div>
        </section>

        <section className="w-full max-w-xl rounded-[2rem] border border-stone-200 bg-white/92 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-amber-700">
                Setup
              </p>
              <h2 className="mt-2 text-3xl font-bold">Get ready nearby</h2>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={pendingAction === 'sign-out'}
              className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pendingAction === 'sign-out' ? 'Signing out...' : 'Sign out'}
            </button>
          </div>

          <div className="mt-6 rounded-3xl border border-stone-200 bg-stone-50 p-5">
            <p className="text-sm font-semibold text-slate-900">
              Location permission
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Ready to Talk needs your live location so scans only work for
              people who are actually in the same place.
            </p>

            <button
              type="button"
              onClick={handleEnableLocation}
              disabled={locationStatus === 'requesting'}
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {locationStatus === 'requesting'
                ? 'Checking location...'
                : locationStatus === 'granted'
                  ? 'Refresh my place'
                  : 'Enable location'}
            </button>

            {locationError ? (
              <p className="mt-3 text-sm text-rose-700">{locationError}</p>
            ) : null}
            {locationStatus === 'granted' ? (
              <p className="mt-3 text-sm text-emerald-700">
                Location enabled. Confirm the place below.
              </p>
            ) : null}
          </div>

          <div className="mt-6">
            <p className="text-sm font-semibold text-slate-900">
              Nearby places
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              We use Google Places for the MVP. Pick the closest match before
              you set your mood and intro.
            </p>

            {placesLoading ? (
              <div className="mt-4 rounded-3xl border border-dashed border-stone-200 px-4 py-5 text-sm text-slate-500">
                Loading nearby places...
              </div>
            ) : null}

            {!placesLoading && places.length > 0 ? (
              <div className="mt-4 space-y-3">
                {places.map((place) => {
                  const isSelected = place.placeId === selectedPlaceId

                  return (
                    <button
                      key={place.placeId}
                      type="button"
                      onClick={() => setSelectedPlaceId(place.placeId)}
                      className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                        isSelected
                          ? 'border-slate-900 bg-slate-950 text-white shadow-lg'
                          : 'border-stone-200 bg-white text-slate-900 hover:border-stone-300'
                      }`}
                    >
                      <p className="font-semibold">{place.name}</p>
                      <p
                        className={`mt-1 text-sm leading-6 ${
                          isSelected ? 'text-slate-200' : 'text-slate-600'
                        }`}
                      >
                        {place.address}
                      </p>
                    </button>
                  )
                })}
              </div>
            ) : null}

            {!placesLoading && locationStatus === 'granted' && places.length === 0 ? (
              <div className="mt-4 rounded-3xl border border-dashed border-stone-200 px-4 py-5 text-sm text-slate-500">
                No nearby place matched yet. Try again when you are closer to a
                venue.
              </div>
            ) : null}

            {placesError ? (
              <p className="mt-3 text-sm text-rose-700">{placesError}</p>
            ) : null}
          </div>

          <div className="mt-6 rounded-3xl border border-stone-200 bg-stone-50 p-5">
            <p className="text-sm font-semibold text-slate-900">
              Mood and intro
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This becomes your short summary for the first version. AI can
              refine it later, but we are stubbing that part for now.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              {MOOD_OPTIONS.map((option) => {
                const isSelected = option === moodEmoji

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMoodEmoji(option)}
                    className={`rounded-2xl border px-4 py-3 text-2xl transition ${
                      isSelected
                        ? 'border-slate-900 bg-slate-950 text-white'
                        : 'border-stone-200 bg-white hover:border-stone-300'
                    }`}
                    aria-pressed={isSelected}
                  >
                    {option}
                  </button>
                )
              })}
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                What do you want to talk about?
              </span>
              <textarea
                value={intentText}
                onChange={(event) => setIntentText(event.target.value)}
                rows={4}
                placeholder="Coffee break, startup ideas, a quiet walk, meeting someone new..."
                className="w-full rounded-3xl border border-stone-200 bg-white px-4 py-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
              />
            </label>

            {selectedPlace ? (
              <p className="mt-4 text-sm text-slate-600">
                Saving for{' '}
                <span className="font-medium text-slate-950">
                  {selectedPlace.name}
                </span>
                .
              </p>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                Choose a place first to unlock this step.
              </p>
            )}

            {saveError ? (
              <p className="mt-3 text-sm text-rose-700">{saveError}</p>
            ) : null}

            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={pendingAction === 'save' || !selectedPlace}
              className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-amber-500 px-5 py-3 font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {pendingAction === 'save' ? 'Saving intro...' : 'Save my intro'}
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}

function StepCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-white/78 p-5 shadow-sm">
      <div className="inline-flex rounded-2xl border border-amber-100 bg-amber-50 p-3 text-amber-700">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-700">{description}</p>
    </div>
  )
}
