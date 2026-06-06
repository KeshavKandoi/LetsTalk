import { createFileRoute } from '@tanstack/react-router'
import { otpStore } from './send-otp'

export const Route = createFileRoute('/api/auth/verify-otp')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { email, otp } = await request.json()
          if (!email || !otp) return new Response(JSON.stringify({ error: 'Email and OTP required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })

          const stored = otpStore.get(email)
          if (!stored) return new Response(JSON.stringify({ error: 'OTP not found. Please request a new one.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
          if (Date.now() > stored.expires) {
            otpStore.delete(email)
            return new Response(JSON.stringify({ error: 'OTP expired. Please request a new one.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
          }
          if (stored.otp !== otp) return new Response(JSON.stringify({ error: 'Invalid OTP. Please try again.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })

          otpStore.delete(email)
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } })
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
      },
    },
  },
})
