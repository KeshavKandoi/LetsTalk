import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { AuthScreen } from '../components/AuthScreen'

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

  const refreshSession = async () => {
    await router.invalidate()
  }

  return <AuthScreen session={session} refreshSession={refreshSession} />
}
