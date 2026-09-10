import { createFileRoute } from '@tanstack/react-router'

// Retired: email OTP is issued by Better Auth's emailOTP plugin.
export const Route = createFileRoute('/api/auth/send-otp')({
  server: {
    handlers: {
      POST: async () => new Response(JSON.stringify({ error: 'This OTP endpoint has been retired.' }), {
        status: 410,
        headers: { 'Content-Type': 'application/json' },
      }),
    },
  },
})
