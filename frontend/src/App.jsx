import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { AdminLoginPage, SignupPage } from './features/auth'

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

  const isSignupRoute = pathname === '/signup' || pathname === '/register'

  useEffect(() => {
    document.title = isSignupRoute
      ? 'Soft Touch Sofas — Create Account'
      : 'Soft Touch Sofas — Admin Sign In'
  }, [isSignupRoute])

  const navigate = useCallback((nextPath) => {
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath)
      window.dispatchEvent(new Event(ROUTE_CHANGE_EVENT))
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [])

  if (isSignupRoute) {
    return <SignupPage onNavigateToLogin={() => navigate('/login')} />
  }

  return <AdminLoginPage onNavigateToSignup={() => navigate('/signup')} />
}

export default App
