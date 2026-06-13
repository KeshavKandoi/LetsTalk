import { and, desc, eq, or } from 'drizzle-orm'
import { createClient } from '@supabase/supabase-js'
import type { PresenceStatus, UserAgentState } from '@frontend/lib/app-types'
import { db } from '../db'
import { handoffConnection, place, user, userProfile } from '../db/schema'
import { getSupabaseUrl, getSupabaseAnonKey } from '../env'
import {
  assertCanConnectAtPlace,
  assertCanRequestFinderPing,
  assertCanSetReady,
  assertCanUpdateFinderProfile,
  buildConversationIntentSummary,
  buildIntentSummary,
  normalizeIntentText,
} from './user-agent-logic'
import { broadcastPlaceUpdate } from './place-agent'

function asPresenceStatus(status: string | null | undefined): PresenceStatus {
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

function toUserProfileSnapshot(profileRecord: typeof userProfile.$inferSelect | null | undefined) {
  if (!profileRecord) return null
  return { ...profileRecord, status: asPresenceStatus(profileRecord.status) }
}

function getDisplayUsername(record: typeof user.$inferSelect) {
  return record.displayUsername || record.username || record.name
}

function normalizeLocationHint(locationHint: string | null | undefined) {
  if (!locationHint) return null
  return locationHint.replace(/\s+/g, ' ').trim() || null
}

async function broadcastUserUpdate(userId: string): Promise<UserAgentState> {
  const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey())
  const state = await loadUserState(userId)
  await supabase.channel(`user:${userId}`).send({
    type: 'broadcast',
    event: 'user_update',
    payload: state,
  })
  return state
}

async function loadUserState(userId: string): Promise<UserAgentState> {
  const [userRecord] = await db.select().from(user).where(eq(user.id, userId)).limit(1)
  const [profileRecord] = await db.select().from(userProfile).where(eq(userProfile.userId, userId)).limit(1)
  const activeConnection = await loadActiveConnection(userId)

  return {
    userId,
    username: userRecord ? getDisplayUsername(userRecord) : null,
    moodEmoji: profileRecord?.moodEmoji ?? null,
    intentSummary: profileRecord?.intentSummary ?? null,
    status: (profileRecord?.status as PresenceStatus | undefined) ?? 'offline',
    currentPlaceId: profileRecord?.currentPlaceId ?? null,
    isFindable: profileRecord?.isFindable ?? false,
    isVerifiedOnSite: profileRecord?.isVerifiedOnSite ?? false,
    locationHint: profileRecord?.locationHint ?? null,
    pingRequestedAt: profileRecord?.pingRequestedAt?.toISOString() ?? null,
    pingRequestedByUserId: profileRecord?.pingRequestedByUserId ?? null,
    pingRequestedByUsername: profileRecord?.pingRequestedByUsername ?? null,
    activeConversationId: activeConnection?.id ?? null,
    updatedAt: profileRecord?.updatedAt?.toISOString() ?? null,
  }
}

async function loadActiveConnection(userId: string) {
  const [connectionRecord] = await db
    .select()
    .from(handoffConnection)
    .where(
      and(
        eq(handoffConnection.status, 'accepted'),
        or(eq(handoffConnection.requesterUserId, userId), eq(handoffConnection.recipientUserId, userId)),
      ),
    )
    .orderBy(desc(handoffConnection.createdAt))
    .limit(1)
  return connectionRecord ?? null
}

async function requirePlaceExists(placeId: string) {
  const [placeRecord] = await db.select({ placeId: place.placeId }).from(place).where(eq(place.placeId, placeId)).limit(1)
  if (!placeRecord) throw new Error('Choose a nearby place before continuing.')
}

async function syncPlaceAgents(placeIds: Array<string | null | undefined>) {
  const uniqueIds = [...new Set(placeIds.filter((id): id is string => Boolean(id)))]
  for (const placeId of uniqueIds) {
    await broadcastPlaceUpdate(placeId)
  }
}

async function syncUserAgents(userIds: Array<string | null | undefined>) {
  const uniqueIds = [...new Set(userIds.filter((id): id is string => Boolean(id)))]
  for (const userId of uniqueIds) {
    await broadcastUserUpdate(userId)
  }
}

