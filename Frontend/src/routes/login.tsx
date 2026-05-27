import { createFileRoute, useRouter } from '@tanstack/react-router'
import { AuthScreen } from '../components/AuthScreen'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  return (
    <AuthScreen
      refreshSession={async () => { await router.navigate({ to: '/' }) }}
      initialMode="sign-in"
      onBack={() => router.navigate({ to: '/' })}
    />
  )
}
