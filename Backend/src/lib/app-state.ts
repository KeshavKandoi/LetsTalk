import { and, asc, desc, eq, inArray, lt, or, sql } from 'drizzle-orm'
// agents removed
import { getRequestHeaders } from '@tanstack/react-start/server'
import type {
  ActiveConnectionState,
  AppSession,
  AppState,
  ConnectionPreviewState,
  CurrentPlaceState,
  NearbyPlace,
  NearbyPlacePreviewState,
  PresenceStatus,
  QrHandoffState,
  UserAgentState,
  UserProfileState,
} from '@frontend/lib/app-types'
import { auth } from './auth'
import { db } from './db'
import { UserAgent } from './agents/user-agent'
import {
  connectRequestRejection,
  handoffCode,
  handoffConnection,
  friendRequest,
  userActivity,
  friendMessage,
  place,
  user,
  userProfile,
} from './db/schema'
import {
  getAppBaseUrl,
  getGoogleMapsApiKey,

  getGoogleMapsMapId,
} from './env'

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
  const sessionUser = session.user as typeof session.user & {
    username?: string | null
    displayUsername?: string | null
  }

  return {
    session: {
      expiresAt: session.session.expiresAt,
    },
    user: {
      id: sessionUser.id,
      name: sessionUser.name,
      username: sessionUser.username ?? null,
      displayUsername: sessionUser.displayUsername ?? null,
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
    isFindable: profileRecord.isFindable,
    isVerifiedOnSite: profileRecord.isVerifiedOnSite,
    locationHint: profileRecord.locationHint,
    pingRequestedAt: profileRecord.pingRequestedAt,
    pingRequestedByUserId: profileRecord.pingRequestedByUserId,
    pingRequestedByUsername: profileRecord.pingRequestedByUsername,
createdAt: profileRecord.createdAt,
    updatedAt: profileRecord.updatedAt,
    age: profileRecord.age,
    gender: profileRecord.gender,
    about: profileRecord.about ?? null,
    photoUrl: profileRecord.photoUrl,
  }
}

function mapPlace(
  record: typeof place.$inferSelect,
  readyCount = 0,
): NearbyPlace {
  return {
    placeId: record.placeId,
    name: record.name,
    address: record.address,
    lat: record.lat,
    lng: record.lng,
    readyCount,
  }
}

function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const toRad = (value: number) => (value * Math.PI) / 180
  const earthRadiusMeters = 6371000
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(h))
}

function assertCoordinates(input: { latitude?: number; longitude?: number }) {
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    throw new Error('A valid location is required.')
  }
  return { latitude: input.latitude as number, longitude: input.longitude as number }
}

const READY_STALE_MS = 60_000
const CONNECT_REQUEST_BLOCK_MS = 20 * 60_000

async function getReadyCountByPlaceIds(placeIds: string[]) {
  if (placeIds.length === 0) {
    return new Map<string, number>()
  }

  const rows = await db
    .select({
      placeId: userProfile.currentPlaceId,
      readyCount: sql<number>`count(*)`,
    })
    .from(userProfile)
    .where(
      and(
        inArray(userProfile.currentPlaceId, placeIds),
        eq(userProfile.status, 'ready'),
      ),
    )
    .groupBy(userProfile.currentPlaceId)

  return new Map(
    rows
      .filter((row): row is { placeId: string; readyCount: number } => Boolean(row.placeId))
      .map((row) => [row.placeId, row.readyCount]),
  )
}

export async function touchReadyPresence(userId: string, now = new Date()) {
  await db
    .update(userProfile)
    .set({ updatedAt: now })
    .where(and(eq(userProfile.userId, userId), inArray(userProfile.status, ['ready', 'in_conversation'])))
}

export async function expireStaleReady(now = new Date()) {
  const staleCutoff = new Date(now.getTime() - READY_STALE_MS)
  const staleProfiles = await db
    .select({
      userId: userProfile.userId,
      currentPlaceId: userProfile.currentPlaceId,
    })
    .from(userProfile)
    .where(
      and(
        inArray(userProfile.status, ['ready', 'in_conversation']),
        lt(userProfile.updatedAt, staleCutoff),
      ),
    )

  if (staleProfiles.length === 0) {
    return { updatedUserIds: [] as string[], affectedPlaceIds: [] as string[] }
  }

  for (const staleProfile of staleProfiles) {
    await new UserAgent(staleProfile.userId).clearTransientPresence()
  }

  return {
    updatedUserIds: staleProfiles.map((profile) => profile.userId),
    affectedPlaceIds: [...new Set(staleProfiles.map((profile) => profile.currentPlaceId).filter((id): id is string => Boolean(id)))],
  }
}

export async function cancelOrphanedRequests(now = new Date()) {
  const pendingRequests = await db
    .select({
      id: handoffConnection.id,
      placeId: handoffConnection.placeId,
      requesterUserId: handoffConnection.requesterUserId,
      recipientUserId: handoffConnection.recipientUserId,
      requesterStatus: userProfile.status,
    })
    .from(handoffConnection)
    .leftJoin(userProfile, eq(userProfile.userId, handoffConnection.requesterUserId))
    .where(eq(handoffConnection.status, 'pending'))

  const orphanedRequests = pendingRequests.filter((request) => request.requesterStatus !== 'ready')

  if (orphanedRequests.length === 0) {
    return {
      canceledRequestIds: [] as string[],
      affectedPlaceIds: [] as string[],
      affectedUserIds: [] as string[],
    }
  }

  await db
    .update(handoffConnection)
    .set({ status: 'canceled', updatedAt: now })
    .where(
      inArray(
        handoffConnection.id,
        orphanedRequests.map((request) => request.id),
      ),
    )

  return {
    canceledRequestIds: orphanedRequests.map((request) => request.id),
    affectedPlaceIds: [...new Set(orphanedRequests.map((request) => request.placeId))],
    affectedUserIds: [...new Set(orphanedRequests.flatMap((request) => [request.requesterUserId, request.recipientUserId]))],
  }
}

async function getConnectRequestRejectionRecord(
  requesterUserId: string,
  recipientUserId: string,
) {
  const [record] = await db
    .select()
    .from(connectRequestRejection)
    .where(
      and(
        eq(connectRequestRejection.requesterUserId, requesterUserId),
        eq(connectRequestRejection.recipientUserId, recipientUserId),
      ),
    )
    .limit(1)

  return record ?? null
}

async function incrementConnectRequestRejection(
  requesterUserId: string,
  recipientUserId: string,
  now = new Date(),
) {
  const existingRecord = await getConnectRequestRejectionRecord(
    requesterUserId,
    recipientUserId,
  )
  const rejectionCount =
    existingRecord &&
    now.getTime() - new Date(existingRecord.lastRejectedAt).getTime() <
      CONNECT_REQUEST_BLOCK_MS
      ? existingRecord.rejectionCount + 1
      : 1

  await db
    .insert(connectRequestRejection)
    .values({
      requesterUserId,
      recipientUserId,
      rejectionCount,
      lastRejectedAt: now,
      createdAt: existingRecord?.createdAt ?? now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        connectRequestRejection.requesterUserId,
        connectRequestRejection.recipientUserId,
      ],
      set: {
        rejectionCount,
        lastRejectedAt: now,
        updatedAt: now,
      },
    })
}

