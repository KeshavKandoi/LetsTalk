import { and, eq, sql } from 'drizzle-orm'
import { getAgentByName } from 'agents'
import { getRequestHeaders } from '@tanstack/react-start/server'
import type {
  AppSession,
  AppState,
  CurrentPlaceState,
  NearbyPlace,
  PresenceStatus,
  UserProfileState,
} from '../app-types'
import { auth } from './auth'
import { db } from './db'
import type { PlaceAgent } from './agents/place-agent'
import { place, userProfile } from './db/schema'
import { getGoogleMapsApiKey, getPlaceAgentBinding } from './env'

type SessionResult = Awaited<ReturnType<typeof auth.api.getSession>>

type GoogleNearbyPlace = {
  id?: string
  displayName?: {
    text?: string
  }
  formattedAddress?: string
  location?: {
    latitude?: number
    longitude?: number
  }
}

function mapSession(session: NonNullable<SessionResult>): AppSession {
  return {
    session: {
      expiresAt: session.session.expiresAt,
    },
    user: {
      id: session.user.id,
      name: session.user.name,
      username: session.user.username ?? null,
      displayUsername: session.user.displayUsername ?? null,
    },
  }
}

function mapUserProfile(
  profileRecord: typeof userProfile.$inferSelect,
): UserProfileState {
  return {
    userId: profileRecord.userId,
    moodEmoji: profileRecord.moodEmoji,
    intentText: profileRecord.intentText,
    intentSummary: profileRecord.intentSummary,
    status: profileRecord.status as PresenceStatus,
    currentPlaceId: profileRecord.currentPlaceId,
    createdAt: profileRecord.createdAt,
    updatedAt: profileRecord.updatedAt,
  }
}

function mapPlace(record: typeof place.$inferSelect): NearbyPlace {
  return {
    placeId: record.placeId,
    name: record.name,
    address: record.address,
    lat: record.lat,
    lng: record.lng,
  }
}

export async function getCurrentSession() {
  try {
    return await auth.api.getSession({
      headers: new Headers(getRequestHeaders()),
      asResponse: false,
      query: {
        disableRefresh: true,
      },
    })
  } catch {
    return null
  }
}

export async function requireCurrentSession() {
  const session = await getCurrentSession()

  if (!session) {
    throw new Error('Your session expired. Sign in again and try once more.')
  }

  return session
}

export async function getAppState(): Promise<AppState> {
  const session = await getCurrentSession()

  if (!session) {
    return {
      session: null,
      profile: null,
      currentPlace: null,
    }
  }

  const [profileRecord] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.userId, session.user.id))
    .limit(1)

  let currentPlace: CurrentPlaceState | null = null

  if (profileRecord?.currentPlaceId) {
    const [currentPlaceRecord] = await db
      .select()
      .from(place)
      .where(eq(place.placeId, profileRecord.currentPlaceId))
      .limit(1)

    if (currentPlaceRecord) {
      const [{ readyCount }] = await db
        .select({
          readyCount: sql<number>`count(*)`,
        })
        .from(userProfile)
        .where(
          and(
            eq(userProfile.currentPlaceId, profileRecord.currentPlaceId),
            eq(userProfile.status, 'ready'),
          ),
        )

      currentPlace = {
        place: mapPlace(currentPlaceRecord),
        readyCount,
      }
    }
  }

  return {
    session: mapSession(session),
    profile: profileRecord ? mapUserProfile(profileRecord) : null,
    currentPlace,
  }
}

async function syncPlaceAgent(placeId: string | null | undefined) {
  if (!placeId) {
    return
  }

  const agent = await getAgentByName<Cloudflare.Env, PlaceAgent>(
    getPlaceAgentBinding(),
    placeId,
  )

  await agent.refresh()
}

async function syncPlaceAgents(placeIds: Array<string | null | undefined>) {
  const uniquePlaceIds = [...new Set(placeIds.filter(Boolean))]

  try {
    for (const placeId of uniquePlaceIds) {
      await syncPlaceAgent(placeId)
    }
  } catch (error) {
    console.error('Failed to sync place agent state', error)
  }
}

function buildIntentSummary(intentText: string | null) {
  if (!intentText) {
    return 'Open to a nearby conversation.'
  }

  if (intentText.length <= 72) {
    return intentText
  }

  return `${intentText.slice(0, 69).trimEnd()}...`
}

