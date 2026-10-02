import { describe, expect, it, vi } from 'vitest'

vi.mock('./db', () => ({ db: {} }))

import { isValidPushToken } from './notifications'

describe('isValidPushToken', () => {
  it('accepts an Expo push token', () => {
    expect(isValidPushToken('ExponentPushToken[McZpAbCdEfGhIjKlMnOpQr]')).toBe(true)
  })

  it('rejects empty and malformed values', () => {
    expect(isValidPushToken('')).toBe(false)
    expect(isValidPushToken('not-a-token')).toBe(false)
    expect(isValidPushToken('ExponentPushToken[]')).toBe(false)
    expect(isValidPushToken('ExponentPushToken[a b]')).toBe(false)
    expect(isValidPushToken(null)).toBe(false)
    expect(isValidPushToken(42)).toBe(false)
  })

  it('rejects oversized values', () => {
    expect(isValidPushToken(`ExponentPushToken[${'a'.repeat(300)}]`)).toBe(false)
  })
})
