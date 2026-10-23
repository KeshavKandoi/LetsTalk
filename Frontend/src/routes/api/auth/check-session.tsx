import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/api/auth/check-session')({
  server: {
    handlers: {
      POST: async () => new Response(JSON.stringify({ error: 'This endpoint has been retired.' }), {
        status: 410,
        headers: { 'Content-Type': 'application/json' },
      }),
    },
  },
})
