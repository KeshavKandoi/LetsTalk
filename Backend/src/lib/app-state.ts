import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm'
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
    isFindable: profileRecord.isFindable,
    locationHint: profileRecord.locationHint,
    pingRequestedAt: profileRecord.pingRequestedAt,
    pingRequestedByUserId: profileRecord.pingRequestedByUserId,
    pingRequestedByUsername: profileRecord.pingRequestedByUsername,
createdAt: profileRecord.createdAt,
    updatedAt: profileRecord.updatedAt,
    age: profileRecord.age,
    gender: profileRecord.gender,
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

async function getActiveConnectionForUser(
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
    },
  }
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

export async function setReadyState(input: { ready: boolean }) {
  const session = await requireCurrentSession()
  const agent = await getUserAgent(session.user.id)
  await agent.setReady(input)
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

  if (viewerProfile.status === 'in_conversation') {
    throw new Error('End your current conversation before starting another one.')
  }

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
  const result = await agent.connectWithUser({
    counterpartUserId: preview.counterpart.userId,
    placeId: preview.placeId,
  })

  return {
    success: result.success,
    connectionId: result.connectionId,
  }
}

export async function createFriendRequest(input: { token?: string }) {
  const session = await requireCurrentSession()
  let targetUserId = ''
  let placeId: string | null = null

  if (input.token) {
    const preview = await resolveScannedHandoff(input.token.trim(), session.user.id)
    targetUserId = preview.counterpart.userId
    placeId = preview.placeId
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

  return { success: true }
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
    outgoing: [],
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

export async function endCurrentConnection() {
  const session = await requireCurrentSession()
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

  if (places.length === 0) {
    return places
  }

  const readyCountRows = await db
    .select({
      placeId: userProfile.currentPlaceId,
      readyCount: sql<number>`count(*)`,
    })
    .from(userProfile)
    .where(
      and(
        inArray(
          userProfile.currentPlaceId,
          places.map((nearbyPlace) => nearbyPlace.placeId),
        ),
        eq(userProfile.status, 'ready'),
      ),
    )
    .groupBy(userProfile.currentPlaceId)

  const readyCountByPlaceId = new Map(
    readyCountRows
      .filter(
        (
          row,
        ): row is {
          placeId: string
          readyCount: number
        } => Boolean(row.placeId),
      )
      .map((row) => [row.placeId, row.readyCount]),
  )

  return places.map((nearbyPlace) => ({
    ...nearbyPlace,
    readyCount: readyCountByPlaceId.get(nearbyPlace.placeId) ?? 0,
  }))
}

export async function getNearbyPlacePreview(input: { placeId: string }) {
  await requireCurrentSession()

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
      readyCount: sql<number>`count(case when ${userProfile.status} = 'ready' then 1 end)`,
      checkedInCount: sql<number>`count(*)`,
    })
    .from(userProfile)
    .where(
      and(
        eq(userProfile.currentPlaceId, placeId),
        inArray(userProfile.status, presentStatuses),
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
      locationHint: userProfile.locationHint,
      age: userProfile.age,
      gender: userProfile.gender,
      photoUrl: userProfile.photoUrl,
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
        locationHint: record.locationHint ?? null,
        age: record.age ?? null,
        gender: record.gender ?? null,
        photoUrl: record.photoUrl ?? null,
        pingRequestedAt: record.pingRequestedAt,
        pingRequestedByUserId: record.pingRequestedByUserId ?? null,
        pingRequestedByUsername: record.pingRequestedByUsername ?? null,
      })),
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

