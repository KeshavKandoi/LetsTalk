import { Agent, callable, getAgentByName } from 'agents'
import { and, desc, eq, or } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import type { PresenceStatus, UserAgentState } from '../../app-types'
import type { PlaceAgent } from './place-agent'
import {
  assertCanConnectAtPlace,
  assertCanRequestFinderPing,
  assertCanSetReady,
  assertCanUpdateFinderProfile,
  buildConversationIntentSummary,
  buildIntentSummary,
  normalizeIntentText,
} from './user-agent-logic'
import * as schema from '../db/schema'
import {
  handoffConnection,
  place,
  user,
  userProfile,
} from '../db/schema'
import { getPlaceAgentBinding, getUserAgentBinding } from '../env'

type UserAgentEnv = Cloudflare.Env & {
  DB: D1Database
}

function asPresenceStatus(
  status: string | null | undefined,
): PresenceStatus {
  switch (status) {
    case 'offline':
    case 'present':
    case 'ready':
    case 'in_conversation':
      return status
    default:
      return 'offline'
  }
}

function toUserProfileSnapshot(
  profileRecord:
    | typeof userProfile.$inferSelect
    | null
    | undefined,
) {
  if (!profileRecord) {
    return null
  }

  return {
    ...profileRecord,
    status: asPresenceStatus(profileRecord.status),
  }
}

function getDisplayUsername(record: typeof user.$inferSelect) {
  return record.displayUsername || record.username || record.name
}

function normalizeLocationHint(locationHint: string | null | undefined) {
  if (!locationHint) {
    return null
  }

  return locationHint.replace(/\s+/g, ' ').trim() || null
}

async function loadActiveConnection(
  database: D1Database,
  userId: string,
) {
  const db = drizzle(database, { schema })

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

  return connectionRecord ?? null
}

async function loadUserState(
  database: D1Database,
  userId: string,
): Promise<UserAgentState> {
  const db = drizzle(database, { schema })
  const [userRecord] = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  const [profileRecord] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.userId, userId))
    .limit(1)
  const activeConnection = await loadActiveConnection(database, userId)

  return {
    userId,
    username: userRecord ? getDisplayUsername(userRecord) : null,
    moodEmoji: profileRecord?.moodEmoji ?? null,
    intentSummary: profileRecord?.intentSummary ?? null,
    status: (profileRecord?.status as PresenceStatus | undefined) ?? 'offline',
    currentPlaceId: profileRecord?.currentPlaceId ?? null,
    isFindable: profileRecord?.isFindable ?? false,
    locationHint: profileRecord?.locationHint ?? null,
    pingRequestedAt: profileRecord?.pingRequestedAt?.toISOString() ?? null,
    pingRequestedByUserId: profileRecord?.pingRequestedByUserId ?? null,
    pingRequestedByUsername: profileRecord?.pingRequestedByUsername ?? null,
    activeConversationId: activeConnection?.id ?? null,
    updatedAt: profileRecord?.updatedAt?.toISOString() ?? null,
  }
}

async function requirePlaceExists(database: D1Database, placeId: string) {
  const db = drizzle(database, { schema })
  const [placeRecord] = await db
    .select({ placeId: place.placeId })
    .from(place)
    .where(eq(place.placeId, placeId))
    .limit(1)

  if (!placeRecord) {
    throw new Error('Choose a nearby place before continuing.')
  }
}

async function syncPlaceAgents(placeIds: Array<string | null | undefined>) {
  const uniquePlaceIds = [
    ...new Set(
      placeIds.filter((placeId): placeId is string => Boolean(placeId)),
    ),
  ]

  for (const placeId of uniquePlaceIds) {
    const agent = await getAgentByName<Cloudflare.Env, PlaceAgent>(
      getPlaceAgentBinding(),
      placeId,
    )
    await agent.refresh()
  }
}

