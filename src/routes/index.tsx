import { useState } from 'react'
import type { FormEvent } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { LockKeyhole, LogIn, Sparkles, UserRound, UserRoundPlus } from 'lucide-react'
import { authClient } from '../lib/auth-client'

const getCurrentSession = createServerFn({ method: 'GET' }).handler(async () => {
  const [{ auth }, { getRequestHeaders }] = await Promise.all([
    import('../lib/server/auth'),
    import('@tanstack/react-start/server'),
  ])

  return auth.api.getSession({
    headers: getRequestHeaders(),
  })
})

export const Route = createFileRoute('/')({
  loader: async () => getCurrentSession(),
  component: App,
})

function App() {
  const session = Route.useLoaderData()
  const router = useRouter()
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [error, setError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<
    'sign-in' | 'sign-up' | 'sign-out' | null
  >(null)

  const refreshSession = async () => {
    await router.invalidate()
  }

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setPendingAction('sign-in')

    const formData = new FormData(event.currentTarget)
    const username = String(formData.get('username') ?? '').trim()
    const password = String(formData.get('password') ?? '')

    const result = await authClient.signIn.username({
      username,
      password,
      rememberMe: true,
    })

    if (result.error) {
      setError(result.error.message || 'Unable to sign in with that username.')
      setPendingAction(null)
      return
    }

    event.currentTarget.reset()
    await refreshSession()
    setPendingAction(null)
  }

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setPendingAction('sign-up')

    const formData = new FormData(event.currentTarget)
    const name = String(formData.get('name') ?? '').trim()
    const email = String(formData.get('email') ?? '').trim()
    const username = String(formData.get('username') ?? '').trim()
    const password = String(formData.get('password') ?? '')
    const confirmPassword = String(formData.get('confirmPassword') ?? '')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setPendingAction(null)
      return
    }

    const result = await authClient.signUp.email({
      name,
      email,
      password,
      username,
    })

    if (result.error) {
      setError(result.error.message || 'Unable to create that account.')
      setPendingAction(null)
      return
    }

    event.currentTarget.reset()
    await refreshSession()
    setPendingAction(null)
  }

  const handleSignOut = async () => {
    setError(null)
    setPendingAction('sign-out')

    const result = await authClient.signOut()

    if (result.error) {
      setError(result.error.message || 'Unable to sign out right now.')
      setPendingAction(null)
      return
    }

    await refreshSession()
    setPendingAction(null)
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07111f] text-slate-50">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.14),_transparent_32%)]" />
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-12 px-6 py-10 lg:flex-row lg:items-center lg:justify-between">
        <section className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 backdrop-blur">
            <Sparkles className="h-4 w-4" />
            TanStack Start on Cloudflare Workers
          </div>

          <h1 className="mt-6 text-5xl font-black leading-none tracking-[-0.06em] text-white sm:text-6xl">
            ReadyToTalk
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
            Better Auth is wired to Cloudflare D1 through Drizzle, with username
            sign-in enabled and the TanStack Start app serving the auth flow
            directly from your Worker.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <FeatureCard
              icon={<UserRound className="h-5 w-5" />}
              title="Username login"
              description="Users sign in with a username and password, while account creation still captures name and email."
            />
            <FeatureCard
              icon={<LockKeyhole className="h-5 w-5" />}
              title="D1-backed sessions"
              description="Auth records and sessions are stored in Cloudflare D1 with a Drizzle schema ready for migrations."
            />
          </div>
        </section>

        <section className="w-full max-w-xl">
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl sm:p-8">
            {session ? (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-cyan-200/80">
                      Authenticated
                    </p>
                    <h2 className="mt-2 text-3xl font-bold text-white">
                      Welcome back, {session.user.displayUsername || session.user.name}
                    </h2>
                  </div>
                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-100">
                    <UserRound className="h-6 w-6" />
                  </div>
                </div>

                <dl className="grid gap-3 rounded-3xl border border-white/8 bg-white/4 p-5 text-sm text-slate-200">
                  <InfoRow label="Username" value={session.user.username || 'Not set'} />
                  <InfoRow label="Email" value={session.user.email} />
                  <InfoRow
                    label="Session expires"
                    value={new Date(session.session.expiresAt).toLocaleString()}
                  />
                </dl>

                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={pendingAction === 'sign-out'}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <LogIn className="h-4 w-4 rotate-180" />
                  {pendingAction === 'sign-out' ? 'Signing out...' : 'Sign out'}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-orange-200/80">
                      Authentication
                    </p>
                    <h2 className="mt-2 text-3xl font-bold text-white">
                      {mode === 'sign-in' ? 'Log in' : 'Create an account'}
                    </h2>
                  </div>

                  <div className="flex rounded-full border border-white/10 bg-white/5 p-1 text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('sign-in')
                        setError(null)
                      }}
                      className={`rounded-full px-4 py-2 transition ${
                        mode === 'sign-in'
                          ? 'bg-cyan-400 text-slate-950'
                          : 'text-slate-300 hover:text-white'
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
                          ? 'bg-cyan-400 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Sign up
                    </button>
                  </div>
                </div>

                {error ? (
                  <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
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
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <LogIn className="h-4 w-4" />
                      {pendingAction === 'sign-in' ? 'Logging in...' : 'Log in'}
                    </button>
                  </form>
                ) : (
                  <form className="space-y-4" onSubmit={handleSignUp}>
                    <FormField
                      label="Name"
                      name="name"
                      autoComplete="name"
                      placeholder="Ready Talk"
                    />
                    <FormField
                      label="Email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                    />
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
                      autoComplete="new-password"
                      placeholder="Create a strong password"
                    />
                    <FormField
                      label="Confirm password"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Repeat your password"
                    />

                    <button
                      type="submit"
                      disabled={pendingAction === 'sign-up'}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <UserRoundPlus className="h-4 w-4" />
                      {pendingAction === 'sign-up'
                        ? 'Creating account...'
                        : 'Create account'}
                    </button>
                  </form>
                )}
              </div>
            )}
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
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 p-3 text-cyan-100">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-300">{description}</p>
    </div>
  )
}

function FormField({
  label,
  name,
  type = 'text',
  autoComplete,
  placeholder,
}: {
  label: string
  name: string
  type?: string
  autoComplete?: string
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-200">
        {label}
      </span>
      <input
        required
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
      />
    </label>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/8 pb-3 last:border-b-0 last:pb-0">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-white">{value}</dd>
    </div>
  )
}
