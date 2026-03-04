import { useEffect, useState } from 'react'
import { MapPin, MessageCircle, QrCode } from 'lucide-react'
import type { AppSession, ConnectionPreviewState } from '../lib/app-types'

export function ScanJoinScreen({
  session,
  scanToken,
  refreshSession,
  clearScanToken,
  loadPreview,
  joinAndConnect,
}: {
  session: AppSession
  scanToken: string
  refreshSession: () => Promise<void>
  clearScanToken: () => Promise<void>
  loadPreview: (input: {
    data: {
      token: string
    }
  }) => Promise<ConnectionPreviewState>
  joinAndConnect: (input: {
    data: {
      token: string
    }
  }) => Promise<unknown>
}) {
  const [preview, setPreview] = useState<ConnectionPreviewState | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const username =
    session.user.displayUsername || session.user.username || session.user.name

  useEffect(() => {
    let cancelled = false

    void loadPreview({
      data: {
        token: scanToken,
      },
    })
      .then((nextPreview) => {
        if (!cancelled) {
          setPreview(nextPreview)
          setError(null)
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : 'Unable to load that QR code right now.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [loadPreview, scanToken])

  const handleJoin = async () => {
    setJoining(true)
    setError(null)

    try {
      await joinAndConnect({
        data: {
          token: scanToken,
        },
      })
      await clearScanToken()
      await refreshSession()
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Unable to join this place right now.',
      )
    } finally {
      setJoining(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f4efe6] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center gap-8 px-5 py-8 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-stone-200 bg-white/92 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
            <QrCode className="h-4 w-4" />
            Scan-first join
          </div>

          <h1 className="mt-5 text-4xl font-black leading-none tracking-[-0.05em] sm:text-5xl">
            You found someone nearby, {username}.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700 sm:text-lg">
            You do not need to check in first. We can drop you into their place
            now, then start the conversation from there.
          </p>

          {loading ? (
            <div className="mt-8 rounded-3xl border border-stone-200 bg-stone-50 p-6 text-sm text-slate-600">
              Reading the QR code...
            </div>
          ) : preview ? (
            <div className="mt-8 rounded-3xl border border-stone-200 bg-stone-50 p-6">
              <div className="flex items-center gap-3 text-slate-900">
                <MessageCircle className="h-5 w-5" />
                <p className="text-sm font-semibold">You are about to meet</p>
              </div>
              <p className="mt-4 text-3xl font-semibold">
                {preview.counterpart.username}
              </p>
              <p className="mt-3 text-base leading-7 text-slate-700">
                {preview.counterpart.moodEmoji} {preview.counterpart.intentSummary}
              </p>

              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-slate-700">
                <MapPin className="h-4 w-4" />
                {preview.placeName}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleJoin}
                  disabled={joining}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {joining ? 'Joining place...' : 'Join this place and talk'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void clearScanToken()
                  }}
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-stone-200 bg-white px-5 py-3 font-semibold text-slate-900 transition hover:border-stone-300"
                >
                  Not now
                </button>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  )
}
