import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@backend/lib/auth'

export const Route = createFileRoute('/api/places/change-password')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const session = await auth.api.getSession({ headers: request.headers })
          if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
          const { currentPassword, newPassword } = await request.json()
          await auth.api.changePassword({
            headers: request.headers,
            body: { currentPassword, newPassword, revokeOtherSessions: true },
          })
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
      },
    },
  },
})
