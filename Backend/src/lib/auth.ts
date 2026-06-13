import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'
import { bearer, emailOTP } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { Resend } from 'resend'
import { db } from './db'
import * as schema from './db/schema'
import { getAppBaseUrl, getAuthSecret } from './env'

const resend = new Resend(process.env.RESEND_API_KEY)

export const auth = betterAuth({
  secret: getAuthSecret(),
  baseURL: getAppBaseUrl(),
  basePath: '/api/auth',
  trustedOrigins: [
    getAppBaseUrl(),
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://192.168.29.59:3000',
    'https://letstalks.app',
  ],
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  databaseHooks: {
    session: {
      create: {
        after: async (session: any) => {
          try {
            const { db } = await import('./db')
            const { session: sessionTable } = await import('./db/schema')
            const { and, eq, ne } = await import('drizzle-orm')
            // Delete all other sessions for this user except the new one
            await db.delete(sessionTable).where(
              and(
                eq(sessionTable.userId, session.userId),
                ne(sessionTable.id, session.id)
              )
            )
          } catch (e) {}
        },
      },
    },
    user: {
      create: {
        before: async (user: any) => {
          return { data: { ...user, username: user.username || user.name || null } }
        },
        after: async (user: any) => {
          try {
            const { db } = await import('./db')
            const { userProfile } = await import('./db/schema')
            const dob = user.dob || null
            let age = null
            if (dob) {
              const birth = new Date(dob)
              const today = new Date()
              age = today.getFullYear() - birth.getFullYear()
              const m = today.getMonth() - birth.getMonth()
              if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
            }
            await db.insert(userProfile).values({
              userId: user.id,
              gender: user.gender || null,
              age: age ? String(age) : null,
              createdAt: new Date(),
              updatedAt: new Date(),
            }).onConflictDoNothing()
          } catch (e) {
          }
        },
      },
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  plugins: [
    tanstackStartCookies(),
    bearer(),
    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      async sendVerificationOTP({ email, otp, type }) {
        const subjects = {
          'sign-in': "Your Let's Talk login code",
          'email-verification': "Verify your Let's Talk email",
          'forget-password': "Reset your Let's Talk password",
        }
        await resend.emails.send({
          from: 'Let\'s Talk <noreply@letstalks.app>',
          to: email,
          subject: subjects[type] || "Your Let's Talk OTP",
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0a0704;border-radius:16px">
              <h2 style="color:#e8824a;margin:0 0 8px">Let's Talk</h2>
              <p style="color:#ffffff;font-size:16px;margin:0 0 24px">Your verification code:</p>
              <div style="background:#1a1a1a;border-radius:12px;padding:24px;text-align:center;letter-spacing:12px;font-size:36px;font-weight:900;color:#e8824a">${otp}</div>
              <p style="color:rgba(255,255,255,0.5);font-size:13px;margin:24px 0 0">This code expires in 10 minutes. Do not share it with anyone.</p>
            </div>
          `,
        })
      },
    }),
  ],
})
