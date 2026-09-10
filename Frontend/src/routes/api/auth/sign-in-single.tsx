import { createFileRoute } from '@tanstack/react-router'

// Retired: sign-in and session management are handled by Better Auth.
export const Route = createFileRoute('/api/auth/sign-in-single')({
  server: {
    handlers: {
      POST: async () => new Response(JSON.stringify({ error: 'This endpoint has been retired.' }), {
        status: 410,
        headers: { 'Content-Type': 'application/json' },
      }),
    },
  },
})
