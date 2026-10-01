import { createFileRoute } from '@tanstack/react-router'
import {
  getConversationMessages,
  sendConversationMessage,
} from '@backend/lib/app-state'
import { auth } from '@backend/lib/auth'
import { ChatMediaError, MAX_AUDIO_BYTES, MAX_IMAGE_BYTES, type UploadedFile } from '@backend/lib/chat-media'

const MAX_REQUEST_BYTES = MAX_AUDIO_BYTES + 512 * 1024

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } })
}

type ParsedRequest = {
  action?: string
  friendUserId?: string
  body?: string
  messageType?: string
  durationMs?: number | null
  file?: UploadedFile
}

async function parseRequest(request: Request): Promise<ParsedRequest | Response> {
  const contentType = request.headers.get('content-type') || ''
  if (!contentType.includes('multipart/form-data')) {
    const body = await request.json() as { friendUserId?: string; body?: string; action?: string; messageType?: string }
    return { action: body.action, friendUserId: body.friendUserId, body: body.body, messageType: body.messageType }
  }

  if (Number(request.headers.get('content-length') || 0) > MAX_REQUEST_BYTES) {
    return json({ error: 'File is too large.' }, 413)
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return json({ error: 'Invalid message.' }, 400)
  }

  const text = (key: string) => {
    const value = form.get(key)
    return typeof value === 'string' ? value : undefined
  }
  const messageType = text('messageType')
  const rawDuration = text('durationMs')
  const durationMs = rawDuration === undefined || rawDuration === '' ? null : Number(rawDuration)

  const entry = form.get('file')
  let file: UploadedFile | undefined
  if (entry instanceof Blob) {
    const limit = messageType === 'image' ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES
    if (entry.size > limit) return json({ error: 'File is too large.' }, 413)
    file = {
      data: new Uint8Array(await entry.arrayBuffer()),
      mimeType: entry.type,
      fileName: 'name' in entry ? String(entry.name) : '',
    }
  }

  return {
    action: text('action') ?? 'send',
    friendUserId: text('friendUserId'),
    body: text('body') ?? '',
    messageType,
    durationMs,
    file,
  }
}

export const Route = createFileRoute('/api/friends/messages')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const session = await auth.api.getSession({ headers: (() => { const h = new Headers(Object.fromEntries(request.headers.entries())); const t = (request.headers.get('authorization') || request.headers.get('Authorization') || '').replace('Bearer ',''); if(t) h.set('cookie', 'better-auth.session_token=' + t); return h; })() })
          if (!session) return json({ error: 'Unauthorized' }, 401)

          const parsed = await parseRequest(request)
          if (parsed instanceof Response) return parsed

          const result = parsed.action === 'send'
            ? await sendConversationMessage({
                friendUserId: parsed.friendUserId ?? '',
                body: parsed.body ?? '',
                messageType: parsed.messageType,
                durationMs: parsed.durationMs,
                file: parsed.file,
                viewerUserId: session.user.id,
              })
            : await getConversationMessages({
                friendUserId: parsed.friendUserId ?? '',
                viewerUserId: session.user.id,
              })

          return json(result)
        } catch (e) {
          if (e instanceof ChatMediaError) return json({ error: e.message }, e.status)
          const message = e instanceof Error ? e.message : 'Invalid message.'
          return json({ error: message }, 400)
        }
      },
    },
  },
})
