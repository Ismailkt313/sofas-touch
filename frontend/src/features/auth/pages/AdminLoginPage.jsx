import { AuthLayout } from '../components/AuthLayout'
import { LoginForm } from '../components/LoginForm'

export function AdminLoginPage({ onAuthenticated, onNavigateToSignup }) {
  return (
    <AuthLayout panelLabel="Administrator sign in">
      <LoginForm
        onLoginSuccess={onAuthenticated}
        onNavigateToSignup={onNavigateToSignup}
      />
    </AuthLayout>
  )
}
