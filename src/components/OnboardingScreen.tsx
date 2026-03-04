import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowLeft,
  Compass,
  MessageCircle,
  MapPin,
  QrCode,
  Users,
} from 'lucide-react'
import { authClient } from '../lib/auth-client'
import { NearbyPlacesMap } from './NearbyPlacesMap'
import type {
  AppSession,
  NearbyPlace,
  NearbyPlacePreviewState,
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
  loadNearbyPlacePreview,
  googleMapsConfig,
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
  loadNearbyPlacePreview: (input: {
    data: {
      placeId: string
    }
  }) => Promise<NearbyPlacePreviewState>
  googleMapsConfig: {
    apiKey: string
    mapId: string | null
  } | null
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
  const [locationCoords, setLocationCoords] = useState<{
    latitude: number
    longitude: number
  } | null>(null)
  const [places, setPlaces] = useState<NearbyPlace[]>([])
  const [placesError, setPlacesError] = useState<string | null>(null)
  const [placesLoading, setPlacesLoading] = useState(false)
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [placePreview, setPlacePreview] = useState<NearbyPlacePreviewState | null>(
    null,
  )
  const [placePreviewLoading, setPlacePreviewLoading] = useState(false)
  const [placePreviewError, setPlacePreviewError] = useState<string | null>(null)
  const [moodEmoji, setMoodEmoji] = useState(profile?.moodEmoji ?? '🙂')
  const [intentText, setIntentText] = useState(profile?.intentText ?? '')
  const [saveError, setSaveError] = useState<string | null>(null)

  const username =
    session.user.displayUsername || session.user.username || session.user.name
  const selectedPlace =
    places.find((place) => place.placeId === selectedPlaceId) ?? null
  const totalReadyCount = places.reduce(
    (sum, place) => sum + place.readyCount,
    0,
  )
  const busiestPlace =
    places.length > 0
      ? [...places].sort((left, right) => right.readyCount - left.readyCount)[0]
      : null
  const isChoosingPlace = locationStatus === 'granted' && !selectedPlace

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
    setLocationCoords(coords)

    try {
      const result = await searchNearbyPlaces({
        data: coords,
      })

      setPlaces(result)
      setSelectedPlaceId(
        (currentSelection) =>
          currentSelection &&
          result.some((place) => place.placeId === currentSelection)
            ? currentSelection
            : null,
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

  useEffect(() => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.geolocation ||
      !navigator.permissions?.query
    ) {
      return
    }

    let cancelled = false

    void navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((permissionStatus) => {
        if (cancelled || permissionStatus.state !== 'granted') {
          return
        }

        handleEnableLocation()
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedPlaceId) {
      setPlacePreview(null)
      setPlacePreviewError(null)
      setPlacePreviewLoading(false)
      return
    }

    let cancelled = false

    setPlacePreviewLoading(true)
    setPlacePreviewError(null)

    void loadNearbyPlacePreview({
      data: {
        placeId: selectedPlaceId,
      },
    })
      .then((nextPreview) => {
        if (cancelled) {
          return
        }

        setPlacePreview(nextPreview)
      })
      .catch((error) => {
        if (cancelled) {
          return
        }

        setPlacePreview(null)
        setPlacePreviewError(
          error instanceof Error
            ? error.message
            : 'Unable to load this place right now.',
        )
      })
      .finally(() => {
        if (!cancelled) {
          setPlacePreviewLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [loadNearbyPlacePreview, selectedPlaceId])

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
            See who is ready nearby, {username}.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-700 sm:text-lg">
            Open the app, share your location, and check which places are alive
            before you walk in. When one feels right, claim your spot and set
            the tone there.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <StepCard
              icon={<MapPin className="h-5 w-5" />}
              title="1. Share location"
              description="You can sign up without it, but nearby readiness stays locked until location is enabled."
            />
            <StepCard
              icon={<Users className="h-5 w-5" />}
              title="2. Check nearby"
              description="See which cafes or spots already have people ready before you choose a place."
            />
            <StepCard
              icon={<QrCode className="h-5 w-5" />}
              title="3. Join and talk"
              description="Set your vibe for that place, then use your QR once you actually want to connect."
            />
          </div>

          <div className="mt-8 rounded-[2rem] border border-stone-200 bg-white/78 p-5 text-sm text-slate-700 shadow-sm">
            {locationStatus === 'granted' && places.length > 0 ? (
              <>
                <p className="font-semibold text-slate-950">Nearby right now</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-stone-200 bg-stone-50 px-4 py-4">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                      Across these places
                    </p>
                    <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">
                      {totalReadyCount}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      people marked ready nearby
                    </p>
                  </div>
                  <div className="rounded-3xl border border-stone-200 bg-stone-50 px-4 py-4">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                      Most active place
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {busiestPlace?.name ?? 'No nearby place yet'}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {busiestPlace
                        ? busiestPlace.readyCount === 1
                          ? '1 person ready there now'
                          : `${busiestPlace.readyCount} people ready there now`
                        : 'Move a little closer to a venue.'}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="font-semibold text-slate-950">What happens next</p>
                <p className="mt-2 leading-6">
                  Once you pick a place and save your intro, you are checked in
                  there as <span className="font-medium text-slate-950">present</span>.
                  The next screen is your live place view.
                </p>
              </>
            )}
          </div>
        </section>

        <section className="w-full max-w-xl rounded-[2rem] border border-stone-200 bg-white/92 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-amber-700">
                {selectedPlace ? 'Join place' : 'Nearby now'}
              </p>
              <h2 className="mt-2 text-3xl font-bold">
                {selectedPlace ? 'Set your vibe here' : 'Nearby map and list'}
              </h2>
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
                Location enabled. Nearby places are live below.
              </p>
            ) : null}
          </div>

          {isChoosingPlace ? (
            <div className="mt-6">
              <p className="text-sm font-semibold text-slate-900">
                Nearby places
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                We use Google Places for the MVP. Start with the map, then pick
                the place that feels right for right now.
              </p>

              {placesLoading ? (
                <div className="mt-4 rounded-3xl border border-dashed border-stone-200 px-4 py-5 text-sm text-slate-500">
                  Loading nearby places...
                </div>
              ) : null}

              {!placesLoading && places.length > 0 ? (
                <>
                  <NearbyPlacesMap
                    places={places}
                    selectedPlaceId={selectedPlaceId}
                    locationCoords={locationCoords}
                    onSelectPlace={setSelectedPlaceId}
                    googleMapsConfig={googleMapsConfig}
                  />

                  <div className="mt-4 space-y-3">
                    {places.map((place) => (
                      <PlaceChoiceCard
                        key={place.placeId}
                        place={place}
                        isSelected={place.placeId === selectedPlaceId}
                        onSelect={() => setSelectedPlaceId(place.placeId)}
                      />
                    ))}
                  </div>
                </>
              ) : null}

              {!placesLoading &&
              locationStatus === 'granted' &&
              places.length === 0 ? (
                <div className="mt-4 rounded-3xl border border-dashed border-stone-200 px-4 py-5 text-sm text-slate-500">
                  No nearby place matched yet. Try again when you are closer to
                  a venue.
                </div>
              ) : null}

              {placesError ? (
                <p className="mt-3 text-sm text-rose-700">{placesError}</p>
              ) : null}
            </div>
          ) : null}

          {selectedPlace ? (
            <div className="mt-6 rounded-3xl border border-stone-200 bg-stone-50 p-5">
              <button
                type="button"
                onClick={() => setSelectedPlaceId(null)}
                className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-300 hover:text-slate-950"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to nearby places
              </button>

              <div className="mt-4 rounded-3xl border border-stone-200 bg-white px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-950">
                      {selectedPlace.name}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {selectedPlace.address}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                    {selectedPlace.readyCount === 1
                      ? '1 ready'
                      : `${selectedPlace.readyCount} ready`}
                  </span>
                </div>
              </div>

              <div className="mt-5 rounded-3xl border border-stone-200 bg-white px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Live here now
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Preview the room before you step in.
                    </p>
                  </div>
                  {placePreview ? (
                    <span className="shrink-0 rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {placePreview.checkedInCount} here now
                    </span>
                  ) : null}
                </div>

                {placePreviewLoading ? (
                  <div className="mt-4 rounded-3xl border border-dashed border-stone-200 bg-stone-50 px-4 py-5 text-sm text-slate-500">
                    Loading place preview...
                  </div>
                ) : null}

                {placePreview ? (
                  <>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <PreviewMetricCard
                        icon={<Users className="h-4 w-4" />}
                        label="Ready"
                        value={
                          placePreview.readyCount === 1
                            ? '1 person'
                            : `${placePreview.readyCount} people`
                        }
                      />
                      <PreviewMetricCard
                        icon={<MessageCircle className="h-4 w-4" />}
                        label="Talking"
                        value={
                          placePreview.activeConversationCount === 1
                            ? '1 conversation'
                            : `${placePreview.activeConversationCount} conversations`
                        }
                      />
                    </div>

                    <div className="mt-4">
                      <p className="text-sm font-semibold text-slate-900">
                        Ready to talk here
                      </p>
                      {placePreview.readyParticipants.length > 0 ? (
                        <div className="mt-3 space-y-3">
                          {placePreview.readyParticipants.map((participant) => (
                            <div
                              key={participant.userId}
                              className="rounded-3xl border border-stone-200 bg-stone-50 px-4 py-4"
                            >
                              <p className="text-sm font-semibold text-slate-950">
                                {participant.username}
                              </p>
                              <p className="mt-2 text-sm leading-6 text-slate-700">
                                {participant.moodEmoji}{' '}
                                {participant.intentSummary ||
                                  'Open to a nearby conversation.'}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-3xl border border-dashed border-stone-200 bg-stone-50 px-4 py-5 text-sm text-slate-500">
                          No one is marked ready here at the moment.
                        </div>
                      )}
                    </div>
                  </>
                ) : null}

                {placePreviewError ? (
                  <p className="mt-4 text-sm text-rose-700">
                    {placePreviewError}
                  </p>
                ) : null}
              </div>

              <div className="mt-5">
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

                <p className="mt-4 text-sm text-slate-600">
                  Saving for{' '}
                  <span className="font-medium text-slate-950">
                    {selectedPlace.name}
                  </span>
                  .
                </p>

                {saveError ? (
                  <p className="mt-3 text-sm text-rose-700">{saveError}</p>
                ) : null}

                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={pendingAction === 'save' || placePreviewLoading}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-amber-500 px-5 py-3 font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {pendingAction === 'save'
                    ? 'Saving intro...'
                    : 'Join this place'}
                </button>
              </div>
            </div>
          ) : null}
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

function PreviewMetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-stone-50 px-4 py-4">
      <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
        {icon}
        {label}
      </div>
      <p className="mt-3 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function PlaceChoiceCard({
  place,
  isSelected,
  onSelect,
}: {
  place: NearbyPlace
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
        isSelected
          ? 'border-slate-900 bg-slate-950 text-white shadow-lg'
          : 'border-stone-200 bg-white text-slate-900 hover:border-stone-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">{place.name}</p>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            isSelected
              ? 'bg-white/15 text-white'
              : place.readyCount > 0
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-stone-100 text-slate-600'
          }`}
        >
          {place.readyCount === 1 ? '1 ready' : `${place.readyCount} ready`}
        </span>
      </div>
      <p
        className={`mt-1 text-sm leading-6 ${
          isSelected ? 'text-slate-200' : 'text-slate-600'
        }`}
      >
        {place.address}
      </p>
      <p
        className={`mt-3 text-xs font-medium uppercase tracking-[0.16em] ${
          isSelected ? 'text-slate-300' : 'text-slate-500'
        }`}
      >
        {place.readyCount > 0 ? 'People are ready here now' : 'Quiet right now'}
      </p>
    </button>
  )
}
