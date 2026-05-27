import { createFileRoute, useRouter } from '@tanstack/react-router'
import { AuthScreen } from '../components/AuthScreen'

export const Route = createFileRoute('/signup')({
  component: SignupPage,
})

function SignupPage() {
  const router = useRouter()
  return (
    <AuthScreen
      refreshSession={async () => { await router.navigate({ to: '/' }) }}
      initialMode="sign-up"
      onBack={() => router.navigate({ to: '/' })}
    />
  )
}
