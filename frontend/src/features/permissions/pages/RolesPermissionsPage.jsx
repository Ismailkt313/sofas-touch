import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { getVisibleNavItems } from '../../../components/layout/navigationConfig'
import { fetchProjects } from '../../projects'
import {
  ADMIN_RESERVED_PERMISSIONS,
  computeDraftEffectivePermissions,
  PERMISSION_LABELS,
  togglePermissionWithDependencies,
} from '../constants/permissionsCatalog'
import {
  broadcastPermissionsUpdated,
  usePermissions,
} from '../context/permissionsContextRef'
import {
  fetchPermissionsOverview,
  resetDataEntryRolePermissions,
  saveDataEntryRolePermissions,
  saveUserPermissionOverrides,
} from '../services/permissionService'
import '../styles/permissions.css'

function arraysEqualSorted(a, b) {
  const left = [...(a || [])].sort()
  const right = [...(b || [])].sort()
  if (left.length !== right.length) return false
  return left.every((val, idx) => val === right[idx])
}

export function RolesPermissionsPage() {
  const { refreshPermissions } = usePermissions()

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'roles'
    const params = new URLSearchParams(window.location.search)
    return params.get('user') ? 'users' : 'roles'
  })
  const [overview, setOverview] = useState(null)
  const [projectsCatalog, setProjectsCatalog] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [draftRolePerms, setDraftRolePerms] = useState([])
  const [openMobileModules, setOpenMobileModules] = useState(() => ({
    dashboard: true,
    projects: true,
    purchases: true,
  }))

  const [selectedUserId, setSelectedUserId] = useState('')
  const [draftUserGrant, setDraftUserGrant] = useState([])
  const [draftUserRevoke, setDraftUserRevoke] = useState([])
  const [projectScopeMode, setProjectScopeMode] = useState('all')
  const [draftAssignedProjects, setDraftAssignedProjects] = useState([])

  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const syncSelectedUserDraft = useCallback((operatorsList, targetId) => {
    const chosen =
      (operatorsList || []).find((op) => op.id === targetId) ||
      (operatorsList || [])[0] ||
      null

    if (!chosen) {
      setSelectedUserId('')
      setDraftUserGrant([])
      setDraftUserRevoke([])
      setProjectScopeMode('all')
      setDraftAssignedProjects([])
      return
    }

    setSelectedUserId(chosen.id)
    setDraftUserGrant(chosen.permissionOverrides?.grant || [])
    setDraftUserRevoke(chosen.permissionOverrides?.revoke || [])
    if (Array.isArray(chosen.assignedProjectIds)) {
      setProjectScopeMode('restricted')
      setDraftAssignedProjects(chosen.assignedProjectIds)
    } else {
      setProjectScopeMode('all')
      setDraftAssignedProjects([])
    }
  }, [])

  const loadData = useCallback(
    async (keepSelectedUser = '') => {
      setIsLoading(true)
      setLoadError('')
      try {
        const [permData, projData] = await Promise.all([
          fetchPermissionsOverview(),
          fetchProjects({ page: 1, limit: 100 }).catch(() => ({ projects: [] })),
        ])
        setOverview(permData)
        setDraftRolePerms(permData?.roles?.data_entry?.permissions || [])
        setProjectsCatalog(projData?.projects || [])
        syncSelectedUserDraft(permData?.operators || [], keepSelectedUser)
      } catch (err) {
        setLoadError(
          err?.message || 'Unable to load role and permission configuration.',
        )
      } finally {
        setIsLoading(false)
      }
    },
    [syncSelectedUserDraft],
  )

  useEffect(() => {
    let active = true
    const initialUser =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('user') || ''
        : ''

    Promise.all([
      fetchPermissionsOverview(),
      fetchProjects({ page: 1, limit: 100 }).catch(() => ({ projects: [] })),
    ])
      .then(([permData, projData]) => {
        if (!active) return
        setOverview(permData)
        setDraftRolePerms(permData?.roles?.data_entry?.permissions || [])
        setProjectsCatalog(projData?.projects || [])
        syncSelectedUserDraft(permData?.operators || [], initialUser)
        setLoadError('')
      })
      .catch((err) => {
        if (!active) return
        setLoadError(
          err?.message || 'Unable to load role and permission configuration.',
        )
      })
      .finally(() => {
        if (!active) return
        setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [syncSelectedUserDraft])

  const savedRolePerms = useMemo(
    () => overview?.roles?.data_entry?.permissions || [],
    [overview],
  )

  const hasUnsavedRoleChanges = useMemo(
    () => !arraysEqualSorted(draftRolePerms, savedRolePerms),
    [draftRolePerms, savedRolePerms],
  )

  const selectedOperator = useMemo(
    () => (overview?.operators || []).find((o) => o.id === selectedUserId) || null,
    [overview, selectedUserId],
  )

  const hasUnsavedUserChanges = useMemo(() => {
    if (!selectedOperator) return false
    const origGrant = selectedOperator.permissionOverrides?.grant || []
    const origRevoke = selectedOperator.permissionOverrides?.revoke || []
    const origScopeMode = Array.isArray(selectedOperator.assignedProjectIds)
      ? 'restricted'
      : 'all'
    const origProjects = Array.isArray(selectedOperator.assignedProjectIds)
      ? selectedOperator.assignedProjectIds
      : []

    if (!arraysEqualSorted(draftUserGrant, origGrant)) return true
    if (!arraysEqualSorted(draftUserRevoke, origRevoke)) return true
    if (projectScopeMode !== origScopeMode) return true
    if (
      projectScopeMode === 'restricted' &&
      !arraysEqualSorted(draftAssignedProjects, origProjects)
    ) {
      return true
    }
    return false
  }, [
    selectedOperator,
    draftUserGrant,
    draftUserRevoke,
    projectScopeMode,
    draftAssignedProjects,
  ])

  const anyUnsavedChanges = hasUnsavedRoleChanges || hasUnsavedUserChanges

  useEffect(() => {
    if (!anyUnsavedChanges || typeof window === 'undefined') {
      return undefined
    }
    const handleBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [anyUnsavedChanges])

  const draftNavPreview = useMemo(
    () =>
      getVisibleNavItems({
        role: 'data_entry',
        permissions: draftRolePerms,
      }),
    [draftRolePerms],
  )

  const draftOperatorEffectivePerms = useMemo(
    () =>
      computeDraftEffectivePermissions({
        role: 'data_entry',
        rolePermissions: savedRolePerms,
        overrides: {
          grant: draftUserGrant,
          revoke: draftUserRevoke,
        },
      }),
    [savedRolePerms, draftUserGrant, draftUserRevoke],
  )

  const handleToggleRolePerm = (permKey, checked) => {
    setFeedback(null)
    setDraftRolePerms((prev) =>
      togglePermissionWithDependencies(prev, permKey, checked),
    )
  }

  const handleDiscardRoleChanges = () => {
    setDraftRolePerms(savedRolePerms)
    setFeedback(null)
  }

  const handleSaveRoleChanges = async () => {
    if (isSaving) return
    setIsSaving(true)
    setFeedback(null)
    try {
      const updated = await saveDataEntryRolePermissions(draftRolePerms)
      setOverview(updated)
      setDraftRolePerms(updated?.roles?.data_entry?.permissions || [])
      syncSelectedUserDraft(updated?.operators || [], selectedUserId)
      broadcastPermissionsUpdated()
      await refreshPermissions()
      setFeedback({
        tone: 'success',
        text:
          updated?.message ||
          'Data Entry Operator role permissions saved and applied immediately.',
      })
    } catch (err) {
      setFeedback({
        tone: 'error',
        text: err?.message || 'Failed to save Data Entry role permissions.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleRestoreRoleDefaults = async () => {
    if (isSaving) return
    const confirmed = window.confirm(
      'Restore Data Entry Operator permissions to the recommended secure defaults?',
    )
    if (!confirmed) return

    setIsSaving(true)
    setFeedback(null)
    try {
      const updated = await resetDataEntryRolePermissions()
      setOverview(updated)
      setDraftRolePerms(updated?.roles?.data_entry?.permissions || [])
      syncSelectedUserDraft(updated?.operators || [], selectedUserId)
      broadcastPermissionsUpdated()
      await refreshPermissions()
      setFeedback({
        tone: 'success',
        text:
          updated?.message ||
          'Data Entry permissions restored to recommended defaults.',
      })
    } catch (err) {
      setFeedback({
        tone: 'error',
        text: err?.message || 'Failed to restore default permissions.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSelectOperator = (operatorId) => {
    if (hasUnsavedUserChanges) {
      const proceed = window.confirm(
        'Discard unsaved override changes for the current operator?',
      )
      if (!proceed) return
    }
    setFeedback(null)
    syncSelectedUserDraft(overview?.operators || [], operatorId)
  }

  const handleUserOverrideModeChange = (permKey, mode) => {
    setFeedback(null)
    if (mode === 'inherit') {
      setDraftUserGrant((prev) => prev.filter((k) => k !== permKey))
      setDraftUserRevoke((prev) => prev.filter((k) => k !== permKey))
    } else if (mode === 'grant') {
      setDraftUserRevoke((prev) => prev.filter((k) => k !== permKey))
      setDraftUserGrant((prev) =>
        prev.includes(permKey) ? prev : [...prev, permKey],
      )
    } else if (mode === 'revoke') {
      setDraftUserGrant((prev) => prev.filter((k) => k !== permKey))
      setDraftUserRevoke((prev) =>
        prev.includes(permKey) ? prev : [...prev, permKey],
      )
    }
  }

  const handleToggleAssignedProject = (projectCode) => {
    setFeedback(null)
    setDraftAssignedProjects((prev) =>
      prev.includes(projectCode)
        ? prev.filter((c) => c !== projectCode)
        : [...prev, projectCode],
    )
  }

  const handleResetUserToBaseline = () => {
    setFeedback(null)
    setDraftUserGrant([])
    setDraftUserRevoke([])
    setProjectScopeMode('all')
    setDraftAssignedProjects([])
  }

  const handleSaveUserOverrides = async () => {
    if (!selectedOperator || isSaving) return
    setIsSaving(true)
    setFeedback(null)
    try {
      const updated = await saveUserPermissionOverrides(selectedOperator.id, {
        grant: draftUserGrant,
        revoke: draftUserRevoke,
        assignedProjectIds:
          projectScopeMode === 'restricted' ? draftAssignedProjects : null,
      })
      setOverview(updated)
      syncSelectedUserDraft(updated?.operators || [], selectedOperator.id)
      broadcastPermissionsUpdated()
      setFeedback({
        tone: 'success',
        text:
          updated?.message ||
          `Saved individual overrides for ${selectedOperator.name}.`,
      })
    } catch (err) {
      setFeedback({
        tone: 'error',
        text: err?.message || 'Unable to save operator permission overrides.',
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
          Loading role &amp; permission matrix...
        </p>
      </div>
    )
  }

  if (loadError || !overview) {
    return (
      <div className="rbac-page">
        <section className="rbac-surface">
          <h1 className="rbac-header__title">Roles &amp; Permissions</h1>
          <p className="rbac-banner rbac-banner--error" role="alert">
            <span>{loadError || 'Permission matrix unavailable.'}</span>
            <button
              type="button"
              className="admin-btn admin-btn--secondary"
              onClick={() => loadData(selectedUserId)}
            >
              Retry
            </button>
          </p>
        </section>
      </div>
    )
  }

  const modules = overview.modules || []
  const operators = overview.operators || []
  const customOperatorsCount = operators.filter(
    (op) => op.hasCustomOverrides,
  ).length

  return (
    <div className="rbac-page">
      <header className="rbac-header">
        <div>
          <h1 className="rbac-header__title">Roles &amp; Permissions</h1>
          <p className="rbac-header__subtitle">
            Configure operational access for Data Entry Operators, enforce
            sensitive financial boundaries, and manage individual operator
            overrides.
          </p>
        </div>

        {activeTab === 'roles' ? (
          <div className="rbac-header__actions">
            <button
              type="button"
              className="admin-btn admin-btn--secondary"
              onClick={handleRestoreRoleDefaults}
              disabled={isSaving}
            >
              Restore Defaults
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={handleSaveRoleChanges}
              disabled={isSaving || !hasUnsavedRoleChanges}
            >
              {isSaving ? 'Saving...' : 'Save Role Changes'}
            </button>
          </div>
        ) : null}
      </header>

      <div className="rbac-tabs" role="tablist" aria-label="Permission views">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'roles'}
          className={`rbac-tab${activeTab === 'roles' ? ' rbac-tab--active' : ''}`}
          onClick={() => setActiveTab('roles')}
        >
          <span>Role Baseline Matrix</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'users'}
          className={`rbac-tab${activeTab === 'users' ? ' rbac-tab--active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <span>Per-Operator Overrides</span>
          <span className="rbac-tab__badge">{customOperatorsCount}</span>
        </button>
      </div>

      {feedback ? (
        <div
          className={`rbac-banner rbac-banner--${feedback.tone}`}
          role="status"
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={() => setFeedback(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {activeTab === 'roles' && hasUnsavedRoleChanges ? (
        <div className="rbac-banner rbac-banner--unsaved" role="status">
          <span>
            You have unsaved changes to the Data Entry Operator role baseline.
          </span>
          <div className="rbac-banner__actions">
            <button
              type="button"
              className="admin-btn admin-btn--secondary"
              onClick={handleDiscardRoleChanges}
              disabled={isSaving}
            >
              Discard
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={handleSaveRoleChanges}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === 'roles' ? (
        <>
          <section
            className="rbac-preview-strip"
            aria-label="Effective Data Entry navigation preview"
          >
            <div className="rbac-preview-strip__top">
              <span className="rbac-preview-strip__label">
                Effective Data Entry Sidebar Preview ({draftNavPreview.length}{' '}
                sections, {draftRolePerms.length} active permissions)
              </span>
              {overview.roles?.data_entry?.updatedByName ? (
                <span className="rbac-preview-strip__meta">
                  Last saved by {overview.roles.data_entry.updatedByName} (v
                  {overview.roles.data_entry.version})
                </span>
              ) : null}
            </div>
            <div className="rbac-pill-list">
              {draftNavPreview.length > 0 ? (
                draftNavPreview.map((item) => (
                  <span key={item.id} className="rbac-pill">
                    {item.displayLabel || item.label}
                  </span>
                ))
              ) : (
                <span className="rbac-pill rbac-pill--locked">
                  Profile &amp; Sign Out Only
                </span>
              )}
            </div>
          </section>

          <section className="rbac-surface">
            <div className="rbac-matrix-wrap rbac-matrix-wrap--responsive">
              <table className="rbac-matrix-table">
                <thead>
                  <tr>
                    <th scope="col">Capability</th>
                    <th scope="col">Administrator</th>
                    <th scope="col">Data Entry Operator</th>
                  </tr>
                </thead>
                <tbody>
                  {modules.map((mod) => (
                    <Fragment key={mod.moduleKey}>
                      <tr className="rbac-matrix-module-row">
                        <td colSpan={3}>
                          <span>{mod.moduleLabel}</span>
                          <span className="rbac-matrix-module-desc">
                            {mod.description}
                          </span>
                        </td>
                      </tr>
                      {mod.permissions.map((perm) => {
                        const isReserved =
                          Boolean(perm.adminOnly) ||
                          ADMIN_RESERVED_PERMISSIONS.has(perm.key)
                        const isEnabled = draftRolePerms.includes(perm.key)

                        return (
                          <tr key={perm.key}>
                            <td>
                              <div className="rbac-perm-title">
                                <span>{perm.label}</span>
                                <code className="rbac-perm-key">{perm.key}</code>
                              </div>
                              <div className="rbac-perm-desc">
                                {perm.description}
                              </div>
                            </td>
                            <td>
                              <span className="rbac-pill rbac-pill--locked">
                                Protected &bull; Always On
                              </span>
                            </td>
                            <td>
                              {isReserved ? (
                                <span className="rbac-pill rbac-pill--locked">
                                  Admin-Only Safeguard
                                </span>
                              ) : (
                                <label className="rbac-switch">
                                  <input
                                    type="checkbox"
                                    checked={isEnabled}
                                    onChange={(e) =>
                                      handleToggleRolePerm(
                                        perm.key,
                                        e.target.checked,
                                      )
                                    }
                                    aria-label={`${perm.label} for Data Entry Operator`}
                                  />
                                  <span className="rbac-switch__track">
                                    <span className="rbac-switch__thumb" />
                                  </span>
                                  <span className="rbac-switch__state">
                                    {isEnabled ? 'Allowed' : 'Restricted'}
                                  </span>
                                </label>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rbac-mobile-modules">
              {modules.map((mod) => {
                const isOpen = Boolean(openMobileModules[mod.moduleKey])
                const enabledInMod = mod.permissions.filter((p) =>
                  draftRolePerms.includes(p.key),
                ).length

                return (
                  <div key={mod.moduleKey} className="rbac-accordion">
                    <button
                      type="button"
                      className="rbac-accordion__trigger"
                      aria-expanded={isOpen}
                      onClick={() =>
                        setOpenMobileModules((prev) => ({
                          ...prev,
                          [mod.moduleKey]: !prev[mod.moduleKey],
                        }))
                      }
                    >
                      <span className="rbac-accordion__title">
                        {mod.moduleLabel}
                      </span>
                      <span className="rbac-accordion__count">
                        {enabledInMod}/{mod.permissions.length} active
                      </span>
                    </button>

                    {isOpen ? (
                      <div className="rbac-accordion__body">
                        {mod.permissions.map((perm) => {
                          const isReserved =
                            Boolean(perm.adminOnly) ||
                            ADMIN_RESERVED_PERMISSIONS.has(perm.key)
                          const isEnabled = draftRolePerms.includes(perm.key)

                          return (
                            <div
                              key={perm.key}
                              className="rbac-mobile-perm-item"
                            >
                              <div>
                                <div className="rbac-perm-title">
                                  {perm.label}
                                </div>
                                <div className="rbac-perm-desc">
                                  {perm.description}
                                </div>
                              </div>

                              {isReserved ? (
                                <span className="rbac-pill rbac-pill--locked">
                                  Admin Only
                                </span>
                              ) : (
                                <label className="rbac-switch">
                                  <input
                                    type="checkbox"
                                    checked={isEnabled}
                                    onChange={(e) =>
                                      handleToggleRolePerm(
                                        perm.key,
                                        e.target.checked,
                                      )
                                    }
                                    aria-label={`${perm.label} for Data Entry`}
                                  />
                                  <span className="rbac-switch__track">
                                    <span className="rbac-switch__thumb" />
                                  </span>
                                </label>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>
        </>
      ) : (
        <section className="rbac-surface">
          {operators.length === 0 ? (
            <p className="rbac-header__subtitle">
              No Data Entry Operator accounts have been registered yet. Once an
              operator account is created or approved, you can assign individual
              grants, restrictions, or project-level scope here.
            </p>
          ) : (
            <div className="rbac-override-layout">
              <div
                className="rbac-operator-list"
                role="listbox"
                aria-label="Data Entry Operators"
              >
                {operators.map((op) => {
                  const active = op.id === selectedUserId
                  return (
                    <button
                      key={op.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`rbac-operator-btn${
                        active ? ' rbac-operator-btn--active' : ''
                      }`}
                      onClick={() => handleSelectOperator(op.id)}
                    >
                      <span className="rbac-operator-btn__name">
                        <span>{op.name}</span>
                        {op.hasCustomOverrides ? (
                          <span className="rbac-pill rbac-pill--grant">
                            Custom
                          </span>
                        ) : null}
                      </span>
                      <span className="rbac-operator-btn__email">
                        {op.email} &bull;{' '}
                        {op.isActive ? op.approvalStatus : 'inactive'}
                      </span>
                    </button>
                  )
                })}
              </div>

              {selectedOperator ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div className="rbac-header">
                    <div>
                      <h2
                        className="rbac-header__title"
                        style={{ fontSize: '1.18rem' }}
                      >
                        {selectedOperator.name} ({selectedOperator.email})
                      </h2>
                      <p className="rbac-header__subtitle">
                        Explicit restrictions always override role baseline
                        permissions. Dependent capabilities require their module
                        view permission.
                      </p>
                    </div>
                    <div className="rbac-header__actions">
                      <button
                        type="button"
                        className="admin-btn admin-btn--secondary"
                        onClick={handleResetUserToBaseline}
                        disabled={isSaving}
                      >
                        Reset to Role Baseline
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn--primary"
                        onClick={handleSaveUserOverrides}
                        disabled={isSaving || !hasUnsavedUserChanges}
                      >
                        {isSaving ? 'Saving...' : 'Save Operator Overrides'}
                      </button>
                    </div>
                  </div>

                  <div className="rbac-preview-strip">
                    <div className="rbac-preview-strip__top">
                      <span className="rbac-preview-strip__label">
                        Effective Permissions for {selectedOperator.name} (
                        {draftOperatorEffectivePerms.length})
                      </span>
                      <span className="rbac-preview-strip__meta">
                        +{draftUserGrant.length} granted &bull; -
                        {draftUserRevoke.length} restricted
                      </span>
                    </div>
                    <div className="rbac-pill-list">
                      {draftOperatorEffectivePerms.map((key) => {
                        const isExtraGrant = draftUserGrant.includes(key)
                        return (
                          <span
                            key={key}
                            className={`rbac-pill${
                              isExtraGrant ? ' rbac-pill--grant' : ''
                            }`}
                          >
                            {PERMISSION_LABELS[key] || key}
                          </span>
                        )
                      })}
                      {draftUserRevoke.map((key) => (
                        <span
                          key={`rev-${key}`}
                          className="rbac-pill rbac-pill--revoke"
                        >
                          Restricted: {PERMISSION_LABELS[key] || key}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rbac-preview-strip">
                    <div className="rbac-preview-strip__top">
                      <span className="rbac-preview-strip__label">
                        Project Access Scope
                      </span>
                      <div className="rbac-segmented">
                        <button
                          type="button"
                          className={`rbac-segmented__btn${
                            projectScopeMode === 'all'
                              ? ' rbac-segmented__btn--inherit-active'
                              : ''
                          }`}
                          onClick={() => {
                            setFeedback(null)
                            setProjectScopeMode('all')
                          }}
                        >
                          All Projects
                        </button>
                        <button
                          type="button"
                          className={`rbac-segmented__btn${
                            projectScopeMode === 'restricted'
                              ? ' rbac-segmented__btn--grant-active'
                              : ''
                          }`}
                          onClick={() => {
                            setFeedback(null)
                            setProjectScopeMode('restricted')
                          }}
                        >
                          Selected Projects Only
                        </button>
                      </div>
                    </div>

                    {projectScopeMode === 'restricted' ? (
                      projectsCatalog.length === 0 ? (
                        <p className="rbac-perm-desc">
                          No projects exist yet. While restricted with zero
                          projects selected, this operator cannot view or post
                          against any project.
                        </p>
                      ) : (
                        <div className="rbac-project-grid">
                          {projectsCatalog.map((proj) => {
                            const code = proj.projectId
                            const checked = draftAssignedProjects.includes(code)
                            return (
                              <label key={code} className="rbac-project-check">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    handleToggleAssignedProject(code)
                                  }
                                />
                                <span>
                                  <strong>{code}</strong> &mdash; {proj.name}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      )
                    ) : (
                      <p className="rbac-perm-desc">
                        Operator can work with all active studio projects
                        permitted by their module permissions.
                      </p>
                    )}
                  </div>

                  <div className="rbac-matrix-wrap">
                    <table className="rbac-matrix-table">
                      <thead>
                        <tr>
                          <th scope="col">Capability</th>
                          <th scope="col">Role Baseline</th>
                          <th scope="col">Individual Override</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modules
                          .filter((m) => m.moduleKey !== 'administration')
                          .map((mod) => (
                            <Fragment key={mod.moduleKey}>
                              <tr className="rbac-matrix-module-row">
                                <td colSpan={3}>{mod.moduleLabel}</td>
                              </tr>
                              {mod.permissions
                                .filter(
                                  (p) =>
                                    !p.adminOnly &&
                                    !ADMIN_RESERVED_PERMISSIONS.has(p.key),
                                )
                                .map((perm) => {
                                  const inRole = savedRolePerms.includes(
                                    perm.key,
                                  )
                                  const mode = draftUserRevoke.includes(
                                    perm.key,
                                  )
                                    ? 'revoke'
                                    : draftUserGrant.includes(perm.key)
                                      ? 'grant'
                                      : 'inherit'

                                  return (
                                    <tr key={perm.key}>
                                      <td>
                                        <div className="rbac-perm-title">
                                          {perm.label}
                                        </div>
                                        <div className="rbac-perm-desc">
                                          {perm.description}
                                        </div>
                                      </td>
                                      <td>
                                        <span className="rbac-pill">
                                          {inRole ? 'Allowed' : 'Off'}
                                        </span>
                                      </td>
                                      <td>
                                        <div
                                          className="rbac-segmented"
                                          role="group"
                                          aria-label={`Override for ${perm.label}`}
                                        >
                                          <button
                                            type="button"
                                            className={`rbac-segmented__btn${
                                              mode === 'inherit'
                                                ? ' rbac-segmented__btn--inherit-active'
                                                : ''
                                            }`}
                                            onClick={() =>
                                              handleUserOverrideModeChange(
                                                perm.key,
                                                'inherit',
                                              )
                                            }
                                          >
                                            Inherit
                                          </button>
                                          <button
                                            type="button"
                                            className={`rbac-segmented__btn${
                                              mode === 'grant'
                                                ? ' rbac-segmented__btn--grant-active'
                                                : ''
                                            }`}
                                            onClick={() =>
                                              handleUserOverrideModeChange(
                                                perm.key,
                                                'grant',
                                              )
                                            }
                                          >
                                            + Grant
                                          </button>
                                          <button
                                            type="button"
                                            className={`rbac-segmented__btn${
                                              mode === 'revoke'
                                                ? ' rbac-segmented__btn--revoke-active'
                                                : ''
                                            }`}
                                            onClick={() =>
                                              handleUserOverrideModeChange(
                                                perm.key,
                                                'revoke',
                                              )
                                            }
                                          >
                                            - Restrict
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  )
                                })}
                            </Fragment>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
