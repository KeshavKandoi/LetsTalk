import { createFileRoute } from '@tanstack/react-router'
import { leaveCurrentPlace } from '@backend/lib/app-state'
import { auth } from '@backend/lib/auth'

export const Route = createFileRoute('/api/places/leave')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const session = await auth.api.getSession({ headers: request.headers })
          if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
          const result = await leaveCurrentPlace()
          return new Response(JSON.stringify(result ?? { success: true }), { headers: { 'Content-Type': 'application/json' } })
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
      },
    },
  },
})
