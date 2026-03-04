import { describe, expect, it } from 'vitest'
import { extractScanToken } from './scan-token'

describe('extractScanToken', () => {
  it('reads the scan token from a full URL', () => {
    expect(
      extractScanToken('https://readytotalk.app/?scan=token-123'),
    ).toBe('token-123')
  })

  it('returns the raw token when given plain text', () => {
    expect(extractScanToken('token-123')).toBe('token-123')
  })

  it('returns null for empty input', () => {
    expect(extractScanToken('   ')).toBeNull()
  })
})
