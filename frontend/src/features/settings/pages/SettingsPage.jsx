import { useCallback, useEffect, useState } from 'react'
import '../../permissions/styles/permissions.css'
import {
  fetchAppSettings,
  updateAppSettings,
} from '../services/settingsService'

export function SettingsPage() {
  const [form, setForm] = useState({
    companyName: '',
    workshopLocation: '',
    supportEmail: '',
    defaultCostWarningPercent: 80,
    defaultCostCriticalPercent: 100,
    projectInactivityThresholdDays: 14,
    operatorGuidanceBanner: '',
  })
  const [savedSnapshot, setSavedSnapshot] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [feedback, setFeedback] = useState(null)

  const applySettings = useCallback((settings) => {
    const normalized = {
      companyName: settings?.companyName || 'Soft Touch Sofas',
      workshopLocation: settings?.workshopLocation || '',
      supportEmail: settings?.supportEmail || '',
      defaultCostWarningPercent: Number(
        settings?.defaultCostWarningPercent ?? 80,
      ),
      defaultCostCriticalPercent: Number(
        settings?.defaultCostCriticalPercent ?? 100,
      ),
      projectInactivityThresholdDays: Number(
        settings?.projectInactivityThresholdDays ?? 14,
      ),
      operatorGuidanceBanner: settings?.operatorGuidanceBanner || '',
    }
    setForm(normalized)
    setSavedSnapshot(normalized)
  }, [])

  const loadSettings = useCallback(async () => {
    setIsLoading(true)
    setFeedback(null)
    try {
      const res = await fetchAppSettings()
      applySettings(res.settings)
    } catch (err) {
      setFeedback({
        tone: 'error',
        text: err?.message || 'Unable to load workspace settings.',
      })
    } finally {
      setIsLoading(false)
    }
  }, [applySettings])

  useEffect(() => {
    let active = true
    fetchAppSettings()
      .then((res) => {
        if (!active) return
        applySettings(res.settings)
      })
      .catch((err) => {
        if (!active) return
        setFeedback({
          tone: 'error',
          text: err?.message || 'Unable to load workspace settings.',
        })
      })
      .finally(() => {
        if (!active) return
        setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [applySettings])

  const hasChanges =
    savedSnapshot !== null &&
    JSON.stringify(form) !== JSON.stringify(savedSnapshot)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSaving) return
    setIsSaving(true)
    setFieldErrors({})
    setFeedback(null)

    try {
      const res = await updateAppSettings({
        companyName: form.companyName,
        workshopLocation: form.workshopLocation,
        supportEmail: form.supportEmail,
        defaultCostWarningPercent: Number(form.defaultCostWarningPercent),
        defaultCostCriticalPercent: Number(form.defaultCostCriticalPercent),
        projectInactivityThresholdDays: Number(
          form.projectInactivityThresholdDays,
        ),
        operatorGuidanceBanner: form.operatorGuidanceBanner,
      })
      applySettings(res.settings)
      setFeedback({
        tone: 'success',
        text: res.message || 'Application settings saved successfully.',
      })
    } catch (err) {
      if (err?.errors) {
        setFieldErrors(err.errors)
      }
      setFeedback({
        tone: 'error',
        text: err?.message || 'Failed to update application settings.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="rbac-route-loading" role="status" aria-live="polite">
        <div className="rbac-route-loading__spinner" aria-hidden="true" />
        <p className="rbac-route-loading__text">
          Loading application settings...
        </p>
      </div>
    )
  }

  return (
    <div className="rbac-page">
      <header className="rbac-header">
        <div>
          <h1 className="rbac-header__title">Application Settings</h1>
          <p className="rbac-header__subtitle">
            Manage workspace identity, financial cost alert thresholds, and the
            operational guidance banner displayed on the Data Entry desk.
          </p>
        </div>
      </header>

      {feedback ? (
        <div
          className={`rbac-banner rbac-banner--${feedback.tone}`}
          role="status"
        >
          <span>{feedback.text}</span>
          {feedback.tone === 'error' ? (
            <button
              type="button"
              className="admin-btn admin-btn--secondary"
              onClick={loadSettings}
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      <form className="rbac-surface" onSubmit={handleSubmit}>
        <div className="rbac-settings-grid">
          <div className="rbac-field">
            <label htmlFor="sts-company-name">Company Name</label>
            <input
              id="sts-company-name"
              type="text"
              value={form.companyName}
              onChange={(e) =>
                setForm((p) => ({ ...p, companyName: e.target.value }))
              }
              required
            />
            {fieldErrors.companyName ? (
              <span className="rbac-field__error">
                {fieldErrors.companyName}
              </span>
            ) : null}
          </div>

          <div className="rbac-field">
            <label htmlFor="sts-workshop-loc">Workshop / Studio Location</label>
            <input
              id="sts-workshop-loc"
              type="text"
              value={form.workshopLocation}
              onChange={(e) =>
                setForm((p) => ({ ...p, workshopLocation: e.target.value }))
              }
            />
            {fieldErrors.workshopLocation ? (
              <span className="rbac-field__error">
                {fieldErrors.workshopLocation}
              </span>
            ) : null}
          </div>

          <div className="rbac-field">
            <label htmlFor="sts-support-email">
              Administrator Contact Email
            </label>
            <input
              id="sts-support-email"
              type="email"
              value={form.supportEmail}
              onChange={(e) =>
                setForm((p) => ({ ...p, supportEmail: e.target.value }))
              }
              required
            />
            {fieldErrors.supportEmail ? (
              <span className="rbac-field__error">
                {fieldErrors.supportEmail}
              </span>
            ) : null}
          </div>

          <div className="rbac-field">
            <label htmlFor="sts-inactivity-days">
              Project Inactivity Warning (Days)
            </label>
            <input
              id="sts-inactivity-days"
              type="number"
              min={1}
              max={365}
              value={form.projectInactivityThresholdDays}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  projectInactivityThresholdDays: e.target.value,
                }))
              }
            />
            {fieldErrors.projectInactivityThresholdDays ? (
              <span className="rbac-field__error">
                {fieldErrors.projectInactivityThresholdDays}
              </span>
            ) : null}
          </div>

          <div className="rbac-field">
            <label htmlFor="sts-warn-pct">
              Default Cost Warning Threshold (%)
            </label>
            <input
              id="sts-warn-pct"
              type="number"
              min={10}
              max={100}
              value={form.defaultCostWarningPercent}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  defaultCostWarningPercent: e.target.value,
                }))
              }
            />
            {fieldErrors.defaultCostWarningPercent ? (
              <span className="rbac-field__error">
                {fieldErrors.defaultCostWarningPercent}
              </span>
            ) : null}
          </div>

          <div className="rbac-field">
            <label htmlFor="sts-crit-pct">
              Critical Cost Overrun Threshold (%)
            </label>
            <input
              id="sts-crit-pct"
              type="number"
              min={50}
              max={200}
              value={form.defaultCostCriticalPercent}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  defaultCostCriticalPercent: e.target.value,
                }))
              }
            />
            {fieldErrors.defaultCostCriticalPercent ? (
              <span className="rbac-field__error">
                {fieldErrors.defaultCostCriticalPercent}
              </span>
            ) : null}
          </div>

          <div className="rbac-field rbac-field--full">
            <label htmlFor="sts-guidance-banner">
              Data Entry Desk Guidance Note
            </label>
            <textarea
              id="sts-guidance-banner"
              rows={3}
              value={form.operatorGuidanceBanner}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  operatorGuidanceBanner: e.target.value,
                }))
              }
            />
            <span className="rbac-field__hint">
              Shown at the top of the Data Entry Operations Desk to remind
              operators of daily voucher and bill-upload standards.
            </span>
          </div>
        </div>

        <div
          className="rbac-header__actions"
          style={{ marginTop: '20px', justifyContent: 'flex-end' }}
        >
          {hasChanges ? (
            <button
              type="button"
              className="admin-btn admin-btn--secondary"
              onClick={() => applySettings(savedSnapshot)}
              disabled={isSaving}
            >
              Reset Form
            </button>
          ) : null}
          <button
            type="submit"
            className="admin-btn admin-btn--primary"
            disabled={isSaving || !hasChanges}
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
