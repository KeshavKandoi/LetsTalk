import { createFileRoute } from '@tanstack/react-router'

// Retired: OTP verification is handled by Better Auth's emailOTP plugin.
export const Route = createFileRoute('/api/auth/verify-otp')({
  server: {
    handlers: {
      POST: async () => new Response(JSON.stringify({ error: 'This OTP endpoint has been retired.' }), {
        status: 410,
        headers: { 'Content-Type': 'application/json' },
      }),
    },
  },
})
