import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { AdminLayout } from './components/layout/AdminLayout'
import { AdminPlaceholderPage } from './components/layout/AdminPlaceholderPage'
import {
  findNavItemByPath,
  isNavItemActive,
} from './components/layout/navigationConfig'
import { ActivityHistoryPage } from './features/activity'
import { ApprovalsProvider, UserApprovalsPage } from './features/approvals'
import {
  AdminLoginPage,
  SignupPage,
  clearStoredSession,
  fetchCurrentUser,
  getStoredSession,
} from './features/auth'
import { DashboardPage } from './features/dashboard'
import { ExpensesPage } from './features/expenses'
import {
  PermissionsProvider,
  ProtectedRouteGuard,
  RolesPermissionsPage,
  hasPermission,
  resolveFirstPermittedPath,
} from './features/permissions'
import { ProjectDetailsPage, ProjectsPage } from './features/projects'
import {
  PurchaseDetailsPage,
  PurchaseVoucherFormPage,
  PurchasesPage,
} from './features/purchases'
import { RawMaterialsPage } from './features/raw-materials'
import { ProjectReportPage, ReportsPage } from './features/reports'
import { ProfilePage, SettingsPage } from './features/settings'
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

function WorkspaceProviders({ currentUser, children }) {
  if (hasPermission(currentUser, 'users.approve')) {
    return (
      <ApprovalsProvider currentUser={currentUser}>
        {children}
      </ApprovalsProvider>
    )
  }
  return children
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
  const [isCheckingSession, setIsCheckingSession] = useState(() =>
    Boolean(getStoredSession()?.token),
  )

  const navigate = useCallback((nextPath, options) => {
    const currentFull = `${window.location.pathname}${window.location.search}`
    if (currentFull !== nextPath) {
      try {
        sessionStorage.setItem(`sts:scroll:${currentFull}`, String(window.scrollY))
        sessionStorage.setItem(`sts:scroll:${window.location.pathname}`, String(window.scrollY))
      } catch {}

      const stateObj = {
        ...(options?.state || {}),
        from: currentFull,
      }

      if (options?.replace) {
        window.history.replaceState(stateObj, '', nextPath)
      } else {
        window.history.pushState(stateObj, '', nextPath)
      }
      window.dispatchEvent(new Event(ROUTE_CHANGE_EVENT))
      if (!options?.preserveScroll) {
        window.scrollTo({ top: 0, behavior: 'auto' })
      }
    }
  }, [])

  const refreshCurrentSession = useCallback(async () => {
    const stored = getStoredSession()
    if (!stored?.token) {
      setCurrentUser(null)
      setIsCheckingSession(false)
      return null
    }

    try {
      const verifiedUser = await fetchCurrentUser()
      if (verifiedUser) {
        setCurrentUser(verifiedUser)
        return verifiedUser
      }
      return null
    } catch (error) {
      const status = error?.response?.status
      const code = error?.response?.data?.code
      if (
        status === 401 ||
        code === 'ACCOUNT_INACTIVE' ||
        code === 'PENDING_APPROVAL' ||
        code === 'ACCOUNT_REJECTED'
      ) {
        clearStoredSession()
        setCurrentUser(null)
      }
      return null
    } finally {
      setIsCheckingSession(false)
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
        if (!cancelled) {
          const status = error?.response?.status
          const code = error?.response?.data?.code
          if (
            status === 401 ||
            code === 'ACCOUNT_INACTIVE' ||
            code === 'PENDING_APPROVAL' ||
            code === 'ACCOUNT_REJECTED'
          ) {
            clearStoredSession()
            setCurrentUser(null)
          }
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsCheckingSession(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const isLoginRoute = pathname === '/login'
  const isSignupRoute = pathname === '/signup' || pathname === '/register'
  const hasSession = Boolean(currentUser || isCheckingSession)

  const matchedAdminNav = findNavItemByPath(pathname, currentUser)
  const isDashboardRoute =
    pathname === '/dashboard' || (pathname === '/' && hasSession)
  const isActivityRoute = isNavItemActive(pathname, '/activity')
  const isUsersRoute = isNavItemActive(pathname, '/users')
  const isUserApprovalsRoute = isNavItemActive(pathname, '/user-approvals')
  const isPermissionsRoute = isNavItemActive(pathname, '/permissions')
  const isSettingsRoute = isNavItemActive(pathname, '/settings')
  const isProfileRoute = pathname === '/profile'
  const isProjectsListRoute = pathname === '/projects'
  const projectReportMatch =
    pathname.match(/^\/projects\/([^/]+)\/report$/) ||
    pathname.match(/^\/reports\/projects\/([^/]+)$/) ||
    pathname.match(/^\/reports\/([^/]+)$/)
  const projectReportIdentifier = projectReportMatch
    ? decodeURIComponent(projectReportMatch[1])
    : ''
  const isReportsListRoute = pathname === '/reports'
  const projectDetailsMatch = !projectReportIdentifier
    ? pathname.match(/^\/projects\/([^/]+)$/)
    : null
  const projectDetailsIdentifier = projectDetailsMatch
    ? decodeURIComponent(projectDetailsMatch[1])
    : ''
  const isRawMaterialsRoute = isNavItemActive(pathname, '/raw-materials')
  const isExpensesRoute = isNavItemActive(pathname, '/expenses')
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

  const isProtectedWorkspacePath =
    !isLoginRoute &&
    !isSignupRoute &&
    (isDashboardRoute ||
      isActivityRoute ||
      isUserApprovalsRoute ||
      isUsersRoute ||
      isPermissionsRoute ||
      isSettingsRoute ||
      isProfileRoute ||
      Boolean(projectReportIdentifier) ||
      isReportsListRoute ||
      Boolean(projectDetailsIdentifier) ||
      isProjectsListRoute ||
      isRawMaterialsRoute ||
      isExpensesRoute ||
      isPurchaseCreateRoute ||
      Boolean(purchaseEditIdentifier) ||
      Boolean(purchaseDetailsIdentifier) ||
      isPurchasesListRoute ||
      Boolean(matchedAdminNav))

  useEffect(() => {
    if (isProtectedWorkspacePath && !hasSession) {
      navigate('/login')
    }
  }, [isProtectedWorkspacePath, hasSession, navigate])

  useEffect(() => {
    if (isDashboardRoute) {
      document.title = 'Soft Touch Sofas — Dashboard'
    } else if (isPermissionsRoute) {
      document.title = 'Soft Touch Sofas — Roles & Permissions'
    } else if (isSettingsRoute) {
      document.title = 'Soft Touch Sofas — Application Settings'
    } else if (isProfileRoute) {
      document.title = 'Soft Touch Sofas — My Profile'
    } else if (isActivityRoute) {
      document.title = 'Soft Touch Sofas — Activity History'
    } else if (isUserApprovalsRoute) {
      document.title = 'Soft Touch Sofas — User Approvals'
    } else if (isUsersRoute) {
      document.title = 'Soft Touch Sofas — User Management'
    } else if (projectReportIdentifier) {
      document.title = 'Soft Touch Sofas — Project Financial Report'
    } else if (isReportsListRoute) {
      document.title = 'Soft Touch Sofas — Project Reports'
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
    } else if (isExpensesRoute) {
      document.title = 'Soft Touch Sofas — Expenses'
    } else if (matchedAdminNav) {
      document.title = `Soft Touch Sofas — ${matchedAdminNav.label}`
    } else if (isSignupRoute) {
      document.title = 'Soft Touch Sofas — Create Account'
    } else {
      document.title = 'Soft Touch Sofas — Sign In'
    }
  }, [
    isDashboardRoute,
    isPermissionsRoute,
    isSettingsRoute,
    isProfileRoute,
    isActivityRoute,
    isUserApprovalsRoute,
    isUsersRoute,
    projectReportIdentifier,
    isReportsListRoute,
    projectDetailsIdentifier,
    isProjectsListRoute,
    isPurchaseCreateRoute,
    purchaseEditIdentifier,
    purchaseDetailsIdentifier,
    isPurchasesListRoute,
    isExpensesRoute,
    matchedAdminNav,
    isSignupRoute,
  ])

  const handleAuthenticated = useCallback(
    (sessionPayload) => {
      const user = sessionPayload?.user || null
      setCurrentUser(user)
      setIsCheckingSession(false)
      navigate(resolveFirstPermittedPath(user))
    },
    [navigate],
  )

  const handleLogout = useCallback(() => {
    clearStoredSession()
    setCurrentUser(null)
    setIsCheckingSession(false)
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

  if (isProtectedWorkspacePath && hasSession) {
    const activePathname = isDashboardRoute ? '/dashboard' : pathname

    return (
      <PermissionsProvider
        currentUser={currentUser}
        isCheckingSession={isCheckingSession}
        onRefreshSession={refreshCurrentSession}
      >
        <WorkspaceProviders currentUser={currentUser}>
          <AdminLayout
            pathname={activePathname}
            currentUser={currentUser}
            onNavigate={navigate}
            onLogout={handleLogout}
          >
            <ProtectedRouteGuard pathname={activePathname} onNavigate={navigate}>
              {isDashboardRoute ? (
                <DashboardPage
                  currentUser={currentUser}
                  onNavigate={navigate}
                />
              ) : isPermissionsRoute ? (
                <RolesPermissionsPage />
              ) : isSettingsRoute ? (
                <SettingsPage />
              ) : isProfileRoute ? (
                <ProfilePage
                  currentUser={currentUser}
                  onLogout={handleLogout}
                />
              ) : isActivityRoute ? (
                <ActivityHistoryPage
                  currentUser={currentUser}
                  onNavigate={navigate}
                />
              ) : isUserApprovalsRoute ? (
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
              ) : isExpensesRoute ? (
                <ExpensesPage
                  currentUser={currentUser}
                  onNavigate={navigate}
                />
              ) : projectReportIdentifier ? (
                <ProjectReportPage
                  key={`report-${projectReportIdentifier}`}
                  projectId={projectReportIdentifier}
                  currentUser={currentUser}
                  onNavigate={navigate}
                />
              ) : isReportsListRoute ? (
                <ReportsPage
                  currentUser={currentUser}
                  onNavigate={navigate}
                />
              ) : (
                <AdminPlaceholderPage pathname={pathname} onNavigate={navigate} />
              )}
            </ProtectedRouteGuard>
          </AdminLayout>
        </WorkspaceProviders>
      </PermissionsProvider>
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
