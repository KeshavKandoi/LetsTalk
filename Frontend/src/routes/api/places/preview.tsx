import { createFileRoute } from '@tanstack/react-router'
import { getNearbyPlacePreview } from '@backend/lib/app-state'
import { auth } from '@backend/lib/auth'

export const Route = createFileRoute('/api/places/preview')({
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
          const body = await request.json() as { placeId: string }
          const result = await getNearbyPlacePreview({
            ...body,
            viewerUserId: session.user.id,
          })
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
