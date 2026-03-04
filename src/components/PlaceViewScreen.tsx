import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import * as QRCode from 'qrcode'
import { useAgent } from 'agents/react'
import {
  ArrowLeft,
  Camera,
  Check,
  MapPin,
  MessageCircle,
  QrCode,
  Radio,
  ScanLine,
  Users,
  X,
} from 'lucide-react'
import { authClient } from '../lib/auth-client'
import type {
  ActiveConnectionState,
  AppSession,
  ConnectionPreviewState,
  CurrentPlaceState,
  PlaceAgentState,
  QrHandoffState,
  UserProfileState,
} from '../lib/app-types'
import { extractScanToken } from '../lib/scan-token'
import type { PlaceAgent } from '../lib/server/agents/place-agent'

type DetectedCode = {
  rawValue?: string
}

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<DetectedCode[]>
}

type BarcodeDetectorCtor = new (options?: {
  formats?: string[]
}) => BarcodeDetectorLike

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorCtor
  }
}

type AuthResult = {
  error?: {
    message?: string | null
  } | null
}

type PlaceViewClientLike = {
  signOut: () => Promise<AuthResult>
}

export function PlaceViewScreen({
  session,
  profile,
  currentPlace,
  qrHandoff,
  activeConnection,
  initialScanToken,
  refreshSession,
  clearScanToken,
  setReady,
  leavePlace,
  loadScanPreview,
  connectScan,
  endConversation,
  client = authClient,
}: {
  session: AppSession
  profile: UserProfileState
  currentPlace: CurrentPlaceState
  qrHandoff: QrHandoffState
  activeConnection: ActiveConnectionState | null
  initialScanToken: string | null
  refreshSession: () => Promise<void>
  clearScanToken: () => Promise<void>
  setReady: (input: { data: { ready: boolean } }) => Promise<void>
  leavePlace: () => Promise<void>
  loadScanPreview: (input: {
    data: {
      token: string
    }
  }) => Promise<ConnectionPreviewState>
  connectScan: (input: {
    data: {
      token: string
    }
  }) => Promise<unknown>
  endConversation: () => Promise<unknown>
  client?: PlaceViewClientLike
}) {
  const [pendingAction, setPendingAction] = useState<
    'ready' | 'leave' | 'sign-out' | 'connect' | 'end-connection' | null
  >(null)
  const [error, setError] = useState<string | null>(null)
  const [livePlaceState, setLivePlaceState] = useState<PlaceAgentState | null>(
    null,
  )
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanInput, setScanInput] = useState('')
  const [scanPreview, setScanPreview] = useState<ConnectionPreviewState | null>(
    null,
  )
  const [scanError, setScanError] = useState<string | null>(null)
  const [cameraStatus, setCameraStatus] = useState<
    'idle' | 'starting' | 'scanning' | 'unsupported'
  >('idle')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<number | null>(null)
  const resolvingScanRef = useRef(false)

  const placeAgent = useAgent<PlaceAgent, PlaceAgentState>({
    agent: 'place-agent',
    name: currentPlace.place.placeId,
    onStateUpdate: (nextState) => {
      setLivePlaceState(nextState)
    },
  })

  const username =
    session.user.displayUsername || session.user.username || session.user.name
  const isReady = profile.status === 'ready'
  const isInConversation = profile.status === 'in_conversation'
  const readyCount =
    livePlaceState?.placeId === currentPlace.place.placeId
      ? livePlaceState.readyCount
      : currentPlace.readyCount

  useEffect(() => {
    void placeAgent.stub.refresh().catch(() => undefined)
  }, [currentPlace.place.placeId])

  useEffect(() => {
    let cancelled = false

    void QRCode.toDataURL(qrHandoff.url, {
      margin: 1,
      width: 512,
      color: {
        dark: '#0f172a',
        light: '#f8fafc',
      },
    }).then((nextQrDataUrl: string) => {
      if (!cancelled) {
        setQrDataUrl(nextQrDataUrl)
      }
    })

    return () => {
      cancelled = true
    }
  }, [qrHandoff.url])

  const stopScanner = () => {
    if (scanIntervalRef.current !== null) {
      window.clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }

    streamRef.current?.getTracks().forEach((track) => {
      track.stop()
    })
    streamRef.current = null
    setCameraStatus('idle')
  }

  const resolveToken = async (rawValue: string) => {
    const token = extractScanToken(rawValue)

    if (!token || resolvingScanRef.current) {
      return
    }

    resolvingScanRef.current = true
    setScanError(null)

    try {
      const preview = await loadScanPreview({
        data: {
          token,
        },
      })
      setScanInput(rawValue)
      setScanPreview(preview)
      stopScanner()
    } catch (nextError) {
      setScanPreview(null)
      setScanError(
        nextError instanceof Error
          ? nextError.message
          : 'Unable to read that QR code right now.',
      )
    } finally {
      resolvingScanRef.current = false
    }
  }

  useEffect(() => {
    if (!initialScanToken) {
      return
    }

    setScannerOpen(true)
    void resolveToken(initialScanToken)
  }, [initialScanToken])

  useEffect(() => {
    if (!scannerOpen || scanPreview || isInConversation) {
      return
    }

    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof window === 'undefined' ||
      !window.BarcodeDetector
    ) {
      setCameraStatus('unsupported')
      return
    }

    const startScanner = async () => {
      setCameraStatus('starting')
      setScanError(null)

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {
              ideal: 'environment',
            },
          },
        })

        if (!videoRef.current) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream
        videoRef.current.srcObject = stream
        await videoRef.current.play()

        const BarcodeDetector = window.BarcodeDetector

        if (!BarcodeDetector) {
          setCameraStatus('unsupported')
          return
        }

        const detector = new BarcodeDetector({
          formats: ['qr_code'],
        })

        setCameraStatus('scanning')
        scanIntervalRef.current = window.setInterval(() => {
          if (!videoRef.current || resolvingScanRef.current) {
            return
          }

          void detector.detect(videoRef.current).then((results) => {
            const rawValue = results[0]?.rawValue

            if (rawValue) {
              void resolveToken(rawValue)
            }
          })
        }, 500)
      } catch (nextError) {
        setCameraStatus('unsupported')
        setScanError(
          nextError instanceof Error
            ? nextError.message
            : 'Unable to start the camera right now.',
        )
      }
    }

    void startScanner()

    return () => {
      stopScanner()
    }
  }, [scannerOpen, scanPreview, isInConversation])

  const handleReadyToggle = async () => {
    setPendingAction('ready')
    setError(null)

    try {
      await setReady({
        data: {
          ready: !isReady,
        },
      })
      await refreshSession()
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Unable to change your status right now.',
      )
    } finally {
      setPendingAction(null)
    }
  }

  const handleLeavePlace = async () => {
    setPendingAction('leave')
    setError(null)

    try {
      await leavePlace()
      await refreshSession()
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Unable to switch places right now.',
      )
    } finally {
      setPendingAction(null)
    }
  }

  const handleSignOut = async () => {
    setPendingAction('sign-out')
    setError(null)

    const result = await client.signOut()

    if (result.error) {
      setError(result.error.message || 'Unable to sign out right now.')
      setPendingAction(null)
      return
    }

    await refreshSession()
    setPendingAction(null)
  }

  const handleOpenScanner = async () => {
    setScannerOpen(true)
    setScanPreview(null)
    setScanError(null)
    setScanInput('')
    await clearScanToken()
  }

  const handleCloseScanner = async () => {
    stopScanner()
    setScannerOpen(false)
    setScanPreview(null)
    setScanError(null)
    setScanInput('')
    await clearScanToken()
  }

  const handleResolveManualScan = async () => {
    await resolveToken(scanInput)
  }

  const handleConnect = async () => {
    if (!scanPreview) {
      return
    }

    setPendingAction('connect')
    setError(null)

    try {
      await connectScan({
        data: {
          token: scanPreview.token,
        },
      })
      await handleCloseScanner()
      await refreshSession()
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Unable to start that connection right now.',
      )
    } finally {
      setPendingAction(null)
    }
  }

  const handleEndConnection = async () => {
    setPendingAction('end-connection')
    setError(null)

    try {
      await endConversation()
      await refreshSession()
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Unable to end that connection right now.',
      )
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <main className="min-h-screen bg-[#f4efe6] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-5 py-8 sm:px-6 lg:flex-row lg:items-start lg:justify-between lg:gap-12 lg:px-8">
        <section className="w-full max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-sm font-medium text-emerald-800 shadow-sm">
            <Radio className="h-4 w-4" />
            Live place prototype
          </div>

          <h1 className="mt-5 text-4xl font-black leading-none tracking-[-0.05em] sm:text-5xl">
            {currentPlace.place.name}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-700 sm:text-lg">
            You are checked in here as {username}. This is the calm MVP place
            view: confirm the place, decide whether you are ready, then show a
            QR code when you want someone nearby to connect.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <MetricCard
              icon={<Users className="h-5 w-5" />}
              label="Ready right now"
              value={String(readyCount)}
              tone="amber"
            />
            <MetricCard
              icon={<MapPin className="h-5 w-5" />}
              label="Your state"
              value={
                isInConversation
                  ? 'Talking'
                  : isReady
                    ? 'Ready'
                    : 'Present'
              }
              tone={isInConversation ? 'amber' : isReady ? 'emerald' : 'slate'}
            />
          </div>

          <div className="mt-8 rounded-[2rem] border border-stone-200 bg-white/78 p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
              Your intro
            </p>
            <p className="mt-4 text-2xl font-semibold">
              {profile.moodEmoji} {profile.intentSummary}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {currentPlace.place.address}
            </p>
          </div>
        </section>

        <section className="w-full max-w-xl rounded-[2rem] border border-stone-200 bg-white/92 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-emerald-700">
                Place View
              </p>
              <h2 className="mt-2 text-3xl font-bold">Ready when you want</h2>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={pendingAction === 'sign-out'}
              className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pendingAction === 'sign-out' ? 'Signing out...' : 'Sign out'}
            </button>
          </div>

          <div className="mt-6 rounded-3xl border border-stone-200 bg-stone-50 p-5">
            <p className="text-sm font-semibold text-slate-900">Status</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {isInConversation
                ? 'You are currently in a conversation, so your QR and ready state are paused.'
                : isReady
                ? 'You are visible in the ready count for this place.'
                : 'You are present here, but not yet in the ready count.'}
            </p>

            {isInConversation ? (
              <button
                type="button"
                onClick={handleEndConnection}
                disabled={pendingAction === 'end-connection'}
                className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {pendingAction === 'end-connection'
                  ? 'Ending conversation...'
                  : 'I am free again'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleReadyToggle}
                disabled={pendingAction === 'ready'}
                className={`mt-4 inline-flex w-full items-center justify-center rounded-2xl px-5 py-3 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70 ${
                  isReady
                    ? 'bg-slate-900 hover:bg-slate-800'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {pendingAction === 'ready'
                  ? 'Updating status...'
                  : isReady
                    ? 'Leave ready pool'
                    : 'Set me ready'}
              </button>
            )}
          </div>

          <div className="mt-6 rounded-3xl border border-stone-200 bg-stone-50 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-stone-200 bg-white p-3 text-slate-700">
                <QrCode className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Your QR</p>
                <p className="text-sm leading-6 text-slate-600">
                  Nearby people can scan this to preview you, then confirm
                  before they connect.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-stone-200 bg-white px-4 py-6 text-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`Ready to Talk QR for ${username}`}
                  className={`mx-auto h-48 w-48 rounded-3xl border border-stone-200 bg-slate-50 p-3 ${
                    qrHandoff.isActive ? '' : 'opacity-40'
                  }`}
                />
              ) : (
                <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-3xl border border-dashed border-stone-300 text-sm text-slate-500">
                  Building QR...
                </div>
              )}

              <div
                className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
                  qrHandoff.isActive
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-stone-200 text-slate-700'
                }`}
              >
                <Check className="h-4 w-4" />
                {qrHandoff.isActive
                  ? 'Live while you are ready'
                  : 'Set yourself ready to make this live'}
              </div>
            </div>
          </div>

          {activeConnection ? (
            <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-center gap-3 text-emerald-900">
                <MessageCircle className="h-5 w-5" />
                <p className="text-sm font-semibold">Current conversation</p>
              </div>
              <p className="mt-3 text-xl font-semibold text-slate-950">
                {activeConnection.counterpart.username}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {activeConnection.counterpart.moodEmoji}{' '}
                {activeConnection.counterpart.intentSummary}
              </p>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleOpenScanner}
              disabled={isInConversation}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <ScanLine className="h-4 w-4" />
              Scan someone nearby
            </button>
            <button
              type="button"
              onClick={handleLeavePlace}
              disabled={pendingAction === 'leave'}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-5 py-3 font-semibold text-slate-900 transition hover:border-stone-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <ArrowLeft className="h-4 w-4" />
              {pendingAction === 'leave' ? 'Leaving place...' : 'Switch place'}
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </section>
      </div>

      {scannerOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/55 sm:items-center sm:justify-center">
          <div className="w-full max-w-xl rounded-t-[2rem] border border-stone-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.22)] sm:rounded-[2rem] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-amber-700">
                  Scan QR
                </p>
                <h3 className="mt-2 text-2xl font-bold">
                  Understand, then connect
                </h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  void handleCloseScanner()
                }}
                className="rounded-full border border-stone-200 p-2 text-slate-700 transition hover:border-stone-300 hover:text-slate-950"
                aria-label="Close scanner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {scanPreview ? (
              <div className="mt-6 rounded-3xl border border-stone-200 bg-stone-50 p-5">
                <p className="text-sm font-semibold text-slate-900">
                  You are about to connect with
                </p>
                <p className="mt-3 text-2xl font-semibold">
                  {scanPreview.counterpart.username}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {scanPreview.counterpart.moodEmoji}{' '}
                  {scanPreview.counterpart.intentSummary}
                </p>
                <p className="mt-3 text-sm text-slate-500">
                  {scanPreview.placeName}
                </p>

                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={pendingAction === 'connect'}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {pendingAction === 'connect'
                      ? 'Connecting...'
                      : 'Start conversation'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScanPreview(null)
                      setScanInput('')
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-5 py-3 font-semibold text-slate-900 transition hover:border-stone-300"
                  >
                    Scan another
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-6 overflow-hidden rounded-3xl border border-stone-200 bg-slate-950">
                  {cameraStatus === 'unsupported' ? (
                    <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 py-10 text-center text-slate-200">
                      <Camera className="h-8 w-8" />
                      <p className="max-w-sm text-sm leading-6">
                        In-app camera scanning is not available here. Scan the QR
                        with your phone camera or paste the link below.
                      </p>
                    </div>
                  ) : (
                    <video
                      ref={videoRef}
                      muted
                      playsInline
                      className="aspect-[4/5] w-full object-cover"
                    />
                  )}
                </div>

                <div className="mt-4 rounded-3xl border border-stone-200 bg-stone-50 p-5">
                  <p className="text-sm font-semibold text-slate-900">
                    {cameraStatus === 'starting'
                      ? 'Starting camera...'
                      : cameraStatus === 'scanning'
                        ? 'Point your camera at their QR code.'
                        : 'Paste a scan link or token'}
                  </p>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <input
                      type="text"
                      value={scanInput}
                      onChange={(event) => setScanInput(event.target.value)}
                      placeholder="https://readytotalk.app/?scan=..."
                      className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void handleResolveManualScan()
                      }}
                      className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800"
                    >
                      Preview
                    </button>
                  </div>
                </div>
              </>
            )}

            {scanError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {scanError}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  )
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode
  label: string
  value: string
  tone: 'amber' | 'emerald' | 'slate'
}) {
  const styles = {
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    slate: 'border-stone-200 bg-white text-slate-900',
  }[tone]

  return (
    <div className={`rounded-[2rem] border p-5 shadow-sm ${styles}`}>
      <div className="inline-flex rounded-2xl border border-current/10 bg-white/70 p-3">
        {icon}
      </div>
      <p className="mt-4 text-sm font-medium">{label}</p>
      <p className="mt-2 text-4xl font-black tracking-[-0.04em]">{value}</p>
    </div>
  )
}
