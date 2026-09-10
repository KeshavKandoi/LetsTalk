import { createFileRoute } from '@tanstack/react-router'
import { db } from '@backend/lib/db'
import { friendRequest, handoffConnection, user, userProfile } from '@backend/lib/db/schema'
import { auth } from '@backend/lib/auth'
import { eq, or, and, desc, gte } from 'drizzle-orm'

export const Route = createFileRoute('/api/friends/notifications')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const session = await auth.api.getSession({ headers: (() => { const h = new Headers(Object.fromEntries(request.headers.entries())); const t = (request.headers.get('authorization') || request.headers.get('Authorization') || '').replace('Bearer ',''); if(t) h.set('cookie', 'better-auth.session_token=' + t); return h; })() })
          if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
          const userId = session.user.id
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

          // Friend requests - join only the OTHER user
          const friendRows = await db
            .select({
              id: friendRequest.id,
              status: friendRequest.status,
              requesterUserId: friendRequest.requesterUserId,
              recipientUserId: friendRequest.recipientUserId,
              requesterAccepted: friendRequest.requesterAccepted,
              recipientAccepted: friendRequest.recipientAccepted,
              updatedAt: friendRequest.updatedAt,
              username: user.displayUsername,
              fallbackUsername: user.username,
            })
            .from(friendRequest)
            .innerJoin(user, or(
              and(eq(friendRequest.requesterUserId, userId), eq(user.id, friendRequest.recipientUserId)),
              and(eq(friendRequest.recipientUserId, userId), eq(user.id, friendRequest.requesterUserId)),
            ))
            .where(or(
              eq(friendRequest.requesterUserId, userId),
              eq(friendRequest.recipientUserId, userId),
            ))
            .orderBy(desc(friendRequest.updatedAt))
            // only last 30 days handled in filter below

          // QR scan connections - join only the OTHER user
          const scanRows = await db
            .select({
              id: handoffConnection.id,
              requesterUserId: handoffConnection.requesterUserId,
              recipientUserId: handoffConnection.recipientUserId,
              createdAt: handoffConnection.createdAt,
              username: user.displayUsername,
              fallbackUsername: user.username,
            })
            .from(handoffConnection)
            .innerJoin(user, or(
              and(eq(handoffConnection.requesterUserId, userId), eq(user.id, handoffConnection.recipientUserId)),
              and(eq(handoffConnection.recipientUserId, userId), eq(user.id, handoffConnection.requesterUserId)),
            ))
            .where(or(
              eq(handoffConnection.requesterUserId, userId),
              eq(handoffConnection.recipientUserId, userId),
            ))
            .orderBy(desc(handoffConnection.createdAt))

          const notifications: any[] = []

          for (const row of friendRows) {
            const otherUsername = row.username || row.fallbackUsername || 'Someone'
            const isRequester = row.requesterUserId === userId
            const isRecipient = row.recipientUserId === userId

            if (row.status === 'pending' && isRecipient && !row.recipientAccepted) {
              notifications.push({ id: `fr-${row.id}`, type: 'friend_request', message: `${otherUsername} sent you a friend request`, time: row.updatedAt })
            } else if (row.status === 'accepted') {
              notifications.push({ id: `fa-${row.id}`, type: 'friend_accepted', message: `You are now friends with ${otherUsername}`, time: row.updatedAt })
            } else if (row.status === 'declined' && isRequester) {
              notifications.push({ id: `fd-${row.id}`, type: 'friend_removed', message: `${otherUsername} removed you from friends`, time: row.updatedAt })
            }
          }

          // Deduplicate scan connections by pair
          const seenPairs = new Set<string>()
          for (const row of scanRows) {
            const otherId = row.requesterUserId === userId ? row.recipientUserId : row.requesterUserId
            const pairKey = [userId, otherId].sort().join('-')
            if (seenPairs.has(pairKey)) continue
            seenPairs.add(pairKey)
            const otherUsername = row.username || row.fallbackUsername || 'Someone'
            notifications.push({ id: `sc-${row.id}`, type: 'scan_connected', message: `You connected with ${otherUsername}`, time: row.createdAt })
          }

          const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
          const filtered = notifications.filter(n => new Date(n.time).getTime() > cutoff)
          filtered.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
          return new Response(JSON.stringify({ notifications: filtered }), { headers: { 'Content-Type': 'application/json' } })
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
      },
    },
  },
})
