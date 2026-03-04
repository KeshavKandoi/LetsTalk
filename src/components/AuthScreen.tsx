import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { LockKeyhole, LogIn, SunMedium, UserRoundPlus } from 'lucide-react'
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
    <main className="relative min-h-screen overflow-hidden bg-[#f7f3ea] text-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.2),_transparent_32%),linear-gradient(180deg,_rgba(255,255,255,0.92),_rgba(246,238,225,0.95))]" />
      <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-12 px-6 py-10 lg:flex-row lg:items-center lg:justify-between">
        <section className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-4 py-2 text-sm font-medium text-sky-700 shadow-sm backdrop-blur">
            <SunMedium className="h-4 w-4" />
            Calm, phone-first conversation starts
          </div>

          <h1 className="mt-6 text-5xl font-black leading-none tracking-[-0.06em] text-slate-950 sm:text-6xl">
            Ready to Talk
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-700">
            Meet nearby people only when both of you are actually ready.
            Sign in with a pseudonym, keep your email private, and use
            location plus QR codes when you want to connect in person.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <FeatureCard
              icon={<UserRoundPlus className="h-5 w-5" />}
              title="Pseudonym first"
              description="Your username is the public identity. Email is only used for account creation and never shown in the product flow."
            />
            <FeatureCard
              icon={<LockKeyhole className="h-5 w-5" />}
              title="Same-place safety"
              description="Location and QR scans keep the experience grounded in real nearby moments instead of open browsing."
            />
          </div>
        </section>

        <section className="w-full max-w-xl">
          <div className="rounded-[2rem] border border-stone-200 bg-white/88 p-6 shadow-[0_28px_80px_rgba(148,163,184,0.22)] backdrop-blur-xl sm:p-8">
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-amber-700">
                    Authentication
                  </p>
                  <h2 className="mt-2 text-3xl font-bold text-slate-950">
                    {mode === 'sign-in' ? 'Log in' : 'Create an account'}
                  </h2>
                </div>

                <div className="flex rounded-full border border-stone-200 bg-stone-100 p-1 text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('sign-in')
                      setError(null)
                    }}
                    className={`rounded-full px-4 py-2 transition ${
                      mode === 'sign-in'
                        ? 'bg-white text-slate-950 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
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
                        ? 'bg-white text-slate-950 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Sign up
                  </button>
                </div>
              </div>

              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              {mode === 'sign-in' ? (
                <form className="space-y-4" onSubmit={handleSignIn}>
                  <FormField
                    label="Username"
                    name="username"
                    autoComplete="username"
                    placeholder="readytotalk"
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
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 px-5 py-3 font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <LogIn className="h-4 w-4" />
                    {pendingAction === 'sign-in' ? 'Logging in...' : 'Log in'}
                  </button>
                </form>
              ) : (
                <form className="space-y-4" onSubmit={handleSignUp}>
                  <FormField
                    label="Email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    hint="Required by Better Auth. Never shown in the product."
                  />
                  <FormField
                    label="Pseudonym"
                    name="username"
                    autoComplete="username"
                    placeholder="readytotalk"
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
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <UserRoundPlus className="h-4 w-4" />
                    {pendingAction === 'sign-up'
                      ? 'Creating account...'
                      : 'Create account'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-white/75 p-5 shadow-sm backdrop-blur">
      <div className="inline-flex rounded-2xl border border-sky-100 bg-sky-50 p-3 text-sky-700">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-700">{description}</p>
    </div>
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
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>
      <input
        required
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
      />
      {hint ? <span className="mt-2 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  )
}
