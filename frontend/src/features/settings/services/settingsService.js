import api from '../../../services/api'

function wrapAxiosError(error, fallbackMessage) {
  const status = error?.response?.status || 0
  const data = error?.response?.data || {}
  const wrapped = new Error(data.message || data.error || fallbackMessage)
  wrapped.status = status
  wrapped.code = data.code || ''
  wrapped.errors = data.errors || null
  return wrapped
}

export async function fetchAppSettings() {
  try {
    const res = await api.get('/api/settings')
    return res.data
  } catch (err) {
    throw wrapAxiosError(err, 'Unable to load workspace settings.')
  }
}

export async function updateAppSettings(payload) {
  try {
    const res = await api.put('/api/settings', payload)
    return res.data
  } catch (err) {
    throw wrapAxiosError(err, 'Unable to save workspace settings.')
  }
}

export async function updateSelfProfile(payload) {
  try {
    const res = await api.patch('/api/auth/me', payload)
    return res.data
  } catch (err) {
    throw wrapAxiosError(err, 'Unable to update your profile.')
  }
}
