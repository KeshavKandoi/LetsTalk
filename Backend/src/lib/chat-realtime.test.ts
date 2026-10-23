import { beforeEach, describe, expect, it, vi } from 'vitest'

const publishUserEvent = vi.hoisted(() => vi.fn())
vi.mock('./realtime-publish', () => ({ publishUserEvent }))

import { relayPersistedMessage } from './chat-realtime'

const input = {
  message: { id: 'm1', body: 'hello' },
  messageId: 'm1',
  friendRequestId: 'r1',
  senderUserId: 'user-a',
  recipientUserId: 'user-b',
  messageType: 'text',
  createdAt: '2026-10-04T00:00:00.000Z',
}

beforeEach(() => vi.clearAllMocks())

describe('relayPersistedMessage', () => {
  it('broadcasts the persisted message to the recipient', async () => {
    publishUserEvent.mockResolvedValue(true)
    await expect(relayPersistedMessage(input)).resolves.toBe(true)
    expect(publishUserEvent).toHaveBeenCalledWith('user-b', 'new_message', input.message)
  })

  it('reports a failed broadcast so clients can reconcile from storage', async () => {
    publishUserEvent.mockResolvedValue(false)
    await expect(relayPersistedMessage(input)).resolves.toBe(false)
  })
})
