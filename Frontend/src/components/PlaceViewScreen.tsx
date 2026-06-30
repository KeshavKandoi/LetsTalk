import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import jsQR from 'jsqr'
import * as QRCode from 'qrcode'
import { useAgent } from 'agents/react'
import {
  ArrowLeft,
  BellRing,
  Camera,
  Check,
  LocateFixed,
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

type DetectedCode = {
  rawValue?: string
}

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<DetectedCode[]>
}

type BarcodeDetectorCtor = new (options?: {
  formats?: string[]
}) => BarcodeDetectorLike

type QrFrameDetector = {
  detect: (source: HTMLVideoElement) => Promise<string | null>
}

type MotionPermissionResponse = 'granted' | 'denied'

type DeviceMotionEventWithPermission = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<MotionPermissionResponse>
}

type MotionAccessState =
  | 'unavailable'
  | 'needs-permission'
  | 'requesting'
  | 'active'
  | 'denied'

const FACE_DOWN_HORIZONTAL_THRESHOLD = 4
const FACE_DOWN_Z_THRESHOLD = -7
const FACE_DOWN_HOLD_MS = 1200
const MOTION_ARM_DELAY_MS = 1500

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorCtor
  }
}

function getInitialMotionAccessState(): MotionAccessState {
  if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) {
    return 'unavailable'
  }

  const motionEvent = window.DeviceMotionEvent as
    | DeviceMotionEventWithPermission
    | undefined

  if (!motionEvent) {
    return 'unavailable'
  }

  return typeof motionEvent.requestPermission === 'function'
    ? 'needs-permission'
    : 'active'
}

function isFaceDownReading(
  acceleration: DeviceMotionEvent['accelerationIncludingGravity'] | null,
) {
  if (!acceleration) {
    return false
  }

  const { x, y, z } = acceleration

  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof z !== 'number'
  ) {
    return false
  }

  return (
    Math.abs(x) <= FACE_DOWN_HORIZONTAL_THRESHOLD &&
    Math.abs(y) <= FACE_DOWN_HORIZONTAL_THRESHOLD &&
    z <= FACE_DOWN_Z_THRESHOLD
  )
}

