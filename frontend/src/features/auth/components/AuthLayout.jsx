import { BrandShowcase } from './BrandShowcase'
import '../styles/auth.css'

export function AuthLayout({
  panelLabel,
  shellClassName = '',
  children,
}) {
  const shellClasses = shellClassName
    ? `auth-shell ${shellClassName}`
    : 'auth-shell'

  return (
    <main className="auth-page">
      <div className="auth-backdrop" aria-hidden="true">
        <div className="auth-backdrop__image" />
        <div className="auth-backdrop__overlay" />
      </div>

      <div className={shellClasses}>
        <section className="auth-shell__brand" aria-label="Company branding">
          <BrandShowcase />
        </section>

        <section className="auth-shell__panel" aria-label={panelLabel}>
          {children}
        </section>
      </div>
    </main>
  )
}