async function isConnectRequestBlocked(
  requesterUserId: string,
  recipientUserId: string,
  now = new Date(),
) {
  const record = await getConnectRequestRejectionRecord(
    requesterUserId,
    recipientUserId,
  )

  if (!record) {
    return false
  }

  if (
    now.getTime() - new Date(record.lastRejectedAt).getTime() >=
    CONNECT_REQUEST_BLOCK_MS
  ) {
    return false
  }

  return record.rejectionCount >= 2
}

async function endConnectionsForLocationExit(userId: string, now: Date) {
  const activeConnections = await db
    .select()
    .from(handoffConnection)
    .where(
      and(
        eq(handoffConnection.status, 'accepted'),
        or(eq(handoffConnection.requesterUserId, userId), eq(handoffConnection.recipientUserId, userId)),
      ),
    )

  const participantUserIds = new Set<string>()
  const placeIds = new Set<string>()

  for (const connection of activeConnections) {
    placeIds.add(connection.placeId)
    participantUserIds.add(connection.requesterUserId)
    participantUserIds.add(connection.recipientUserId)
    await db
      .update(handoffConnection)
      .set({ status: 'left_verified_location', updatedAt: now })
      .where(eq(handoffConnection.id, connection.id))

    const otherUserId = connection.requesterUserId === userId
      ? connection.recipientUserId
      : connection.requesterUserId
    await db
      .update(userProfile)
      .set({ status: 'ready', isFindable: false, updatedAt: now })
      .where(and(eq(userProfile.userId, otherUserId), eq(userProfile.status, 'in_conversation')))
  }

  return { participantUserIds: [...participantUserIds], placeIds: [...placeIds] }
}

function getDisplayUsername(record: typeof user.$inferSelect) {
  return record.displayUsername || record.username || record.name
}

function createHandoffToken() {
  return crypto.randomUUID().replaceAll('-', '')
}

function buildQrUrl(token: string) {
  const url = new URL(getAppBaseUrl())
  url.searchParams.set('scan', token)
  return url.toString()
}

function normalizeFriendPair(scannerId: string, scannedUserId: string) {
  // Sort for deduplication — same pair always maps to same row
  const sorted = scannerId < scannedUserId
    ? { requesterUserId: scannerId, recipientUserId: scannedUserId }
    : { requesterUserId: scannedUserId, recipientUserId: scannerId }
  return { ...sorted, initiatorUserId: scannerId }
}

function mapFriendUser(record: {
  id: string
  otherId: string
  username: string | null
  fallbackUsername: string | null
  fallbackName: string
  moodEmoji: string | null
  photoUrl: string | null
}) {
  return {
    userId: record.otherId,
    username: record.username || record.fallbackUsername || record.fallbackName,
    moodEmoji: record.moodEmoji,
    photoUrl: record.photoUrl,
  }
}

async function getFriendshipRecordForUserPair(
  userId: string,
  otherUserId: string,
) {
  // Search both directions since we no longer sort pairs
  const [requestRecord] = await db
    .select()
    .from(friendRequest)
    .where(
      or(
        and(
          eq(friendRequest.requesterUserId, userId),
          eq(friendRequest.recipientUserId, otherUserId),
        ),
        and(
          eq(friendRequest.requesterUserId, otherUserId),
          eq(friendRequest.recipientUserId, userId),
        ),
      ),
    )
    .limit(1)

  return requestRecord ?? null
}

async function getOrCreateQrHandoff(
  userId: string,
  placeId: string,
  status: PresenceStatus,
): Promise<QrHandoffState> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000)
  const [existingCode] = await db
    .select()
    .from(handoffCode)
    .where(eq(handoffCode.userId, userId))
    .limit(1)

  let token = existingCode?.token ?? createHandoffToken()

  if (existingCode && existingCode.expiresAt <= now) {
    token = createHandoffToken()
  }

  await db
    .insert(handoffCode)
    .values({
      token,
      userId,
      placeId,
      expiresAt,
      createdAt: existingCode?.createdAt ?? now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: handoffCode.userId,
      set: {
        token,
        placeId,
        expiresAt,
        updatedAt: now,
      },
    })

  return {
    token,
    url: buildQrUrl(token),
    expiresAt,
    isActive: status === 'ready',
  }
}

export async function getActiveConnectionForUser(
  userId: string,
): Promise<ActiveConnectionState | null> {
  const [connectionRecord] = await db
    .select()
    .from(handoffConnection)
    .where(
      and(
        eq(handoffConnection.status, 'accepted'),
        or(
          eq(handoffConnection.requesterUserId, userId),
          eq(handoffConnection.recipientUserId, userId),
        ),
      ),
    )
    .orderBy(desc(handoffConnection.createdAt))
    .limit(1)

  if (!connectionRecord) {
    return null
  }

  const counterpartUserId =
    connectionRecord.requesterUserId === userId
      ? connectionRecord.recipientUserId
      : connectionRecord.requesterUserId

  const [counterpartUser] = await db
    .select()
    .from(user)
    .where(eq(user.id, counterpartUserId))
    .limit(1)
  const [counterpartProfile] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.userId, counterpartUserId))
    .limit(1)

  if (!counterpartUser || !counterpartProfile) {
    return null
  }

  return {
    id: connectionRecord.id,
    placeId: connectionRecord.placeId,
    createdAt: connectionRecord.createdAt,
    counterpart: {
      userId: counterpartUser.id,
      username: getDisplayUsername(counterpartUser),
      moodEmoji: counterpartProfile.moodEmoji,
      intentSummary: counterpartProfile.intentSummary,
      spotLabel: counterpartProfile.locationHint ?? null,
      locationHint: counterpartProfile.locationHint ?? null,
      photoUrl: counterpartProfile.photoUrl,
    },
  }
}

