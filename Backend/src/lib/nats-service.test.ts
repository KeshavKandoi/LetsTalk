// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ connect: vi.fn() }))
vi.mock('nats', () => ({ connect: state.connect }))

const event = {
  v: 1,
  messageId: 'm1',
  friendRequestId: 'r1',
  senderUserId: 'user-a',
  recipientUserId: 'user-b',
  messageType: 'text',
  createdAt: '2026-10-04T00:00:00.000Z',
  message: { id: 'm1', body: 'x' },
}

function fakeSub() {
  const queue: unknown[] = []
  let wake: (() => void) | null = null
  return {
    push(msg: unknown) {
      queue.push(msg)
      wake?.()
    },
    isClosed: () => false,
    [Symbol.asyncIterator]() {
      return {
        async next() {
          while (queue.length === 0) await new Promise<void>((resolve) => { wake = resolve })
          return { done: false as const, value: queue.shift() }
        },
      }
    },
  }
}

function fakeConn() {
  const sub = fakeSub()
  const never = new Promise<never>(() => {})
  const nc = {
    publish: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn(() => sub),
    status: () => ({ [Symbol.asyncIterator]: () => ({ next: () => never }) }),
    closed: () => never,
    drain: vi.fn().mockResolvedValue(undefined),
  }
  return { sub, nc }
}

function wire(subject: string, payload: unknown) {
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload)
  return { subject, data: new TextEncoder().encode(data) }
}

async function load() {
  vi.resetModules()
  return import('./nats-service')
}