function createQrFrameDetector(): QrFrameDetector | null {
  if (typeof window === 'undefined') {
    return null
  }

  const BarcodeDetector = window.BarcodeDetector

  if (BarcodeDetector) {
    const detector = new BarcodeDetector({
      formats: ['qr_code'],
    })

    return {
      detect: async (source) => {
        const results = await detector.detect(source)
        return results[0]?.rawValue ?? null
      },
    }
  }

  if (typeof document === 'undefined') {
    return null
  }

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', {
    willReadFrequently: true,
  })

  if (!context) {
    return null
  }

  return {
    detect: async (source) => {
      const width = source.videoWidth
      const height = source.videoHeight

      if (!width || !height) {
        return null
      }

      if (canvas.width !== width) {
        canvas.width = width
      }

      if (canvas.height !== height) {
        canvas.height = height
      }

      context.drawImage(source, 0, 0, width, height)

      const imageData = context.getImageData(0, 0, width, height)
      const result = jsQR(imageData.data, width, height)

      return result?.data ?? null
    },
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

type ConversationNoticeState = {
  title: string
  description: string
}

function isBenignVideoPlaybackInterruption(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()

  return (
    error.name === 'AbortError' ||
    message.includes('play() request was interrupted') ||
    message.includes('media was removed from the document')
  )
}

const finderHintOptions = [
  'Front tables',
  'Counter',
  'Window seats',
  'Patio',
  'Back corner',
] as const

async function playFinderCue() {
  if (typeof window !== 'undefined') {
    const AudioContextCtor =
      window.AudioContext ||
      // Safari.
      ('webkitAudioContext' in window
        ? ((window as Window & {
            webkitAudioContext?: typeof AudioContext
          }).webkitAudioContext ?? null)
        : null)

    if (AudioContextCtor) {
      try {
        const audioContext = new AudioContextCtor()
        const oscillator = audioContext.createOscillator()
        const gain = audioContext.createGain()

        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime)
        oscillator.frequency.exponentialRampToValueAtTime(
          1320,
          audioContext.currentTime + 0.18,
        )
        gain.gain.setValueAtTime(0.0001, audioContext.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.06, audioContext.currentTime + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.28)

        oscillator.connect(gain)
        gain.connect(audioContext.destination)
        oscillator.start()
        oscillator.stop(audioContext.currentTime + 0.3)

        window.setTimeout(() => {
          void audioContext.close().catch(() => undefined)
        }, 450)
      } catch {
        // Ignore blocked audio contexts and rely on vibration/visual cues.
      }
    }
  }

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate?.([120, 80, 140])
  }
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
  sendHeartbeat,
  saveFinderProfile,
  leavePlace,
  pingParticipant,
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
  sendHeartbeat: () => Promise<unknown>
  saveFinderProfile: (input: {
    data: {
      isFindable: boolean
      locationHint: string | null
    }
  }) => Promise<UserProfileState>
  leavePlace: () => Promise<void>
  pingParticipant: (input: {
    data: {
      userId: string
    }
  }) => Promise<unknown>
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
    | 'ready'
    | 'finder'
    | 'leave'
    | 'sign-out'
    | 'connect'
    | 'end-connection'
    | null
  >(null)
  const [error, setError] = useState<string | null>(null)
  const [finderNotice, setFinderNotice] = useState<ConversationNoticeState | null>(
    null,
  )
  const [livePlaceState, setLivePlaceState] = useState<PlaceAgentState | null>(
    null,
  )
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanInput, setScanInput] = useState('')
  const [scanPreview, setScanPreview] = useState<ConnectionPreviewState | null>(
    null,
  )
  const [conversationNotice, setConversationNotice] =
    useState<ConversationNoticeState | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [cameraStatus, setCameraStatus] = useState<
    'idle' | 'starting' | 'scanning' | 'unsupported'
  >('idle')
  const [conversationNow, setConversationNow] = useState(() => Date.now())
  const [pendingPingUserId, setPendingPingUserId] = useState<string | null>(null)
  const [selectedFinderHint, setSelectedFinderHint] = useState(
    profile.locationHint ?? finderHintOptions[0],
  )
  const [motionAccessState, setMotionAccessState] = useState<MotionAccessState>(
    () => getInitialMotionAccessState(),
  )
  const [motionNotice, setMotionNotice] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<number | null>(null)
  const resolvingScanRef = useRef(false)
  const readyRequestInFlightRef = useRef(false)
  const motionArmedRef = useRef(false)
  const motionIgnoreUntilRef = useRef(0)
  const faceDownSinceRef = useRef<number | null>(null)
  const previousConnectionRef = useRef<ActiveConnectionState | null>(
    activeConnection,
  )
  const previousPingRef = useRef<string | null>(profile.pingRequestedAt?.toString() ?? null)

  const placeAgent = useAgent<PlaceAgentState>({
    agent: 'place-agent',
    name: currentPlace.place.placeId,
    onStateUpdate: (nextState) => {
      setLivePlaceState(nextState)
    },
  })
  void placeAgent

  const username =
    session.user.displayUsername || session.user.username || session.user.name
  const liveParticipant =
    livePlaceState?.participants?.find(
      (participant) => participant.userId === session.user.id,
    ) ?? null
  const liveConnection =
    livePlaceState?.connections?.find(
      (connection) =>
        connection.requesterUserId === session.user.id ||
        connection.recipientUserId === session.user.id,
    ) ?? null
  const counterpartParticipant =
    liveConnection && livePlaceState
      ? livePlaceState.participants.find(
          (participant) =>
            participant.userId !== session.user.id &&
            (participant.userId === liveConnection.requesterUserId ||
              participant.userId === liveConnection.recipientUserId),
        ) ?? null
      : null
  const liveStatus = liveParticipant?.status ?? profile.status
  const isFindable = liveParticipant?.isFindable ?? profile.isFindable
  const locationHint = liveParticipant?.locationHint ?? profile.locationHint
  const activePingRequestedAt =
    liveParticipant?.pingRequestedAt ?? profile.pingRequestedAt
  const activePingRequestedByUsername =
    liveParticipant?.pingRequestedByUsername ?? profile.pingRequestedByUsername
  const resolvedActiveConnection =
    liveParticipant && livePlaceState
      ? liveConnection && counterpartParticipant
        ? {
            id: liveConnection.id,
            placeId: currentPlace.place.placeId,
            createdAt: liveConnection.createdAt,
            counterpart: {
              userId: counterpartParticipant.userId,
              username: counterpartParticipant.username,
              moodEmoji: counterpartParticipant.moodEmoji,
              intentSummary: counterpartParticipant.intentSummary,
            },
          }
        : null
      : activeConnection
  const isReady = liveStatus === 'ready'
  const isInConversation = liveStatus === 'in_conversation'
  const liveParticipants =
    livePlaceState?.placeId === currentPlace.place.placeId
      ? livePlaceState.participants
      : []
  const readyParticipants = [...liveParticipants]
    .filter((participant) => participant.status === 'ready')
    .sort((left, right) => {
      if (left.userId === session.user.id) {
        return -1
      }

      if (right.userId === session.user.id) {
        return 1
      }

      return left.username.localeCompare(right.username)
    })
  const findableParticipants = readyParticipants.filter(
    (participant) => participant.userId !== session.user.id && participant.isFindable,
  )
  const presentParticipants = liveParticipants.filter(
    (participant) => participant.status === 'present',
  )
  const activeConversationCount =
    livePlaceState?.placeId === currentPlace.place.placeId
      ? livePlaceState.connections.length
      : 0
  const readyCount =
    livePlaceState?.placeId === currentPlace.place.placeId
      ? livePlaceState.readyCount
      : currentPlace.readyCount
  const checkedInCount =
    livePlaceState?.placeId === currentPlace.place.placeId
      ? livePlaceState.checkedInCount
      : Math.max(currentPlace.readyCount, readyParticipants.length)
  const conversationElapsed =
    resolvedActiveConnection !== null
      ? formatConversationElapsed(
          resolvedActiveConnection.createdAt,
          conversationNow,
        )
      : null

  useEffect(() => {
    setLivePlaceState(null)
  }, [currentPlace.place.placeId])

  useEffect(() => {
    setMotionAccessState(getInitialMotionAccessState())
  }, [])

  useEffect(() => {
    if (resolvedActiveConnection) {
      previousConnectionRef.current = resolvedActiveConnection
      setConversationNotice(null)
      return
    }

    const previousConnection = previousConnectionRef.current

    if (!previousConnection) {
      return
    }

    previousConnectionRef.current = null
    setConversationNotice({
      title: 'Conversation ended',
      description:
        liveStatus === 'ready'
          ? `You and ${previousConnection.counterpart.username} are back in the ready pool.`
          : `You and ${previousConnection.counterpart.username} are no longer connected. Set yourself ready again whenever you want.`,
    })
  }, [liveStatus, resolvedActiveConnection])

  useEffect(() => {
    if (!conversationNotice) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setConversationNotice(null)
    }, 5000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [conversationNotice])

  useEffect(() => {
    if (!finderNotice) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setFinderNotice(null)
    }, 5000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [finderNotice])

  useEffect(() => {
    if (!motionNotice) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setMotionNotice(null)
    }, 4000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [motionNotice])

  useEffect(() => {
    if (!resolvedActiveConnection) {
      return
    }

    setConversationNow(Date.now())

    const intervalId = window.setInterval(() => {
      setConversationNow(Date.now())
    }, 30000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [resolvedActiveConnection?.id])

  useEffect(() => {
    if (
      !isReady ||
      isInConversation ||
      typeof window === 'undefined' ||
      typeof document === 'undefined'
    ) {
      return
    }

    let cancelled = false

    const pulse = () => {
      if (cancelled || document.visibilityState !== 'visible') {
        return
      }

      void sendHeartbeat()
    }

    pulse()

    const intervalId = window.setInterval(pulse, 15_000)
    const handleVisibilityChange = () => {
      pulse()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isReady, isInConversation, sendHeartbeat])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const leaveIfNeeded = () => {
      if (!isReady && !isInConversation) {
        return
      }

      void leavePlace()
    }

    window.addEventListener('pagehide', leaveIfNeeded)

    return () => {
      window.removeEventListener('pagehide', leaveIfNeeded)
      leaveIfNeeded()
    }
  }, [isReady, isInConversation, leavePlace])

  useEffect(() => {
    if (locationHint) {
      setSelectedFinderHint(locationHint)
    }
  }, [locationHint])

  useEffect(() => {
    const nextPingValue = activePingRequestedAt?.toString() ?? null

    if (!nextPingValue || previousPingRef.current === nextPingValue) {
      return
    }

    previousPingRef.current = nextPingValue

    const pingTimestamp = new Date(nextPingValue).getTime()

    if (!Number.isFinite(pingTimestamp) || Date.now() - pingTimestamp > 15000) {
      return
    }

    setFinderNotice({
      title: 'Someone is trying to find you',
      description: activePingRequestedByUsername
        ? `${activePingRequestedByUsername} asked for a quick cue. Keep your QR ready when they arrive.`
        : 'Someone nearby asked for a quick cue. Keep your QR ready when they arrive.',
    })
    void playFinderCue()
  }, [activePingRequestedAt, activePingRequestedByUsername])

  useEffect(() => {
    let cancelled = false

    void QRCode.toDataURL(qrHandoff.url, {
      margin: 1,
      width: 512,
      color: {
        dark: '#123f35',
        light: '#f8fcf8',
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

  const updateReadyState = async (
    nextReady: boolean,
    source: 'manual' | 'face-down' = 'manual',
  ) => {
    if (readyRequestInFlightRef.current || nextReady === isReady) {
      return
    }

    readyRequestInFlightRef.current = true
    setPendingAction('ready')
    setError(null)

    try {
      await setReady({
        data: {
          ready: nextReady,
        },
      })
      await refreshSession()

      if (source === 'face-down') {
        setMotionNotice('Phone turned face-down. You are no longer marked ready.')
      }
    } catch (nextError) {
      setMotionNotice(null)
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Unable to change your status right now.',
      )
    } finally {
      readyRequestInFlightRef.current = false
      motionArmedRef.current = false
      motionIgnoreUntilRef.current = nextReady
        ? Date.now() + MOTION_ARM_DELAY_MS
        : 0
      faceDownSinceRef.current = null
      setPendingAction(null)
    }
  }

  const handleDeviceMotion = useEffectEvent((event: DeviceMotionEvent) => {
    if (!isReady || isInConversation || readyRequestInFlightRef.current) {
      motionArmedRef.current = false
      faceDownSinceRef.current = null
      return
    }

    const now = Date.now()
    const isFaceDown = isFaceDownReading(event.accelerationIncludingGravity)

    if (now < motionIgnoreUntilRef.current) {
      faceDownSinceRef.current = null
      return
    }

    if (!motionArmedRef.current) {
      if (!isFaceDown) {
        motionArmedRef.current = true
      }

      faceDownSinceRef.current = null
      return
    }

    if (!isFaceDown) {
      faceDownSinceRef.current = null
      return
    }

    if (faceDownSinceRef.current === null) {
      faceDownSinceRef.current = now
      return
    }

    if (now - faceDownSinceRef.current < FACE_DOWN_HOLD_MS) {
      return
    }

    faceDownSinceRef.current = null
    void updateReadyState(false, 'face-down')
  })

  useEffect(() => {
    if (
      !isReady ||
      isInConversation ||
      motionAccessState !== 'active' ||
      typeof window === 'undefined'
    ) {
      motionArmedRef.current = false
      motionIgnoreUntilRef.current = 0
      faceDownSinceRef.current = null
      return
    }

    motionArmedRef.current = false
    motionIgnoreUntilRef.current = Date.now() + MOTION_ARM_DELAY_MS
    faceDownSinceRef.current = null

    window.addEventListener('devicemotion', handleDeviceMotion)

    return () => {
      window.removeEventListener('devicemotion', handleDeviceMotion)
    }
  }, [isReady, isInConversation, motionAccessState])

  const stopScanner = () => {
    if (scanIntervalRef.current !== null) {
      window.clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
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
    if (!scannerOpen || scanPreview) {
      return
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof window === 'undefined') {
      setCameraStatus('unsupported')
      return
    }

    const detector = createQrFrameDetector()

    if (!detector) {
      setCameraStatus('unsupported')
      return
    }

    let cancelled = false

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

        if (cancelled || !videoRef.current) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream
        videoRef.current.srcObject = stream
        await videoRef.current.play()

        if (cancelled || videoRef.current?.srcObject !== stream) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        setCameraStatus('scanning')
        scanIntervalRef.current = window.setInterval(() => {
          if (!videoRef.current || resolvingScanRef.current) {
            return
          }

          void detector
            .detect(videoRef.current)
            .then((rawValue) => {
              if (rawValue) {
                void resolveToken(rawValue)
              }
            })
            .catch(() => undefined)
        }, 500)
      } catch (nextError) {
        if (cancelled || isBenignVideoPlaybackInterruption(nextError)) {
          return
        }

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
      cancelled = true
      stopScanner()
    }
  }, [scannerOpen, scanPreview])

  const handleReadyToggle = async () => {
    await updateReadyState(!isReady)
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

  const saveFinderState = async (nextIsFindable: boolean, nextLocationHint: string) => {
    setPendingAction('finder')
    setError(null)

    try {
      await saveFinderProfile({
        data: {
          isFindable: nextIsFindable,
          locationHint: nextLocationHint,
        },
      })
      await refreshSession()
      setFinderNotice({
        title: nextIsFindable ? 'Finder mode is on' : 'Finder mode is off',
        description: nextIsFindable
          ? `People nearby can look for you around ${nextLocationHint}.`
          : 'You are no longer sharing a spot in this place.',
      })
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Unable to update your finder settings right now.',
      )
    } finally {
      setPendingAction(null)
    }
  }

  const handleFinderToggle = async () => {
    await saveFinderState(!isFindable, selectedFinderHint)
  }

  const handleSelectFinderHint = async (nextHint: string) => {
    setSelectedFinderHint(nextHint)

    if (!isFindable) {
      return
    }

    await saveFinderState(true, nextHint)
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

  const handleEnableMotionAccess = async () => {
    if (typeof window === 'undefined') {
      return
    }

    const motionEvent = window.DeviceMotionEvent as
      | DeviceMotionEventWithPermission
      | undefined

    if (!motionEvent) {
      setMotionAccessState('unavailable')
      return
    }

    if (!motionEvent.requestPermission) {
      setMotionAccessState('active')
      motionArmedRef.current = false
      motionIgnoreUntilRef.current = Date.now() + MOTION_ARM_DELAY_MS
      return
    }

    setMotionAccessState('requesting')

    try {
      const permission = await motionEvent.requestPermission()

      if (permission === 'granted') {
        setMotionAccessState('active')
        motionArmedRef.current = false
        motionIgnoreUntilRef.current = Date.now() + MOTION_ARM_DELAY_MS
        setMotionNotice('Flip your phone face-down to leave the ready pool.')
        return
      }

      setMotionAccessState('denied')
    } catch {
      setMotionAccessState('denied')
    }
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

  const handlePingParticipant = async (participant: PlaceAgentState['participants'][number]) => {
    setPendingPingUserId(participant.userId)
    setError(null)

    try {
      await pingParticipant({
        data: {
          userId: participant.userId,
        },
      })
      setFinderNotice({
        title: 'Ping sent',
        description: `A quick cue was sent to ${participant.username} near ${participant.locationHint || 'their shared spot'}.`,
      })
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Unable to send that ping right now.',
      )
    } finally {
      setPendingPingUserId(null)
    }
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-xl flex-col gap-4">
        <section className="rounded-[2rem] border border-[var(--rt-border)] bg-[var(--rt-surface)] p-5 shadow-[0_28px_80px_rgba(17,52,44,0.12)] backdrop-blur-xl sm:p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--rt-border-strong)] bg-[var(--rt-accent-soft)] px-4 py-2 text-sm font-medium text-[var(--rt-accent)] shadow-sm">
            <Radio className="h-4 w-4" />
            Live place
          </div>

          <h1 className="mt-5 text-4xl font-black leading-none tracking-[-0.05em] text-[var(--rt-ink)] sm:text-5xl">
            {currentPlace.place.name}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[var(--rt-ink-soft)] sm:text-lg">
            You are here as {username}. Watch the room, go ready when you want,
            and share your QR when a nearby conversation feels right.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <MetricCard
              icon={<Users className="h-5 w-5" />}
              label="Ready right now"
              value={String(readyCount)}
              tone="amber"
            />
            <MetricCard
              icon={<Radio className="h-5 w-5" />}
              label="Checked in now"
              value={String(checkedInCount)}
              tone="slate"
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

          <div className="mt-8 rounded-[2rem] border border-[var(--rt-border)] bg-white/82 p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--rt-ink-soft)]">
              Your intro
            </p>
            <p className="mt-4 text-2xl font-semibold text-[var(--rt-ink)]">
              {profile.moodEmoji} {profile.intentSummary}
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--rt-ink-soft)]">
              {currentPlace.place.address}
            </p>
          </div>

          <div className="mt-6 rounded-[2rem] border border-[var(--rt-border)] bg-white/82 p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--rt-ink-soft)]">
                  Who is ready here
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--rt-ink-soft)]">
                  You can see who is open to a conversation before you scan.
                </p>
              </div>
              <div className="rounded-full bg-[var(--rt-accent-soft)] px-3 py-1 text-sm font-semibold text-[var(--rt-accent)]">
                {readyCount} ready
              </div>
            </div>

            {readyParticipants.length > 0 ? (
              <div className="mt-5 space-y-3">
                {readyParticipants.map((participant) => (
                  <PresencePersonCard
                    key={participant.userId}
                    participant={participant}
                    username={participant.username}
                    moodEmoji={participant.moodEmoji}
                    intentSummary={participant.intentSummary}
                    isCurrentUser={participant.userId === session.user.id}
                    onPing={
                      participant.userId === session.user.id || !participant.isFindable
                        ? null
                        : () => {
                            void handlePingParticipant(participant)
                          }
                    }
                    isPinging={pendingPingUserId === participant.userId}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-3xl border border-dashed border-[var(--rt-border)] bg-[var(--rt-surface-strong)] px-4 py-5 text-sm text-[var(--rt-ink-soft)]">
                No one is marked ready here yet.
              </div>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <PresenceSummaryCard
                label="Taking a moment"
                count={presentParticipants.length}
                description="Checked in here, but not in the ready pool."
              />
              <PresenceSummaryCard
                label="Talking now"
                count={activeConversationCount}
                description="Active conversations happening in this place."
              />
              <PresenceSummaryCard
                label="Easy to find"
                count={findableParticipants.length}
                description="Ready people who shared a spot and can be pinged."
              />
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-[var(--rt-border)] bg-[var(--rt-surface)] p-6 shadow-[0_24px_80px_rgba(17,52,44,0.12)] sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-[var(--rt-accent)]">
                Place View
              </p>
              <h2 className="mt-2 text-3xl font-bold text-[var(--rt-ink)]">
                Ready when you want
              </h2>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={pendingAction === 'sign-out'}
              className="rounded-full border border-[var(--rt-border)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--rt-ink-soft)] transition hover:border-[var(--rt-border-strong)] hover:text-[var(--rt-ink)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pendingAction === 'sign-out' ? 'Signing out...' : 'Sign out'}
            </button>
          </div>

          <div className="mt-6 rounded-3xl border border-[var(--rt-border)] bg-[var(--rt-accent-soft)] p-5">
            <p className="text-sm font-semibold text-[var(--rt-ink)]">Status</p>
            <p className="mt-2 text-sm leading-6 text-[var(--rt-ink-soft)]">
              {isInConversation
                ? `You are currently talking${resolvedActiveConnection ? ` with ${resolvedActiveConnection.counterpart.username}` : ''}, so your QR and ready state are paused.`
                : isReady
                ? 'You are visible in the ready count for this place.'
                : 'You are present here, but not yet in the ready count.'}
            </p>

            {isInConversation ? (
              <button
                type="button"
                onClick={handleEndConnection}
                disabled={pendingAction === 'end-connection'}
                className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-[var(--rt-accent)] px-5 py-3 font-semibold text-white transition hover:bg-[var(--rt-accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
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
                    ? 'bg-[var(--rt-accent)] hover:bg-[var(--rt-accent-strong)]'
                    : 'bg-[#1b8d6d] hover:bg-[#157257]'
                }`}
              >
                {pendingAction === 'ready'
                  ? 'Updating status...'
                  : isReady
                    ? 'Leave ready pool'
                    : 'Set me ready'}
              </button>
            )}

            {!isInConversation ? (
              <div className="mt-4 rounded-2xl border border-dashed border-[var(--rt-border)] bg-white px-4 py-4">
                <p className="text-sm font-semibold text-[var(--rt-ink)]">
                  Phone flip shortcut
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--rt-ink-soft)]">
                  {motionAccessState === 'active'
                    ? isReady
                      ? 'Flip your phone face-down for a moment to leave the ready pool without tapping.'
                      : 'When you are ready, flipping your phone face-down can take you back out of the ready pool without tapping.'
                    : motionAccessState === 'needs-permission' ||
                        motionAccessState === 'requesting'
                      ? 'Allow motion access once so turning your phone face-down can quietly take you out of the ready pool.'
                      : motionAccessState === 'denied'
                        ? 'Motion access is still off, so face-down detection cannot change your status yet.'
                        : 'Face-down detection is not available in this browser.'}
                </p>

                {(motionAccessState === 'needs-permission' ||
                  motionAccessState === 'requesting' ||
                  motionAccessState === 'denied') && (
                  <button
                    type="button"
                    onClick={() => {
                      void handleEnableMotionAccess()
                    }}
                    disabled={motionAccessState === 'requesting'}
                    className="mt-4 inline-flex items-center justify-center rounded-full border border-[var(--rt-border)] bg-[var(--rt-surface-strong)] px-4 py-2 text-sm font-medium text-[var(--rt-ink)] transition hover:border-[var(--rt-border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {motionAccessState === 'requesting'
                      ? 'Enabling motion access...'
                      : motionAccessState === 'denied'
                        ? 'Try motion access again'
                        : 'Enable face-down shortcut'}
                  </button>
                )}

                {motionNotice ? (
                  <p className="mt-3 text-sm font-medium text-[var(--rt-accent)]">
                    {motionNotice}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {conversationNotice ? (
            <div className="mt-6 rounded-3xl border border-[var(--rt-border-strong)] bg-[var(--rt-accent-soft)] p-5 text-[var(--rt-ink)]">
              <p className="text-sm font-semibold">{conversationNotice.title}</p>
              <p className="mt-2 text-sm leading-6">
                {conversationNotice.description}
              </p>
            </div>
          ) : null}

          {finderNotice ? (
            <div className="mt-6 rounded-3xl border border-[var(--rt-border-strong)] bg-[var(--rt-accent-soft)] p-5 text-[var(--rt-ink)]">
              <p className="text-sm font-semibold">{finderNotice.title}</p>
              <p className="mt-2 text-sm leading-6">{finderNotice.description}</p>
            </div>
          ) : null}

          <div className="mt-6 rounded-3xl border border-[var(--rt-border)] bg-[var(--rt-surface-strong)] p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-[var(--rt-border)] bg-white p-3 text-[var(--rt-accent)]">
                <LocateFixed className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--rt-ink)]">
                  Help someone find you
                </p>
                <p className="text-sm leading-6 text-[var(--rt-ink-soft)]">
                  Share one simple spot in this place, then let someone nearby
                  send a quick cue before they scan your QR.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {finderHintOptions.map((hint) => {
                const isSelected = selectedFinderHint === hint

                return (
                  <button
                    key={hint}
                    type="button"
                    onClick={() => {
                      void handleSelectFinderHint(hint)
                    }}
                    disabled={!isReady || isInConversation || pendingAction === 'finder'}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      isSelected
                        ? 'bg-[var(--rt-accent)] text-white'
                        : 'border border-[var(--rt-border)] bg-white text-[var(--rt-ink-soft)] hover:border-[var(--rt-border-strong)] hover:text-[var(--rt-ink)]'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {hint}
                  </button>
                )
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--rt-border)] bg-white px-4 py-4">
              <p className="text-sm font-semibold text-[var(--rt-ink)]">
                {isFindable
                  ? `Currently sharing: ${selectedFinderHint}`
                  : isInConversation
                    ? 'Finder mode pauses while you are talking.'
                    : isReady
                      ? 'Pick the spot that best matches where you are.'
                      : 'Set yourself ready before sharing a spot.'}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--rt-ink-soft)]">
                {isFindable
                  ? 'People nearby can look for this hint and send a quick cue to your phone.'
                  : 'This stays off until you choose to share it.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                void handleFinderToggle()
              }}
              disabled={!isReady || isInConversation || pendingAction === 'finder'}
              className={`mt-4 inline-flex w-full items-center justify-center rounded-2xl px-5 py-3 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70 ${
                isFindable
                  ? 'bg-[var(--rt-accent)] hover:bg-[var(--rt-accent-strong)]'
                  : 'bg-[#1b8d6d] hover:bg-[#157257]'
              }`}
            >
              {pendingAction === 'finder'
                ? 'Saving finder settings...'
                : isFindable
                  ? 'Stop sharing my spot'
                  : 'Help someone find me'}
            </button>
          </div>

          <div className="mt-6 rounded-3xl border border-[var(--rt-border)] bg-[var(--rt-surface-strong)] p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-[var(--rt-border)] bg-white p-3 text-[var(--rt-accent)]">
                <QrCode className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--rt-ink)]">Your QR</p>
                <p className="text-sm leading-6 text-[var(--rt-ink-soft)]">
                  Nearby people can scan this to preview you, then confirm
                  before they connect.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-[var(--rt-border)] bg-white px-4 py-6 text-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`LetsTalk QR for ${username}`}
                  className={`mx-auto h-48 w-48 rounded-3xl border border-[var(--rt-border)] bg-[var(--rt-surface-strong)] p-3 ${
                    liveStatus === 'ready' ? '' : 'opacity-40'
                  }`}
                />
              ) : (
                <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-3xl border border-dashed border-[var(--rt-border-strong)] text-sm text-[var(--rt-ink-soft)]">
                  Building QR...
                </div>
              )}

              <div
                className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
                  qrHandoff.isActive
                    ? 'bg-[var(--rt-accent-soft)] text-[var(--rt-accent)]'
                    : 'bg-[var(--rt-bg-strong)] text-[var(--rt-ink-soft)]'
                }`}
              >
                <Check className="h-4 w-4" />
                {liveStatus === 'ready'
                  ? 'Live while you are ready'
                  : 'Set yourself ready to make this live'}
              </div>
            </div>
          </div>

          {resolvedActiveConnection ? (
            <div className="mt-6 rounded-3xl border border-[var(--rt-border-strong)] bg-[var(--rt-accent-soft)] p-5">
              <div className="flex items-center justify-between gap-3 text-[var(--rt-accent)]">
                <div className="flex items-center gap-3">
                  <MessageCircle className="h-5 w-5" />
                  <p className="text-sm font-semibold">Current conversation</p>
                </div>
                {conversationElapsed ? (
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--rt-accent)]">
                    {conversationElapsed}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-xl font-semibold text-[var(--rt-ink)]">
                {resolvedActiveConnection.counterpart.username}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--rt-ink-soft)]">
                {resolvedActiveConnection.counterpart.moodEmoji}{' '}
                {resolvedActiveConnection.counterpart.intentSummary}
              </p>
              <p className="mt-3 text-sm leading-6 text-[var(--rt-accent)]/80">
                Take your time. Either person can end the conversation, and you
                will both return to ready automatically.
              </p>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleOpenScanner}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--rt-accent)] px-5 py-3 font-semibold text-white transition hover:bg-[var(--rt-accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <ScanLine className="h-4 w-4" />
              Scan someone nearby
            </button>
            <button
              type="button"
              onClick={handleLeavePlace}
              disabled={pendingAction === 'leave'}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--rt-border)] bg-white px-5 py-3 font-semibold text-[var(--rt-ink)] transition hover:border-[var(--rt-border-strong)] disabled:cursor-not-allowed disabled:opacity-70"
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
        <div className="fixed inset-0 z-50 flex items-end bg-[rgba(17,52,44,0.55)] sm:items-center sm:justify-center">
          <div className="w-full max-w-xl rounded-t-[2rem] border border-[var(--rt-border)] bg-[var(--rt-surface-strong)] p-6 shadow-[0_24px_80px_rgba(17,52,44,0.22)] sm:rounded-[2rem] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-[var(--rt-accent)]">
                  Scan QR
                </p>
                <h3 className="mt-2 text-2xl font-bold text-[var(--rt-ink)]">
                  Understand, then connect
                </h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  void handleCloseScanner()
                }}
                className="rounded-full border border-[var(--rt-border)] p-2 text-[var(--rt-ink-soft)] transition hover:border-[var(--rt-border-strong)] hover:text-[var(--rt-ink)]"
                aria-label="Close scanner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {scanPreview ? (
              <div className="mt-6 rounded-3xl border border-[var(--rt-border)] bg-[var(--rt-accent-soft)] p-5">
                <p className="text-sm font-semibold text-[var(--rt-ink)]">
                  You are about to connect with
                </p>
                <p className="mt-3 text-2xl font-semibold text-[var(--rt-ink)]">
                  {scanPreview.counterpart.username}
                </p>
                <p className="mt-3 text-sm leading-6 text-[var(--rt-ink-soft)]">
                  {scanPreview.counterpart.moodEmoji}{' '}
                  {scanPreview.counterpart.intentSummary}
                </p>
                <p className="mt-3 text-sm text-[var(--rt-ink-soft)]">
                  {scanPreview.placeName}
                </p>

                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={pendingAction === 'connect'}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--rt-accent)] px-5 py-3 font-semibold text-white transition hover:bg-[var(--rt-accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
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
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--rt-border)] bg-white px-5 py-3 font-semibold text-[var(--rt-ink)] transition hover:border-[var(--rt-border-strong)]"
                  >
                    Scan another
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-6 overflow-hidden rounded-3xl border border-[var(--rt-border)] bg-[var(--rt-accent)]">
                  {cameraStatus === 'unsupported' ? (
                    <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 py-10 text-center text-white/85">
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

                <div className="mt-4 rounded-3xl border border-[var(--rt-border)] bg-white p-5">
                  <p className="text-sm font-semibold text-[var(--rt-ink)]">
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
                      placeholder="https://letstalk.app/?scan=..."
                      className="w-full rounded-2xl border border-[var(--rt-border)] bg-[var(--rt-surface-strong)] px-4 py-3 text-sm text-[var(--rt-ink)] outline-none transition focus:border-[var(--rt-accent-strong)]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void handleResolveManualScan()
                      }}
                      className="inline-flex items-center justify-center rounded-2xl bg-[var(--rt-accent)] px-5 py-3 font-semibold text-white transition hover:bg-[var(--rt-accent-strong)]"
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
    amber: 'border-[var(--rt-border)] bg-[var(--rt-accent-soft)] text-[var(--rt-accent)]',
    emerald:
      'border-[var(--rt-border)] bg-[color:rgba(27,141,109,0.12)] text-[#0b5d49]',
    slate: 'border-[var(--rt-border)] bg-white text-[var(--rt-ink)]',
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

function PresencePersonCard({
  participant,
  username,
  moodEmoji,
  intentSummary,
  isCurrentUser,
  onPing,
  isPinging,
}: {
  participant: PlaceAgentState['participants'][number]
  username: string
  moodEmoji: string | null
  intentSummary: string | null
  isCurrentUser: boolean
  onPing: (() => void) | null
  isPinging: boolean
}) {
  return (
    <div className="rounded-3xl border border-[var(--rt-border)] bg-[var(--rt-surface-strong)] px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-[var(--rt-ink)]">
            {username}
            {isCurrentUser ? (
              <span className="ml-2 rounded-full bg-[var(--rt-accent)] px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-white">
                You
              </span>
            ) : null}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--rt-ink-soft)]">
            {moodEmoji} {intentSummary || 'Open to a nearby conversation.'}
          </p>
          {participant.isFindable && participant.locationHint ? (
            <p className="mt-2 text-sm font-medium text-[var(--rt-accent)]">
              Near {participant.locationHint.toLowerCase()}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="rounded-full bg-[var(--rt-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--rt-accent)]">
            {participant.isFindable ? 'Findable' : 'Ready'}
          </span>
          {onPing ? (
            <button
              type="button"
              onClick={onPing}
              disabled={isPinging}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--rt-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--rt-ink)] transition hover:border-[var(--rt-border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <BellRing className="h-3.5 w-3.5" />
              {isPinging ? 'Pinging...' : 'Ping me'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function PresenceSummaryCard({
  label,
  count,
  description,
}: {
  label: string
  count: number
  description: string
}) {
  return (
    <div className="rounded-3xl border border-[var(--rt-border)] bg-[var(--rt-surface-strong)] px-4 py-4">
      <p className="text-sm font-semibold text-[var(--rt-ink)]">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-[var(--rt-ink)]">
        {count}
      </p>
      <p className="mt-2 text-sm leading-6 text-[var(--rt-ink-soft)]">
        {description}
      </p>
    </div>
  )
}

function formatConversationElapsed(
  createdAt: string | Date,
  now: number,
) {
  const startedAt = new Date(createdAt).getTime()

  if (!Number.isFinite(startedAt)) {
    return null
  }

  const elapsedMinutes = Math.max(0, Math.floor((now - startedAt) / 60000))

  if (elapsedMinutes < 1) {
    return 'Started now'
  }

  if (elapsedMinutes === 1) {
    return '1 min in'
  }

  return `${elapsedMinutes} min in`
}
