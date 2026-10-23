import axios from 'axios'

export function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL
  if (!configured || typeof configured !== 'string') {
    return 'http://localhost:5000'
  }
  return configured.replace(/\/+$/, '')
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

// Attach Bearer token from stored session if present
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
        // Ignore storage read/parse errors
      }
    }
    return config
  },
  (error) => Promise.reject(error),
)

export default api