async function syncUserAgents(userIds: Array<string | null | undefined>) {
  const uniqueUserIds = [
    ...new Set(userIds.filter((userId): userId is string => Boolean(userId))),
  ]

  for (const userId of uniqueUserIds) {
    const agent = await getAgentByName<Cloudflare.Env, UserAgent>(
      getUserAgentBinding(),
      userId,
    )
    await agent.refresh()
  }
}

async function endAcceptedConnectionsForUser(database: D1Database, userId: string) {
  const db = drizzle(database, { schema })
  const activeConnections = await db
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

  if (activeConnections.length === 0) {
    return {
      placeIds: [] as string[],
      participantUserIds: [] as string[],
    }
  }

  const now = new Date()
  const placeIds = new Set<string>()
  const participantUserIds = new Set<string>()

  for (const connectionRecord of activeConnections) {
    placeIds.add(connectionRecord.placeId)
    participantUserIds.add(connectionRecord.requesterUserId)
    participantUserIds.add(connectionRecord.recipientUserId)

    await db
      .update(handoffConnection)
      .set({
        status: 'ended',
        updatedAt: now,
      })
      .where(eq(handoffConnection.id, connectionRecord.id))

    for (const nextUserId of [
      connectionRecord.requesterUserId,
      connectionRecord.recipientUserId,
    ]) {
      const [nextProfile] = await db
        .select()
        .from(userProfile)
        .where(eq(userProfile.userId, nextUserId))
        .limit(1)

      if (nextProfile?.status === 'in_conversation') {
        await db
          .update(userProfile)
          .set({
            status: 'ready',
            isFindable: false,
            locationHint: null,
            pingRequestedAt: null,
            pingRequestedByUserId: null,
            pingRequestedByUsername: null,
            updatedAt: now,
          })
          .where(eq(userProfile.userId, nextUserId))
      }
    }
  }

  return {
    placeIds: [...placeIds],
    participantUserIds: [...participantUserIds],
  }
}

export class UserAgent extends Agent<UserAgentEnv, UserAgentState> {
  initialState: UserAgentState = {
    userId: '',
    username: null,
    moodEmoji: null,
    intentSummary: null,
    status: 'offline',
    currentPlaceId: null,
    isFindable: false,
    locationHint: null,
    pingRequestedAt: null,
    pingRequestedByUserId: null,
    pingRequestedByUsername: null,
    activeConversationId: null,
    updatedAt: null,
  }

  async onConnect() {
    await this.refresh()
  }

  // `agents` exposes stage-3 decorator types while local dev needs TS decorator transpilation enabled.
  // The runtime behavior is correct; this suppresses the signature mismatch in `tsc --noEmit`.
  // @ts-expect-error decorator signature mismatch between TS modes
  @callable()
  async refresh() {
    const snapshot = await loadUserState(this.env.DB, this.name)
    this.setState(snapshot)
    return snapshot
  }

