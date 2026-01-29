export function useApi() {
  const config = useRuntimeConfig()
  const auth = useAuth()

  async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    }

    if (auth.token.value) {
      headers['Authorization'] = `Bearer ${auth.token.value}`
    }

    const res = await fetch(`${config.public.apiBase}${path}`, {
      ...options,
      headers,
    })

    if (res.status === 401 && auth.refreshToken.value) {
      const refreshed = await auth.refresh()
      if (refreshed) {
        headers['Authorization'] = `Bearer ${auth.token.value}`
        const retry = await fetch(`${config.public.apiBase}${path}`, {
          ...options,
          headers,
        })
        if (!retry.ok) {
          const err = await retry.json().catch(() => ({ error: 'Request failed' }))
          throw new Error(err.error || 'Request failed')
        }
        return retry.json()
      } else {
        auth.logout()
        navigateTo('/login')
        throw new Error('Session expired')
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }))
      throw new Error(err.error || `Request failed: ${res.status}`)
    }

    return res.json()
  }

  return { apiFetch }
}
