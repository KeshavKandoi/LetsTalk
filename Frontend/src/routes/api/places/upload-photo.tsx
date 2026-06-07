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

export const Route = createFileRoute('/api/places/upload-photo')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const session = await auth.api.getSession({ headers: (() => { const h = new Headers(Object.fromEntries(request.headers.entries())); const t = (request.headers.get('authorization') || request.headers.get('Authorization') || '').replace('Bearer ',''); if(t) h.set('cookie', 'better-auth.session_token=' + t); return h; })() })
          if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })

          const { photoBase64 } = await request.json()
          if (!photoBase64) return new Response(JSON.stringify({ error: 'No photo' }), { status: 400, headers: { 'Content-Type': 'application/json' } })

          // Convert base64 to buffer
          const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '')
          const buffer = Buffer.from(base64Data, 'base64')

          const fileName = `${session.user.id}.jpg`

          // Upload to Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, buffer, {
              contentType: 'image/jpeg',
              upsert: true,
            })

          if (uploadError) throw new Error(uploadError.message)

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
          return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
      },
    },
  },
})