  // @ts-expect-error decorator signature mismatch between TS modes
  @callable()
  async setProfile(input: {
    moodEmoji: string
    intentText: string
    currentPlaceId: string
  }) {
    await requirePlaceExists(this.env.DB, input.currentPlaceId)

    const db = drizzle(this.env.DB, { schema })
    const now = new Date()
    const intentText = normalizeIntentText(input.intentText)
    const intentSummary = buildIntentSummary(intentText)
    const [existingProfile] = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, this.name))
      .limit(1)
    const endedConnections = await endAcceptedConnectionsForUser(this.env.DB, this.name)

    await db
      .insert(userProfile)
      .values({
        userId: this.name,
        moodEmoji: input.moodEmoji,
        intentText,
        intentSummary,
        status: 'present',
        currentPlaceId: input.currentPlaceId,
        isFindable: false,
        locationHint: null,
        pingRequestedAt: null,
        pingRequestedByUserId: null,
        pingRequestedByUsername: null,
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
          isFindable: false,
          locationHint: null,
          pingRequestedAt: null,
          pingRequestedByUserId: null,
          pingRequestedByUsername: null,
          updatedAt: now,
        },
      })

    await syncPlaceAgents([
      existingProfile?.currentPlaceId,
      input.currentPlaceId,
      ...endedConnections.placeIds,
    ])
    await syncUserAgents(
      endedConnections.participantUserIds.filter((userId) => userId !== this.name),
    )

    return this.refresh()
  }

  // @ts-expect-error decorator signature mismatch between TS modes
  @callable()
  async setMood(input: { moodEmoji: string }) {
    const db = drizzle(this.env.DB, { schema })
    const now = new Date()
    const [existingProfile] = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, this.name))
      .limit(1)

    await db
      .insert(userProfile)
      .values({
        userId: this.name,
        moodEmoji: input.moodEmoji,
        intentText: existingProfile?.intentText ?? null,
        intentSummary: buildConversationIntentSummary(
          existingProfile?.intentSummary ?? null,
          existingProfile?.intentText ?? null,
        ),
        status: existingProfile?.status ?? 'offline',
        currentPlaceId: existingProfile?.currentPlaceId ?? null,
        isFindable: existingProfile?.isFindable ?? false,
        locationHint: existingProfile?.locationHint ?? null,
        pingRequestedAt: existingProfile?.pingRequestedAt ?? null,
        pingRequestedByUserId: existingProfile?.pingRequestedByUserId ?? null,
        pingRequestedByUsername:
          existingProfile?.pingRequestedByUsername ?? null,
        createdAt: existingProfile?.createdAt ?? now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userProfile.userId,
        set: {
          moodEmoji: input.moodEmoji,
          updatedAt: now,
        },
      })

    await syncPlaceAgents([existingProfile?.currentPlaceId])
    return this.refresh()
  }

  // @ts-expect-error decorator signature mismatch between TS modes
  @callable()
  async setIntentSummary(input: { intentText: string }) {
    const db = drizzle(this.env.DB, { schema })
    const now = new Date()
    const [existingProfile] = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, this.name))
      .limit(1)
    const intentText = normalizeIntentText(input.intentText)
    const intentSummary = buildIntentSummary(intentText)

    await db
      .insert(userProfile)
      .values({
        userId: this.name,
        moodEmoji: existingProfile?.moodEmoji ?? null,
        intentText,
        intentSummary,
        status: existingProfile?.status ?? 'offline',
        currentPlaceId: existingProfile?.currentPlaceId ?? null,
        isFindable: existingProfile?.isFindable ?? false,
        locationHint: existingProfile?.locationHint ?? null,
        pingRequestedAt: existingProfile?.pingRequestedAt ?? null,
        pingRequestedByUserId: existingProfile?.pingRequestedByUserId ?? null,
        pingRequestedByUsername:
          existingProfile?.pingRequestedByUsername ?? null,
        createdAt: existingProfile?.createdAt ?? now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userProfile.userId,
        set: {
          intentText,
          intentSummary,
          updatedAt: now,
        },
      })

    await syncPlaceAgents([existingProfile?.currentPlaceId])
    return this.refresh()
  }

  // @ts-expect-error decorator signature mismatch between TS modes
  @callable()
  async joinPlace(input: { placeId: string }) {
    await requirePlaceExists(this.env.DB, input.placeId)

    const db = drizzle(this.env.DB, { schema })
    const now = new Date()
    const [existingProfile] = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, this.name))
      .limit(1)
    const endedConnections = await endAcceptedConnectionsForUser(this.env.DB, this.name)

    await db
      .insert(userProfile)
      .values({
        userId: this.name,
        moodEmoji: existingProfile?.moodEmoji ?? null,
        intentText: existingProfile?.intentText ?? null,
        intentSummary: buildConversationIntentSummary(
          existingProfile?.intentSummary ?? null,
          existingProfile?.intentText ?? null,
        ),
        status: 'present',
        currentPlaceId: input.placeId,
        isFindable: false,
        locationHint: null,
        pingRequestedAt: null,
        pingRequestedByUserId: null,
        pingRequestedByUsername: null,
        createdAt: existingProfile?.createdAt ?? now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userProfile.userId,
        set: {
          status: 'present',
          currentPlaceId: input.placeId,
          isFindable: false,
          locationHint: null,
          pingRequestedAt: null,
          pingRequestedByUserId: null,
          pingRequestedByUsername: null,
          updatedAt: now,
        },
      })

    await syncPlaceAgents([
      existingProfile?.currentPlaceId,
      input.placeId,
      ...endedConnections.placeIds,
    ])
    await syncUserAgents(
      endedConnections.participantUserIds.filter((userId) => userId !== this.name),
    )

    return this.refresh()
  }

  // @ts-expect-error decorator signature mismatch between TS modes
  @callable()
  async leavePlace() {
    return this.setOffline()
  }

  // @ts-expect-error decorator signature mismatch between TS modes
  @callable()
  async setReady(input: { ready: boolean }) {
    const db = drizzle(this.env.DB, { schema })
    const [profileRecord] = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, this.name))
      .limit(1)

    const profileSnapshot = toUserProfileSnapshot(profileRecord)

    assertCanSetReady(profileSnapshot)

    await db
      .update(userProfile)
      .set({
        status: input.ready ? 'ready' : 'present',
        isFindable: input.ready ? profileRecord?.isFindable ?? false : false,
        pingRequestedAt: null,
        pingRequestedByUserId: null,
        pingRequestedByUsername: null,
        updatedAt: new Date(),
      })
      .where(eq(userProfile.userId, this.name))

    await syncPlaceAgents([profileSnapshot?.currentPlaceId])
    return this.refresh()
  }

  // @ts-expect-error decorator signature mismatch between TS modes
  @callable()
  async setFinderProfile(input: {
    isFindable: boolean
    locationHint: string | null
  }) {
    const db = drizzle(this.env.DB, { schema })
    const now = new Date()
    const [profileRecord] = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, this.name))
      .limit(1)
    const profileSnapshot = toUserProfileSnapshot(profileRecord)
    const locationHint = normalizeLocationHint(input.locationHint)

    assertCanUpdateFinderProfile({
      profile: profileSnapshot,
      isFindable: input.isFindable,
      locationHint,
    })

    await db
      .update(userProfile)
      .set({
        isFindable: input.isFindable,
        locationHint,
        pingRequestedAt: null,
        pingRequestedByUserId: null,
        pingRequestedByUsername: null,
        updatedAt: now,
      })
      .where(eq(userProfile.userId, this.name))

    await syncPlaceAgents([profileSnapshot?.currentPlaceId])
    return this.refresh()
  }

  // @ts-expect-error decorator signature mismatch between TS modes
  @callable()
  async setOffline() {
    const db = drizzle(this.env.DB, { schema })
    const [profileRecord] = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, this.name))
      .limit(1)
    const endedConnections = await endAcceptedConnectionsForUser(this.env.DB, this.name)

    await db
      .update(userProfile)
      .set({
        status: 'offline',
        currentPlaceId: null,
        isFindable: false,
        locationHint: null,
        pingRequestedAt: null,
        pingRequestedByUserId: null,
        pingRequestedByUsername: null,
        updatedAt: new Date(),
      })
      .where(eq(userProfile.userId, this.name))

    await syncPlaceAgents([
      profileRecord?.currentPlaceId,
      ...endedConnections.placeIds,
    ])
    await syncUserAgents(
      endedConnections.participantUserIds.filter((userId) => userId !== this.name),
    )

    return this.refresh()
  }

  // @ts-expect-error decorator signature mismatch between TS modes
  @callable()
  async enterConversation(input: { placeId: string }) {
    await requirePlaceExists(this.env.DB, input.placeId)

    const db = drizzle(this.env.DB, { schema })
    const now = new Date()
    const [existingProfile] = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, this.name))
      .limit(1)

    await db
      .insert(userProfile)
      .values({
        userId: this.name,
        moodEmoji: existingProfile?.moodEmoji ?? null,
        intentText: existingProfile?.intentText ?? null,
        intentSummary: buildConversationIntentSummary(
          existingProfile?.intentSummary ?? null,
          existingProfile?.intentText ?? null,
        ),
        status: 'in_conversation',
        currentPlaceId: input.placeId,
        isFindable: false,
        locationHint: null,
        pingRequestedAt: null,
        pingRequestedByUserId: null,
        pingRequestedByUsername: null,
        createdAt: existingProfile?.createdAt ?? now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userProfile.userId,
        set: {
          status: 'in_conversation',
          currentPlaceId: input.placeId,
          isFindable: false,
          locationHint: null,
          pingRequestedAt: null,
          pingRequestedByUserId: null,
          pingRequestedByUsername: null,
          updatedAt: now,
        },
      })

    await syncPlaceAgents([existingProfile?.currentPlaceId, input.placeId])
    return this.refresh()
  }

  // @ts-expect-error decorator signature mismatch between TS modes
  @callable()
  async requestFinderPing(input: { requesterUserId: string }) {
    if (input.requesterUserId === this.name) {
      throw new Error('You cannot ping yourself.')
    }

    const db = drizzle(this.env.DB, { schema })
    const now = new Date()
    const [targetProfile] = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, this.name))
      .limit(1)
    const [requesterProfile] = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, input.requesterUserId))
      .limit(1)
    const [requesterUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, input.requesterUserId))
      .limit(1)

    const requesterConnection = await loadActiveConnection(
      this.env.DB,
      input.requesterUserId,
    )
    const targetConnection = await loadActiveConnection(this.env.DB, this.name)
    const requesterProfileSnapshot = toUserProfileSnapshot(requesterProfile)
    const targetProfileSnapshot = toUserProfileSnapshot(targetProfile)

    assertCanRequestFinderPing({
      viewerProfile: requesterProfileSnapshot,
      targetProfile: targetProfileSnapshot,
      placeId:
        requesterProfileSnapshot?.currentPlaceId ??
        targetProfileSnapshot?.currentPlaceId ??
        '',
      viewerHasActiveConnection: Boolean(requesterConnection),
      targetHasActiveConnection: Boolean(targetConnection),
    })

    await db
      .update(userProfile)
      .set({
        pingRequestedAt: now,
        pingRequestedByUserId: input.requesterUserId,
        pingRequestedByUsername: requesterUser
          ? getDisplayUsername(requesterUser)
          : null,
        updatedAt: now,
      })
      .where(eq(userProfile.userId, this.name))

    await syncPlaceAgents([targetProfileSnapshot?.currentPlaceId])
    return this.refresh()
  }

  // @ts-expect-error decorator signature mismatch between TS modes
  @callable()
  async leaveConversation() {
    await this.endCurrentConnection()
    return this.refresh()
  }

  // @ts-expect-error decorator signature mismatch between TS modes
  @callable()
  async connectWithUser(input: { counterpartUserId: string; placeId: string }) {
    const db = drizzle(this.env.DB, { schema })
    const now = new Date()
    const [viewerProfile] = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, this.name))
      .limit(1)
    const [targetProfile] = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, input.counterpartUserId))
      .limit(1)

    const existingConnection = await loadActiveConnection(this.env.DB, this.name)
    const targetConnection = await loadActiveConnection(
      this.env.DB,
      input.counterpartUserId,
    )

    assertCanConnectAtPlace({
      viewerProfile: toUserProfileSnapshot(viewerProfile),
      targetProfile: toUserProfileSnapshot(targetProfile),
      placeId: input.placeId,
      viewerHasActiveConnection: Boolean(existingConnection),
      targetHasActiveConnection: Boolean(targetConnection),
    })

    const connectionId = crypto.randomUUID()

    await db.insert(handoffConnection).values({
      id: connectionId,
      requesterUserId: this.name,
      recipientUserId: input.counterpartUserId,
      placeId: input.placeId,
      status: 'accepted',
      createdAt: now,
      updatedAt: now,
    })

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
          eq(userProfile.userId, this.name),
          eq(userProfile.userId, input.counterpartUserId),
        ),
      )

    await syncPlaceAgents([input.placeId])
    await syncUserAgents([input.counterpartUserId])
    await this.refresh()

    return {
      success: true,
      connectionId,
    }
  }

  // @ts-expect-error decorator signature mismatch between TS modes
  @callable()
  async joinPlaceAndConnectWithUser(input: {
    counterpartUserId: string
    placeId: string
  }) {
    await requirePlaceExists(this.env.DB, input.placeId)

    const db = drizzle(this.env.DB, { schema })
    const now = new Date()
    const [viewerProfile] = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, this.name))
      .limit(1)
    const [targetProfile] = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, input.counterpartUserId))
      .limit(1)

    const existingConnection = await loadActiveConnection(this.env.DB, this.name)
    const targetConnection = await loadActiveConnection(
      this.env.DB,
      input.counterpartUserId,
    )
    const viewerProfileSnapshot = toUserProfileSnapshot(viewerProfile)

    assertCanConnectAtPlace({
      viewerProfile: {
        currentPlaceId: input.placeId,
        status: viewerProfileSnapshot?.status ?? 'offline',
      },
      targetProfile: toUserProfileSnapshot(targetProfile),
      placeId: input.placeId,
      viewerHasActiveConnection: Boolean(existingConnection),
      targetHasActiveConnection: Boolean(targetConnection),
    })

    const endedConnections = await endAcceptedConnectionsForUser(this.env.DB, this.name)

    await db
      .insert(userProfile)
      .values({
        userId: this.name,
        moodEmoji: viewerProfile?.moodEmoji ?? null,
        intentText: viewerProfile?.intentText ?? null,
        intentSummary: buildConversationIntentSummary(
          viewerProfile?.intentSummary ?? null,
          viewerProfile?.intentText ?? null,
        ),
        status: 'in_conversation',
        currentPlaceId: input.placeId,
        isFindable: false,
        locationHint: null,
        pingRequestedAt: null,
        pingRequestedByUserId: null,
        pingRequestedByUsername: null,
        createdAt: viewerProfile?.createdAt ?? now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userProfile.userId,
        set: {
          status: 'in_conversation',
          currentPlaceId: input.placeId,
          isFindable: false,
          locationHint: null,
          pingRequestedAt: null,
          pingRequestedByUserId: null,
          pingRequestedByUsername: null,
          updatedAt: now,
        },
      })

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
      .where(eq(userProfile.userId, input.counterpartUserId))

    const connectionId = crypto.randomUUID()

    await db.insert(handoffConnection).values({
      id: connectionId,
      requesterUserId: this.name,
      recipientUserId: input.counterpartUserId,
      placeId: input.placeId,
      status: 'accepted',
      createdAt: now,
      updatedAt: now,
    })

    await syncPlaceAgents([
      viewerProfile?.currentPlaceId,
      input.placeId,
      ...endedConnections.placeIds,
    ])
    await syncUserAgents(
      [input.counterpartUserId, ...endedConnections.participantUserIds].filter(
        (userId) => userId !== this.name,
      ),
    )
    await this.refresh()

    return {
      success: true,
      connectionId,
    }
  }

  // @ts-expect-error decorator signature mismatch between TS modes
  @callable()
  async endCurrentConnection() {
    const endedConnections = await endAcceptedConnectionsForUser(this.env.DB, this.name)

    if (endedConnections.placeIds.length === 0) {
      return {
        success: false,
      }
    }

    await syncPlaceAgents(endedConnections.placeIds)
    await syncUserAgents(
      endedConnections.participantUserIds.filter((userId) => userId !== this.name),
    )
    await this.refresh()

    return {
      success: true,
    }
  }
}
