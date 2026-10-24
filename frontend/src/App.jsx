import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { AdminLayout } from './components/layout/AdminLayout'
import { AdminPlaceholderPage } from './components/layout/AdminPlaceholderPage'
import { findNavItemByPath, isNavItemActive } from './components/layout/navigationConfig'
import {
  AdminLoginPage,
  SignupPage,
  clearStoredSession,
  fetchCurrentUser,
  getStoredSession,
} from './features/auth'
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
    if (window.location.pathname !== nextPath) {
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
  const isSignupRoute = pathname === '/signup' || pathname === '/register'

  useEffect(() => {
    if (isUsersRoute) {
      document.title = 'Soft Touch Sofas — User Management'
    } else if (matchedAdminNav) {
      document.title = `Soft Touch Sofas — ${matchedAdminNav.label}`
    } else if (isSignupRoute) {
      document.title = 'Soft Touch Sofas — Create Account'
    } else {
      document.title = 'Soft Touch Sofas — Admin Sign In'
    }
  }, [isUsersRoute, matchedAdminNav, isSignupRoute])

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

  if (isUsersRoute || matchedAdminNav) {
    return (
      <AdminLayout
        pathname={pathname}
        currentUser={currentUser}
        onNavigate={navigate}
        onLogout={handleLogout}
      >
        {isUsersRoute ? (
          <UserManagementPage
            currentUser={currentUser}
            onNavigate={navigate}
          />
        ) : (
          <AdminPlaceholderPage pathname={pathname} onNavigate={navigate} />
        )}
      </AdminLayout>
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
