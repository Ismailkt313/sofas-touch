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

export async function fetchPermissionsOverview() {
  try {
    const res = await api.get('/api/permissions')
    return res.data
  } catch (err) {
    throw wrapAxiosError(
      err,
      'Unable to load role and permission configuration.',
    )
  }
}

export async function saveDataEntryRolePermissions(permissions) {
  try {
    const res = await api.put('/api/permissions/roles/data_entry', {
      permissions,
    })
    return res.data
  } catch (err) {
    throw wrapAxiosError(err, 'Failed to save Data Entry role permissions.')
  }
}

export async function resetDataEntryRolePermissions() {
  try {
    const res = await api.post('/api/permissions/roles/data_entry/reset')
    return res.data
  } catch (err) {
    throw wrapAxiosError(err, 'Failed to restore default permissions.')
  }
}

export async function saveUserPermissionOverrides(
  userId,
  { grant = [], revoke = [], assignedProjectIds = null },
) {
  try {
    const res = await api.put(
      `/api/permissions/users/${encodeURIComponent(userId)}`,
      { grant, revoke, assignedProjectIds },
    )
    return res.data
  } catch (err) {
    throw wrapAxiosError(err, 'Failed to save operator permission overrides.')
  }
}
