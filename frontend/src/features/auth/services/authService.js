import api, { getApiBaseUrl } from '../../../services/api'

const SESSION_STORAGE_KEY = 'sts_admin_session'
const REMEMBERED_EMAIL_KEY = 'sts_admin_remembered_email'

export { getApiBaseUrl }

function safeStorageGet(storage, key) {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function safeStorageSet(storage, key, value) {
  try {
    storage.setItem(key, value)
  } catch {
    // Ignore storage quota or privacy mode errors
  }
}

function safeStorageRemove(storage, key) {
  try {
    storage.removeItem(key)
  } catch {
    // Ignore storage access errors
  }
}

export function getRememberedEmail() {
  if (typeof window === 'undefined') {
    return ''
  }
  return safeStorageGet(window.localStorage, REMEMBERED_EMAIL_KEY) || ''
}

export function persistRememberedEmail(email, rememberMe) {
  if (typeof window === 'undefined') {
    return
  }

  if (rememberMe && email) {
    safeStorageSet(window.localStorage, REMEMBERED_EMAIL_KEY, email.trim())
  } else {
    safeStorageRemove(window.localStorage, REMEMBERED_EMAIL_KEY)
  }
}

export function getStoredSession() {
  if (typeof window === 'undefined') {
    return null
  }

  const raw =
    safeStorageGet(window.localStorage, SESSION_STORAGE_KEY) ||
    safeStorageGet(window.sessionStorage, SESSION_STORAGE_KEY)

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearStoredSession() {
  if (typeof window === 'undefined') {
    return
  }

  safeStorageRemove(window.localStorage, SESSION_STORAGE_KEY)
  safeStorageRemove(window.sessionStorage, SESSION_STORAGE_KEY)
}

function isValidAuthPayload(data) {
  if (!data || typeof data !== 'object') {
    return false
  }

  return Boolean(
    data.token ||
      data.accessToken ||
      data.session ||
      data.user ||
      data.authenticated === true,
  )
}

export async function loginAdmin({ email, password, rememberMe = false }) {
  const normalizedEmail = email.trim()

  let response
  try {
    response = await api.post('/api/auth/login', {
      email: normalizedEmail,
      password,
      rememberMe: Boolean(rememberMe),
    })
  } catch (error) {
    if (!error.response) {
      throw new Error(
        'Unable to reach the authentication server. Please check your connection and try again.',
        { cause: error },
      )
    }

    const { status, data } = error.response

    if (status === 401 || status === 403) {
      throw new Error(
        data?.message ||
          'Invalid email address or password. Please verify your credentials and try again.',
        { cause: error },
      )
    }

    if (status === 404) {
      throw new Error(
        'Authentication endpoint (/api/auth/login) is not yet configured on the server.',
        { cause: error },
      )
    }

    if (status === 429) {
      throw new Error(
        data?.message ||
          'Too many sign-in attempts. Please wait a moment before trying again.',
        { cause: error },
      )
    }

    if (status >= 500) {
      throw new Error(
        data?.message && data.message !== 'Something went wrong'
          ? data.message
          : 'Authentication service is currently unavailable. Please ensure the backend server is running and try again.',
        { cause: error },
      )
    }

    throw new Error(
      data?.message ||
        'Unable to complete sign-in. Please check your details and try again.',
      { cause: error },
    )
  }

  const data = response.data

  if (!isValidAuthPayload(data)) {
    throw new Error(
      'Received an invalid authentication response from the server.',
    )
  }

  const sessionPayload = {
    token: data.token || data.accessToken || null,
    user: data.user || { email: normalizedEmail },
    authenticatedAt: new Date().toISOString(),
  }

  if (typeof window !== 'undefined') {
    const serialized = JSON.stringify(sessionPayload)
    if (rememberMe) {
      safeStorageSet(window.localStorage, SESSION_STORAGE_KEY, serialized)
      safeStorageRemove(window.sessionStorage, SESSION_STORAGE_KEY)
    } else {
      safeStorageSet(window.sessionStorage, SESSION_STORAGE_KEY, serialized)
      safeStorageRemove(window.localStorage, SESSION_STORAGE_KEY)
    }
  }

  persistRememberedEmail(normalizedEmail, rememberMe)

  return sessionPayload
}

export async function fetchCurrentUser() {
  const stored = getStoredSession()
  if (!stored?.token) {
    return null
  }

  const response = await api.get('/api/auth/me')
  const user = response.data?.user
  if (!user || typeof user !== 'object') {
    return null
  }

  if (typeof window !== 'undefined') {
    const updatedSession = {
      ...stored,
      user,
    }
    const serialized = JSON.stringify(updatedSession)
    if (safeStorageGet(window.localStorage, SESSION_STORAGE_KEY)) {
      safeStorageSet(window.localStorage, SESSION_STORAGE_KEY, serialized)
    } else if (safeStorageGet(window.sessionStorage, SESSION_STORAGE_KEY)) {
      safeStorageSet(window.sessionStorage, SESSION_STORAGE_KEY, serialized)
    }
  }

  return user
}

/**
 * Prepares sanitized public registration data and delegates to the backend integration
 * once a non-admin public registration API is defined.
 *
 * Security & API integration notes:
 * - Role selection is intentionally disallowed on the client; any role/admin properties
 *   are ignored and must be assigned strictly on the server as a standard non-admin user.
 * - Public signup must never create Admin accounts or establish an Admin session.
 * - The current Express backend (`backend/src/index.ts`) does not yet define a public
 *   registration endpoint, so no endpoint URL is invented here. Connect the verified
 *   backend registration route here once specified.
 */
export async function registerAccount(
  { fullName, email, phone, password },
  { registerHandler } = {},
) {
  const sanitizedPayload = {
    fullName: fullName.trim(),
    email: email.trim(),
    phone: phone.trim(),
    password,
  }

  if (typeof registerHandler === 'function') {
    return registerHandler(sanitizedPayload)
  }

  await new Promise((resolve) => {
    setTimeout(resolve, 350)
  })

  throw new Error(
    'Public account registration is not yet connected to a backend API. Please configure the registration service to enable account creation.',
  )
}
