import { createFileRoute } from '@tanstack/react-router'
import { saveFinderProfile, pingFindableUser } from '@backend/lib/app-state'
import { auth } from '@backend/lib/auth'

export const Route = createFileRoute('/api/places/finder')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const session = await auth.api.getSession({ headers: request.headers })
          if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
          const body = await request.json()
          if (body.action === 'ping') {
            const result = await pingFindableUser({ userId: body.userId })
            return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
          }
          const result = await saveFinderProfile({ isFindable: body.isFindable, locationHint: body.locationHint ?? null })
          return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
      },
    },
  },
})
