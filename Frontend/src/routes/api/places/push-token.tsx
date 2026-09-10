import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@backend/lib/auth'
import { db } from '@backend/lib/db'
import { userProfile } from '@backend/lib/db/schema'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/places/push-token')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const session = await auth.api.getSession({ headers: (() => { const h = new Headers(Object.fromEntries(request.headers.entries())); const t = (request.headers.get('authorization') || request.headers.get('Authorization') || '').replace('Bearer ',''); if(t) h.set('cookie', 'better-auth.session_token=' + t); return h; })() })
          if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
          const body = await request.json() as { token?: unknown }
          const token = typeof body.token === 'string' ? body.token.trim() : ''
          if (!token || token.length > 256 || !token.startsWith('ExponentPushToken')) {
            return new Response(JSON.stringify({ error: 'Invalid push token.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
          }
          await db.update(userProfile).set({ pushToken: token }).where(eq(userProfile.userId, session.user.id))
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
        } catch {
          return new Response(JSON.stringify({ error: 'Unable to save push token.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
      },
    },
  },
})
