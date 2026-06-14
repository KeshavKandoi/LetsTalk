import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/api/auth/check-session')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json()
          const email = body.email
          const currentToken = body.currentToken || null
          const { db } = await import('@backend/lib/db')
          const { user, session } = await import('@backend/lib/db/schema')
          const { eq, and, gt, ne } = await import('drizzle-orm')
          const existingUser = await db.select({ id: user.id })
            .from(user)
            .where(eq(user.email, email))
            .limit(1)
          if (existingUser.length === 0) {
            return new Response(JSON.stringify({ hasSession: false }), {
              status: 200, headers: { 'Content-Type': 'application/json' },
            })
          }
          const userId = existingUser[0].id
          const activeSessions = currentToken
            ? await db.select({ id: session.id }).from(session).where(and(eq(session.userId, userId), gt(session.expiresAt, new Date()), ne(session.token, currentToken)))
            : await db.select({ id: session.id }).from(session).where(and(eq(session.userId, userId), gt(session.expiresAt, new Date())))
          return new Response(JSON.stringify({ hasSession: activeSessions.length > 0 }), {
            status: 200, headers: { 'Content-Type': 'application/json' },
          })
        } catch (e: any) {
          return new Response(JSON.stringify({ hasSession: false }), {
            status: 200, headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
