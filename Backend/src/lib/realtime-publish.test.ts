import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./env', () => ({
  getSupabaseUrl: () => 'https://example.supabase.co',
  getSupabaseAnonKey: () => 'anon-key',
}))

import { publishUserEvent } from './realtime-publish'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('publishUserEvent', () => {
  it('posts to the recipient topic with the event name and payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }))
    vi.stubGlobal('fetch', fetchMock)
    const ok = await publishUserEvent('user-b', 'new_message', { id: 'm1' })
    expect(ok).toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.supabase.co/realtime/v1/api/broadcast')
    const body = JSON.parse(init.body as string)
    expect(body.messages[0]).toMatchObject({ topic: 'user:user-b', event: 'new_message', payload: { id: 'm1' } })
  })

  it('reports failure when the server rejects the broadcast', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('denied', { status: 401 })))
    expect(await publishUserEvent('user-b', 'new_message', { id: 'm1' })).toBe(false)
  })

  it('reports failure when the request throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    expect(await publishUserEvent('user-b', 'message_status', { status: 'read' })).toBe(false)
  })
})
