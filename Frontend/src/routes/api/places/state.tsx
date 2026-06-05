import { createFileRoute } from '@tanstack/react-router'
import { getAppState } from '@backend/lib/app-state'
import { auth } from '@backend/lib/auth'

export const Route = createFileRoute('/api/places/state')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const session = await auth.api.getSession({ headers: request.headers })
          if (!session) return new Response(JSON.stringify({ session: null, profile: null }), { headers: { 'Content-Type': 'application/json' } })
          const result = await getAppState()
          return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
        } catch (e: any) {
          return new Response(JSON.stringify({ session: null, profile: null }), { headers: { 'Content-Type': 'application/json' } })
        }
      },
    },
  },
})