async function getPendingConnectionRequestsForUser(userId: string) {
  const rows = await db
    .select({
      id: handoffConnection.id,
      requesterUserId: handoffConnection.requesterUserId,
      recipientUserId: handoffConnection.recipientUserId,
      placeId: handoffConnection.placeId,
      status: handoffConnection.status,
      createdAt: handoffConnection.createdAt,
      updatedAt: handoffConnection.updatedAt,
      otherUserId: user.id,
      username: user.displayUsername,
      fallbackUsername: user.username,
      fallbackName: user.name,
      moodEmoji: userProfile.moodEmoji,
      intentSummary: userProfile.intentSummary,
      photoUrl: userProfile.photoUrl,
    })
    .from(handoffConnection)
    .innerJoin(
      user,
      or(
        and(eq(handoffConnection.requesterUserId, userId), eq(user.id, handoffConnection.recipientUserId)),
        and(eq(handoffConnection.recipientUserId, userId), eq(user.id, handoffConnection.requesterUserId)),
      ),
    )
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .where(
      and(
        eq(handoffConnection.status, 'pending'),
        or(
          eq(handoffConnection.requesterUserId, userId),
          eq(handoffConnection.recipientUserId, userId),
        ),
      ),
    )
    .orderBy(desc(handoffConnection.createdAt))

  return rows.map((row) => ({
    id: row.id,
    requesterUserId: row.requesterUserId,
    recipientUserId: row.recipientUserId,
    placeId: row.placeId,
    status: row.status,
    direction: row.requesterUserId === userId ? 'outgoing' as const : 'incoming' as const,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    user: {
      userId: row.otherUserId,
      username: row.username || row.fallbackUsername || row.fallbackName,
      moodEmoji: row.moodEmoji,
      intentSummary: row.intentSummary,
      photoUrl: row.photoUrl,
    },
  }))
}

async function getRecentConnectionEventsForUser(userId: string) {
  const since = new Date(Date.now() - 60_000)
  const rows = await db
    .select({
      id: handoffConnection.id,
      requesterUserId: handoffConnection.requesterUserId,
      recipientUserId: handoffConnection.recipientUserId,
      status: handoffConnection.status,
      updatedAt: handoffConnection.updatedAt,
    })
    .from(handoffConnection)
    .where(
      and(
        or(
          and(
            eq(handoffConnection.status, 'accepted'),
            or(
              eq(handoffConnection.requesterUserId, userId),
              eq(handoffConnection.recipientUserId, userId),
            ),
          ),
          and(
            inArray(handoffConnection.status, ['declined', 'left_verified_location']),
            eq(handoffConnection.requesterUserId, userId),
          ),
          and(
            eq(handoffConnection.status, 'left_verified_location'),
            eq(handoffConnection.recipientUserId, userId),
          ),
        ),
      ),
    )
    .orderBy(desc(handoffConnection.updatedAt))
    .limit(20)

  const recentRows = rows.filter((row) => new Date(row.updatedAt).getTime() > since.getTime())
  const otherUserIds = recentRows.map((row) =>
    row.requesterUserId === userId ? row.recipientUserId : row.requesterUserId,
  )
  const otherUsers = otherUserIds.length > 0
    ? await db
        .select({
          id: user.id,
          username: user.displayUsername,
          fallbackUsername: user.username,
          fallbackName: user.name,
        })
        .from(user)
        .where(inArray(user.id, otherUserIds))
    : []
  const userById = new Map(otherUsers.map((otherUser) => [otherUser.id, otherUser]))

  return recentRows.map((row) => ({
    id: row.id,
    status: row.status,
    direction: row.requesterUserId === userId ? 'outgoing' as const : 'incoming' as const,
    updatedAt: row.updatedAt,
    user: (() => {
      const otherUserId = row.requesterUserId === userId ? row.recipientUserId : row.requesterUserId
      const otherUser = userById.get(otherUserId)
      return {
        userId: otherUserId,
        username: otherUser?.username || otherUser?.fallbackUsername || otherUser?.fallbackName || 'Someone nearby',
      }
    })(),
    message: row.status === 'left_verified_location'
      ? 'Your connection has left the verified location and is no longer available.'
      : undefined,
  }))
}

async function resolveScannedHandoff(
  token: string,
  viewerUserId: string,
): Promise<ConnectionPreviewState> {
  const [viewerProfile] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.userId, viewerUserId))
    .limit(1)
  const preview = await resolveScanPreview(token, viewerUserId)

  if (!viewerProfile?.currentPlaceId) {
    throw new Error('Pick your current place before scanning someone nearby.')
  }

  if (viewerProfile.currentPlaceId !== preview.placeId) {
    throw new Error('That QR code belongs to someone in a different place.')
  }

  return preview
}

async function resolveScanPreview(
  token: string,
  viewerUserId: string,
): Promise<ConnectionPreviewState> {
  const now = new Date()

  const [codeRecord] = await db
    .select()
    .from(handoffCode)
    .where(eq(handoffCode.token, token))
    .limit(1)

  if (!codeRecord || codeRecord.expiresAt <= now) {
    throw new Error('That QR code expired. Ask them to reopen their place view.')
  }

  if (codeRecord.userId === viewerUserId) {
    throw new Error('That is your own QR code.')
  }

  const [targetUser] = await db
    .select()
    .from(user)
    .where(eq(user.id, codeRecord.userId))
    .limit(1)
  const [targetProfile] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.userId, codeRecord.userId))
    .limit(1)
  const [targetPlace] = await db
    .select()
    .from(place)
    .where(eq(place.placeId, codeRecord.placeId))
    .limit(1)

  if (!targetUser || !targetProfile || !targetPlace) {
    throw new Error('We could not resolve that person right now.')
  }

  return {
    token,
    placeId: targetPlace.placeId,
    placeName: targetPlace.name,
    counterpart: {
      userId: targetUser.id,
      username: getDisplayUsername(targetUser),
      moodEmoji: targetProfile.moodEmoji,
      intentSummary: targetProfile.intentSummary,
      locationHint: targetProfile.locationHint ?? null,
      status: targetProfile.status as PresenceStatus,
    },
  }
}

function mapUserProfileStateFromAgent(
  state: UserAgentState,
  intentText: string | null,
): UserProfileState {
  const now = state.updatedAt ? new Date(state.updatedAt) : new Date()

  return {
    userId: state.userId,
    moodEmoji: state.moodEmoji,
    intentText,
    intentSummary: state.intentSummary,
    status: state.status,
    currentPlaceId: state.currentPlaceId,
    isFindable: state.isFindable,
    isVerifiedOnSite: state.isVerifiedOnSite ?? false,
    locationHint: state.locationHint,
    pingRequestedAt: state.pingRequestedAt,
    pingRequestedByUserId: state.pingRequestedByUserId,
    pingRequestedByUsername: state.pingRequestedByUsername,
    createdAt: now,
    updatedAt: now,
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
      qrHandoff: null,
      activeConnection: null,
    }
  }

  await expireStaleReady()

  const [profileRecord] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.userId, session.user.id))
    .limit(1)

  let currentPlace: CurrentPlaceState | null = null
  let qrHandoff: QrHandoffState | null = null

  if (profileRecord?.currentPlaceId) {
    const [currentPlaceRecord] = await db
      .select()
      .from(place)
      .where(eq(place.placeId, profileRecord.currentPlaceId))
      .limit(1)

    if (currentPlaceRecord) {
      const readyCountByPlaceId = await getReadyCountByPlaceIds([
        profileRecord.currentPlaceId,
      ])
      const readyCount = readyCountByPlaceId.get(profileRecord.currentPlaceId) ?? 0

      currentPlace = {
        place: mapPlace(currentPlaceRecord, readyCount),
        readyCount,
      }

      qrHandoff = await getOrCreateQrHandoff(
        session.user.id,
        profileRecord.currentPlaceId,
        profileRecord.status as PresenceStatus,
      )
    }
  }

  return {
    session: mapSession(session),
    profile: profileRecord ? mapUserProfile(profileRecord) : null,
    currentPlace,
    qrHandoff,
    activeConnection: await getActiveConnectionForUser(session.user.id),
  }
}

