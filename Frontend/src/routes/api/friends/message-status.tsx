import { createFileRoute } from '@tanstack/react-router'
import {
  markMessageAsDelivered,
  markMessageAsRead,
} from '@backend/lib/app-state'
import { auth } from '@backend/lib/auth'

export const Route = createFileRoute('/api/friends/message-status')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const session = await auth.api.getSession({ headers: request.headers })
          if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
          
          const body = await request.json() as { messageId?: string; action?: 'delivered' | 'read' }
          
          const result = body.action === 'delivered'
            ? await markMessageAsDelivered({ messageId: body.messageId ?? '' })
            : body.action === 'read'
              ? await markMessageAsRead({ messageId: body.messageId ?? '' })
              : { error: 'Invalid action' }
          
          return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
      },
    },
  },
})
