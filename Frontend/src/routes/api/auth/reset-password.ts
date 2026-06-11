import { json } from '@tanstack/react-start'

export async function POST(request: Request) {
  try {
    const { email, otp, newPassword } = await request.json()

    if (!email || !otp || !newPassword) {
      return json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Call better-auth to reset password
    const response = await fetch('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, newPassword })
    })

    return response
  } catch (error) {
    console.error('Reset password error:', error)
    return json({ error: 'Failed to reset password' }, { status: 500 })
  }
}
