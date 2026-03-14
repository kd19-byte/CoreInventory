const API_BASE = import.meta.env.VITE_API_URL || '/api'
const TOKEN_KEY = 'coreinventory.token'

const parseJsonSafely = (text) => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {}
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
        ...(options.headers || {}),
      },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new Error('Unable to reach the API server. Check that the backend is running.')
  }

  const text = await res.text()
  const data = text ? parseJsonSafely(text) : null

  if (!res.ok) {
    const message =
      data?.error ||
      data?.message ||
      (text && !text.trim().startsWith('<') ? text : null) ||
      `Request failed (${res.status})`
    throw new Error(message)
  }

  if (text && data === null) {
    throw new Error('Received an invalid response from the server.')
  }

  return data
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  del: (path) => request(path, { method: 'DELETE' }),
}