export async function saveUserProfile(input: {
  moodEmoji: string
  intentText: string
  currentPlaceId: string
}) {
  const session = await requireCurrentSession()
  const now = new Date()
  const intentText = input.intentText.replace(/\s+/g, ' ').trim() || null
  const intentSummary = buildIntentSummary(intentText)
  const [existingProfile] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.userId, session.user.id))
    .limit(1)
  const [selectedPlace] = await db
    .select()
    .from(place)
    .where(eq(place.placeId, input.currentPlaceId))
    .limit(1)

  if (!selectedPlace) {
    throw new Error('Choose a nearby place before saving your intro.')
  }

  await db
    .insert(userProfile)
    .values({
      userId: session.user.id,
      moodEmoji: input.moodEmoji,
      intentText,
      intentSummary,
      status: 'present',
      currentPlaceId: input.currentPlaceId,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userProfile.userId,
      set: {
        moodEmoji: input.moodEmoji,
        intentText,
        intentSummary,
        status: 'present',
        currentPlaceId: input.currentPlaceId,
        updatedAt: now,
      },
    })

  await syncPlaceAgents([existingProfile?.currentPlaceId, input.currentPlaceId])

  return {
    userId: session.user.id,
    moodEmoji: input.moodEmoji,
    intentText,
    intentSummary,
    status: 'present',
    currentPlaceId: input.currentPlaceId,
    createdAt: now,
    updatedAt: now,
  } satisfies UserProfileState
}

export async function setReadyState(input: { ready: boolean }) {
  const session = await requireCurrentSession()
  const [profileRecord] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.userId, session.user.id))
    .limit(1)

  if (!profileRecord?.currentPlaceId) {
    throw new Error('Pick your current place before changing your status.')
  }

  await db
    .update(userProfile)
    .set({
      status: input.ready ? 'ready' : 'present',
      updatedAt: new Date(),
    })
    .where(eq(userProfile.userId, session.user.id))

  await syncPlaceAgents([profileRecord.currentPlaceId])
}

export async function leaveCurrentPlace() {
  const session = await requireCurrentSession()
  const [profileRecord] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.userId, session.user.id))
    .limit(1)

  await db
    .update(userProfile)
    .set({
      status: 'offline',
      currentPlaceId: null,
      updatedAt: new Date(),
    })
    .where(eq(userProfile.userId, session.user.id))

  await syncPlaceAgents([profileRecord?.currentPlaceId])
}

function mapGooglePlace(result: GoogleNearbyPlace): NearbyPlace | null {
  if (
    !result.id ||
    !result.displayName?.text ||
    !result.formattedAddress ||
    typeof result.location?.latitude !== 'number' ||
    typeof result.location?.longitude !== 'number'
  ) {
    return null
  }

  return {
    placeId: result.id,
    name: result.displayName.text,
    address: result.formattedAddress,
    lat: result.location.latitude,
    lng: result.location.longitude,
  }
}

export async function searchNearbyPlacesForLocation(input: {
  latitude: number
  longitude: number
}) {
  await requireCurrentSession()

  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    throw new Error('A valid location is required.')
  }

  const response = await fetch(
    'https://places.googleapis.com/v1/places:searchNearby',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': getGoogleMapsApiKey(),
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location',
      },
      body: JSON.stringify({
        maxResultCount: 8,
        locationRestriction: {
          circle: {
            center: {
              latitude: input.latitude,
              longitude: input.longitude,
            },
            radius: 120,
          },
        },
      }),
    },
  )

  if (!response.ok) {
    throw new Error('Unable to load nearby places right now.')
  }

  const payload = (await response.json()) as {
    places?: GoogleNearbyPlace[]
  }

  const places = (payload.places ?? [])
    .map(mapGooglePlace)
    .filter((value): value is NearbyPlace => value !== null)

  if (places.length > 0) {
    const now = new Date()

    await db
      .insert(place)
      .values(
        places.map((nearbyPlace) => ({
          placeId: nearbyPlace.placeId,
          name: nearbyPlace.name,
          address: nearbyPlace.address,
          lat: nearbyPlace.lat,
          lng: nearbyPlace.lng,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .onConflictDoNothing()
  }

  return places
}