beforeEach(() => {
  state.connect.mockReset()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('configuration', () => {
  it('defaults to localhost outside production', async () => {
    vi.stubEnv('NATS_URL', '')
    vi.stubEnv('NODE_ENV', 'development')
    const { getNatsUrl } = await load()
    expect(getNatsUrl()).toBe('nats://localhost:4222')
  })

  it('reads NATS_URL from the environment', async () => {
    vi.stubEnv('NATS_URL', 'nats://nats.internal:4222')
    const { getNatsUrl } = await load()
    expect(getNatsUrl()).toBe('nats://nats.internal:4222')
  })

  it('refuses to default in production', async () => {
    vi.stubEnv('NATS_URL', '')
    vi.stubEnv('NODE_ENV', 'production')
    const { getNatsUrl } = await load()
    expect(() => getNatsUrl()).toThrow('Missing NATS_URL')
  })
})

describe('subject generation', () => {
  it('routes by user id', async () => {
    const { chatSubject } = await load()
    expect(chatSubject('user-b')).toBe('chat.user.user-b')
  })

  it('rejects ids that could inject wildcards or extra tokens', async () => {
    const { chatSubject } = await load()
    for (const bad of ['', 'a.b', 'a*', 'a>', 'a b', 'user@example.com']) {
      expect(() => chatSubject(bad)).toThrow()
    }
  })
})

describe('publishing', () => {
  it('connects once and publishes the persisted message to the recipient subject', async () => {
    vi.stubEnv('NATS_URL', 'nats://test:4222')
    const { nc } = fakeConn()
    state.connect.mockResolvedValue(nc)
    const { publishChatEvent } = await load()
    expect(await publishChatEvent(event as never)).toBe(true)
    expect(await publishChatEvent(event as never)).toBe(true)
    expect(state.connect).toHaveBeenCalledTimes(1)
    expect(state.connect.mock.calls[0][0]).toMatchObject({ servers: 'nats://test:4222', maxReconnectAttempts: -1 })
    const [subject, data] = nc.publish.mock.calls[0]
    expect(subject).toBe('chat.user.user-b')
    expect(JSON.parse(new TextDecoder().decode(data))).toMatchObject({ messageId: 'm1', recipientUserId: 'user-b' })
    expect(nc.flush).toHaveBeenCalled()
  })

  it('returns false instead of throwing when NATS is unavailable', async () => {
    state.connect.mockRejectedValue(new Error('connection refused'))
    const { publishChatEvent } = await load()
    await expect(publishChatEvent(event as never)).resolves.toBe(false)
  })

  it('returns false for an invalid recipient id', async () => {
    const { publishChatEvent } = await load()
    expect(await publishChatEvent({ ...event, recipientUserId: 'a.b' } as never)).toBe(false)
    expect(state.connect).not.toHaveBeenCalled()
  })

  it('reconnects on the next publish after a failed connection', async () => {
    const { nc } = fakeConn()
    state.connect.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(nc)
    const { publishChatEvent } = await load()
    expect(await publishChatEvent(event as never)).toBe(false)
    expect(await publishChatEvent(event as never)).toBe(true)
    expect(state.connect).toHaveBeenCalledTimes(2)
  })
})

describe('relay subscription', () => {
  async function started() {
    const { sub, nc } = fakeConn()
    state.connect.mockResolvedValue(nc)
    const mod = await load()
    const deliver = vi.fn().mockResolvedValue(true)
    await mod.ensureChatRelay(deliver)
    return { sub, nc, deliver, mod }
  }

  it('creates exactly one subscription however often it is ensured', async () => {
    const { nc, deliver, mod } = await started()
    await mod.ensureChatRelay(deliver)
    await mod.ensureChatRelay(deliver)
    expect(nc.subscribe).toHaveBeenCalledTimes(1)
    expect(nc.subscribe.mock.calls[0]).toEqual(['chat.user.*', { queue: 'chat-relay' }])
  })

  it('delivers a valid event to the client layer', async () => {
    const { sub, deliver } = await started()
    sub.push(wire('chat.user.user-b', event))
    await vi.waitFor(() => expect(deliver).toHaveBeenCalledTimes(1))
    expect(deliver.mock.calls[0][0]).toMatchObject({ messageId: 'm1', recipientUserId: 'user-b' })
  })

  it('rejects malformed events', async () => {
    const { sub, deliver } = await started()
    sub.push(wire('chat.user.user-b', 'not json'))
    sub.push(wire('chat.user.user-b', { v: 1, messageId: 'm9' }))
    sub.push(wire('chat.user.user-b', { ...event, message: { id: 'other' } }))
    sub.push(wire('chat.user.user-b', { ...event, messageId: 'm2', message: { id: 'm2' } }))
    await vi.waitFor(() => expect(deliver).toHaveBeenCalledTimes(1))
    expect(deliver.mock.calls[0][0].messageId).toBe('m2')
  })

  it('rejects events whose subject does not match the recipient', async () => {
    const { sub, deliver } = await started()
    sub.push(wire('chat.user.user-c', event))
    sub.push(wire('chat.user.user-b', { ...event, messageId: 'm3', message: { id: 'm3' } }))
    await vi.waitFor(() => expect(deliver).toHaveBeenCalledTimes(1))
    expect(deliver.mock.calls[0][0].messageId).toBe('m3')
  })

  it('ignores duplicate events for the same message id', async () => {
    const { sub, deliver } = await started()
    sub.push(wire('chat.user.user-b', event))
    sub.push(wire('chat.user.user-b', event))
    sub.push(wire('chat.user.user-b', { ...event, messageId: 'm4', message: { id: 'm4' } }))
    await vi.waitFor(() => expect(deliver).toHaveBeenCalledTimes(2))
    expect(deliver.mock.calls.map((c) => c[0].messageId)).toEqual(['m1', 'm4'])
  })

  it('keeps relaying after a delivery failure', async () => {
    const { sub, deliver } = await started()
    deliver.mockRejectedValueOnce(new Error('supabase down'))
    sub.push(wire('chat.user.user-b', event))
    sub.push(wire('chat.user.user-b', { ...event, messageId: 'm5', message: { id: 'm5' } }))
    await vi.waitFor(() => expect(deliver).toHaveBeenCalledTimes(2))
  })
})