async function endAcceptedConnectionsForUser(userId: string) {
  const activeConnections = await db
    .select()
    .from(handoffConnection)
    .where(
      and(
        eq(handoffConnection.status, 'accepted'),
        or(eq(handoffConnection.requesterUserId, userId), eq(handoffConnection.recipientUserId, userId)),
      ),
    )

  if (activeConnections.length === 0) return { placeIds: [] as string[], participantUserIds: [] as string[] }

  const now = new Date()
  const placeIds = new Set<string>()
  const participantUserIds = new Set<string>()

  for (const conn of activeConnections) {
    placeIds.add(conn.placeId)
    participantUserIds.add(conn.requesterUserId)
    participantUserIds.add(conn.recipientUserId)

    await db.update(handoffConnection).set({ status: 'ended', updatedAt: now }).where(eq(handoffConnection.id, conn.id))

    for (const nextUserId of [conn.requesterUserId, conn.recipientUserId]) {
      const [nextProfile] = await db.select().from(userProfile).where(eq(userProfile.userId, nextUserId)).limit(1)
      if (nextProfile?.status === 'in_conversation') {
        await db.update(userProfile).set({
          status: 'ready',
          isFindable: false,
          locationHint: null,
          pingRequestedAt: null,
          pingRequestedByUserId: null,
          pingRequestedByUsername: null,
          updatedAt: now,
        }).where(eq(userProfile.userId, nextUserId))
      }
    }
  }

  return { placeIds: [...placeIds], participantUserIds: [...participantUserIds] }
}

export class UserAgent {
  constructor(private userId: string) {}

  async refresh() {
    return broadcastUserUpdate(this.userId)
  }

  async setProfile(input: { moodEmoji: string; intentText: string; currentPlaceId: string }) {
    await requirePlaceExists(input.currentPlaceId)
    const now = new Date()
    const intentText = normalizeIntentText(input.intentText)
    const intentSummary = buildIntentSummary(intentText)
    const [existingProfile] = await db.select().from(userProfile).where(eq(userProfile.userId, this.userId)).limit(1)
    const endedConnections = await endAcceptedConnectionsForUser(this.userId)

    await db.insert(userProfile).values({
      userId: this.userId, moodEmoji: input.moodEmoji, intentText, intentSummary,
      status: 'present', currentPlaceId: input.currentPlaceId, isFindable: false, isVerifiedOnSite: false,
      locationHint: null, pingRequestedAt: null, pingRequestedByUserId: null,
      pingRequestedByUsername: null, createdAt: now, updatedAt: now,
    }).onConflictDoUpdate({
      target: userProfile.userId,
      set: { moodEmoji: input.moodEmoji, intentText, intentSummary, status: 'present',
        currentPlaceId: input.currentPlaceId, isFindable: false, locationHint: null,
        isVerifiedOnSite: false,
        pingRequestedAt: null, pingRequestedByUserId: null, pingRequestedByUsername: null, updatedAt: now },
    })

    await syncPlaceAgents([existingProfile?.currentPlaceId, input.currentPlaceId, ...endedConnections.placeIds])
    await syncUserAgents(endedConnections.participantUserIds.filter((id) => id !== this.userId))
    return this.refresh()
  }

  async setReady(input: { ready: boolean }) {
    const [profileRecord] = await db.select().from(userProfile).where(eq(userProfile.userId, this.userId)).limit(1)
    assertCanSetReady(toUserProfileSnapshot(profileRecord))
    await db.update(userProfile).set({
      status: input.ready ? 'ready' : 'present',
      isFindable: input.ready ? profileRecord?.isFindable ?? false : false,
      isVerifiedOnSite: input.ready ? profileRecord?.isVerifiedOnSite ?? false : false,
      pingRequestedAt: null, pingRequestedByUserId: null, pingRequestedByUsername: null,
      updatedAt: new Date(),
    }).where(eq(userProfile.userId, this.userId))
    await syncPlaceAgents([profileRecord?.currentPlaceId])
    return this.refresh()
  }

