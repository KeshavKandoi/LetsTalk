import { describe, expect, it } from 'vitest'
import {
  ChatMediaError,
  MAX_AUDIO_BYTES,
  MAX_IMAGE_BYTES,
  previewOf,
  sanitizeFileName,
  toMessageDto,
  validateChatMedia,
} from './chat-media'

const jpeg = (size = 64) => {
  const b = new Uint8Array(size)
  b.set([0xff, 0xd8, 0xff])
  return b
}
const m4a = (size = 64) => {
  const b = new Uint8Array(size)
  b.set([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70])
  return b
}
const status = (fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    return e instanceof ChatMediaError ? e.status : -1
  }
  return 0
}

describe('image validation', () => {
  it('accepts a real jpeg', () => {
    const r = validateChatMedia('image', { data: jpeg(), mimeType: 'image/jpeg', fileName: 'a.jpg' })
    expect(r.mime).toBe('image/jpeg')
    expect(r.size).toBe(64)
  })
  it('rejects svg claimed type', () => {
    expect(status(() => validateChatMedia('image', { data: jpeg(), mimeType: 'image/svg+xml', fileName: 'a.svg' }))).toBe(415)
  })
  it('rejects spoofed bytes', () => {
    const html = new TextEncoder().encode('<html></html>')
    expect(status(() => validateChatMedia('image', { data: html, mimeType: 'image/jpeg', fileName: 'a.jpg' }))).toBe(415)
  })
  it('rejects oversized', () => {
    expect(status(() => validateChatMedia('image', { data: jpeg(MAX_IMAGE_BYTES + 1), mimeType: 'image/jpeg', fileName: 'a.jpg' }))).toBe(413)
  })
  it('rejects empty', () => {
    expect(status(() => validateChatMedia('image', { data: new Uint8Array(0), mimeType: 'image/jpeg', fileName: 'a.jpg' }))).toBe(400)
  })
})

describe('audio validation', () => {
  it('accepts m4a with duration', () => {
    const r = validateChatMedia('audio', { data: m4a(), mimeType: 'audio/m4a', fileName: 'v.m4a' }, 4210.4)
    expect(r.mime).toBe('audio/mp4')
    expect(r.durationMs).toBe(4210)
  })
  it('accepts audio without duration', () => {
    expect(validateChatMedia('audio', { data: m4a(), mimeType: 'audio/mp4', fileName: 'v.m4a' }).durationMs).toBeNull()
  })
  it('rejects unsupported type', () => {
    expect(status(() => validateChatMedia('audio', { data: m4a(), mimeType: 'audio/ogg', fileName: 'v.ogg' }))).toBe(415)
  })
  it('rejects oversized', () => {
    expect(status(() => validateChatMedia('audio', { data: m4a(MAX_AUDIO_BYTES + 1), mimeType: 'audio/m4a', fileName: 'v.m4a' }))).toBe(413)
  })
  it('rejects bad duration', () => {
    expect(status(() => validateChatMedia('audio', { data: m4a(), mimeType: 'audio/m4a', fileName: 'v.m4a' }, -5))).toBe(400)
    expect(status(() => validateChatMedia('audio', { data: m4a(), mimeType: 'audio/m4a', fileName: 'v.m4a' }, Number.NaN))).toBe(400)
  })
})

describe('file names', () => {
  it('strips traversal', () => {
    expect(sanitizeFileName('../../etc/passwd', 'x.jpg')).toBe('passwd')
    expect(sanitizeFileName('..', 'x.jpg')).toBe('x.jpg')
  })
})

describe('message payload', () => {
  const base = {
    id: 'm1', friendRequestId: 'r1', senderUserId: 'a', recipientUserId: 'b',
    status: 'sent', createdAt: new Date('2026-10-01T00:00:00Z'), updatedAt: new Date('2026-10-01T00:00:00Z'),
    mediaKey: null, mimeType: null, fileName: null, fileSize: null, durationMs: null,
  }
  it('text and emoji have no media and keep the body', async () => {
    const dto = await toMessageDto({ ...base, body: 'Hello 😀🔥❤️', messageType: 'text' })
    expect(dto.media).toBeNull()
    expect(dto.body).toBe('Hello 😀🔥❤️')
    expect(dto.createdAt).toBe('2026-10-01T00:00:00.000Z')
  })
  it('legacy rows without a type behave as text', async () => {
    const dto = await toMessageDto({ ...base, body: 'old', messageType: '' })
    expect(dto.messageType).toBe('text')
  })
  it('image carries media metadata', async () => {
    const dto = await toMessageDto({ ...base, body: '', messageType: 'image', mediaKey: 'r1/m1/image-x.jpg', mimeType: 'image/jpeg', fileName: 'a.jpg', fileSize: 10 })
    expect(dto.media?.mimeType).toBe('image/jpeg')
    expect(dto.media?.fileSize).toBe(10)
  })
  it('audio carries duration', async () => {
    const dto = await toMessageDto({ ...base, body: '', messageType: 'audio', mediaKey: 'r1/m1/audio-x.m4a', mimeType: 'audio/mp4', fileName: 'v.m4a', fileSize: 20, durationMs: 4210 })
    expect(dto.media?.durationMs).toBe(4210)
  })
  it('previews media-only messages', () => {
    expect(previewOf({ body: '', messageType: 'image' })).toBe('Photo')
    expect(previewOf({ body: '', messageType: 'audio' })).toBe('Voice message')
    expect(previewOf(null)).toBeNull()
  })
})
