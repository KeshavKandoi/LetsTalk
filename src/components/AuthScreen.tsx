import { useState } from 'react'
import type { FormEvent } from 'react'
import { LogIn, MapPin, UserRoundPlus } from 'lucide-react'
import { authClient } from '../lib/auth-client'

type AuthResult = {
  error?: {
    message?: string | null
  } | null
}

type AuthClientLike = {
  signIn: {
    username: (input: {
      username: string
      password: string
      rememberMe: boolean
    }) => Promise<AuthResult>
  }
  signUp: {
    email: (input: {
      name: string
      email: string
      password: string
      username: string
    }) => Promise<AuthResult>
  }
}

export function AuthScreen({
  refreshSession,
  client = authClient,
}: {
  refreshSession: () => Promise<void>
  client?: AuthClientLike
}) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [error, setError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<'sign-in' | 'sign-up' | null>(
    null,
  )

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    setError(null)
    setPendingAction('sign-in')

    const formData = new FormData(form)
    const username = String(formData.get('username') ?? '').trim()
    const password = String(formData.get('password') ?? '')

    const result = await client.signIn.username({
      username,
      password,
      rememberMe: true,
    })

    if (result.error) {
      setError(result.error.message || 'Unable to sign in with that username.')
      setPendingAction(null)
      return
    }

    form.reset()
    await refreshSession()
    setPendingAction(null)
  }

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    setError(null)
    setPendingAction('sign-up')

    const formData = new FormData(form)
    const email = String(formData.get('email') ?? '').trim()
    const username = String(formData.get('username') ?? '').trim()
    const password = String(formData.get('password') ?? '')

    const result = await client.signUp.email({
      name: username,
      email,
      password,
      username,
    })

    if (result.error) {
      setError(result.error.message || 'Unable to create that account.')
      setPendingAction(null)
      return
    }

    form.reset()
    await refreshSession()
    setPendingAction(null)
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col justify-center">
        <section className="rounded-[2rem] border border-[var(--rt-border)] bg-[var(--rt-surface)] p-5 shadow-[0_28px_80px_rgba(17,52,44,0.12)] backdrop-blur-xl sm:p-6">
          <div className="rounded-[1.75rem] border border-[var(--rt-border)] bg-[linear-gradient(180deg,rgba(220,239,227,0.92),rgba(248,252,248,0.95))] p-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--rt-border-strong)] bg-white/85 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--rt-accent)]">
              <MapPin className="h-3.5 w-3.5" />
              Nearby conversations
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.06em] text-[var(--rt-ink)]">
              LetsTalk
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--rt-ink-soft)] sm:text-base">
              Find local places where people are ready now. Your pseudonym is
              public. Your email stays private.
            </p>
          </div>

          <div className="mt-5 rounded-[1.75rem] border border-[var(--rt-border)] bg-white/88 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--rt-accent)]">
                  Account
                </p>
                <h2 className="mt-2 text-2xl font-bold text-[var(--rt-ink)]">
                  {mode === 'sign-in' ? 'Log in' : 'Create an account'}
                </h2>
              </div>

              <div className="flex rounded-full border border-[var(--rt-border)] bg-[var(--rt-accent-soft)] p-1 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setMode('sign-in')
                    setError(null)
                  }}
                  className={`rounded-full px-4 py-2 transition ${
                    mode === 'sign-in'
                      ? 'bg-[var(--rt-accent)] text-white shadow-sm'
                      : 'text-[var(--rt-ink-soft)] hover:text-[var(--rt-ink)]'
                  }`}
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('sign-up')
                    setError(null)
                  }}
                  className={`rounded-full px-4 py-2 transition ${
                    mode === 'sign-up'
                      ? 'bg-[var(--rt-accent)] text-white shadow-sm'
                      : 'text-[var(--rt-ink-soft)] hover:text-[var(--rt-ink)]'
                  }`}
                >
                  Sign up
                </button>
              </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-[var(--rt-ink-soft)]">
              {mode === 'sign-in'
                ? 'Pick up where you left off at the places around you.'
                : 'Create a pseudonym-first account, then check live nearby places.'}
            </p>

            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            {mode === 'sign-in' ? (
              <form className="mt-5 space-y-4" onSubmit={handleSignIn}>
                <FormField
                  label="Username"
                  name="username"
                  autoComplete="username"
                  placeholder="letstalk"
                />
                <FormField
                  label="Password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                />

                <button
                  type="submit"
                  disabled={pendingAction === 'sign-in'}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--rt-accent)] px-5 py-3 font-semibold text-white transition hover:bg-[var(--rt-accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <LogIn className="h-4 w-4" />
                  {pendingAction === 'sign-in' ? 'Logging in...' : 'Log in'}
                </button>
              </form>
            ) : (
              <form className="mt-5 space-y-4" onSubmit={handleSignUp}>
                <FormField
                  label="Email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  hint="Required for account recovery. Never shown in the app."
                />
                <FormField
                  label="Pseudonym"
                  name="username"
                  autoComplete="username"
                  placeholder="letstalk"
                />
                <FormField
                  label="Password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Create a strong password"
                />

                <button
                  type="submit"
                  disabled={pendingAction === 'sign-up'}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--rt-accent)] px-5 py-3 font-semibold text-white transition hover:bg-[var(--rt-accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <UserRoundPlus className="h-4 w-4" />
                  {pendingAction === 'sign-up'
                    ? 'Creating account...'
                    : 'Create account'}
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function FormField({
  label,
  name,
  type = 'text',
  autoComplete,
  placeholder,
  hint,
}: {
  label: string
  name: string
  type?: string
  autoComplete?: string
  placeholder?: string
  hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[var(--rt-ink-soft)]">
        {label}
      </span>
      <input
        required
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-[var(--rt-border)] bg-[var(--rt-surface-strong)] px-4 py-3 text-base text-[var(--rt-ink)] outline-none transition placeholder:text-[color:rgba(69,104,90,0.55)] focus:border-[var(--rt-accent-strong)] focus:ring-2 focus:ring-[var(--rt-accent-soft-strong)]"
      />
      {hint ? (
        <span className="mt-2 block text-xs text-[var(--rt-ink-soft)]">
          {hint}
        </span>
      ) : null}
    </label>
  )
}
