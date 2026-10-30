import { createContext, useContext } from 'react'

export const DEFAULT_PERMISSIONS_CONTEXT = {
  currentUser: null,
  role: '',
  isAdmin: false,
  isOperator: false,
  permissions: [],
  isLoadingPermissions: false,
  can: () => false,
  canAny: () => false,
  canAll: () => false,
  refreshPermissions: async () => null,
}

export const PermissionsContext = createContext(DEFAULT_PERMISSIONS_CONTEXT)

export function usePermissions() {
  return useContext(PermissionsContext)
}

export function broadcastPermissionsUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sts:permissions-updated'))
  }
}
