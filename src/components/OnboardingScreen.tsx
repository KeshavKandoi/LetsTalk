import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowLeft,
  MessageCircle,
  MapPin,
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
            ? 'Location is required before you can use LetsTalk.'
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
    <main className="min-h-screen px-4 py-5 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-xl flex-col gap-4">
        <section className="rounded-[2rem] border border-[var(--rt-border)] bg-[var(--rt-surface)] p-5 shadow-[0_28px_80px_rgba(17,52,44,0.12)] backdrop-blur-xl sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--rt-border-strong)] bg-[var(--rt-accent-soft)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--rt-accent)]">
                <MapPin className="h-3.5 w-3.5" />
                Nearby now
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-[-0.05em] text-[var(--rt-ink)] sm:text-4xl">
                Find people ready to talk nearby, {username}.
              </h1>
              <p className="mt-3 text-sm leading-6 text-[var(--rt-ink-soft)] sm:text-base">
                Start with nearby places. Pick one that feels active, then add
                a quick vibe before you join it.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={pendingAction === 'sign-out'}
              className="shrink-0 rounded-full border border-[var(--rt-border)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--rt-ink-soft)] transition hover:border-[var(--rt-border-strong)] hover:text-[var(--rt-ink)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pendingAction === 'sign-out' ? 'Signing out...' : 'Sign out'}
            </button>
          </div>

          <div className="mt-5 rounded-[1.75rem] border border-[var(--rt-border)] bg-[linear-gradient(180deg,rgba(220,239,227,0.85),rgba(248,252,248,0.92))] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--rt-ink)]">
                  Your location
                </p>
                <p className="mt-1 text-sm leading-6 text-[var(--rt-ink-soft)]">
                  Needed to show nearby places and keep conversations local.
                </p>
              </div>
              {locationStatus === 'granted' ? (
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--rt-accent)]">
                  Live
                </span>
              ) : null}
            </div>

            <button
              type="button"
              onClick={handleEnableLocation}
              disabled={locationStatus === 'requesting'}
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-[var(--rt-accent)] px-5 py-3 font-semibold text-white transition hover:bg-[var(--rt-accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {locationStatus === 'requesting'
                ? 'Checking location...'
                : locationStatus === 'granted'
                  ? 'Refresh nearby places'
                  : 'Enable location'}
            </button>

            {locationError ? (
              <p className="mt-3 text-sm text-rose-700">{locationError}</p>
            ) : null}
          </div>

          {locationStatus === 'granted' && places.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <ToplineMetric
                label="Ready nearby"
                value={String(totalReadyCount)}
                detail="across nearby places"
              />
              <ToplineMetric
                label="Most active"
                value={busiestPlace?.readyCount ? String(busiestPlace.readyCount) : '0'}
                detail={busiestPlace?.name ?? 'No place yet'}
              />
            </div>
          ) : null}

          {isChoosingPlace ? (
            <div className="mt-5">
              {placesLoading ? (
                <div className="rounded-3xl border border-dashed border-[var(--rt-border)] bg-white/70 px-4 py-5 text-sm text-[var(--rt-ink-soft)]">
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
                <div className="rounded-3xl border border-dashed border-[var(--rt-border)] bg-white/70 px-4 py-5 text-sm text-[var(--rt-ink-soft)]">
                  No nearby place matched yet. Move closer to a cafe or venue
                  and try again.
                </div>
              ) : null}

              {placesError ? (
                <p className="mt-3 text-sm text-rose-700">{placesError}</p>
              ) : null}
            </div>
          ) : null}

          {selectedPlace ? (
            <div className="mt-5 rounded-[1.75rem] border border-[var(--rt-border)] bg-white/86 p-4 sm:p-5">
              <button
                type="button"
                onClick={() => setSelectedPlaceId(null)}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--rt-border)] bg-[var(--rt-surface-strong)] px-4 py-2 text-sm font-medium text-[var(--rt-ink-soft)] transition hover:border-[var(--rt-border-strong)] hover:text-[var(--rt-ink)]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to places
              </button>

              <div className="mt-4 rounded-3xl border border-[var(--rt-border)] bg-[var(--rt-accent-soft)] px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-[var(--rt-ink)]">
                      {selectedPlace.name}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--rt-ink-soft)]">
                      {selectedPlace.address}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[var(--rt-accent)]">
                    {selectedPlace.readyCount === 1
                      ? '1 ready'
                      : `${selectedPlace.readyCount} ready`}
                  </span>
                </div>
              </div>

              <div className="mt-4 rounded-3xl border border-[var(--rt-border)] bg-[var(--rt-surface-strong)] px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--rt-ink)]">
                      Place preview
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--rt-ink-soft)]">
                      See how active it is before you join.
                    </p>
                  </div>
                  {placePreview ? (
                    <span className="shrink-0 rounded-full bg-[var(--rt-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--rt-accent)]">
                      {placePreview.checkedInCount} here now
                    </span>
                  ) : null}
                </div>

                {placePreviewLoading ? (
                  <div className="mt-4 rounded-3xl border border-dashed border-[var(--rt-border)] bg-white px-4 py-5 text-sm text-[var(--rt-ink-soft)]">
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
                      <p className="text-sm font-semibold text-[var(--rt-ink)]">
                        Ready to talk here
                      </p>
                      {placePreview.readyParticipants.length > 0 ? (
                        <div className="mt-3 space-y-3">
                          {placePreview.readyParticipants.map((participant) => (
                            <div
                              key={participant.userId}
                              className="rounded-3xl border border-[var(--rt-border)] bg-[var(--rt-accent-soft)] px-4 py-4"
                            >
                              <p className="text-sm font-semibold text-[var(--rt-ink)]">
                                {participant.username}
                              </p>
                              <p className="mt-2 text-sm leading-6 text-[var(--rt-ink-soft)]">
                                {participant.moodEmoji}{' '}
                                {participant.intentSummary ||
                                  'Open to a nearby conversation.'}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-3xl border border-dashed border-[var(--rt-border)] bg-white px-4 py-5 text-sm text-[var(--rt-ink-soft)]">
                          No one is marked ready here right now.
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

              <div className="mt-4">
                <p className="text-sm font-semibold text-[var(--rt-ink)]">
                  Your vibe for this place
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--rt-ink-soft)]">
                  Keep it short. People nearby will see this before they talk to
                  you.
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
                            ? 'border-[var(--rt-accent)] bg-[var(--rt-accent)] text-white'
                            : 'border-[var(--rt-border)] bg-white hover:border-[var(--rt-border-strong)]'
                        }`}
                        aria-pressed={isSelected}
                      >
                        {option}
                      </button>
                    )
                  })}
                </div>

                <label className="mt-4 block">
                  <span className="mb-2 block text-sm font-medium text-[var(--rt-ink-soft)]">
                    What do you want to talk about?
                  </span>
                  <textarea
                    value={intentText}
                    onChange={(event) => setIntentText(event.target.value)}
                    rows={4}
                    placeholder="Coffee break, startup ideas, a quiet walk, meeting someone new..."
                    className="w-full rounded-3xl border border-[var(--rt-border)] bg-[var(--rt-surface-strong)] px-4 py-3 text-base text-[var(--rt-ink)] outline-none transition placeholder:text-[color:rgba(69,104,90,0.55)] focus:border-[var(--rt-accent-strong)] focus:ring-2 focus:ring-[var(--rt-accent-soft-strong)]"
                  />
                </label>

                <p className="mt-4 text-sm text-[var(--rt-ink-soft)]">
                  Joining <span className="font-medium text-[var(--rt-ink)]">{selectedPlace.name}</span>.
                </p>

                {saveError ? (
                  <p className="mt-3 text-sm text-rose-700">{saveError}</p>
                ) : null}

                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={pendingAction === 'save' || placePreviewLoading}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[var(--rt-accent)] px-5 py-3 font-semibold text-white transition hover:bg-[var(--rt-accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
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

function ToplineMetric({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-3xl border border-[var(--rt-border)] bg-white/82 px-4 py-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--rt-ink-soft)]">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-[var(--rt-ink)]">
        {value}
      </p>
      <p className="mt-1 text-sm leading-6 text-[var(--rt-ink-soft)]">{detail}</p>
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
    <div className="rounded-3xl border border-[var(--rt-border)] bg-[var(--rt-accent-soft)] px-4 py-4">
      <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--rt-ink-soft)]">
        {icon}
        {label}
      </div>
      <p className="mt-3 text-lg font-semibold text-[var(--rt-ink)]">{value}</p>
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
          ? 'border-[var(--rt-accent)] bg-[var(--rt-accent)] text-white shadow-lg'
          : 'border-[var(--rt-border)] bg-white/86 text-[var(--rt-ink)] hover:border-[var(--rt-border-strong)]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">{place.name}</p>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            isSelected
              ? 'bg-white/15 text-white'
              : place.readyCount > 0
                ? 'bg-[var(--rt-accent-soft)] text-[var(--rt-accent)]'
                : 'bg-[var(--rt-bg-strong)] text-[var(--rt-ink-soft)]'
          }`}
        >
          {place.readyCount === 1 ? '1 ready' : `${place.readyCount} ready`}
        </span>
      </div>
      <p
        className={`mt-1 text-sm leading-6 ${
          isSelected ? 'text-white/80' : 'text-[var(--rt-ink-soft)]'
        }`}
      >
        {place.address}
      </p>
      <p
        className={`mt-3 text-xs font-medium uppercase tracking-[0.16em] ${
          isSelected ? 'text-white/65' : 'text-[var(--rt-ink-soft)]'
        }`}
      >
        {place.readyCount > 0 ? 'People are ready here now' : 'Quiet right now'}
      </p>
    </button>
  )
}
