import { useState } from 'react'
import {
  getEffectivePermissions,
  normalizeRoleKey,
} from '../../permissions/constants/permissionsCatalog'
import { usePermissions } from '../../permissions/context/permissionsContextRef'
import '../../permissions/styles/permissions.css'
import { updateSelfProfile } from '../services/profileService'

export function ProfilePage({ currentUser, onLogout }) {
  const { refreshPermissions } = usePermissions()
  const [name, setName] = useState(() => currentUser?.name || '')
  const [phone, setPhone] = useState(() => currentUser?.phone || '')
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const roleKey = normalizeRoleKey(currentUser?.role)
  const roleLabel =
    roleKey === 'admin' ? 'Administrator' : 'Data Entry Operator'

  const handleSave = async (e) => {
    e.preventDefault()
    if (isSaving) return
    setIsSaving(true)
    setFeedback(null)
    try {
      const res = await updateSelfProfile({
        name: name.trim(),
        phone: phone.trim(),
      })
      await refreshPermissions()
      setFeedback({
        tone: 'success',
        text: res.message || 'Your profile details have been updated.',
      })
    } catch (err) {
      setFeedback({
        tone: 'error',
        text: err?.message || 'Unable to update profile details.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="rbac-page">
      <header className="rbac-header">
        <div>
          <h1 className="rbac-header__title">My Account &amp; Access</h1>
          <p className="rbac-header__subtitle">
            Review your workspace role, active operational permissions, and
            contact information.
          </p>
        </div>
        <div className="rbac-header__actions">
          <span className="rbac-pill">{roleLabel}</span>
          {typeof onLogout === 'function' ? (
            <button
              type="button"
              className="admin-btn admin-btn--secondary"
              onClick={onLogout}
            >
              Sign Out
            </button>
          ) : null}
        </div>
      </header>

      {feedback ? (
        <div
          className={`rbac-banner rbac-banner--${feedback.tone}`}
          role="status"
        >
          <span>{feedback.text}</span>
        </div>
      ) : null}

      <form className="rbac-surface" onSubmit={handleSave}>
        <div className="rbac-settings-grid">
          <div className="rbac-field">
            <label htmlFor="profile-name">Full Name</label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="rbac-field">
            <label htmlFor="profile-email">Email Address (Login ID)</label>
            <input
              id="profile-email"
              type="email"
              value={currentUser?.email || ''}
              disabled
            />
          </div>

          <div className="rbac-field">
            <label htmlFor="profile-phone">Phone Number</label>
            <input
              id="profile-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>

          <div className="rbac-field">
            <label htmlFor="profile-role">Assigned Role</label>
            <input id="profile-role" type="text" value={roleLabel} disabled />
            <span className="rbac-field__hint">
              Roles and permissions can only be modified by an Administrator.
            </span>
          </div>
        </div>

        <div
          className="rbac-header__actions"
          style={{ marginTop: '18px', justifyContent: 'flex-end' }}
        >
          <button
            type="submit"
            className="admin-btn admin-btn--primary"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Update Profile'}
          </button>
        </div>
      </form>
    </div>
  )
}

