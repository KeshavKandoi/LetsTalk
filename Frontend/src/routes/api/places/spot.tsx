import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/places/spot')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { auth } = await import('@backend/lib/auth')
          const session = await auth.api.getSession({ headers: request.headers })
          if (!session?.user?.id) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })

          const { spotLabel } = await request.json()
          const { db } = await import('@backend/lib/db')
          const { userProfile } = await import('@backend/lib/db/schema')
          const { eq } = await import('drizzle-orm')

          await db.update(userProfile)
            .set({ spotLabel, updatedAt: new Date() })
            .where(eq(userProfile.userId, session.user.id))

          return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
      },
    },
  },
})
