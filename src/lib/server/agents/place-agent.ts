import { and, eq, inArray, sql } from 'drizzle-orm'
import type { PlaceAgentState } from '../../app-types'
import { db } from '../db'
import { handoffConnection, user, userProfile } from '../db/schema'
import { getSupabaseUrl, getSupabaseAnonKey } from '../env'
import { createClient } from '@supabase/supabase-js'

export async function loadPlaceSnapshot(placeId: string): Promise<PlaceAgentState> {
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
      username: record.username || record.fallbackUsername || record.fallbackName,
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

export async function broadcastPlaceUpdate(placeId: string) {
  const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey())
  const snapshot = await loadPlaceSnapshot(placeId)
  await supabase.channel(`place:${placeId}`).send({
    type: 'broadcast',
    event: 'place_update',
    payload: snapshot,
  })
  return snapshot
}

export class PlaceAgent {
  async refresh(placeId: string) {
    return broadcastPlaceUpdate(placeId)
  }
}
