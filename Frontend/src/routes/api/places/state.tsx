import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@backend/lib/auth'
import { db } from '@backend/lib/db'
import { userProfile } from '@backend/lib/db/schema'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/places/state')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const session = await auth.api.getSession({ headers: request.headers })
          if (!session) return new Response(JSON.stringify({ session: null, profile: null }), { headers: { 'Content-Type': 'application/json' } })

          const [profileRecord] = await db
            .select()
            .from(userProfile)
            .where(eq(userProfile.userId, session.user.id))
            .limit(1)

          return new Response(JSON.stringify({
            session: {
              session: { expiresAt: session.session.expiresAt },
              user: {
                id: session.user.id,
                name: session.user.name,
                username: session.user.username ?? null,
                email: session.user.email,
              },
            },
            profile: profileRecord ? {
              userId: profileRecord.userId,
              moodEmoji: profileRecord.moodEmoji,
              intentText: profileRecord.intentText,
              intentSummary: profileRecord.intentSummary,
              status: profileRecord.status,
              currentPlaceId: profileRecord.currentPlaceId,
              isFindable: profileRecord.isFindable,
              locationHint: profileRecord.locationHint,
              photoUrl: profileRecord.photoUrl,
              age: profileRecord.age,
              gender: profileRecord.gender,
              createdAt: profileRecord.createdAt,
              updatedAt: profileRecord.updatedAt,
            } : null,
            currentPlace: null,
            qrHandoff: null,
            activeConnection: null,
          }), { headers: { 'Content-Type': 'application/json' } })
        } catch (e: any) {
          return new Response(JSON.stringify({ session: null, profile: null }), { headers: { 'Content-Type': 'application/json' } })
        }
      },
    },
  },
})
