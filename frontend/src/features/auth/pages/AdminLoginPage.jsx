import { BrandShowcase } from '../components/BrandShowcase'
import { LoginForm } from '../components/LoginForm'
import '../styles/auth.css'

export function AdminLoginPage({ onAuthenticated }) {
  return (
    <main className="auth-page">
      <div className="auth-backdrop" aria-hidden="true">
        <div className="auth-backdrop__image" />
        <div className="auth-backdrop__overlay" />
      </div>

      <div className="auth-shell">
        <section className="auth-shell__brand" aria-label="Company branding">
          <BrandShowcase />
        </section>

        <section className="auth-shell__panel" aria-label="Administrator sign in">
          <LoginForm onLoginSuccess={onAuthenticated} />
        </section>
      </div>
    </main>
  )
}
