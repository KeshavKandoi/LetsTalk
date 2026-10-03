import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = vi.hoisted(() => {
  const state = { rows: [] as unknown[], inserted: null as unknown, conflict: null as unknown, deleteCalls: 0 }
  const db = {
    select: () => ({ from: () => ({ where: () => Promise.resolve(state.rows) }) }),
    insert: () => ({
      values: (v: unknown) => {
        state.inserted = v
        return { onConflictDoUpdate: (c: unknown) => { state.conflict = c; return Promise.resolve() } }
      },
    }),
    delete: () => ({ where: () => { state.deleteCalls++; return Promise.resolve() } }),
  }
  return { state, db }
})

vi.mock('./db', () => ({ db: dbMock.db }))

import { userDevice } from './db/schema'
import { buildPushMessages, getRecipientTokens, isValidPushToken, notifyNewMessage, registerDevice, removeDeadTokens, sendPushChunk } from './notifications'

const TOKEN_A = 'ExponentPushToken[AAAAAAAAAAAAAAAAAAAAAA]'
const TOKEN_B = 'ExponentPushToken[BBBBBBBBBBBBBBBBBBBBBB]'

function chunkOf(...tokens: string[]) {
  return buildPushMessages(tokens, { title: 'Sam', body: 'hi', data: { type: 'chat_message' } })
}

beforeEach(() => {
  dbMock.state.rows = []
  dbMock.state.inserted = null
  dbMock.state.conflict = null
  dbMock.state.deleteCalls = 0
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('isValidPushToken', () => {
  it('accepts an Expo push token', () => {
    expect(isValidPushToken('ExponentPushToken[McZpAbCdEfGhIjKlMnOpQr]')).toBe(true)
  })

  it('rejects empty and malformed values', () => {
    expect(isValidPushToken('')).toBe(false)
    expect(isValidPushToken('not-a-token')).toBe(false)
    expect(isValidPushToken('ExponentPushToken[]')).toBe(false)
    expect(isValidPushToken('ExponentPushToken[a b]')).toBe(false)
    expect(isValidPushToken(null)).toBe(false)
    expect(isValidPushToken(42)).toBe(false)
  })

  it('rejects oversized values', () => {
    expect(isValidPushToken(`ExponentPushToken[${'a'.repeat(300)}]`)).toBe(false)
  })
})

describe('device registration', () => {
  it('stores the token for the authenticated user', async () => {
    await registerDevice({ userId: 'user-a', pushToken: TOKEN_A })
    expect(dbMock.state.inserted).toMatchObject({ userId: 'user-a', pushToken: TOKEN_A, platform: 'android' })
  })

  it('upserts on the push token so a duplicate registration updates the row', async () => {
    await registerDevice({ userId: 'user-b', pushToken: TOKEN_A, platform: 'android' })
    const conflict = dbMock.state.conflict as { target: unknown; set: { userId: string } }
    expect(conflict.target).toBe(userDevice.pushToken)
    expect(conflict.set.userId).toBe('user-b')
  })

  it('looks up every token registered for the recipient', async () => {
    dbMock.state.rows = [{ pushToken: TOKEN_A }, { pushToken: TOKEN_B }]
    expect(await getRecipientTokens('user-b')).toEqual([TOKEN_A, TOKEN_B])
  })
})

describe('push payload', () => {
  it('is directly displayable by Android with high priority and a channel', () => {
    const [msg] = chunkOf(TOKEN_A)
    expect(msg).toMatchObject({ to: TOKEN_A, title: 'Sam', body: 'hi', channelId: 'messages', priority: 'high', sound: 'default', ttl: 86400 })
    expect(msg.data.type).toBe('chat_message')
  })

  it('sends one array element per device to Expo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ status: 'ok' }, { status: 'ok' }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await sendPushChunk(chunkOf(TOKEN_A, TOKEN_B))
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body).toHaveLength(2)
    expect(body[0].title).toBe('Sam')
    expect(result).toMatchObject({ httpStatus: 200, sent: 2, failed: 0 })
  })
})

describe('Expo failures', () => {
  it('reports an HTTP failure without removing tokens', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })))
    const result = await sendPushChunk(chunkOf(TOKEN_A))
    expect(result.failed).toBe(1)
    expect(result.deadTokens).toEqual([])
    expect(result.errors[0]).toMatch(/^http_500/)
  })

  it('reports a ticket error and keeps the token for non-removal errors', async () => {
    const tickets = { data: [{ status: 'error', message: 'too big', details: { error: 'MessageTooBig' } }] }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(tickets), { status: 200 })))
    const result = await sendPushChunk(chunkOf(TOKEN_A))
    expect(result.deadTokens).toEqual([])
    expect(result.errors[0]).toContain('MessageTooBig')
  })

  it('marks only DeviceNotRegistered tokens for cleanup and redacts tokens from errors', async () => {
    const tickets = {
      data: [
        { status: 'ok' },
        { status: 'error', message: `"${TOKEN_B}" is not a registered push notification recipient`, details: { error: 'DeviceNotRegistered' } },
      ],
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(tickets), { status: 200 })))
    const result = await sendPushChunk(chunkOf(TOKEN_A, TOKEN_B))
    expect(result.sent).toBe(1)
    expect(result.deadTokens).toEqual([TOKEN_B])
    expect(result.errors.join(' ')).not.toContain('ExponentPushToken[')
    await removeDeadTokens(result.deadTokens)
    expect(dbMock.state.deleteCalls).toBe(1)
  })

  it('does not touch the database when there is nothing to remove', async () => {
    await removeDeadTokens([])
    expect(dbMock.state.deleteCalls).toBe(0)
  })

  it('reports a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const result = await sendPushChunk(chunkOf(TOKEN_A))
    expect(result.failed).toBe(1)
    expect(result.errors[0]).toContain('request_failed')
  })
})

describe('notifyNewMessage', () => {
  it('does nothing when the recipient has no devices', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const summary = await notifyNewMessage({ senderUserId: 'a', recipientUserId: 'b', friendRequestId: 'r' })
    expect(summary).toEqual({ devices: 0, sent: 0, failed: 0, errors: [] })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
