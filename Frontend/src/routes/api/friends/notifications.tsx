import { createFileRoute } from '@tanstack/react-router'
import { and, desc, eq, isNull, lt, or, sql } from 'drizzle-orm'
import { auth } from '@backend/lib/auth'
import { db } from '@backend/lib/db'
import { notification } from '@backend/lib/db/schema'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

function sessionHeaders(request: Request) {
  const headers = new Headers(Object.fromEntries(request.headers.entries()))
  const token = (request.headers.get('authorization') || request.headers.get('Authorization') || '').replace('Bearer ', '')
  if (token) headers.set('cookie', `better-auth.session_token=${token}`)
  return headers
}

async function unreadCount(userId: string) {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notification)
    .where(and(eq(notification.recipientUserId, userId), isNull(notification.readAt)))
  return Number(result?.count ?? 0)
}

function parseCursor(cursor: unknown) {
  if (typeof cursor !== 'string' || !cursor) return null
  const separator = cursor.indexOf('|')
  if (separator <= 0) return null
  const createdAt = new Date(cursor.slice(0, separator))
  const id = cursor.slice(separator + 1)
  if (!id || Number.isNaN(createdAt.getTime())) return null
  return { createdAt, id }
}

export const Route = createFileRoute('/api/friends/notifications')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const session = await auth.api.getSession({ headers: sessionHeaders(request) })
          if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })

          const body = await request.json().catch(() => ({})) as {
            action?: 'list' | 'unreadCount' | 'markRead' | 'markAllRead' | 'delete' | 'clear'
            cursor?: string
            limit?: number
            notificationId?: string
          }
          const userId = session.user.id

          if (body.action === 'unreadCount') {
            return Response.json({ unreadCount: await unreadCount(userId) })
          }

          if (body.action === 'markRead' && body.notificationId) {
            await db.update(notification)
              .set({ readAt: new Date() })
              .where(and(eq(notification.id, body.notificationId), eq(notification.recipientUserId, userId)))
            return Response.json({ unreadCount: await unreadCount(userId) })
          }

          if (body.action === 'markAllRead') {
            await db.update(notification)
              .set({ readAt: new Date() })
              .where(and(eq(notification.recipientUserId, userId), isNull(notification.readAt)))
            return Response.json({ unreadCount: 0 })
          }

          if (body.action === 'delete') {
            const deletedRows = typeof body.notificationId === 'string' && body.notificationId
              ? await db.delete(notification)
                .where(and(eq(notification.id, body.notificationId), eq(notification.recipientUserId, userId)))
                .returning({ id: notification.id })
              : []
            if (deletedRows.length === 0) {
              return Response.json({ error: 'Notification not found.' }, { status: 404 })
            }
            return Response.json({
              deletedNotificationId: deletedRows[0].id,
              unreadCount: await unreadCount(userId),
            })
          }

          if (body.action === 'clear') {
            const deletedRows = await db.delete(notification)
              .where(eq(notification.recipientUserId, userId))
              .returning({ id: notification.id })
            return Response.json({
              deletedCount: deletedRows.length,
              unreadCount: await unreadCount(userId),
            })
          }

          const pageSize = Math.min(Math.max(Number(body.limit) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE)
          const cursor = parseCursor(body.cursor)
          const rows = await db
            .select()
            .from(notification)
            .where(and(
              eq(notification.recipientUserId, userId),
              cursor
                ? or(
                    lt(notification.createdAt, cursor.createdAt),
                    and(eq(notification.createdAt, cursor.createdAt), lt(notification.id, cursor.id)),
                  )
                : undefined,
            ))
            .orderBy(desc(notification.createdAt), desc(notification.id))
            .limit(pageSize + 1)

          const hasMore = rows.length > pageSize
          const page = rows.slice(0, pageSize)
          const last = page[page.length - 1]
          return Response.json({
            notifications: page.map((row) => ({
              id: row.id,
              type: row.type,
              message: row.message,
              data: row.data ? JSON.parse(row.data) : null,
              createdAt: row.createdAt,
              readAt: row.readAt,
              isRead: Boolean(row.readAt),
            })),
            nextCursor: hasMore && last ? `${new Date(last.createdAt).toISOString()}|${last.id}` : null,
            hasMore,
            unreadCount: await unreadCount(userId),
          })
        } catch {
          return new Response(JSON.stringify({ error: 'Unable to load notifications.' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
        }
      },
    },
  },
})
