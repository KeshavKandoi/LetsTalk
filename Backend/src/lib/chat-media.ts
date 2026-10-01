import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const CHAT_MEDIA_BUCKET = 'chat-media'
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024
export const MAX_DURATION_MS = 10 * 60 * 1000
export const SIGNED_URL_TTL_SECONDS = 600
export const MESSAGE_TYPES = ['text', 'image', 'audio'] as const
export type MessageType = (typeof MESSAGE_TYPES)[number]

export class ChatMediaError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ChatMediaError'
    this.status = status
  }
}

export function isMessageType(value: unknown): value is MessageType {
  return typeof value === 'string' && (MESSAGE_TYPES as readonly string[]).includes(value)
}

const IMAGE_CLAIMED = new Set(['image/jpeg', 'image/png', 'image/webp'])
const AUDIO_CLAIMED = new Set([
  'audio/m4a', 'audio/x-m4a', 'audio/mp4', 'audio/aac',
  'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/webm',
])

type Detected = { mime: string; ext: string }

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.subarray(start, end))
}

export function detectImage(b: Uint8Array): Detected | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' }
  if (b.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v)) return { mime: 'image/png', ext: 'png' }
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' }
  return null
}

export function detectAudio(b: Uint8Array): Detected | null {
  if (b.length >= 12 && ascii(b, 4, 8) === 'ftyp') return { mime: 'audio/mp4', ext: 'm4a' }
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WAVE') return { mime: 'audio/wav', ext: 'wav' }
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { mime: 'audio/webm', ext: 'webm' }
  if (b.length >= 2 && b[0] === 0xff && (b[1] & 0xf6) === 0xf0) return { mime: 'audio/aac', ext: 'aac' }
  if (b.length >= 3 && ascii(b, 0, 3) === 'ID3') return { mime: 'audio/mpeg', ext: 'mp3' }
  if (b.length >= 2 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && ((b[1] >> 1) & 3) !== 0) return { mime: 'audio/mpeg', ext: 'mp3' }
  return null
}

export function sanitizeFileName(name: string, fallback: string) {
  const last = name.split(/[\\/]/).pop() ?? ''
  const cleaned = last.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '').slice(0, 80)
  return cleaned || fallback
}

export type UploadedFile = { data: Uint8Array; mimeType: string; fileName: string }

export type ValidatedMedia = {
  kind: 'image' | 'audio'
  data: Uint8Array
  mime: string
  ext: string
  fileName: string
  size: number
  durationMs: number | null
}

export function validateChatMedia(
  kind: 'image' | 'audio',
  file: UploadedFile,
  durationMs?: number | null,
): ValidatedMedia {
  const size = file.data.byteLength
  if (size === 0) throw new ChatMediaError(400, 'Invalid message.')
  const limit = kind === 'image' ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES
  if (size > limit) throw new ChatMediaError(413, 'File is too large.')
  const claimed = file.mimeType.trim().toLowerCase()
  const allowed = kind === 'image' ? IMAGE_CLAIMED : AUDIO_CLAIMED
  if (!allowed.has(claimed)) throw new ChatMediaError(415, 'Unsupported media type.')
  const detected = kind === 'image' ? detectImage(file.data) : detectAudio(file.data)
  if (!detected) throw new ChatMediaError(415, 'Unsupported media type.')
  let duration: number | null = null
  if (kind === 'audio' && durationMs !== undefined && durationMs !== null) {
    if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > MAX_DURATION_MS) {
      throw new ChatMediaError(400, 'Invalid message.')
    }
    duration = Math.round(durationMs)
  }
  return {
    kind,
    data: file.data,
    mime: detected.mime,
    ext: detected.ext,
    fileName: sanitizeFileName(file.fileName, `${kind}.${detected.ext}`),
    size,
    durationMs: duration,
  }
}

let client: SupabaseClient | null = null
let bucketReady: Promise<void> | null = null

function storage() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new ChatMediaError(500, 'Media storage is not configured.')
  if (!client) client = createClient(url, key, { auth: { persistSession: false } })
  return client.storage
}

async function ensureBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const { error } = await storage().createBucket(CHAT_MEDIA_BUCKET, { public: false })
      if (error && !/exist/i.test(error.message)) throw error
    })().catch((e) => {
      bucketReady = null
      throw e
    })
  }
  return bucketReady
}

function randomHex(bytes: number) {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr, (v) => v.toString(16).padStart(2, '0')).join('')
}

export async function uploadChatMedia(friendRequestId: string, messageId: string, media: ValidatedMedia) {
  const key = `${friendRequestId}/${messageId}/${media.kind}-${randomHex(8)}.${media.ext}`
  try {
    await ensureBucket()
    const { error } = await storage().from(CHAT_MEDIA_BUCKET).upload(key, media.data, {
      contentType: media.mime,
      upsert: false,
    })
    if (error) throw error
  } catch (e) {
    if (e instanceof ChatMediaError) throw e
    console.error('[chat-media] upload failed')
    throw new ChatMediaError(500, 'Could not upload media.')
  }
  return { key }
}

export async function removeChatMedia(key: string) {
  try {
    await storage().from(CHAT_MEDIA_BUCKET).remove([key])
  } catch {
    console.error('[chat-media] cleanup failed')
  }
}

export async function signChatMediaUrl(key: string) {
  try {
    const { data, error } = await storage().from(CHAT_MEDIA_BUCKET).createSignedUrl(key, SIGNED_URL_TTL_SECONDS)
    if (error) return null
    return data.signedUrl
  } catch {
    return null
  }
}

export type MessageRow = {
  id: string
  friendRequestId: string
  senderUserId: string
  recipientUserId: string
  body: string
  status: string
  messageType: string
  mediaKey: string | null
  mimeType: string | null
  fileName: string | null
  fileSize: number | null
  durationMs: number | null
  createdAt: Date
  updatedAt: Date
}

export type ChatMessageDto = {
  id: string
  friendRequestId: string
  senderUserId: string
  recipientUserId: string
  messageType: MessageType
  body: string
  status: string
  media: {
    url: string | null
    mimeType: string | null
    fileName: string | null
    fileSize: number | null
    durationMs: number | null
  } | null
  createdAt: string
  updatedAt: string
}

export async function toMessageDto(row: MessageRow): Promise<ChatMessageDto> {
  const messageType: MessageType = isMessageType(row.messageType) ? row.messageType : 'text'
  const media =
    messageType !== 'text' && row.mediaKey
      ? {
          url: await signChatMediaUrl(row.mediaKey),
          mimeType: row.mimeType,
          fileName: row.fileName,
          fileSize: row.fileSize,
          durationMs: row.durationMs,
        }
      : null
  return {
    id: row.id,
    friendRequestId: row.friendRequestId,
    senderUserId: row.senderUserId,
    recipientUserId: row.recipientUserId,
    messageType,
    body: row.body,
    status: row.status,
    media,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function previewOf(message: { body: string; messageType: string } | null | undefined) {
  if (!message) return null
  if (message.body) return message.body
  if (message.messageType === 'image') return 'Photo'
  if (message.messageType === 'audio') return 'Voice message'
  return null
}
