import { createFileRoute } from '@tanstack/react-router'
import {
  updateUserOnlineStatus,
  getUserOnlineStatus,
} from '@backend/lib/app-state'
import { auth } from '@backend/lib/auth'

export const Route = createFileRoute('/api/friends/online-status')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const session = await auth.api.getSession({ headers: request.headers })
          if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
          
          const body = await request.json() as { isOnline?: boolean; userId?: string }
          
          if (body.userId) {
            // Get status of another user
            const result = await getUserOnlineStatus({ userId: body.userId })
            return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
          } else {
            // Update own status
            const result = await updateUserOnlineStatus({ isOnline: body.isOnline ?? false })
            return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
          }
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
      },
    },
  },
})