async function getUserAgent(userId: string) {
  return new UserAgent(userId)
}

export async function saveUserProfile(input: {
  moodEmoji: string
  intentText: string
  currentPlaceId: string
}) {
  const session = await requireCurrentSession()
  const agent = await getUserAgent(session.user.id)
  const nextState = await agent.setProfile(input)
  const intentText = input.intentText.replace(/\s+/g, ' ').trim() || null

  return mapUserProfileStateFromAgent(nextState, intentText)
}

export async function setReadyState(input: { ready: boolean; latitude?: number; longitude?: number }) {
  const session = await requireCurrentSession()
  if (input.ready) {
    const currentLocation = assertCoordinates(input)
    const [profileRecord] = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, session.user.id))
      .limit(1)
    if (!profileRecord?.currentPlaceId) {
      throw new Error('Pick your current place before setting yourself ready.')
    }
    const [placeRecord] = await db
      .select()
      .from(place)
      .where(eq(place.placeId, profileRecord.currentPlaceId))
      .limit(1)
    if (!placeRecord) {
      throw new Error('That place is no longer available.')
    }
    const placeLocation = {
      latitude: placeRecord.lat,
      longitude: placeRecord.lng,
    }
    if (distanceMeters(currentLocation, placeLocation) > 200) {
      throw new Error('You are outside 100 meters of this location.')
    }
  }
  const agent = await getUserAgent(session.user.id)
  await agent.setReady(input)
  await db
    .update(userProfile)
    .set({ isVerifiedOnSite: input.ready, updatedAt: new Date() })
    .where(eq(userProfile.userId, session.user.id))
}

export async function verifyOnSiteLocation(input: { latitude?: number; longitude?: number }) {
  const session = await requireCurrentSession()
  const currentLocation = assertCoordinates(input)
  const [profileRecord] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.userId, session.user.id))
    .limit(1)

  if (!profileRecord?.currentPlaceId) return { success: true, verified: false }

  const [placeRecord] = await db
    .select()
    .from(place)
    .where(eq(place.placeId, profileRecord.currentPlaceId))
    .limit(1)
  if (!placeRecord) return { success: true, verified: false }

  const placeLocation = {
    latitude: placeRecord.lat,
    longitude: placeRecord.lng,
  }
  const isWithinRange = distanceMeters(currentLocation, placeLocation) <= 200

  if (isWithinRange) {
    await db
      .update(userProfile)
      .set({ isVerifiedOnSite: true, updatedAt: new Date() })
      .where(eq(userProfile.userId, session.user.id))
    return { success: true, verified: true }
  }

  const now = new Date()
  const ended = await endConnectionsForLocationExit(session.user.id, now)
  await db
    .update(userProfile)
    .set({
      status: 'present',
      isFindable: false,
      isVerifiedOnSite: false,
      locationHint: null,
      pingRequestedAt: null,
      pingRequestedByUserId: null,
      pingRequestedByUsername: null,
      updatedAt: now,
    })
    .where(eq(userProfile.userId, session.user.id))

  for (const placeId of new Set([profileRecord.currentPlaceId, ...ended.placeIds])) {
    await import('./agents/place-agent').then(({ broadcastPlaceUpdate }) => broadcastPlaceUpdate(placeId))
  }
  for (const userId of ended.participantUserIds.filter((id) => id !== session.user.id)) {
    await new UserAgent(userId).refresh()
  }

  return {
    success: true,
    verified: false,
    deactivated: true,
    message: 'You are out of 100 meters. Your availability has been deactivated.',
  }
}

export async function saveFinderProfile(input: {
  isFindable: boolean
  locationHint: string | null
}) {
  const session = await requireCurrentSession()
  const agent = await getUserAgent(session.user.id)
  const [existingProfile] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.userId, session.user.id))
    .limit(1)
  const nextState = await agent.setFinderProfile(input)

  return mapUserProfileStateFromAgent(nextState, existingProfile?.intentText ?? null)
}

export async function pingFindableUser(input: { userId: string }) {
  const session = await requireCurrentSession()
  const targetUserId = input.userId.trim()

  if (!targetUserId) {
    throw new Error('Choose someone in the place first.')
  }

  const targetAgent = await getUserAgent(targetUserId)
  await targetAgent.requestFinderPing({
    requesterUserId: session.user.id,
  })

  return {
    success: true,
  }
}

export async function leaveCurrentPlace() {
  const session = await requireCurrentSession()
  const agent = await getUserAgent(session.user.id)
  await agent.leavePlace()
}

export async function resolveScanToken(input: { token: string }) {
  const session = await requireCurrentSession()
  const token = input.token.trim()

  if (!token) {
    throw new Error('Scan a LetsTalk QR code first.')
  }

  return resolveScannedHandoff(token, session.user.id)
}

export async function connectFromScan(input: { token: string }) {
  const session = await requireCurrentSession()
  const preview = await resolveScannedHandoff(input.token.trim(), session.user.id)
  const [viewerProfile] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.userId, session.user.id))
    .limit(1)
  const [targetProfile] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.userId, preview.counterpart.userId))
    .limit(1)

  if (!viewerProfile?.currentPlaceId || viewerProfile.currentPlaceId !== preview.placeId) {
    throw new Error('You need to be checked into the same place first.')
  }

  // If the viewer is already in a conversation, check whether it's with the SAME
  // person they're scanning right now. If so, this scan is confirming/verifying
  // the existing connection rather than starting a new one.
  const existingScanConnection = await getActiveConnectionForUser(session.user.id)
  if (existingScanConnection && existingScanConnection.counterpart.userId === preview.counterpart.userId) {
    await db
      .update(userProfile)
      .set({ isVerifiedOnSite: true, updatedAt: new Date() })
      .where(eq(userProfile.userId, session.user.id))
    await db
      .update(userProfile)
      .set({ isVerifiedOnSite: true, updatedAt: new Date() })
      .where(eq(userProfile.userId, preview.counterpart.userId))
    return {
      success: true,
      connectionId: existingScanConnection.id,
      alreadyConnected: true,
    }
  }

  if (viewerProfile.status === 'in_conversation') {
    throw new Error('End your current conversation before starting another one.')
  }

  if (!targetProfile?.currentPlaceId || targetProfile.currentPlaceId !== preview.placeId) {
    throw new Error('They are no longer checked into this place.')
  }

  if (targetProfile.status !== 'ready') {
    throw new Error('They are not marked ready right now.')
  }
  if (!viewerProfile.isVerifiedOnSite || !targetProfile.isVerifiedOnSite) {
    throw new Error('Both people need verified on-site status before connecting.')
  }

  const existingConnection = await getActiveConnectionForUser(session.user.id)
  if (existingConnection) {
    throw new Error('You are already connected with someone nearby.')
  }

  const targetConnection = await getActiveConnectionForUser(preview.counterpart.userId)
  if (targetConnection) {
    throw new Error('They are already in a conversation.')
  }

  const agent = await getUserAgent(session.user.id)
  const result = await agent.connectWithUser({
    counterpartUserId: preview.counterpart.userId,
    placeId: preview.placeId,
  })

  return {
    success: result.success,
    connectionId: result.connectionId,
  }
}

