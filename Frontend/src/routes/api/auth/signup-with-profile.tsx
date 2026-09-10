import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/auth/signup-with-profile')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json() as Record<string, any>
          const rawEmail = typeof body.email === 'string' ? body.email : ''
          const email = rawEmail.trim().toLowerCase()
          const { username, password, dob, gender, confirmPassword } = body
          if (!email || !password || !username) {
            return new Response(JSON.stringify({ error: 'Email, username, and password are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
          }

          const { auth } = await import('@backend/lib/auth')
          const { db } = await import('@backend/lib/db')
          const { userProfile, user } = await import('@backend/lib/db/schema')
          const { eq, ilike } = await import('drizzle-orm')

          const existing = await db.select({ id: user.id }).from(user).where(ilike(user.email, email)).limit(1)
          if (existing.length) {
            return new Response(JSON.stringify({ error: 'ACCOUNT_EXISTS', code: 'ACCOUNT_EXISTS', message: 'An account with this email already exists. Please log in.' }), {
              status: 409, headers: { 'Content-Type': 'application/json' },
            })
          }

          // Step 1: Call the standard better-auth endpoint via handler
          const signupBody = JSON.stringify({
            email,
            password,
            confirmPassword: confirmPassword || password,
            name: username,
          })
          
          const signupRequest = new Request('http://localhost:3000/api/auth/sign-up/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: signupBody,
          })

          const signupResponse = await auth.handler(signupRequest)
          const responseText = await signupResponse.text()
          const signupData = responseText ? JSON.parse(responseText) : {}
          

          if (!signupResponse.ok || !signupData.user?.id) {
            const duplicate = /exist|already|unique|duplicate/i.test(JSON.stringify(signupData))
            return new Response(JSON.stringify({ error: duplicate ? 'ACCOUNT_EXISTS' : 'Signup failed' }), {
              status: duplicate ? 409 : 400,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          const created = await db.select({ id: user.id, email: user.email }).from(user).where(eq(user.id, signupData.user.id)).limit(1)
          if (!created[0] || created[0].email.trim().toLowerCase() !== email) {
            return new Response(JSON.stringify({ error: 'Signup failed' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
          }

          // Step 2: Save dob and gender to user_profile
          let age = null
          if (dob) {
            const birth = new Date(dob)
            const today = new Date()
            age = today.getFullYear() - birth.getFullYear()
            const m = today.getMonth() - birth.getMonth()
            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
          }

          
          // Try insert first, if it fails, update
          try {
            await db.insert(userProfile).values({
              userId: signupData.user.id,
              gender: gender || null,
              age: age ? String(age) : null,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
          } catch {
            // If row exists, update it
            const { eq } = await import('drizzle-orm')
            await db.update(userProfile)
              .set({
                gender: gender || null,
                age: age ? String(age) : null,
                updatedAt: new Date(),
              })
              .where(eq(userProfile.userId, signupData.user.id))
          }

          // Update username in user table
          await db.update(user)
            .set({ username: username || null })
            .where(eq(user.id, signupData.user.id))

          return new Response(JSON.stringify({
            success: true,
            user: signupData.user,
            message: 'Check your email for OTP',
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (e: any) {
          if (/exist|already|unique|duplicate/i.test(String(e?.message || e))) {
            return new Response(JSON.stringify({ error: 'ACCOUNT_EXISTS', code: 'ACCOUNT_EXISTS', message: 'An account with this email already exists. Please log in.' }), {
              status: 409,
              headers: { 'Content-Type': 'application/json' },
            })
          }
          return new Response(JSON.stringify({ error: 'Signup failed' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
