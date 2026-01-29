interface User {
  id: string
  email: string
  fullName: string
  role: 'MEMBER' | 'ADMIN'
  mustChangePassword: boolean
}

interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: User
}

export function useAuth() {
  const token = useState<string | null>('auth_token', () => {
    if (import.meta.client) {
      return localStorage.getItem('auth_token')
    }
    return null
  })

  const refreshToken = useState<string | null>('refresh_token', () => {
    if (import.meta.client) {
      return localStorage.getItem('refresh_token')
    }
    return null
  })

  const user = useState<User | null>('auth_user', () => {
    if (import.meta.client) {
      const stored = localStorage.getItem('auth_user')
      return stored ? JSON.parse(stored) : null
    }
    return null
  })

  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const isAdmin = computed(() => user.value?.role === 'ADMIN')

  const config = useRuntimeConfig()

  async function login(email: string, password: string) {
    const res = await fetch(`${config.public.apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }))
      throw new Error(err.error || 'Login failed')
    }

    const data: LoginResponse = await res.json()
    token.value = data.accessToken
    refreshToken.value = data.refreshToken
    user.value = data.user

    localStorage.setItem('auth_token', data.accessToken)
    localStorage.setItem('refresh_token', data.refreshToken)
    localStorage.setItem('auth_user', JSON.stringify(data.user))

    return data
  }

  async function refresh(): Promise<boolean> {
    if (!refreshToken.value) return false

    try {
      const res = await fetch(`${config.public.apiBase}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refreshToken.value }),
      })

      if (!res.ok) return false

      const data = await res.json()
      token.value = data.accessToken
      localStorage.setItem('auth_token', data.accessToken)
      return true
    } catch {
      return false
    }
  }

  async function logout() {
    try {
      if (token.value) {
        await fetch(`${config.public.apiBase}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token.value}`,
          },
        })
      }
    } catch {
      // ignore
    }

    token.value = null
    refreshToken.value = null
    user.value = null
    localStorage.removeItem('auth_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('auth_user')
  }

  return { token, refreshToken, user, isAuthenticated, isAdmin, login, refresh, logout }
}
