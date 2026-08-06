export async function readApiErrorMessage(response: Response, fallback = '') {
  try {
    const payload = await response.clone().json()
    if (payload && typeof payload === 'object') {
      const error = typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error.trim()
        : ''
      if (error) return error

      const message = typeof (payload as { message?: unknown }).message === 'string'
        ? (payload as { message: string }).message.trim()
        : ''
      if (message) return message
    }
  } catch (error) {
    // fall through to text/status fallback
  }

  try {
    const text = (await response.clone().text()).trim()
    if (text) return text
  } catch (error) {
    // ignore body read failures
  }

  return fallback || `HTTP ${response.status}`
}