import { createFileRoute } from '@tanstack/react-router'
import { db } from '@backend/lib/db'
import { user } from '@backend/lib/db/schema'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/auth/check-email')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { email } = await request.json()
          if (!email) return new Response(JSON.stringify({ exists: false }), { headers: { 'Content-Type': 'application/json' } })
          const found = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1)
          return new Response(JSON.stringify({ exists: found.length > 0 }), { headers: { 'Content-Type': 'application/json' } })
        } catch (e) {
          return new Response(JSON.stringify({ exists: false }), { headers: { 'Content-Type': 'application/json' } })
        }
      }
    }
  }
})
