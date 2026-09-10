import { createFileRoute } from '@tanstack/react-router'
import { db } from '@backend/lib/db'
import { user, account as accountTable } from '@backend/lib/db/schema'
import { eq, ilike } from 'drizzle-orm'

export const Route = createFileRoute('/api/auth/check-email')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json() as { email?: unknown }
          const rawEmail = body.email
          const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : ''
          if (!email) return new Response(JSON.stringify({ exists: false }), { headers: { 'Content-Type': 'application/json' } })
          const found = await db.select({ id: user.id, emailVerified: user.emailVerified }).from(user).where(ilike(user.email, email)).limit(1)
          const account = found[0]
          const methods = account
            ? await db.select({ providerId: accountTable.providerId }).from(accountTable).where(eq(accountTable.userId, account.id)).limit(1)
            : []
          return new Response(JSON.stringify({
            exists: !!account,
            emailVerified: account?.emailVerified ?? false,
            authMethods: account ? ['email', ...methods.filter((m) => m.providerId === 'google').map(() => 'google')] : [],
          }), { headers: { 'Content-Type': 'application/json' } })
        } catch (e) {
          return new Response(JSON.stringify({ exists: false }), { headers: { 'Content-Type': 'application/json' } })
        }
      }
    }
  }
})
