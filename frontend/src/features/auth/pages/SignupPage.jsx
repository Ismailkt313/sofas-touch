import { AuthLayout } from '../components/AuthLayout'
import { SignupForm } from '../components/SignupForm'

export function SignupPage({ onSignupSuccess, onNavigateToLogin }) {
  return (
    <AuthLayout panelLabel="Create account" shellClassName="auth-shell--signup">
      <SignupForm
        onSignupSuccess={onSignupSuccess}
        onNavigateToLogin={onNavigateToLogin}
      />
    </AuthLayout>
  )
}
