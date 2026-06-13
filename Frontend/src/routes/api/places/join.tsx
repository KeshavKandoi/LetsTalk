import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@backend/lib/auth'
import { buildIntentSummary, normalizeIntentText } from '@backend/lib/agents/user-agent-logic'

export const Route = createFileRoute('/api/places/join')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const session = await auth.api.getSession({ headers: (() => { const h = new Headers(Object.fromEntries(request.headers.entries())); const t = (request.headers.get('authorization') || request.headers.get('Authorization') || '').replace('Bearer ',''); if(t) h.set('cookie', 'better-auth.session_token=' + t); return h; })() })
          if (!session) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
              status: 401, headers: { 'Content-Type': 'application/json' },
            })
          }
          const body = await request.json() as {
            moodEmoji?: string
            intentText?: string
            currentPlaceId?: string
          }
          if (!body.currentPlaceId) {
            throw new Error('Pick a place first.')
          }
          const { db } = await import('@backend/lib/db')
          const { place, userProfile } = await import('@backend/lib/db/schema')
          const { eq } = await import('drizzle-orm')
          const [placeRecord] = await db
            .select({ placeId: place.placeId })
            .from(place)
            .where(eq(place.placeId, body.currentPlaceId))
            .limit(1)
          if (!placeRecord) {
            throw new Error('Choose a nearby place before continuing.')
          }

          const now = new Date()
          const intentText = normalizeIntentText(body.intentText ?? '')
          const intentSummary = buildIntentSummary(intentText)

          await db
            .insert(userProfile)
            .values({
              userId: session.user.id,
              moodEmoji: body.moodEmoji || '🙂',
              intentText,
              intentSummary,
              currentPlaceId: body.currentPlaceId,
              status: 'present',
              isFindable: false,
              isVerifiedOnSite: false,
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
                moodEmoji: body.moodEmoji || '🙂',
                intentText,
                intentSummary,
                currentPlaceId: body.currentPlaceId,
                status: 'present',
                isFindable: false,
                isVerifiedOnSite: false,
                locationHint: null,
                pingRequestedAt: null,
                pingRequestedByUserId: null,
                pingRequestedByUsername: null,
                updatedAt: now,
              },
            })
          const result = { ok: true }
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), {
            status: 400, headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
