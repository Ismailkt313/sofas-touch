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

/**
 * Submits public registration data to the backend /api/auth/signup API endpoint.
 *
 * Security & API integration notes:
 * - Role selection is disallowed on the client; the server strictly assigns 'data_entry'.
 * - Public signup never creates Admin accounts or establishes an Admin session.
 */
export async function registerAccount(
  { fullName, name, email, phone, password },
  { registerHandler } = {},
) {
  const sanitizedPayload = {
    name: (fullName || name || '').trim(),
    fullName: (fullName || name || '').trim(),
    email: (email || '').trim().toLowerCase(),
    phone: (phone || '').trim(),
    password,
  }

  if (typeof registerHandler === 'function') {
    return registerHandler(sanitizedPayload)
  }

  let response
  try {
    response = await api.post('/api/auth/signup', {
      name: sanitizedPayload.name,
      fullName: sanitizedPayload.fullName,
      email: sanitizedPayload.email,
      phone: sanitizedPayload.phone,
      password: sanitizedPayload.password,
    })
  } catch (error) {
    if (!error.response) {
      throw new Error(
        'Unable to reach the authentication server. Please check your connection and try again.',
        { cause: error },
      )
    }

    const { status, data } = error.response

    if (status === 400) {
      const fieldError =
        data?.errors && typeof data.errors === 'object'
          ? Object.values(data.errors)[0]
          : null
      throw new Error(
        fieldError ||
          data?.message ||
          'Please verify your registration details and try again.',
        { cause: error },
      )
    }

    if (status === 409) {
      throw new Error(
        data?.message ||
          'An account with this email address already exists. Please sign in instead.',
        { cause: error },
      )
    }

    if (status === 429) {
      throw new Error(
        data?.message ||
          'Too many registration attempts. Please wait 15 minutes before trying again.',
        { cause: error },
      )
    }

    if (status === 404) {
      throw new Error(
        'Registration endpoint (/api/auth/signup) is not available on the server.',
        { cause: error },
      )
    }

    if (status >= 500) {
      throw new Error(
        data?.message && data.message !== 'Something went wrong'
          ? data.message
          : 'Registration service is currently unavailable. Please try again shortly.',
        { cause: error },
      )
    }

    throw new Error(
      data?.message ||
        'Unable to create your account. Please check your details and try again.',
      { cause: error },
    )
  }

  return response.data
}
