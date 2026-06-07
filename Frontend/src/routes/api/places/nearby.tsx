import { createFileRoute } from '@tanstack/react-router'
import { searchNearbyPlacesForLocation } from '@backend/lib/app-state'
import { auth } from '@backend/lib/auth'

export const Route = createFileRoute('/api/places/nearby')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const session = await auth.api.getSession({ headers: (() => { const h = new Headers(Object.fromEntries(request.headers.entries())); const t = (request.headers.get('authorization') || request.headers.get('Authorization') || '').replace('Bearer ',''); if(t) h.set('cookie', 'better-auth.session_token=' + t); return h; })() })
          if (!session) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
              status: 401, headers: { 'Content-Type': 'application/json' },
            })
          }
          const body = await request.json()
          const result = await searchNearbyPlacesForLocation(body)
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), {
            status: 400, headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
