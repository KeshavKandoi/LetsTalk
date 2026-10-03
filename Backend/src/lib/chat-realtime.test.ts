import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  ensureChatRelay: vi.fn(),
  publishChatEvent: vi.fn(),
  publishUserEvent: vi.fn(),
}))

vi.mock('./nats-service', async () => {
  const actual = await vi.importActual<typeof import('./nats-service')>('./nats-service')
  return { ...actual, ensureChatRelay: mocks.ensureChatRelay, publishChatEvent: mocks.publishChatEvent }
})
vi.mock('./realtime-publish', () => ({ publishUserEvent: mocks.publishUserEvent }))

import { relayPersistedMessage } from './chat-realtime'

const input = {
  message: { id: 'm1', body: 'x' },
  messageId: 'm1',
  friendRequestId: 'r1',
  senderUserId: 'user-a',
  recipientUserId: 'user-b',
  messageType: 'text',
  createdAt: '2026-10-04T00:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.ensureChatRelay.mockResolvedValue(true)
  mocks.publishChatEvent.mockResolvedValue(true)
  mocks.publishUserEvent.mockResolvedValue(true)
})

describe('relayPersistedMessage', () => {
  it('starts the relay then publishes the canonical message to NATS', async () => {
    expect(await relayPersistedMessage(input)).toBe(true)
    expect(mocks.ensureChatRelay).toHaveBeenCalledTimes(1)
    const published = mocks.publishChatEvent.mock.calls[0][0]
    expect(published).toMatchObject({ v: 1, messageId: 'm1', senderUserId: 'user-a', recipientUserId: 'user-b', friendRequestId: 'r1', messageType: 'text' })
    expect(published.message).toEqual(input.message)
    expect(mocks.ensureChatRelay.mock.invocationCallOrder[0]).toBeLessThan(mocks.publishChatEvent.mock.invocationCallOrder[0])
  })

  it('does not call the direct Supabase path on the send side', async () => {
    await relayPersistedMessage(input)
    expect(mocks.publishUserEvent).not.toHaveBeenCalled()
  })

  it('reports failure without throwing when the NATS publish fails', async () => {
    mocks.publishChatEvent.mockResolvedValue(false)
    await expect(relayPersistedMessage(input)).resolves.toBe(false)
  })

  it('reports failure without throwing when publishing throws', async () => {
    mocks.publishChatEvent.mockRejectedValue(new Error('boom'))
    await expect(relayPersistedMessage(input)).resolves.toBe(false)
  })

  it('rejects an invalid recipient id without publishing', async () => {
    await expect(relayPersistedMessage({ ...input, recipientUserId: 'a.b' })).resolves.toBe(false)
    expect(mocks.publishChatEvent).not.toHaveBeenCalled()
  })

  it('forwards relayed events to the recipient Supabase topic', async () => {
    await relayPersistedMessage(input)
    const deliver = mocks.ensureChatRelay.mock.calls[0][0]
    expect(await deliver({ ...input, v: 1 })).toBe(true)
    expect(mocks.publishUserEvent).toHaveBeenCalledWith('user-b', 'new_message', input.message)
  })
})
