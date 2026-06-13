import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@backend/lib/auth'
import { db } from '@backend/lib/db'
import { userProfile } from '@backend/lib/db/schema'
import { eq } from 'drizzle-orm'
import { place, handoffCode } from '@backend/lib/db/schema'
import { getActiveConnectionForUser } from '@backend/lib/app-state'

export const Route = createFileRoute('/api/places/state')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
          const token = authHeader?.replace('Bearer ', '')
          const session = token
            ? await auth.api.getSession({ headers: new Headers({ ...Object.fromEntries(request.headers.entries()), cookie: `better-auth.session_token=${token}` }) })
            : await auth.api.getSession({ headers: (() => { const h = new Headers(Object.fromEntries(request.headers.entries())); const t = (request.headers.get('authorization') || request.headers.get('Authorization') || '').replace('Bearer ',''); if(t) h.set('cookie', 'better-auth.session_token=' + t); return h; })() })
          if (!session) return new Response(JSON.stringify({ session: null, profile: null }), { headers: { 'Content-Type': 'application/json' } })

          const [profileRecord] = await db
            .select()
            .from(userProfile)
            .where(eq(userProfile.userId, session.user.id))
            .limit(1)

          return new Response(JSON.stringify({
            session: {
              session: { expiresAt: session.session.expiresAt },
              user: {
                id: session.user.id,
                name: session.user.name,
                username: session.user.username ?? null,
                email: session.user.email,
              },
            },
            profile: profileRecord ? {
              userId: profileRecord.userId,
              moodEmoji: profileRecord.moodEmoji,
              intentText: profileRecord.intentText,
              about: profileRecord.about ?? null,
              intentSummary: profileRecord.intentSummary,
              status: profileRecord.status,
              currentPlaceId: profileRecord.currentPlaceId,
              isFindable: profileRecord.isFindable,
              locationHint: profileRecord.locationHint,
              photoUrl: profileRecord.photoUrl,
              age: profileRecord.age,
              gender: profileRecord.gender,
              createdAt: profileRecord.createdAt,
              updatedAt: profileRecord.updatedAt,
            } : null,
            currentPlace: await (async () => {
              if (!profileRecord?.currentPlaceId) return null
              const [placeRecord] = await db.select().from(place).where(eq(place.placeId, profileRecord.currentPlaceId)).limit(1)
              if (!placeRecord) return null
              return { place: { placeId: placeRecord.placeId, name: placeRecord.name, address: placeRecord.address, lat: placeRecord.lat, lng: placeRecord.lng, readyCount: 0 }, readyCount: 0 }
            })(),
            qrHandoff: await (async () => {
              if (!profileRecord?.currentPlaceId) return null
              const now = new Date()
              const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000)
              const [existing] = await db.select().from(handoffCode).where(eq(handoffCode.userId, session.user.id)).limit(1)
              let token = existing?.token ?? Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
              if (existing && existing.expiresAt <= now) token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
              await db.insert(handoffCode).values({ token, userId: session.user.id, placeId: profileRecord.currentPlaceId, expiresAt, createdAt: existing?.createdAt ?? now, updatedAt: now }).onConflictDoUpdate({ target: handoffCode.userId, set: { token, placeId: profileRecord.currentPlaceId, expiresAt, updatedAt: now } })
              const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.29.59:3000'
              return { url: BASE_URL + '/?scan=' + token, isActive: profileRecord.status === 'ready' }
            })(),
            activeConnection: await getActiveConnectionForUser(session.user.id),
          }), { headers: { 'Content-Type': 'application/json' } })
        } catch (e: any) {
          return new Response(JSON.stringify({ session: null, profile: null }), { headers: { 'Content-Type': 'application/json' } })
        }
      },
    },
  },
})
