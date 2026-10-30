import axios from 'axios'

export const ACTIVITY_UPDATED_EVENT = 'sts:activity-updated'

const MUTATING_HTTP_METHODS = new Set(['post', 'put', 'patch', 'delete'])

export function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL
  if (!configured || typeof configured !== 'string') {
    return ''
  }

  const trimmed = configured.replace(/\/+$/, '')

  if (
    typeof window !== 'undefined' &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(trimmed) &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return ''
  }

  return trimmed
}

export const API_BASE_URL = getApiBaseUrl()

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withCredentials: true,
  timeout: 10000,
})

api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      try {
        const raw =
          window.localStorage.getItem('sts_admin_session') ||
          window.sessionStorage.getItem('sts_admin_session')
        if (raw) {
          const session = JSON.parse(raw)
          const token = session?.token || session?.accessToken
          if (token && !config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${token}`
          }
        }
      } catch {
        return config
      }
    }
    return config
  },
  (error) => Promise.reject(error),
)

api.interceptors.response.use(
  (response) => {
    if (typeof window !== 'undefined') {
      const method = String(response?.config?.method || '').toLowerCase()
      const url = String(response?.config?.url || '')
      if (
        MUTATING_HTTP_METHODS.has(method) &&
        !url.includes('/auth/login') &&
        !url.includes('/auth/logout')
      ) {
        window.dispatchEvent(
          new CustomEvent(ACTIVITY_UPDATED_EVENT, {
            detail: { method, url, status: response.status },
          }),
        )
      }
    }
    return response
  },
  (error) => {
    if (typeof window !== 'undefined') {
      const status = error?.response?.status
      const code = error?.response?.data?.code
      const url = String(error?.config?.url || '')
      if (
        status === 403 &&
        code === 'PERMISSION_DENIED' &&
        !url.includes('/auth/me')
      ) {
        window.dispatchEvent(new CustomEvent('sts:permissions-updated'))
      }
    }
    return Promise.reject(error)
  },
)

export default api
