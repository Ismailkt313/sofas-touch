import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { AdminLayout } from './components/layout/AdminLayout'
import { AdminPlaceholderPage } from './components/layout/AdminPlaceholderPage'
import { findNavItemByPath, isNavItemActive } from './components/layout/navigationConfig'
import { ApprovalsProvider, UserApprovalsPage } from './features/approvals'
import {
  AdminLoginPage,
  SignupPage,
  clearStoredSession,
  fetchCurrentUser,
  getStoredSession,
} from './features/auth'
import { ProjectDetailsPage, ProjectsPage } from './features/projects'
import {
  PurchaseDetailsPage,
  PurchaseVoucherFormPage,
  PurchasesPage,
} from './features/purchases'
import { RawMaterialsPage } from './features/raw-materials'
import { UserManagementPage } from './features/users'

const ROUTE_CHANGE_EVENT = 'sts:routechange'

function subscribeToPathname(callback) {
  window.addEventListener('popstate', callback)
  window.addEventListener(ROUTE_CHANGE_EVENT, callback)
  return () => {
    window.removeEventListener('popstate', callback)
    window.removeEventListener(ROUTE_CHANGE_EVENT, callback)
  }
}

function getPathnameSnapshot() {
  return window.location.pathname.replace(/\/+$/, '') || '/'
}

function getServerPathnameSnapshot() {
  return '/'
}

