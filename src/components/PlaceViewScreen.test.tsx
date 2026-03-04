// @vitest-environment jsdom

import type { ComponentProps } from 'react'
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
                isFindable: false,
                locationHint: null,
                pingRequestedAt: null,
                pingRequestedByUserId: null,
                pingRequestedByUsername: null,
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

vi.mock('jsqr', () => ({
  default: vi.fn(() => null),
}))

const originalMediaDevices = navigator.mediaDevices
const originalPlay = HTMLMediaElement.prototype.play
const originalCanvasGetContext = HTMLCanvasElement.prototype.getContext
const originalDeviceMotionEvent = window.DeviceMotionEvent

function renderPlaceViewScreen(
  overrides: Partial<ComponentProps<typeof PlaceViewScreen>> = {},
) {
  const props: ComponentProps<typeof PlaceViewScreen> = {
    session: {
      session: { expiresAt: '2026-03-05T00:00:00.000Z' },
      user: {
        id: 'user-1',
        name: 'readytalk',
        username: 'readytalk',
        displayUsername: 'readytalk',
      },
    },
    profile: {
      userId: 'user-1',
      moodEmoji: '🙂',
      intentText: 'Open to a quick hello.',
      intentSummary: 'Open to a quick hello.',
      status: 'present',
      currentPlaceId: 'place-1',
      isFindable: false,
      locationHint: null,
      pingRequestedAt: null,
      pingRequestedByUserId: null,
      pingRequestedByUsername: null,
      createdAt: '2026-03-04T19:00:00.000Z',
      updatedAt: '2026-03-04T19:00:00.000Z',
    },
    currentPlace: {
      place: {
        placeId: 'place-1',
        name: 'Quiet Cafe',
        address: '123 Main St',
        lat: 1,
        lng: 2,
        readyCount: 2,
      },
      readyCount: 2,
    },
    qrHandoff: {
      token: 'qr-token',
      url: 'https://readytotalk.app/?scan=qr-token',
      expiresAt: '2026-03-05T00:00:00.000Z',
      isActive: false,
    },
    activeConnection: null,
    initialScanToken: null,
    refreshSession: vi.fn(async () => undefined),
    clearScanToken: vi.fn(async () => undefined),
    setReady: vi.fn(async () => undefined),
    saveFinderProfile: vi.fn(async () => ({
      userId: 'user-1',
      moodEmoji: '🙂',
      intentText: 'Open to a quick hello.',
      intentSummary: 'Open to a quick hello.',
      status: 'ready' as const,
      currentPlaceId: 'place-1',
      isFindable: true,
      locationHint: 'Window seats',
      pingRequestedAt: null,
      pingRequestedByUserId: null,
      pingRequestedByUsername: null,
      createdAt: '2026-03-04T19:00:00.000Z',
      updatedAt: '2026-03-04T19:00:00.000Z',
    })),
    leavePlace: vi.fn(async () => undefined),
    pingParticipant: vi.fn(async () => ({ success: true })),
    loadScanPreview: vi.fn(async () => ({
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
    })),
    connectScan: vi.fn(async () => ({ success: true })),
    endConversation: vi.fn(async () => ({ success: true })),
    client: {
      signOut: vi.fn(async () => ({ error: null })),
    },
    ...overrides,
  }

  render(<PlaceViewScreen {...props} />)

  return props
}

function dispatchDeviceMotion(acceleration: { x: number; y: number; z: number }) {
  const event = new Event('devicemotion')

  Object.defineProperty(event, 'accelerationIncludingGravity', {
    configurable: true,
    value: acceleration,
  })

  window.dispatchEvent(event)
}

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  refresh.mockClear()
  useAgentMock.mockClear()
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: originalMediaDevices,
  })
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: originalPlay,
  })
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: originalCanvasGetContext,
  })
  Object.defineProperty(window, 'DeviceMotionEvent', {
    configurable: true,
    value: originalDeviceMotionEvent,
  })
  window.BarcodeDetector = undefined
})

describe('PlaceViewScreen', () => {
  it('subscribes to the place agent and renders live ready count', async () => {
    renderPlaceViewScreen()

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

  it('starts the camera even when BarcodeDetector is unavailable', async () => {
    const stop = vi.fn()
    const getUserMedia = vi.fn(async () => ({
      getTracks: () => [{ stop }],
    }))

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia,
      },
    })
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn(async () => undefined),
    })
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: vi.fn(() => ({
        drawImage: vi.fn(),
        getImageData: vi.fn(() => ({
          data: new Uint8ClampedArray(4),
        })),
      })),
    })
    window.BarcodeDetector = undefined

    renderPlaceViewScreen()

    screen.getByRole('button', { name: 'Scan someone nearby' }).click()

    await waitFor(() => {
      expect(getUserMedia).toHaveBeenCalledTimes(1)
    })

    expect(
      screen.queryByText(/camera scanning is not available here/i),
    ).toBeNull()
  })

  it('marks a ready user not ready after sustained face-down motion', async () => {
    Object.defineProperty(window, 'DeviceMotionEvent', {
      configurable: true,
      value: class DeviceMotionEvent {},
    })

    const setReady = vi.fn(async () => undefined)
    const refreshSession = vi.fn(async () => undefined)
    const dateNow = vi.spyOn(Date, 'now')

    renderPlaceViewScreen({
      setReady,
      refreshSession,
    })

    await screen.findByText(
      'Flip your phone face-down for a moment to leave the ready pool without tapping.',
    )

    dateNow.mockReturnValue(100)
    dispatchDeviceMotion({ x: 0.3, y: -0.5, z: -9.6 })
    dateNow.mockReturnValue(1500)
    dispatchDeviceMotion({ x: 0.2, y: 0.1, z: -9.4 })

    await waitFor(() => {
      expect(setReady).toHaveBeenCalledWith({
        data: {
          ready: false,
        },
      })
    })

    expect(refreshSession).toHaveBeenCalledTimes(1)
    dateNow.mockRestore()
  })

  it('requests motion permission before enabling the face-down shortcut', async () => {
    const requestPermission = vi.fn(async () => 'granted' as const)

    Object.defineProperty(window, 'DeviceMotionEvent', {
      configurable: true,
      value: {
        requestPermission,
      },
    })

    const setReady = vi.fn(async () => undefined)
    const dateNow = vi.spyOn(Date, 'now')

    renderPlaceViewScreen({
      setReady,
    })

    screen.getByRole('button', { name: 'Enable face-down shortcut' }).click()

    await waitFor(() => {
      expect(requestPermission).toHaveBeenCalledTimes(1)
    })

    await screen.findByText('Flip your phone face-down to leave the ready pool.')

    dateNow.mockReturnValue(200)
    dispatchDeviceMotion({ x: 0, y: 0, z: -9.8 })
    dateNow.mockReturnValue(1700)
    dispatchDeviceMotion({ x: 0.1, y: 0.2, z: -9.5 })

    await waitFor(() => {
      expect(setReady).toHaveBeenCalledWith({
        data: {
          ready: false,
        },
      })
    })

    dateNow.mockRestore()
  })
})
