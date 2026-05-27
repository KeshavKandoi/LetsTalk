export function extractScanToken(value: string) {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return null
  }

  try {
    const url = new URL(trimmedValue)
    const token = url.searchParams.get('scan')
    return token?.trim() || null
  } catch {
    return trimmedValue
  }
}
