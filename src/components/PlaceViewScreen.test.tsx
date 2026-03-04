// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { PlaceViewScreen } from './PlaceViewScreen'
import type { PlaceAgentState } from '../lib/app-types'

const { refresh, useAgentMock } = vi.hoisted(() => {
  const refresh = vi.fn(async () => undefined)
  const useAgentMock = vi.fn(
    (
      options: {
        onStateUpdate?: (
          state: PlaceAgentState,
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
            participants: [
              {
                userId: 'user-1',
                username: 'readytalk',
                moodEmoji: '🙂',
                intentSummary: 'Open to a quick hello.',
                status: 'ready',
              },
            ],
            connections: [],
            updatedAt: '2026-03-04T19:30:00.000Z',
          },
          'server',
        )
      })

      return {
        call: refresh,
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

vi.mock('qrcode', () => ({
  toDataURL: vi.fn(async () => 'data:image/png;base64,qr'),
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
            readyCount: 2,
          },
          readyCount: 2,
        }}
        qrHandoff={{
          token: 'qr-token',
          url: 'https://readytotalk.app/?scan=qr-token',
          expiresAt: '2026-03-05T00:00:00.000Z',
          isActive: false,
        }}
        activeConnection={null}
        initialScanToken={null}
        refreshSession={vi.fn(async () => undefined)}
        clearScanToken={vi.fn(async () => undefined)}
        setReady={vi.fn(async () => undefined)}
        leavePlace={vi.fn(async () => undefined)}
        loadScanPreview={vi.fn(async () => ({
          token: 'qr-token',
          placeId: 'place-1',
          placeName: 'Quiet Cafe',
          counterpart: {
            userId: 'user-2',
            username: 'someone',
            moodEmoji: '🙂',
            intentSummary: 'Open to a quick hello.',
            status: 'ready' as const,
          },
        }))}
        connectScan={vi.fn(async () => ({ success: true }))}
        endConversation={vi.fn(async () => ({ success: true }))}
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
