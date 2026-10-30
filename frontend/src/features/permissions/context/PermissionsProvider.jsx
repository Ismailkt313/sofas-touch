import { useCallback, useEffect, useMemo } from 'react'
import {
  getEffectivePermissions,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  normalizeRoleKey,
} from '../constants/permissionsCatalog'
import { PermissionsContext } from './permissionsContextRef'

export function PermissionsProvider({
  currentUser,
  isCheckingSession = false,
  onRefreshSession,
  children,
}) {
  const role = normalizeRoleKey(currentUser?.role)
  const permissions = useMemo(
    () => getEffectivePermissions(currentUser),
    [currentUser],
  )

  const can = useCallback(
    (permKey) => hasPermission(currentUser, permKey),
    [currentUser],
  )

  const canAny = useCallback(
    (permKeys) => hasAnyPermission(currentUser, permKeys),
    [currentUser],
  )

  const canAll = useCallback(
    (permKeys) => hasAllPermissions(currentUser, permKeys),
    [currentUser],
  )

  const refreshPermissions = useCallback(async () => {
    if (typeof onRefreshSession === 'function') {
      return onRefreshSession()
    }
    return null
  }, [onRefreshSession])

  useEffect(() => {
    if (typeof window === 'undefined' || !currentUser) {
      return undefined
    }

    const handleUpdated = () => {
      refreshPermissions()
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshPermissions()
      }
    }

    window.addEventListener('sts:permissions-updated', handleUpdated)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('sts:permissions-updated', handleUpdated)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [currentUser, refreshPermissions])

  const value = useMemo(
    () => ({
      currentUser,
      role,
      isAdmin: role === 'admin',
      isOperator: role === 'data_entry',
      permissions,
      isLoadingPermissions: Boolean(isCheckingSession),
      can,
      canAny,
      canAll,
      refreshPermissions,
    }),
    [currentUser, role, permissions, isCheckingSession, can, canAny, canAll, refreshPermissions],
  )

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  )
}