  async setFinderProfile(input: { isFindable: boolean; locationHint: string | null }) {
    const now = new Date()
    const [profileRecord] = await db.select().from(userProfile).where(eq(userProfile.userId, this.userId)).limit(1)
    const profileSnapshot = toUserProfileSnapshot(profileRecord)
    const locationHint = normalizeLocationHint(input.locationHint)
    assertCanUpdateFinderProfile({ profile: profileSnapshot, isFindable: input.isFindable, locationHint })
    await db.update(userProfile).set({
      isFindable: input.isFindable, locationHint,
      pingRequestedAt: null, pingRequestedByUserId: null, pingRequestedByUsername: null, updatedAt: now,
    }).where(eq(userProfile.userId, this.userId))
    await syncPlaceAgents([profileSnapshot?.currentPlaceId])
    return this.refresh()
  }

  async leavePlace() {
    return this.setOffline()
  }

  async setOffline() {
    const [profileRecord] = await db.select().from(userProfile).where(eq(userProfile.userId, this.userId)).limit(1)
    const endedConnections = await endAcceptedConnectionsForUser(this.userId)
    await db.update(userProfile).set({
      status: 'offline', currentPlaceId: null, isFindable: false, locationHint: null,
      isVerifiedOnSite: false,
      pingRequestedAt: null, pingRequestedByUserId: null, pingRequestedByUsername: null, updatedAt: new Date(),
    }).where(eq(userProfile.userId, this.userId))
    await syncPlaceAgents([profileRecord?.currentPlaceId, ...endedConnections.placeIds])
    await syncUserAgents(endedConnections.participantUserIds.filter((id) => id !== this.userId))
    return this.refresh()
  }

  async requestFinderPing(input: { requesterUserId: string }) {
    if (input.requesterUserId === this.userId) throw new Error('You cannot ping yourself.')
    const now = new Date()
    const [targetProfile] = await db.select().from(userProfile).where(eq(userProfile.userId, this.userId)).limit(1)
    const [requesterProfile] = await db.select().from(userProfile).where(eq(userProfile.userId, input.requesterUserId)).limit(1)
    const [requesterUser] = await db.select().from(user).where(eq(user.id, input.requesterUserId)).limit(1)
    const requesterConnection = await loadActiveConnection(input.requesterUserId)
    const targetConnection = await loadActiveConnection(this.userId)
    const requesterProfileSnapshot = toUserProfileSnapshot(requesterProfile)
    const targetProfileSnapshot = toUserProfileSnapshot(targetProfile)

    assertCanRequestFinderPing({
      viewerProfile: requesterProfileSnapshot,
      targetProfile: targetProfileSnapshot,
      placeId: requesterProfileSnapshot?.currentPlaceId ?? targetProfileSnapshot?.currentPlaceId ?? '',
      viewerHasActiveConnection: Boolean(requesterConnection),
      targetHasActiveConnection: Boolean(targetConnection),
    })

    await db.update(userProfile).set({
      pingRequestedAt: now,
      pingRequestedByUserId: input.requesterUserId,
      pingRequestedByUsername: requesterUser ? getDisplayUsername(requesterUser) : null,
      updatedAt: now,
    }).where(eq(userProfile.userId, this.userId))

    await syncPlaceAgents([targetProfileSnapshot?.currentPlaceId])
    return this.refresh()
  }

