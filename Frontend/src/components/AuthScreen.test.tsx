// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AuthScreen } from './AuthScreen'

afterEach(() => {
  cleanup()
})

describe('AuthScreen', () => {
  it('signs up with email and pseudonym', async () => {
    const refreshSession = vi.fn(async () => {})
    const email = vi.fn(async () => ({ error: null }))

    render(
      <AuthScreen
        refreshSession={refreshSession}
        client={{
          signIn: {
            username: vi.fn(async () => ({ error: null })),
          },
          signUp: { email },
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

    expect(screen.getByLabelText(/Email/i)).toBeTruthy()
    expect(screen.queryByLabelText(/Confirm password/i)).toBeNull()
    expect(screen.queryByLabelText(/Name/i)).toBeNull()

    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: 'ready@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/Pseudonym/i), {
      target: { value: 'ReadyTalk' },
    })
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'secret-pass' },
    })
    fireEvent.submit(screen.getByLabelText(/Password/i).closest('form')!)

    await waitFor(() => {
      expect(email).toHaveBeenCalledWith({
        name: 'ReadyTalk',
        email: 'ready@example.com',
        password: 'secret-pass',
        username: 'ReadyTalk',
      })
    })

    expect(refreshSession).toHaveBeenCalledTimes(1)
  })

  it('submits username sign-in and refreshes on success', async () => {
    const refreshSession = vi.fn(async () => {})
    const username = vi.fn(async () => ({ error: null }))

    render(
      <AuthScreen
        refreshSession={refreshSession}
        client={{
          signIn: { username },
          signUp: {
            email: vi.fn(async () => ({ error: null })),
          },
        }}
      />,
    )

    fireEvent.change(screen.getByLabelText(/Username/i), {
      target: { value: 'ready' },
    })
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'secret' },
    })
    fireEvent.submit(screen.getByLabelText(/Password/i).closest('form')!)

    await waitFor(() => {
      expect(username).toHaveBeenCalledWith({
        username: 'ready',
        password: 'secret',
        rememberMe: true,
      })
    })

    expect(refreshSession).toHaveBeenCalledTimes(1)
  })

  it('shows auth errors instead of refreshing', async () => {
    const refreshSession = vi.fn(async () => {})

    render(
      <AuthScreen
        refreshSession={refreshSession}
        client={{
          signIn: {
            username: vi.fn(async () => ({
              error: { message: 'Nope' },
            })),
          },
          signUp: {
            email: vi.fn(async () => ({ error: null })),
          },
        }}
      />,
    )

    fireEvent.change(screen.getByLabelText(/Username/i), {
      target: { value: 'ready' },
    })
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'secret' },
    })
    fireEvent.submit(screen.getByLabelText(/Password/i).closest('form')!)

    expect(await screen.findByText('Nope')).toBeTruthy()
    expect(refreshSession).not.toHaveBeenCalled()
  })
})
