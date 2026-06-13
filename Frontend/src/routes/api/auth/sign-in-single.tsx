import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/auth/sign-in-single')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json()
          const { email, password, force } = body

          const { db } = await import('@backend/lib/db')
          const { user, session } = await import('@backend/lib/db/schema')
          const { eq } = await import('drizzle-orm')

          // Find user by email
          const existingUser = await db.select({ id: user.id })
            .from(user)
            .where(eq(user.email, email))
            .limit(1)

          if (existingUser.length > 0) {
            const userId = existingUser[0].id

            const activeSessions = await db.select({ id: session.id })
              .from(session)
              .where(eq(session.userId, userId))

            if (activeSessions.length > 0 && !force) {
              return new Response(JSON.stringify({
                error: 'ALREADY_LOGGED_IN',
                message: 'This account is already logged in on another device.',
              }), {
                status: 409,
                headers: { 'Content-Type': 'application/json' },
              })
            }

            if (activeSessions.length > 0 && force) {
              await db.delete(session).where(eq(session.userId, userId))
            }
          }

          // Call better-auth sign-in directly via fetch (avoid circular response)
          const signInRes = await fetch('http://localhost:3000/api/auth/sign-in/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:3000' },
            body: JSON.stringify({ email, password, rememberMe: true }),
          })

          const text = await signInRes.text()
          const data = text ? JSON.parse(text) : {}

          return new Response(JSON.stringify(data), {
            status: signInRes.status,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message || 'Login failed' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