function App() {
  const pathname = useSyncExternalStore(
    subscribeToPathname,
    getPathnameSnapshot,
    getServerPathnameSnapshot,
  )

  const [currentUser, setCurrentUser] = useState(
    () => getStoredSession()?.user || null,
  )

  const navigate = useCallback((nextPath) => {
    const currentFull = `${window.location.pathname}${window.location.search}`
    if (currentFull !== nextPath) {
      window.history.pushState({}, '', nextPath)
      window.dispatchEvent(new Event(ROUTE_CHANGE_EVENT))
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [])

  useEffect(() => {
    const stored = getStoredSession()
    if (!stored?.token) {
      return undefined
    }

    let cancelled = false
    fetchCurrentUser()
      .then((verifiedUser) => {
        if (!cancelled && verifiedUser) {
          setCurrentUser(verifiedUser)
        }
      })
      .catch((error) => {
        if (!cancelled && error?.response?.status === 401) {
          clearStoredSession()
          setCurrentUser(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const matchedAdminNav = findNavItemByPath(pathname)
  const isUsersRoute = isNavItemActive(pathname, '/users')
  const isUserApprovalsRoute = isNavItemActive(pathname, '/user-approvals')
  const isProjectsListRoute = pathname === '/projects'
  const projectDetailsMatch = pathname.match(/^\/projects\/([^/]+)$/)
  const projectDetailsIdentifier = projectDetailsMatch
    ? decodeURIComponent(projectDetailsMatch[1])
    : ''
  const isRawMaterialsRoute = isNavItemActive(pathname, '/raw-materials')
  const isPurchasesListRoute = pathname === '/purchases'
  const isPurchaseCreateRoute = pathname === '/purchases/new'
  const purchaseEditMatch = pathname.match(/^\/purchases\/([^/]+)\/edit$/)
  const purchaseEditIdentifier = purchaseEditMatch
    ? decodeURIComponent(purchaseEditMatch[1])
    : ''
  const purchaseDetailsMatch =
    !isPurchaseCreateRoute && !purchaseEditIdentifier
      ? pathname.match(/^\/purchases\/([^/]+)$/)
      : null
  const purchaseDetailsIdentifier = purchaseDetailsMatch
    ? decodeURIComponent(purchaseDetailsMatch[1])
    : ''
  const isSignupRoute = pathname === '/signup' || pathname === '/register'

  useEffect(() => {
    if (isUserApprovalsRoute) {
      document.title = 'Soft Touch Sofas — User Approvals'
    } else if (isUsersRoute) {
      document.title = 'Soft Touch Sofas — User Management'
    } else if (projectDetailsIdentifier) {
      document.title = 'Soft Touch Sofas — Project Details'
    } else if (isProjectsListRoute) {
      document.title = 'Soft Touch Sofas — Projects'
    } else if (isPurchaseCreateRoute) {
      document.title = 'Soft Touch Sofas — New Purchase Voucher'
    } else if (purchaseEditIdentifier) {
      document.title = 'Soft Touch Sofas — Edit Purchase Voucher'
    } else if (purchaseDetailsIdentifier) {
      document.title = 'Soft Touch Sofas — Purchase Details'
    } else if (isPurchasesListRoute) {
      document.title = 'Soft Touch Sofas — Purchases'
    } else if (matchedAdminNav) {
      document.title = `Soft Touch Sofas — ${matchedAdminNav.label}`
    } else if (isSignupRoute) {
      document.title = 'Soft Touch Sofas — Create Account'
    } else {
      document.title = 'Soft Touch Sofas — Admin Sign In'
    }
  }, [
    isUserApprovalsRoute,
    isUsersRoute,
    projectDetailsIdentifier,
    isProjectsListRoute,
    isPurchaseCreateRoute,
    purchaseEditIdentifier,
    purchaseDetailsIdentifier,
    isPurchasesListRoute,
    matchedAdminNav,
    isSignupRoute,
  ])

  const handleAuthenticated = useCallback(
    (sessionPayload) => {
      setCurrentUser(sessionPayload?.user || null)
      navigate('/users')
    },
    [navigate],
  )

  const handleLogout = useCallback(() => {
    clearStoredSession()
    setCurrentUser(null)
    navigate('/login')
  }, [navigate])

  if (isSignupRoute) {
    return (
      <SignupPage
        onNavigateToLogin={() => navigate('/login')}
        onSignupSuccess={() => navigate('/login')}
      />
    )
  }

  if (isUserApprovalsRoute || isUsersRoute || matchedAdminNav) {
    return (
      <ApprovalsProvider currentUser={currentUser}>
        <AdminLayout
          pathname={pathname}
          currentUser={currentUser}
          onNavigate={navigate}
          onLogout={handleLogout}
        >
          {isUserApprovalsRoute ? (
            <UserApprovalsPage
              currentUser={currentUser}
              onNavigate={navigate}
            />
          ) : isUsersRoute ? (
            <UserManagementPage
              currentUser={currentUser}
              onNavigate={navigate}
            />
          ) : projectDetailsIdentifier ? (
            <ProjectDetailsPage
              projectIdentifier={projectDetailsIdentifier}
              currentUser={currentUser}
              onNavigate={navigate}
            />
          ) : isProjectsListRoute ? (
            <ProjectsPage
              currentUser={currentUser}
              onNavigate={navigate}
            />
          ) : isRawMaterialsRoute ? (
            <RawMaterialsPage
              currentUser={currentUser}
              onNavigate={navigate}
            />
          ) : isPurchaseCreateRoute ? (
            <PurchaseVoucherFormPage
              mode="create"
              currentUser={currentUser}
              onNavigate={navigate}
            />
          ) : purchaseEditIdentifier ? (
            <PurchaseVoucherFormPage
              key={`edit-purchase-${purchaseEditIdentifier}`}
              mode="edit"
              voucherIdentifier={purchaseEditIdentifier}
              currentUser={currentUser}
              onNavigate={navigate}
            />
          ) : purchaseDetailsIdentifier ? (
            <PurchaseDetailsPage
              voucherIdentifier={purchaseDetailsIdentifier}
              currentUser={currentUser}
              onNavigate={navigate}
            />
          ) : isPurchasesListRoute ? (
            <PurchasesPage
              currentUser={currentUser}
              onNavigate={navigate}
            />
          ) : (
            <AdminPlaceholderPage pathname={pathname} onNavigate={navigate} />
          )}
        </AdminLayout>
      </ApprovalsProvider>
    )
  }

  return (
    <AdminLoginPage
      onAuthenticated={handleAuthenticated}
      onNavigateToSignup={() => navigate('/signup')}
    />
  )
}

export default App