export async function sendConnectRequest(input: {
  targetUserId: string
  viewerUserId?: string
}) {
  const session = input.viewerUserId
    ? { user: { id: input.viewerUserId } }
    : await requireCurrentSession()
  const targetUserId = input.targetUserId.trim()

  if (!targetUserId) throw new Error('Choose someone nearby first.')
  if (targetUserId === session.user.id) {
    throw new Error('You cannot send a connection request to yourself.')
  }

  const [viewerProfile] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.userId, session.user.id))
    .limit(1)
  const [targetProfile] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.userId, targetUserId))
    .limit(1)

  if (!viewerProfile?.currentPlaceId || !targetProfile?.currentPlaceId) {
    throw new Error('Both people need to be checked into a place.')
  }
  if (viewerProfile.currentPlaceId !== targetProfile.currentPlaceId) {
    throw new Error('You need to be in the same place to connect.')
  }
  if (viewerProfile.status === 'in_conversation') {
    throw new Error('You are already connected with someone nearby.')
  }
  if (targetProfile.status === 'in_conversation') {
    throw new Error('They are already connected with someone nearby.')
  }
  if (targetProfile.status !== 'ready') {
    throw new Error('They are not marked ready right now.')
  }
  if (!viewerProfile.isVerifiedOnSite || !targetProfile.isVerifiedOnSite) {
    throw new Error('Both people need verified on-site status before connecting.')
  }

  const existingViewerConnection = await getActiveConnectionForUser(session.user.id)
  const existingTargetConnection = await getActiveConnectionForUser(targetUserId)
  if (existingViewerConnection) {
    throw new Error('You are already connected with someone nearby.')
  }
  if (existingTargetConnection) {
    throw new Error('They are already connected with someone nearby.')
  }

  if (await isConnectRequestBlocked(session.user.id, targetUserId, new Date())) {
    throw new Error('You cannot send another request to this person for 20 minutes.')
  }

  const now = new Date()
  const [existingRequest] = await db
    .select()
    .from(handoffConnection)
    .where(
      and(
        eq(handoffConnection.status, 'pending'),
        or(
          and(
            eq(handoffConnection.requesterUserId, session.user.id),
            eq(handoffConnection.recipientUserId, targetUserId),
          ),
          and(
            eq(handoffConnection.requesterUserId, targetUserId),
            eq(handoffConnection.recipientUserId, session.user.id),
          ),
        ),
      ),
    )
    .limit(1)

  if (existingRequest) {
    return { success: true, requestId: existingRequest.id, alreadyPending: true }
  }

  const requestId = crypto.randomUUID()
  await db.insert(handoffConnection).values({
    id: requestId,
    requesterUserId: session.user.id,
    recipientUserId: targetUserId,
    placeId: viewerProfile.currentPlaceId,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  })

  return { success: true, requestId }
}

export async function respondToConnectRequest(input: {
  requestId: string
  action: 'accept' | 'decline' | 'cancel'
  viewerUserId?: string
}) {
  const session = input.viewerUserId
    ? { user: { id: input.viewerUserId } }
    : await requireCurrentSession()
  const requestId = input.requestId.trim()
  if (!requestId) throw new Error('Connection request not found.')

  const [requestRecord] = await db
    .select()
    .from(handoffConnection)
    .where(eq(handoffConnection.id, requestId))
    .limit(1)

  if (
    !requestRecord ||
    requestRecord.status !== 'pending' ||
    (requestRecord.requesterUserId !== session.user.id &&
      requestRecord.recipientUserId !== session.user.id)
  ) {
    throw new Error('Connection request not found.')
  }

  const now = new Date()

  if (input.action === 'cancel') {
    if (requestRecord.requesterUserId !== session.user.id) {
      throw new Error('Only the sender can cancel this request.')
    }
    await db
      .update(handoffConnection)
      .set({ status: 'canceled', updatedAt: now })
      .where(eq(handoffConnection.id, requestRecord.id))
    return { success: true }
  }

  if (requestRecord.recipientUserId !== session.user.id) {
    throw new Error('Only the recipient can respond to this request.')
  }

  if (input.action === 'decline') {
    await db
      .update(handoffConnection)
      .set({ status: 'declined', updatedAt: now })
      .where(eq(handoffConnection.id, requestRecord.id))
    await incrementConnectRequestRejection(
      requestRecord.requesterUserId,
      requestRecord.recipientUserId,
      now,
    )
    return { success: true }
  }

  const [requesterProfile] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.userId, requestRecord.requesterUserId))
    .limit(1)
  const [recipientProfile] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.userId, requestRecord.recipientUserId))
    .limit(1)

  if (!requesterProfile?.currentPlaceId || !recipientProfile?.currentPlaceId) {
    throw new Error('Both people need to be checked into a place.')
  }
  if (
    requesterProfile.currentPlaceId !== requestRecord.placeId ||
    recipientProfile.currentPlaceId !== requestRecord.placeId
  ) {
    throw new Error('Both people need to still be in this place.')
  }
  if (requesterProfile.status === 'in_conversation' || recipientProfile.status === 'in_conversation') {
    throw new Error('One of you is already connected.')
  }
  if (!requesterProfile.isVerifiedOnSite || !recipientProfile.isVerifiedOnSite) {
    throw new Error('Both people need verified on-site status before connecting.')
  }

  await db
    .update(handoffConnection)
    .set({ status: 'accepted', updatedAt: now })
    .where(eq(handoffConnection.id, requestRecord.id))

  await db
    .update(handoffConnection)
    .set({ status: 'canceled', updatedAt: now })
    .where(
      and(
        eq(handoffConnection.status, 'pending'),
        or(
          eq(handoffConnection.requesterUserId, requestRecord.requesterUserId),
          eq(handoffConnection.recipientUserId, requestRecord.requesterUserId),
          eq(handoffConnection.requesterUserId, requestRecord.recipientUserId),
          eq(handoffConnection.recipientUserId, requestRecord.recipientUserId),
        ),
      ),
    )

  await db
    .update(userProfile)
    .set({
      status: 'in_conversation',
      isFindable: false,
      locationHint: null,
      pingRequestedAt: null,
      pingRequestedByUserId: null,
      pingRequestedByUsername: null,
      updatedAt: now,
    })
    .where(
      or(
        eq(userProfile.userId, requestRecord.requesterUserId),
        eq(userProfile.userId, requestRecord.recipientUserId),
      ),
    )

  return { success: true, connectionId: requestRecord.id }
}

