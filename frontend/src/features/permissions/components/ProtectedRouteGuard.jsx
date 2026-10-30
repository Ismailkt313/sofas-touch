import { evaluateRouteAccess } from '../constants/permissionsCatalog'
import { usePermissions } from '../context/permissionsContextRef'
import { AccessDeniedPage } from './AccessDeniedPage'

export function ProtectedRouteGuard({ pathname, onNavigate, children }) {
  const { currentUser, isLoadingPermissions, refreshPermissions } =
    usePermissions()

  if (isLoadingPermissions || !currentUser) {
    return (
      <div
        className="rbac-route-loading"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="rbac-route-loading__spinner" aria-hidden="true" />
        <p className="rbac-route-loading__text">
          Verifying workspace permissions...
        </p>
      </div>
    )
  }

  const evaluation = evaluateRouteAccess(pathname, currentUser)
  if (!evaluation.allowed) {
    return (
      <AccessDeniedPage
        pathname={pathname}
        currentUser={currentUser}
        accessEvaluation={evaluation}
        onNavigate={onNavigate}
        onRefreshPermissions={refreshPermissions}
      />
    )
  }

  return children
}
