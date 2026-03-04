import { Agent, callable } from 'agents'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import type { PlaceAgentState } from '../../app-types'
import * as schema from '../db/schema'
import { userProfile } from '../db/schema'

type PlaceAgentEnv = Cloudflare.Env & {
  DB: D1Database
}

async function loadPlaceSnapshot(
  database: D1Database,
  placeId: string,
): Promise<PlaceAgentState> {
  const db = drizzle(database, { schema })
  const [{ readyCount, checkedInCount }] = await db
    .select({
      readyCount: sql<number>`count(case when ${userProfile.status} = 'ready' then 1 end)`,
      checkedInCount: sql<number>`count(*)`,
    })
    .from(userProfile)
    .where(
      and(
        eq(userProfile.currentPlaceId, placeId),
        inArray(userProfile.status, ['present', 'ready', 'in_conversation']),
      ),
    )

  return {
    placeId,
    readyCount,
    checkedInCount,
    updatedAt: new Date().toISOString(),
  }
}

export class PlaceAgent extends Agent<PlaceAgentEnv, PlaceAgentState> {
  initialState: PlaceAgentState = {
    placeId: '',
    readyCount: 0,
    checkedInCount: 0,
    updatedAt: null,
  }

  async onConnect() {
    await this.refresh()
  }

  @callable()
  async refresh() {
    const snapshot = await loadPlaceSnapshot(this.env.DB, this.name)
    this.setState(snapshot)
    return snapshot
  }
}
