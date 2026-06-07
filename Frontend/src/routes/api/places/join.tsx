import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@backend/lib/auth'

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
          const body = await request.json()
          const { db } = await import('@backend/lib/db')
          const { userProfile } = await import('@backend/lib/db/schema')
          const { eq } = await import('drizzle-orm')
          
          // Just update currentPlaceId, moodEmoji, intentText for existing profile
          await db
            .update(userProfile)
            .set({
              moodEmoji: body.moodEmoji || '🙂',
              intentText: body.intentText || null,
              currentPlaceId: body.currentPlaceId,
              status: 'waiting',
              updatedAt: new Date(),
            })
            .where(eq(userProfile.userId, session.user.id))
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
