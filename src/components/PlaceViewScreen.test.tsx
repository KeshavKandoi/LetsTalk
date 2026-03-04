// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { PlaceViewScreen } from './PlaceViewScreen'

const { refresh, useAgentMock } = vi.hoisted(() => {
  const refresh = vi.fn(async () => undefined)
  const useAgentMock = vi.fn(
    (
      options: {
        onStateUpdate?: (
          state: {
            placeId: string
            readyCount: number
            checkedInCount: number
            updatedAt: string | null
          },
          source: 'server' | 'client',
        ) => void
      },
    ) => {
      queueMicrotask(() => {
        options.onStateUpdate?.(
          {
            placeId: 'place-1',
            readyCount: 7,
            checkedInCount: 12,
            updatedAt: '2026-03-04T19:30:00.000Z',
          },
          'server',
        )
      })

      return {
        stub: {
          refresh,
        },
      }
    },
  )

  return { refresh, useAgentMock }
})

vi.mock('agents/react', () => ({
  useAgent: useAgentMock,
}))

afterEach(() => {
  cleanup()
  refresh.mockClear()
  useAgentMock.mockClear()
})

describe('PlaceViewScreen', () => {
  it('subscribes to the place agent and renders live ready count', async () => {
    render(
      <PlaceViewScreen
        session={{
          session: { expiresAt: '2026-03-05T00:00:00.000Z' },
          user: {
            id: 'user-1',
            name: 'readytalk',
            username: 'readytalk',
            displayUsername: 'readytalk',
          },
        }}
        profile={{
          userId: 'user-1',
          moodEmoji: '🙂',
          intentText: 'Open to a quick hello.',
          intentSummary: 'Open to a quick hello.',
          status: 'present',
          currentPlaceId: 'place-1',
          createdAt: '2026-03-04T19:00:00.000Z',
          updatedAt: '2026-03-04T19:00:00.000Z',
        }}
        currentPlace={{
          place: {
            placeId: 'place-1',
            name: 'Quiet Cafe',
            address: '123 Main St',
            lat: 1,
            lng: 2,
          },
          readyCount: 2,
        }}
        refreshSession={vi.fn(async () => undefined)}
        setReady={vi.fn(async () => undefined)}
        leavePlace={vi.fn(async () => undefined)}
        client={{
          signOut: vi.fn(async () => ({ error: null })),
        }}
      />,
    )

    expect(useAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: 'place-agent',
        name: 'place-1',
      }),
    )

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1)
    })

    expect(await screen.findByText('7')).toBeTruthy()
  })
})