  async connectWithUser(input: { counterpartUserId: string; placeId: string }) {
    const now = new Date()
    const [viewerProfile] = await db.select().from(userProfile).where(eq(userProfile.userId, this.userId)).limit(1)
    const [targetProfile] = await db.select().from(userProfile).where(eq(userProfile.userId, input.counterpartUserId)).limit(1)
    const existingConnection = await loadActiveConnection(this.userId)
    const targetConnection = await loadActiveConnection(input.counterpartUserId)

    assertCanConnectAtPlace({
      viewerProfile: toUserProfileSnapshot(viewerProfile),
      targetProfile: toUserProfileSnapshot(targetProfile),
      placeId: input.placeId,
      viewerHasActiveConnection: Boolean(existingConnection),
      targetHasActiveConnection: Boolean(targetConnection),
    })

    const connectionId = crypto.randomUUID()
    await db.insert(handoffConnection).values({
      id: connectionId, requesterUserId: this.userId, recipientUserId: input.counterpartUserId,
      placeId: input.placeId, status: 'accepted', createdAt: now, updatedAt: now,
    })
    await db.update(userProfile).set({
      status: 'in_conversation', isFindable: false, locationHint: null,
      pingRequestedAt: null, pingRequestedByUserId: null, pingRequestedByUsername: null, updatedAt: now,
    }).where(or(eq(userProfile.userId, this.userId), eq(userProfile.userId, input.counterpartUserId)))

    await syncPlaceAgents([input.placeId])
    await syncUserAgents([input.counterpartUserId])
    await this.refresh()
    return { success: true, connectionId }
  }

  async joinPlaceAndConnectWithUser(input: { counterpartUserId: string; placeId: string }) {
    await requirePlaceExists(input.placeId)
    const now = new Date()
    const [viewerProfile] = await db.select().from(userProfile).where(eq(userProfile.userId, this.userId)).limit(1)
    const [targetProfile] = await db.select().from(userProfile).where(eq(userProfile.userId, input.counterpartUserId)).limit(1)
    const existingConnection = await loadActiveConnection(this.userId)
    const targetConnection = await loadActiveConnection(input.counterpartUserId)
    const viewerProfileSnapshot = toUserProfileSnapshot(viewerProfile)

    assertCanConnectAtPlace({
      viewerProfile: { currentPlaceId: input.placeId, status: viewerProfileSnapshot?.status ?? 'offline' },
      targetProfile: toUserProfileSnapshot(targetProfile),
      placeId: input.placeId,
      viewerHasActiveConnection: Boolean(existingConnection),
      targetHasActiveConnection: Boolean(targetConnection),
    })

    const endedConnections = await endAcceptedConnectionsForUser(this.userId)

    await db.insert(userProfile).values({
      userId: this.userId, moodEmoji: viewerProfile?.moodEmoji ?? null,
      intentText: viewerProfile?.intentText ?? null,
      intentSummary: buildConversationIntentSummary(viewerProfile?.intentSummary ?? null, viewerProfile?.intentText ?? null),
      status: 'in_conversation', currentPlaceId: input.placeId, isFindable: false,
      locationHint: null, pingRequestedAt: null, pingRequestedByUserId: null,
      pingRequestedByUsername: null, createdAt: viewerProfile?.createdAt ?? now, updatedAt: now,
    }).onConflictDoUpdate({
      target: userProfile.userId,
      set: { status: 'in_conversation', currentPlaceId: input.placeId, isFindable: false,
        locationHint: null, pingRequestedAt: null, pingRequestedByUserId: null,
        pingRequestedByUsername: null, updatedAt: now },
    })

    await db.update(userProfile).set({
      status: 'in_conversation', isFindable: false, locationHint: null,
      pingRequestedAt: null, pingRequestedByUserId: null, pingRequestedByUsername: null, updatedAt: now,
    }).where(eq(userProfile.userId, input.counterpartUserId))

    const connectionId = crypto.randomUUID()
    await db.insert(handoffConnection).values({
      id: connectionId, requesterUserId: this.userId, recipientUserId: input.counterpartUserId,
      placeId: input.placeId, status: 'accepted', createdAt: now, updatedAt: now,
    })

    await syncPlaceAgents([viewerProfile?.currentPlaceId, input.placeId, ...endedConnections.placeIds])
    await syncUserAgents([input.counterpartUserId, ...endedConnections.participantUserIds].filter((id) => id !== this.userId))
    await this.refresh()
    return { success: true, connectionId }
  }

  async endCurrentConnection() {
    const endedConnections = await endAcceptedConnectionsForUser(this.userId)
    if (endedConnections.placeIds.length === 0) return { success: false }
    await syncPlaceAgents(endedConnections.placeIds)
    await syncUserAgents(endedConnections.participantUserIds.filter((id) => id !== this.userId))
    await this.refresh()
    return { success: true }
  }
}