export async function createFriendRequest(input: { token?: string }) {
  const session = await requireCurrentSession()
  let targetUserId = ''
  let placeId: string | null = null

  let scannedPreview: Awaited<ReturnType<typeof resolveScannedHandoff>> | null = null
  if (input.token) {
    scannedPreview = await resolveScannedHandoff(input.token.trim(), session.user.id)
    targetUserId = scannedPreview.counterpart.userId
    placeId = scannedPreview.placeId
  }

  if (!targetUserId) {
    throw new Error('Friend requests can only be sent by scanning a QR code.')
  }

  if (targetUserId === session.user.id) {
    throw new Error('You cannot send a friend request to yourself.')
  }

  const [viewerProfile] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.userId, session.user.id))
    .limit(1)
  const [targetProfile] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.userId, targetUserId))
    .limit(1)

  if (!viewerProfile?.currentPlaceId || !targetProfile?.currentPlaceId) {
    throw new Error('Both people need to be checked into a place.')
  }

  if (viewerProfile.currentPlaceId !== targetProfile.currentPlaceId) {
    throw new Error('You need to be in the same place to add them.')
  }

  const now = new Date()
  const pair = normalizeFriendPair(session.user.id, targetUserId)
  const [existingRequest] = await db
    .select()
    .from(friendRequest)
    .where(
      and(
        eq(friendRequest.requesterUserId, pair.requesterUserId),
        eq(friendRequest.recipientUserId, pair.recipientUserId),
      ),
    )
    .limit(1)

  // Neither side is auto-accepted — both must manually accept
  const requesterAccepted = existingRequest?.requesterAccepted ?? false
  const recipientAccepted = existingRequest?.recipientAccepted ?? false
  const nextStatus = requesterAccepted && recipientAccepted ? 'accepted' : 'pending'

  await db
    .insert(friendRequest)
    .values({
      id: crypto.randomUUID(),
      requesterUserId: pair.requesterUserId,
      recipientUserId: pair.recipientUserId,
      initiatorUserId: session.user.id,
      placeId: placeId ?? viewerProfile.currentPlaceId,
      requesterAccepted,
      recipientAccepted,
      status: nextStatus,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [friendRequest.requesterUserId, friendRequest.recipientUserId],
      set: {
        status: nextStatus,
        initiatorUserId: session.user.id,
        requesterAccepted,
        recipientAccepted,
        placeId: placeId ?? viewerProfile.currentPlaceId,
        updatedAt: now,
      },
    })

  return {
    success: true,
    counterpart: scannedPreview?.counterpart ?? null,
    placeName: scannedPreview?.placeName ?? null,
  }
}

export async function listFriends(input?: { viewerUserId?: string }) {
  const session = input?.viewerUserId ? { user: { id: input.viewerUserId } } : await requireCurrentSession()

  const rows = await db
    .select({
      id: friendRequest.id,
      requesterUserId: friendRequest.requesterUserId,
      recipientUserId: friendRequest.recipientUserId,
      initiatorUserId: friendRequest.initiatorUserId,
      requesterAccepted: friendRequest.requesterAccepted,
      recipientAccepted: friendRequest.recipientAccepted,
      status: friendRequest.status,
      otherId: user.id,
      username: user.displayUsername,
      fallbackUsername: user.username,
      fallbackName: user.name,
      moodEmoji: userProfile.moodEmoji,
      photoUrl: userProfile.photoUrl,
      isOnline: userActivity.isOnline,
      lastSeenAt: userActivity.lastSeenAt,
    })
    .from(friendRequest)
    .innerJoin(
      user,
      or(
        and(eq(friendRequest.requesterUserId, session.user.id), eq(user.id, friendRequest.recipientUserId)),
        and(eq(friendRequest.recipientUserId, session.user.id), eq(user.id, friendRequest.requesterUserId)),
      ),
    )
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .leftJoin(userActivity, eq(userActivity.userId, user.id))
    .where(
      or(
        eq(friendRequest.requesterUserId, session.user.id),
        eq(friendRequest.recipientUserId, session.user.id),
      ),
    )
    .orderBy(desc(friendRequest.updatedAt))

  const acceptedRows = rows.filter((row) => row.status === 'accepted')
  const latestMessages = await Promise.all(
    acceptedRows.map(async (row) => {
      const [latestMessage] = await db
        .select({
          friendRequestId: friendMessage.friendRequestId,
          body: friendMessage.body,
          createdAt: friendMessage.createdAt,
        })
        .from(friendMessage)
        .where(eq(friendMessage.friendRequestId, row.id))
        .orderBy(desc(friendMessage.createdAt))
        .limit(1)

      return [row.id, latestMessage ?? null] as const
    }),
  )

  const latestMessageByRequestId = new Map(latestMessages)

  return {
    friends: acceptedRows.map((row) => ({
      id: row.id,
      ...mapFriendUser(row),
      lastMessage: latestMessageByRequestId.get(row.id)?.body ?? null,
      isOnline: row.isOnline ?? false,
      lastSeenAt: row.lastSeenAt ?? null,
    })),
    incoming: rows
      .filter((row) => {
        if (row.status !== 'pending') return false
        // Show as incoming if I haven't accepted yet (regardless of who scanned)
        const iAmRequester = row.requesterUserId === session.user.id
        return iAmRequester ? !row.requesterAccepted : !row.recipientAccepted
      })
      .map((row) => ({
        id: row.id,
        user: mapFriendUser(row),
      })),
    pending: rows
      .filter((row) => {
        if (row.status !== 'pending') return false
        // I have already accepted, waiting on the other person
        const iAmRequester = row.requesterUserId === session.user.id
        return iAmRequester ? row.requesterAccepted : row.recipientAccepted
      })
      .map((row) => ({
        id: row.id,
        user: mapFriendUser(row),
      })),
    rejected: rows
      .filter((row) => row.status === 'rejected')
      .map((row) => ({
        id: row.id,
        user: mapFriendUser(row),
      })),
  }
}

