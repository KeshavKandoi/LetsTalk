import { Agent, callable } from 'agents'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import type { PlaceAgentState } from '../../app-types'
import * as schema from '../db/schema'
import { handoffConnection, user, userProfile } from '../db/schema'

type PlaceAgentEnv = Cloudflare.Env & {
  DB: D1Database
}

async function loadPlaceSnapshot(
  database: D1Database,
  placeId: string,
): Promise<PlaceAgentState> {
  const db = drizzle(database, { schema })
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
      intentSummary: userProfile.intentSummary,
      status: userProfile.status,
      isFindable: userProfile.isFindable,
      locationHint: userProfile.locationHint,
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

  const connectionRecords = await db
    .select({
      id: handoffConnection.id,
      requesterUserId: handoffConnection.requesterUserId,
      recipientUserId: handoffConnection.recipientUserId,
      createdAt: handoffConnection.createdAt,
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
    participants: participantRecords.map((record) => ({
      userId: record.userId,
      username:
        record.username || record.fallbackUsername || record.fallbackName,
      moodEmoji: record.moodEmoji,
      intentSummary: record.intentSummary,
      status: record.status as PlaceAgentState['participants'][number]['status'],
      isFindable: record.isFindable ?? false,
      locationHint: record.locationHint,
      pingRequestedAt: record.pingRequestedAt?.toISOString() ?? null,
      pingRequestedByUserId: record.pingRequestedByUserId,
      pingRequestedByUsername: record.pingRequestedByUsername,
    })),
    connections: connectionRecords.map((record) => ({
      ...record,
      createdAt: record.createdAt.toISOString(),
    })),
    updatedAt: new Date().toISOString(),
  }
}

export class PlaceAgent extends Agent<PlaceAgentEnv, PlaceAgentState> {
  initialState: PlaceAgentState = {
    placeId: '',
    readyCount: 0,
    checkedInCount: 0,
    participants: [],
    connections: [],
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
    const snapshot = await loadPlaceSnapshot(this.env.DB, this.name)
    this.setState(snapshot)
    return snapshot
  }
}
