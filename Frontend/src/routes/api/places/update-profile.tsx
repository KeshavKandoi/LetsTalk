import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@backend/lib/auth'
import { db } from '@backend/lib/db'
import { userProfile } from '@backend/lib/db/schema'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/places/update-profile')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const session = await auth.api.getSession({ headers: (() => { const h = new Headers(Object.fromEntries(request.headers.entries())); const t = (request.headers.get('authorization') || request.headers.get('Authorization') || '').replace('Bearer ',''); if(t) h.set('cookie', 'better-auth.session_token=' + t); return h; })() })
          if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
          const { moodEmoji, intentText, age, gender, about } = await request.json() as {
            moodEmoji?: string
            intentText?: string
            age?: string
            gender?: string
            about?: string
          }
          const now = new Date()
          const [existingProfile] = await db
            .select()
            .from(userProfile)
            .where(eq(userProfile.userId, session.user.id))
            .limit(1)

          if (existingProfile) {
            await db
              .update(userProfile)
              .set({
                moodEmoji: moodEmoji ?? existingProfile.moodEmoji,
                intentText: intentText ?? existingProfile.intentText,
                age: age ?? existingProfile.age,
                gender: gender ?? existingProfile.gender,
                about: about !== undefined ? about : existingProfile.about,
                updatedAt: now,
              })
              .where(eq(userProfile.userId, session.user.id))
          } else {
            await db.insert(userProfile).values({
              userId: session.user.id,
              moodEmoji: moodEmoji ?? null,
              intentText: intentText ?? null,
              intentSummary: null,
              status: 'offline',
              currentPlaceId: null,
              isFindable: false,
              locationHint: null,
              pingRequestedAt: null,
              pingRequestedByUserId: null,
              pingRequestedByUsername: null,
              pushToken: null,
              photoUrl: null,
              age: age ?? null,
              gender: gender ?? null,
              about: about ?? null,
              createdAt: now,
              updatedAt: now,
            })
          }

          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
      },
    },
  },
})
