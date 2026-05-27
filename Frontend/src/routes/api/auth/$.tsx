import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      ANY: async ({ request }) => {
        const { auth } = await import('@backend/lib/auth')
        return auth.handler(request)
      },
    },
  },
})
