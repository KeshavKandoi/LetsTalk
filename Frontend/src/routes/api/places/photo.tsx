import { createFileRoute } from '@tanstack/react-router'
import { getGoogleMapsApiKey } from '@backend/lib/env'

export const Route = createFileRoute('/api/places/photo')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const name = url.searchParams.get('name')

          if (!name || !name.startsWith('places/')) {
            return new Response('Invalid photo name', { status: 400 })
          }

          const googleUrl = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=400&key=${getGoogleMapsApiKey()}`
          const response = await fetch(googleUrl)

          if (!response.ok) {
            return new Response('Photo not available', { status: 404 })
          }

          const contentType = response.headers.get('content-type') || 'image/jpeg'
          const body = await response.arrayBuffer()

          return new Response(body, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=86400',
            },
          })
        } catch (e: any) {
          return new Response('Error loading photo', { status: 500 })
        }
      },
    },
  },
})
