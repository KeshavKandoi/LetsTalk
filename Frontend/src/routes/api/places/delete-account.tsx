import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@backend/lib/auth'
import { db } from '@backend/lib/db'
import { user, userProfile, verification } from '@backend/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

export const Route = createFileRoute('/api/places/delete-account')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const session = await auth.api.getSession({ headers: (() => { const h = new Headers(Object.fromEntries(request.headers.entries())); const t = (request.headers.get('authorization') || request.headers.get('Authorization') || '').replace('Bearer ',''); if(t) h.set('cookie', 'better-auth.session_token=' + t); return h; })() })
          if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
          const userId = session.user.id
          const email = session.user.email
          await db.transaction(async (tx) => {
            await tx.delete(userProfile).where(eq(userProfile.userId, userId))
            await tx.execute(sql`DELETE FROM session WHERE "userId" = ${userId}`)
            await tx.execute(sql`DELETE FROM account WHERE "userId" = ${userId}`)
            await tx.delete(verification).where(eq(verification.identifier, email))
            await tx.delete(user).where(eq(user.id, userId))
          })
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
      },
    },
  },
})
