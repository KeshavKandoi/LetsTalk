import { createFileRoute } from '@tanstack/react-router'
import { isValidPushToken, registerDevice, unregisterDevice } from '@backend/lib/notifications'
import { auth } from '@backend/lib/auth'

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } })
}

export const Route = createFileRoute('/api/notifications/device')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const session = await auth.api.getSession({ headers: (() => { const h = new Headers(Object.fromEntries(request.headers.entries())); const t = (request.headers.get('authorization') || request.headers.get('Authorization') || '').replace('Bearer ',''); if(t) h.set('cookie', 'better-auth.session_token=' + t); return h; })() })
          if (!session) {
            console.log('[CHAT_DEBUG][PUSH] device registration HTTP status=401 (Unauthorized)')
            return json({ error: 'Unauthorized' }, 401)
          }

          let body: { action?: unknown; pushToken?: unknown; platform?: unknown }
          try {
            body = (await request.json()) as typeof body
          } catch {
            console.log('[CHAT_DEBUG][PUSH] device registration HTTP status=400 (Invalid JSON)')
            return json({ error: 'Invalid request.' }, 400)
          }

          if (!isValidPushToken(body.pushToken)) {
            console.log('[CHAT_DEBUG][PUSH] device registration HTTP status=400 (Invalid push token)')
            return json({ error: 'Invalid push token.' }, 400)
          }

          const platform = typeof body.platform === 'string' ? body.platform : 'android'

          if (body.action === 'unregister') {
            await unregisterDevice({ userId: session.user.id, pushToken: body.pushToken })
            console.log(`[CHAT_DEBUG][PUSH] device unregistration succeeded userId=${session.user.id}`)
            return json({ success: true })
          }
          if (body.action === 'register') {
            await registerDevice({ userId: session.user.id, pushToken: body.pushToken, platform })
            console.log(`[CHAT_DEBUG][PUSH] device registration succeeded HTTP status=200 userId=${session.user.id}`)
            return json({ success: true })
          }
          console.log('[CHAT_DEBUG][PUSH] device registration HTTP status=400 (Invalid action)')
          return json({ error: 'Invalid action.' }, 400)
        } catch (err) {
          console.error('[CHAT_DEBUG][PUSH] device registration HTTP status=500 error:', err)
          return json({ error: 'Request failed.' }, 500)
        }
      },
    },
  },
})

