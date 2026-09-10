import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@backend/lib/auth'
import { db } from '@backend/lib/db'
import { userProfile } from '@backend/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const MAX_REQUEST_BYTES = 8 * 1024 * 1024
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

function isSupportedImage(buffer: Buffer) {
  const jpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  const png = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const webp = buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
  return jpeg || png || webp
}

export const Route = createFileRoute('/api/places/upload-photo')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const session = await auth.api.getSession({ headers: (() => { const h = new Headers(Object.fromEntries(request.headers.entries())); const t = (request.headers.get('authorization') || request.headers.get('Authorization') || '').replace('Bearer ',''); if(t) h.set('cookie', 'better-auth.session_token=' + t); return h; })() })
          if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })

          const contentLength = Number(request.headers.get('content-length') || 0)
          if (contentLength > MAX_REQUEST_BYTES) return new Response(JSON.stringify({ error: 'Photo is too large.' }), { status: 413, headers: { 'Content-Type': 'application/json' } })
          const rawBody = await request.text()
          if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) return new Response(JSON.stringify({ error: 'Photo is too large.' }), { status: 413, headers: { 'Content-Type': 'application/json' } })
          const body = JSON.parse(rawBody) as { photoBase64?: unknown }
          if (typeof body.photoBase64 !== 'string' || !body.photoBase64) return new Response(JSON.stringify({ error: 'No photo provided.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })

          // Convert base64 to buffer
          const match = body.photoBase64.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/)
          if (!match) return new Response(JSON.stringify({ error: 'Unsupported image format.' }), { status: 415, headers: { 'Content-Type': 'application/json' } })
          const base64Data = match[2]
          const buffer = Buffer.from(base64Data, 'base64')
          if (!buffer.length || buffer.length > MAX_IMAGE_BYTES || !isSupportedImage(buffer)) {
            return new Response(JSON.stringify({ error: 'Invalid or oversized image.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
          }

          const fileName = `${session.user.id}.jpg`

          // Upload to Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, buffer, {
              contentType: 'image/jpeg',
              upsert: true,
            })

          if (uploadError) throw new Error('storage upload failed')

          // Get public URL
          const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
          const photoUrl = data.publicUrl

          // Save URL to DB - insert if not exists, update if exists
          const [existing] = await db
            .select()
            .from(userProfile)
            .where(eq(userProfile.userId, session.user.id))
            .limit(1)

          if (existing) {
            await db.update(userProfile)
              .set({ photoUrl: photoUrl })
              .where(eq(userProfile.userId, session.user.id))
          } else {
            await db.insert(userProfile).values({
              userId: session.user.id,
              photoUrl: photoUrl,
              moodEmoji: '🙂',
              intentText: '',
              intentSummary: '',
              status: 'offline',
              currentPlaceId: null,
              isFindable: false,
              locationHint: null,
              pingRequestedAt: null,
              pingRequestedByUserId: null,
              pingRequestedByUsername: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
          }

          return new Response(JSON.stringify({ ok: true, photoUrl }), { headers: { 'Content-Type': 'application/json' } })
        } catch (e: any) {
          console.error('[upload-photo] request failed', { name: e?.name })
          return new Response(JSON.stringify({ error: 'Could not upload photo.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
      },
    },
  },
})
