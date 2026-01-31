// API configuration with auth

// Use same hostname as browser, just different port
const API_BASE =
  import.meta.env.VITE_API_URL || `http://${window.location.hostname}:18800`
const WS_BASE =
  import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:18800`

const PASSWORD_KEY = 'claw-machine-password'

export function getPassword(): string | null {
  return localStorage.getItem(PASSWORD_KEY)
}

export function setPassword(password: string): void {
  localStorage.setItem(PASSWORD_KEY, password)
}

export function clearPassword(): void {
  localStorage.removeItem(PASSWORD_KEY)
}

export function isAuthenticated(): boolean {
  return !!getPassword()
}

export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const password = getPassword()
  if (!password) {
    throw new Error('Not authenticated')
  }

  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${password}`)
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    clearPassword()
    window.location.reload()
    throw new Error('Invalid password')
  }

  return response
}

export function getWebSocketUrl(): string {
  // Note: WebSocket auth would need query param or first message
  // For now, we'll keep WS simple and rely on same-origin
  return `${WS_BASE}/ws`
}

export async function validatePassword(password: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/tasks`, {
      headers: {
        Authorization: `Bearer ${password}`,
      },
    })
    return response.ok
  } catch {
    return false
  }
}

export { API_BASE, WS_BASE }
