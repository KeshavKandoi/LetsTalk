import { createFileRoute } from '@tanstack/react-router'
import { Resend } from 'resend'
import { db } from '@backend/lib/db'
import { user } from '@backend/lib/db/schema'
import { eq } from 'drizzle-orm'

const resend = new Resend(process.env.RESEND_API_KEY)

// Store OTPs temporarily in memory
const otpStore = new Map<string, { otp: string; expires: number }>()

export const Route = createFileRoute('/api/auth/send-otp')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { email } = await request.json()
          if (!email) return new Response(JSON.stringify({ error: 'Email required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })

          // Generate 6-digit OTP
          const otp = Math.floor(100000 + Math.random() * 900000).toString()
          const expires = Date.now() + 10 * 60 * 1000 // 10 minutes

          // Store OTP
          otpStore.set(email, { otp, expires })

          // Send email
          await resend.emails.send({
            from: 'LetsTalk <onboarding@resend.dev>',
            to: email,
            subject: 'Your LetsTalk verification code',
            html: `
              <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #fff8f0;">
                <h1 style="color: #813400; font-size: 28px; margin-bottom: 8px;">Let's Talk 💬</h1>
                <p style="color: #55433a; font-size: 16px;">Your verification code is:</p>
                <div style="background: #fdf3dc; border-radius: 16px; padding: 24px; text-align: center; margin: 24px 0; border: 1px solid rgba(220,193,181,0.6);">
                  <span style="font-size: 48px; font-weight: 800; letter-spacing: 12px; color: #405e98;">${otp}</span>
                </div>
                <p style="color: #897268; font-size: 14px;">This code expires in 10 minutes.</p>
                <p style="color: #897268; font-size: 14px;">If you didn't request this, please ignore this email.</p>
              </div>
            `,
          })

          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } })
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
      },
    },
  },
})

export { otpStore }
