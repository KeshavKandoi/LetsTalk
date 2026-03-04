import { useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowLeft, MapPin, QrCode, Radio, Users } from 'lucide-react'
import { authClient } from '../lib/auth-client'
import type {
  AppSession,
  CurrentPlaceState,
  UserProfileState,
} from '../lib/app-types'

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
  refreshSession,
  setReady,
  leavePlace,
  client = authClient,
}: {
  session: AppSession
  profile: UserProfileState
  currentPlace: CurrentPlaceState
  refreshSession: () => Promise<void>
  setReady: (input: { data: { ready: boolean } }) => Promise<void>
  leavePlace: () => Promise<void>
  client?: PlaceViewClientLike
}) {
  const [pendingAction, setPendingAction] = useState<
    'ready' | 'leave' | 'sign-out' | null
  >(null)
  const [error, setError] = useState<string | null>(null)

  const username =
    session.user.displayUsername || session.user.username || session.user.name
  const isReady = profile.status === 'ready'

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
              value={String(currentPlace.readyCount)}
              tone="amber"
            />
            <MetricCard
              icon={<MapPin className="h-5 w-5" />}
              label="Your state"
              value={isReady ? 'Ready' : 'Present'}
              tone={isReady ? 'emerald' : 'slate'}
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
              {isReady
                ? 'You are visible in the ready count for this place.'
                : 'You are present here, but not yet in the ready count.'}
            </p>

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
          </div>

          <div className="mt-6 rounded-3xl border border-stone-200 bg-stone-50 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-stone-200 bg-white p-3 text-slate-700">
                <QrCode className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Your QR</p>
                <p className="text-sm leading-6 text-slate-600">
                  QR flow is next. This screen reserves the handoff point.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
              Static QR placeholder
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
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
