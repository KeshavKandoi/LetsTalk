import { createFileRoute } from '@tanstack/react-router'
import { markMessagesDelivered, markMessagesRead } from '@backend/lib/message-status'
import { ChatMediaError } from '@backend/lib/chat-media'
import { auth } from '@backend/lib/auth'

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } })
}

function stringList(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? (value as string[]) : null
}

export const Route = createFileRoute('/api/friends/message-status')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const session = await auth.api.getSession({ headers: (() => { const h = new Headers(Object.fromEntries(request.headers.entries())); const t = (request.headers.get('authorization') || request.headers.get('Authorization') || '').replace('Bearer ',''); if(t) h.set('cookie', 'better-auth.session_token=' + t); return h; })() })
          if (!session) return json({ error: 'Unauthorized' }, 401)

          let body: { action?: unknown; messageId?: unknown; messageIds?: unknown; friendUserId?: unknown }
          try {
            body = (await request.json()) as typeof body
          } catch {
            return json({ error: 'Invalid request.' }, 400)
          }

          const ids = stringList(body.messageIds) ?? (typeof body.messageId === 'string' ? [body.messageId] : null)
          console.log(`[STATUS] action=${String(body.action)} user=${session.user.id} ids=${ids ? ids.length : 0} friend=${String(body.friendUserId ?? '')}`)

          if (body.action === 'delivered') {
            if (!ids) return json({ error: 'Invalid request.' }, 400)
            return json(await markMessagesDelivered({ viewerUserId: session.user.id, messageIds: ids }))
          }

          if (body.action === 'read') {
            const friendUserId = typeof body.friendUserId === 'string' && body.friendUserId ? body.friendUserId : undefined
            if (!friendUserId && !ids) return json({ error: 'Invalid request.' }, 400)
            return json(await markMessagesRead({ viewerUserId: session.user.id, friendUserId, messageIds: ids ?? undefined }))
          }

          return json({ error: 'Invalid action.' }, 400)
        } catch (e) {
          if (e instanceof ChatMediaError) return json({ error: e.message }, e.status)
          console.error('[message-status] failed')
          return json({ error: 'Request failed.' }, 500)
        }
      },
    },
  },
})