export async function respondToFriendRequest(input: {
  requestId?: string
  friendUserId?: string
  action: 'accept' | 'reject' | 'remove'
}) {
  const session = await requireCurrentSession()
  const [requestRecord] = input.requestId
    ? await db
        .select()
        .from(friendRequest)
        .where(eq(friendRequest.id, input.requestId))
        .limit(1)
    : input.friendUserId
      ? await db
          .select()
          .from(friendRequest)
          .where(
            or(
              and(
                eq(friendRequest.requesterUserId, session.user.id),
                eq(friendRequest.recipientUserId, input.friendUserId),
              ),
              and(
                eq(friendRequest.recipientUserId, session.user.id),
                eq(friendRequest.requesterUserId, input.friendUserId),
              ),
            ),
          )
          .limit(1)
      : []

  if (
    !requestRecord ||
    (requestRecord.requesterUserId !== session.user.id &&
      requestRecord.recipientUserId !== session.user.id)
  ) {
    throw new Error('Friend request not found.')
  }

  const now = new Date()

  if (input.action === 'remove') {
    await db
      .update(friendRequest)
      .set({
        status: 'removed',
        requesterAccepted: false,
        recipientAccepted: false,
        updatedAt: now,
      })
      .where(eq(friendRequest.id, requestRecord.id))
    return { success: true }
  }

  if (input.action === 'reject') {
    await db
      .update(friendRequest)
      .set({ status: 'rejected', updatedAt: now })
      .where(eq(friendRequest.id, requestRecord.id))
    return { success: true }
  }

  const requesterAccepted =
    requestRecord.requesterAccepted || requestRecord.requesterUserId === session.user.id
  const recipientAccepted =
    requestRecord.recipientAccepted || requestRecord.recipientUserId === session.user.id

  await db
    .update(friendRequest)
    .set({
      requesterAccepted,
      recipientAccepted,
      status: requesterAccepted && recipientAccepted ? 'accepted' : 'pending',
      updatedAt: now,
    })
    .where(eq(friendRequest.id, requestRecord.id))

  return { success: true }
}

export async function getConversationMessages(input: { friendUserId: string; viewerUserId?: string }) {
  const session = input.viewerUserId ? { user: { id: input.viewerUserId } } : await requireCurrentSession()
  const friendUserId = input.friendUserId.trim()

  if (!friendUserId) {
    throw new Error('Choose a friend first.')
  }

  const requestRecord = await getFriendshipRecordForUserPair(
    session.user.id,
    friendUserId,
  )

  console.log('[messages] Looking up friendship for:', session.user.id, '↔', friendUserId)
  console.log('[messages] Found record:', JSON.stringify(requestRecord))
  if (!requestRecord || requestRecord.status !== 'accepted') {
    throw new Error('You can only message accepted friends.')
  }

  const messageRows = await db
    .select({
      id: friendMessage.id,
      body: friendMessage.body,
      senderUserId: friendMessage.senderUserId,
      recipientUserId: friendMessage.recipientUserId,
      createdAt: friendMessage.createdAt,
    })
    .from(friendMessage)
    .where(eq(friendMessage.friendRequestId, requestRecord.id))
    .orderBy(asc(friendMessage.createdAt))

  return {
    messages: messageRows,
  }
}

export async function sendConversationMessage(input: {
  friendUserId: string
  body: string
  viewerUserId?: string
}) {
  const session = input.viewerUserId ? { user: { id: input.viewerUserId } } : await requireCurrentSession()
  const friendUserId = input.friendUserId.trim()
  const body = input.body.replace(/\s+/g, ' ').trim()

  if (!friendUserId) {
    throw new Error('Choose a friend first.')
  }

  if (!body) {
    throw new Error('Write a message first.')
  }

  const requestRecord = await getFriendshipRecordForUserPair(
    session.user.id,
    friendUserId,
  )

  console.log('[messages] Looking up friendship for:', session.user.id, '↔', friendUserId)
  console.log('[messages] Found record:', JSON.stringify(requestRecord))
  if (!requestRecord || requestRecord.status !== 'accepted') {
    throw new Error('You can only message accepted friends.')
  }

  const now = new Date()
  await db.insert(friendMessage).values({
    id: crypto.randomUUID(),
    friendRequestId: requestRecord.id,
    senderUserId: session.user.id,
    recipientUserId: friendUserId,
    body,
    status: 'sent',
    sentAt: now,
    createdAt: now,
    updatedAt: now,
  })

  await db
    .update(friendRequest)
    .set({ updatedAt: now })
    .where(eq(friendRequest.id, requestRecord.id))

  return { success: true }
}

export async function previewScanJoin(input: { token: string }) {
  const session = await requireCurrentSession()
  const token = input.token.trim()

  if (!token) {
    throw new Error('Scan a LetsTalk QR code first.')
  }

  return resolveScanPreview(token, session.user.id)
}

export async function joinPlaceAndConnectFromScan(input: { token: string; viewerUserId?: string }) {
  const session = input.viewerUserId ? { user: { id: input.viewerUserId } } : await requireCurrentSession()
  const token = input.token.trim()

  if (!token) {
    throw new Error('Scan a LetsTalk QR code first.')
  }

  const preview = await resolveScanPreview(token, session.user.id)
  const [targetProfile] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.userId, preview.counterpart.userId))
    .limit(1)

  if (!targetProfile?.currentPlaceId || targetProfile.currentPlaceId !== preview.placeId) {
    throw new Error('They are no longer checked into this place.')
  }

  if (targetProfile.status !== 'ready') {
    throw new Error('They are not marked ready right now.')
  }

  const existingConnection = await getActiveConnectionForUser(session.user.id)
  if (existingConnection) {
    throw new Error('You are already connected with someone nearby.')
  }

  const targetConnection = await getActiveConnectionForUser(preview.counterpart.userId)
  if (targetConnection) {
    throw new Error('They are already in a conversation.')
  }

  const agent = await getUserAgent(session.user.id)
  const result = await agent.joinPlaceAndConnectWithUser({
    counterpartUserId: preview.counterpart.userId,
    placeId: preview.placeId,
  })

  return {
    success: result.success,
    connectionId: result.connectionId,
  }
}

export async function endCurrentConnection(input?: { viewerUserId?: string }) {
  const session = input?.viewerUserId
    ? { user: { id: input.viewerUserId } }
    : await requireCurrentSession()
  const agent = await getUserAgent(session.user.id)
  const result = await agent.endCurrentConnection()

  return {
    success: result.success,
  }
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
    readyCount: 0,
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
            radius: 200,
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
      .onConflictDoUpdate({
        target: place.placeId,
        set: {
          name: sql`excluded.name`,
          address: sql`excluded.address`,
          lat: sql`excluded.lat`,
          lng: sql`excluded.lng`,
          updatedAt: now,
        },
      })
  }

  if (places.length === 0) {
    return places
  }

  const readyCountByPlaceId = await getReadyCountByPlaceIds(
    places.map((nearbyPlace) => nearbyPlace.placeId),
  )

  return places.map((nearbyPlace) => ({
    ...nearbyPlace,
    readyCount: readyCountByPlaceId.get(nearbyPlace.placeId) ?? 0,
  }))
}

export async function getNearbyPlacePreview(input: {
  placeId: string
  viewerUserId?: string
}) {
  if (!input.viewerUserId) {
    await requireCurrentSession()
  }

  const placeId = input.placeId.trim()

  if (!placeId) {
    throw new Error('Choose a place first.')
  }

  const [placeRecord] = await db
    .select()
    .from(place)
    .where(eq(place.placeId, placeId))
    .limit(1)

  if (!placeRecord) {
    throw new Error('That place is no longer available.')
  }

  const presentStatuses = ['present', 'ready', 'in_conversation'] as const
  const [{ readyCount, checkedInCount }] = await db
    .select({
      readyCount: sql<number>`count(case when ${userProfile.status} = 'ready' and ${userProfile.isVerifiedOnSite} = true then 1 end)`,
      checkedInCount: sql<number>`count(case when ${userProfile.isVerifiedOnSite} = true then 1 end)`,
    })
    .from(userProfile)
    .where(
      and(
        eq(userProfile.currentPlaceId, placeId),
        inArray(userProfile.status, presentStatuses),
        or(eq(userProfile.isVerifiedOnSite, true), input.viewerUserId ? eq(userProfile.userId, input.viewerUserId) : sql`false`),
      ),
    )

  const participantRecords = await db
    .select({
      userId: user.id,
      username: user.displayUsername,
      fallbackUsername: user.username,
      fallbackName: user.name,
      moodEmoji: userProfile.moodEmoji,
      intentText: userProfile.intentText,
      intentSummary: userProfile.intentSummary,
      status: userProfile.status,
      isFindable: userProfile.isFindable,
      isVerifiedOnSite: userProfile.isVerifiedOnSite,
      locationHint: userProfile.locationHint,
      age: userProfile.age,
      gender: userProfile.gender,
      photoUrl: userProfile.photoUrl,
      about: userProfile.about,
      pingRequestedAt: userProfile.pingRequestedAt,
      pingRequestedByUserId: userProfile.pingRequestedByUserId,
      pingRequestedByUsername: userProfile.pingRequestedByUsername,
    })
    .from(userProfile)
    .innerJoin(user, eq(user.id, userProfile.userId))
    .where(
      and(
        eq(userProfile.currentPlaceId, placeId),
        inArray(userProfile.status, presentStatuses),
        or(eq(userProfile.isVerifiedOnSite, true), input.viewerUserId ? eq(userProfile.userId, input.viewerUserId) : sql`false`),
      ),
    )
    .orderBy(desc(userProfile.updatedAt))
    .limit(24)

  const [{ activeConversationCount }] = await db
    .select({
      activeConversationCount: sql<number>`count(*)`,
    })
    .from(handoffConnection)
    .where(
      and(
        eq(handoffConnection.placeId, placeId),
        eq(handoffConnection.status, 'accepted'),
      ),
    )

  const pendingConnectionRequests = input.viewerUserId
    ? await getPendingConnectionRequestsForUser(input.viewerUserId)
    : []
  const activeConnection = input.viewerUserId
    ? await getActiveConnectionForUser(input.viewerUserId)
    : null
  const connectionEvents = input.viewerUserId
    ? await getRecentConnectionEventsForUser(input.viewerUserId)
    : []

  return {
    placeId,
      readyCount,
      checkedInCount,
    activeConversationCount,
      participants: participantRecords.map((record) => ({
        userId: record.userId,
        username:
          record.username || record.fallbackUsername || record.fallbackName,
        moodEmoji: record.moodEmoji,
        intentText: record.intentText,
        intentSummary: record.intentSummary,
        status: record.status as NearbyPlacePreviewState['participants'][number]['status'],
        isFindable: record.isFindable ?? false,
        isVerifiedOnSite: record.isVerifiedOnSite ?? false,
        locationHint: record.locationHint ?? null,
        age: record.age ?? null,
        gender: record.gender ?? null,
        photoUrl: record.photoUrl ?? null,
        about: record.about ?? null,
        pingRequestedAt: record.pingRequestedAt,
        pingRequestedByUserId: record.pingRequestedByUserId ?? null,
        pingRequestedByUsername: record.pingRequestedByUsername ?? null,
      })),
      pendingConnectionRequests,
      activeConnection,
      connectionEvents,
  } satisfies NearbyPlacePreviewState
}

export async function getGoogleMapsBrowserConfig() {
  await requireCurrentSession()

  return {
    apiKey: getGoogleMapsApiKey(),
    mapId: getGoogleMapsMapId(),
  }
}


// ===== WHATSAPP-LIKE FEATURES =====

export async function markMessageAsDelivered(input: { messageId: string }) {
  const session = await requireCurrentSession()
  const [message] = await db
    .select()
    .from(friendMessage)
    .where(eq(friendMessage.id, input.messageId))
    .limit(1)
  
  if (!message) throw new Error('Message not found')
  if (message.recipientUserId !== session.user.id) {
    throw new Error('Cannot mark others\' messages as delivered')
  }
  
  await db
    .update(friendMessage)
    .set({
      status: 'delivered',
      updatedAt: new Date(),
    })
    .where(eq(friendMessage.id, input.messageId))
  
  return { success: true }
}

export async function markMessageAsRead(input: { messageId: string }) {
  const session = await requireCurrentSession()
  const [message] = await db
    .select()
    .from(friendMessage)
    .where(eq(friendMessage.id, input.messageId))
    .limit(1)
  
  if (!message) throw new Error('Message not found')
  if (message.recipientUserId !== session.user.id) {
    throw new Error('Cannot mark others\' messages as read')
  }
  
  const now = new Date()
  await db
    .update(friendMessage)
    .set({
      status: 'read',
      readAt: now,
      updatedAt: now,
    })
    .where(eq(friendMessage.id, input.messageId))
  
  return { success: true }
}

export async function updateUserOnlineStatus(input: { isOnline: boolean }) {
  const session = await requireCurrentSession()
  const now = new Date()
  
  await db
    .insert(userActivity)
    .values({
      userId: session.user.id,
      isOnline: input.isOnline,
      lastSeenAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [userActivity.userId],
      set: {
        isOnline: input.isOnline,
        lastSeenAt: now,
        updatedAt: now,
      },
    })
  
  return { success: true }
}

export async function getUserOnlineStatus(input: { userId: string }) {
  const [activity] = await db
    .select()
    .from(userActivity)
    .where(eq(userActivity.userId, input.userId))
    .limit(1)
  
  if (!activity) {
    return { isOnline: false, lastSeenAt: null }
  }
  
  return {
    isOnline: activity.isOnline,
    lastSeenAt: activity.lastSeenAt,
  }
}

export async function getConversationMessagesWithStatus(input: { friendUserId: string }) {
  const session = await requireCurrentSession()
  const friendUserId = input.friendUserId.trim()
  
  if (!friendUserId) throw new Error('Choose a friend first.')
  
  const requestRecord = await getFriendshipRecordForUserPair(
    session.user.id,
    friendUserId,
  )
  
  if (!requestRecord || requestRecord.status !== 'accepted') {
    throw new Error('You can only message accepted friends.')
  }
  
  const messages = await db
    .select({
      id: friendMessage.id,
      friendRequestId: friendMessage.friendRequestId,
      senderUserId: friendMessage.senderUserId,
      recipientUserId: friendMessage.recipientUserId,
      body: friendMessage.body,
      status: friendMessage.status,
      sentAt: friendMessage.sentAt,
      readAt: friendMessage.readAt,
      createdAt: friendMessage.createdAt,
    })
    .from(friendMessage)
    .where(eq(friendMessage.friendRequestId, requestRecord.id))
    .orderBy(asc(friendMessage.createdAt))
  
  return messages
}
