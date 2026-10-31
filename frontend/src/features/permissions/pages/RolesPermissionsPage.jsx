import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Toast } from '../../../components/common/Toast'
import { getVisibleNavItems } from '../../../components/layout/navigationConfig'
import { fetchProjects } from '../../projects'
import {
  ADMIN_RESERVED_PERMISSIONS,
  computeDraftEffectivePermissions,
  PERMISSION_LABELS,
  PERMISSION_MODULE_DEFINITIONS,
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

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function RolesPermissionsPage() {
  const { refreshPermissions } = usePermissions()

  // Tabs: 'roles' = Default Employee Access, 'users' = Individual Employee Access
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'roles'
    const params = new URLSearchParams(window.location.search)
    return params.get('user') ? 'users' : 'roles'
  })

  // Mobile 2-step navigation for Individual Employee Access: 'list' | 'detail'
  const [mobileStep, setMobileStep] = useState('list')

  const [overview, setOverview] = useState(null)
  const [projectsCatalog, setProjectsCatalog] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // Default Employee Access state
  const [draftRolePerms, setDraftRolePerms] = useState([])
  const [expandedModules, setExpandedModules] = useState(() => ({
    dashboard: true,
    projects: true,
    purchases: true,
    expenses: true,
    materials: true,
    reports: false,
    users: false,
    activity: false,
    permissions: false,
  }))

  // Individual Employee Access state
  const [operatorSearch, setOperatorSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [draftUserGrant, setDraftUserGrant] = useState([])
  const [draftUserRevoke, setDraftUserRevoke] = useState([])
  const [projectScopeMode, setProjectScopeMode] = useState('all')
  const [draftAssignedProjects, setDraftAssignedProjects] = useState([])
  const [projectSearch, setProjectSearch] = useState('')

  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const syncSelectedUserDraft = useCallback((operatorsList, targetId) => {
    // Prefer approved & active data entry operators, fall back if none
    const eligible = (operatorsList || []).filter(
      (op) => op.approvalStatus === 'approved' && op.isActive !== false,
    )
    const pool = eligible.length > 0 ? eligible : operatorsList || []

    const chosen =
      pool.find((op) => op.id === targetId) ||
      (pool.length > 0 ? pool[0] : null)

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
          fetchProjects({ page: 1, limit: 200 }).catch(() => ({ projects: [] })),
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
      fetchProjects({ page: 1, limit: 200 }).catch(() => ({ projects: [] })),
    ])
      .then(([permData, projData]) => {
        if (!active) return
        setOverview(permData)
        setDraftRolePerms(permData?.roles?.data_entry?.permissions || [])
        setProjectsCatalog(projData?.projects || [])
        syncSelectedUserDraft(permData?.operators || [], initialUser)
        if (initialUser) {
          setMobileStep('detail')
        }
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

  const operators = useMemo(() => overview?.operators || [], [overview])

  // Filter to active and approved Data Entry operators for individual permission configuration
  const eligibleOperators = useMemo(() => {
    const approvedActive = operators.filter(
      (op) => op.approvalStatus === 'approved' && op.isActive !== false,
    )
    return approvedActive.length > 0 ? approvedActive : operators
  }, [operators])

  const filteredOperators = useMemo(() => {
    if (!operatorSearch.trim()) return eligibleOperators
    const query = operatorSearch.toLowerCase().trim()
    return eligibleOperators.filter(
      (op) =>
        (op.name || '').toLowerCase().includes(query) ||
        (op.email || '').toLowerCase().includes(query),
    )
  }, [eligibleOperators, operatorSearch])

  const selectedOperator = useMemo(
    () => operators.find((o) => o.id === selectedUserId) || null,
    [operators, selectedUserId],
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

  // Prevent accidental navigation when unsaved changes exist
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

  const customOperatorsCount = useMemo(
    () => operators.filter((op) => op.hasCustomOverrides).length,
    [operators],
  )

  // Toggle permission for Default Employee Access
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
        text: 'Default employee access permissions saved successfully.',
      })
    } catch (err) {
      setFeedback({
        tone: 'error',
        text: err?.message || 'Failed to save default employee access.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleRestoreRoleDefaults = async () => {
    if (isSaving) return
    const confirmed = window.confirm(
      'Restore default employee access to the recommended secure baseline?',
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
        text: 'Default employee access restored to recommended baseline.',
      })
    } catch (err) {
      setFeedback({
        tone: 'error',
        text: err?.message || 'Failed to restore default access.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSelectOperator = (operatorId) => {
    if (operatorId === selectedUserId) {
      setMobileStep('detail')
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
      return
    }
    if (hasUnsavedUserChanges) {
      const proceed = window.confirm(
        'You have unsaved changes for this employee. Discard them to switch?',
      )
      if (!proceed) return
    }
    setFeedback(null)
    syncSelectedUserDraft(operators, operatorId)
    setMobileStep('detail')
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
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

  const handleSelectAllProjects = () => {
    setFeedback(null)
    const allCodes = projectsCatalog.map((p) => p.projectId)
    setDraftAssignedProjects(allCodes)
  }

  const handleClearAllProjects = () => {
    setFeedback(null)
    setDraftAssignedProjects([])
  }

  const handleResetUserToBaseline = () => {
    const confirmed = window.confirm(
      'Restore this employee to default employee access? All custom individual overrides and project restrictions will be removed.',
    )
    if (!confirmed) return
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
        text: `Employee access saved for ${selectedOperator.name}.`,
      })
    } catch (err) {
      setFeedback({
        tone: 'error',
        text: err?.message || 'Unable to save employee access.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const toggleAllModules = (expand) => {
    const next = {}
    for (const mod of PERMISSION_MODULE_DEFINITIONS) {
      next[mod.id] = expand
    }
    setExpandedModules(next)
  }

  const filteredProjectsCatalog = useMemo(() => {
    if (!projectSearch.trim()) return projectsCatalog
    const q = projectSearch.toLowerCase().trim()
    return projectsCatalog.filter(
      (p) =>
        (p.projectId || '').toLowerCase().includes(q) ||
        (p.name || '').toLowerCase().includes(q),
    )
  }, [projectsCatalog, projectSearch])

  if (isLoading) {
    return (
      <div className="rbac-route-loading" role="status" aria-live="polite">
        <div className="rbac-route-loading__spinner" aria-hidden="true" />
        <p className="rbac-route-loading__text">
          Loading roles &amp; permissions...
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
            <span>{loadError || 'Permission settings unavailable.'}</span>
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

  return (
    <div className="rbac-page">
      {/* Toast Notification */}
      {feedback ? (
        <Toast
          message={feedback.text}
          tone={feedback.tone}
          onClose={() => setFeedback(null)}
        />
      ) : null}

      {/* Page Header */}
      <header className="rbac-header">
        <div>
          <h1 className="rbac-header__title">Roles &amp; Permissions</h1>
          <p className="rbac-header__subtitle">
            Control what employees can view and manage in the application.
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
              Restore Default Access
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={handleSaveRoleChanges}
              disabled={isSaving || !hasUnsavedRoleChanges}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        ) : null}
      </header>

      {/* Segmented Navigation Tabs */}
      <div className="rbac-tabs" role="tablist" aria-label="Permission views">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'roles'}
          className={`rbac-tab${activeTab === 'roles' ? ' rbac-tab--active' : ''}`}
          onClick={() => {
            if (hasUnsavedUserChanges) {
              const proceed = window.confirm(
                'Discard unsaved changes to employee access?',
              )
              if (!proceed) return
            }
            setActiveTab('roles')
          }}
        >
          <span>Default Employee Access</span>
          {hasUnsavedRoleChanges ? (
            <span className="rbac-tab__dot" title="Unsaved changes" />
          ) : null}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'users'}
          className={`rbac-tab${activeTab === 'users' ? ' rbac-tab--active' : ''}`}
          onClick={() => {
            if (hasUnsavedRoleChanges) {
              const proceed = window.confirm(
                'Discard unsaved changes to default role permissions?',
              )
              if (!proceed) return
            }
            setActiveTab('users')
          }}
        >
          <span>Individual Employee Access</span>
          {customOperatorsCount > 0 ? (
            <span className="rbac-tab__badge">{customOperatorsCount}</span>
          ) : null}
          {hasUnsavedUserChanges ? (
            <span className="rbac-tab__dot" title="Unsaved changes" />
          ) : null}
        </button>
      </div>

      {/* TAB 1: DEFAULT EMPLOYEE ACCESS */}
      {activeTab === 'roles' ? (
        <section className="rbac-roles-section">
          {hasUnsavedRoleChanges ? (
            <div className="rbac-banner rbac-banner--unsaved" role="status">
              <span>You have unsaved changes to default employee access.</span>
              <div className="rbac-banner__actions">
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary admin-btn--sm"
                  onClick={handleDiscardRoleChanges}
                  disabled={isSaving}
                >
                  Discard
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn--primary admin-btn--sm"
                  onClick={handleSaveRoleChanges}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : null}

          <div className="rbac-modules-meta-bar">
            <p className="rbac-modules-meta-text">
              These settings decide what every new employee can do by default.
            </p>
            <div className="rbac-modules-meta-actions">
              <button
                type="button"
                className="rbac-text-action"
                onClick={() => toggleAllModules(true)}
              >
                Expand All
              </button>
              <span className="rbac-dot-separator" aria-hidden="true">
                &bull;
              </span>
              <button
                type="button"
                className="rbac-text-action"
                onClick={() => toggleAllModules(false)}
              >
                Collapse All
              </button>
            </div>
          </div>

          <div className="rbac-module-accordion-list">
            {PERMISSION_MODULE_DEFINITIONS.map((moduleDef) => {
              const isOpen = Boolean(expandedModules[moduleDef.id])
              const totalPerms = moduleDef.permissions.length
              const isAdminOnlyModule = moduleDef.permissions.every(
                (p) => p.adminOnly || ADMIN_RESERVED_PERMISSIONS.has(p.key),
              )
              const enabledCount = moduleDef.permissions.filter((p) =>
                draftRolePerms.includes(p.key),
              ).length

              return (
                <div
                  key={moduleDef.id}
                  className={`rbac-module-card${isOpen ? ' rbac-module-card--open' : ''}`}
                >
                  <button
                    type="button"
                    className="rbac-module-header"
                    aria-expanded={isOpen}
                    onClick={() =>
                      setExpandedModules((prev) => ({
                        ...prev,
                        [moduleDef.id]: !prev[moduleDef.id],
                      }))
                    }
                  >
                    <div className="rbac-module-header__title-area">
                      <span className="rbac-module-header__name">
                        {moduleDef.label}
                      </span>
                      <span className="rbac-module-header__desc">
                        {moduleDef.description}
                      </span>
                    </div>

                    <div className="rbac-module-header__right">
                      {isAdminOnlyModule ? (
                        <span className="rbac-pill rbac-pill--locked">
                          Always enabled for Admin
                        </span>
                      ) : (
                        <span className="rbac-count-pill">
                          {enabledCount} of {totalPerms} enabled
                        </span>
                      )}
                      <span
                        className={`rbac-chevron${isOpen ? ' rbac-chevron--up' : ''}`}
                        aria-hidden="true"
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    </div>
                  </button>

                  {isOpen ? (
                    <div className="rbac-module-body">
                      {moduleDef.permissions.map((perm) => {
                        const isReserved =
                          Boolean(perm.adminOnly) ||
                          ADMIN_RESERVED_PERMISSIONS.has(perm.key)
                        const isEnabled = draftRolePerms.includes(perm.key)
                        const labelText =
                          PERMISSION_LABELS[perm.key] || perm.label

                        return (
                          <div key={perm.key} className="rbac-perm-row">
                            <div className="rbac-perm-info">
                              <span className="rbac-perm-name">{labelText}</span>
                              {perm.description ? (
                                <span className="rbac-perm-sub">
                                  {perm.description}
                                </span>
                              ) : null}
                            </div>

                            <div className="rbac-perm-control">
                              {isReserved ? (
                                <span className="rbac-pill rbac-pill--locked">
                                  Always enabled for Admin
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
                                    aria-label={`${labelText} for default employee access`}
                                  />
                                  <span className="rbac-switch__track">
                                    <span className="rbac-switch__thumb" />
                                  </span>
                                  <span className="rbac-switch__state">
                                    {isEnabled ? 'Allowed' : 'Restricted'}
                                  </span>
                                </label>
                              )}
                            </div>
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
      ) : (
        /* TAB 2: INDIVIDUAL EMPLOYEE ACCESS */
        <section className="rbac-individual-section">
          <div className="rbac-split-container">
            {/* LEFT PANEL: EMPLOYEES LIST (with independent scrollbar on desktop) */}
            <aside
              className={`rbac-panel rbac-panel--employees${
                mobileStep === 'detail' ? ' rbac-panel--hidden-mobile' : ''
              }`}
            >
              <div className="rbac-panel__header">
                <div className="rbac-panel__title-row">
                  <h2 className="rbac-panel__title">Employees</h2>
                  <span className="rbac-badge">{filteredOperators.length}</span>
                </div>
                <div className="rbac-search-wrap">
                  <svg
                    className="rbac-search-icon"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <input
                    type="search"
                    placeholder="Search employees..."
                    value={operatorSearch}
                    onChange={(e) => setOperatorSearch(e.target.value)}
                    className="rbac-search-input"
                    aria-label="Search employees by name or email"
                  />
                </div>
              </div>

              <div
                className="rbac-panel__scroll rbac-panel__scroll--left"
                role="listbox"
                aria-label="Employees list"
              >
                {filteredOperators.length === 0 ? (
                  <div className="rbac-empty-state">
                    <p className="rbac-empty-state__title">
                      No matching employees
                    </p>
                    <p className="rbac-empty-state__text">
                      Try searching with a different name or email.
                    </p>
                  </div>
                ) : (
                  filteredOperators.map((op) => {
                    const isSelected = op.id === selectedUserId
                    const initials = getInitials(op.name)

                    return (
                      <button
                        key={op.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={`rbac-employee-card${
                          isSelected ? ' rbac-employee-card--selected' : ''
                        }`}
                        onClick={() => handleSelectOperator(op.id)}
                      >
                        <div className="rbac-employee-card__avatar">
                          {initials}
                        </div>
                        <div className="rbac-employee-card__content">
                          <div className="rbac-employee-card__top">
                            <span className="rbac-employee-card__name">
                              {op.name}
                            </span>
                            {op.hasCustomOverrides ? (
                              <span className="rbac-pill rbac-pill--grant rbac-pill--xs">
                                Custom
                              </span>
                            ) : null}
                          </div>
                          <span className="rbac-employee-card__email">
                            {op.email}
                          </span>
                          <div className="rbac-employee-card__meta">
                            <span className="rbac-status-dot rbac-status-dot--active" />
                            <span className="rbac-status-text">Active</span>
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </aside>

            {/* RIGHT PANEL: SELECTED EMPLOYEE PERMISSIONS (with independent scrollbar on desktop) */}
            <main
              className={`rbac-panel rbac-panel--permissions${
                mobileStep === 'list' ? ' rbac-panel--hidden-mobile' : ''
              }`}
            >
              {selectedOperator ? (
                <>
                  {/* Pinned Top Bar */}
                  <div className="rbac-panel__header rbac-panel__header--sticky">
                    <div className="rbac-operator-meta-header">
                      {/* Mobile Back Button */}
                      <button
                        type="button"
                        className="rbac-mobile-back-btn"
                        onClick={() => {
                          if (hasUnsavedUserChanges) {
                            const proceed = window.confirm(
                              'Discard unsaved changes to employee access?',
                            )
                            if (!proceed) return
                          }
                          setMobileStep('list')
                          if (typeof window !== 'undefined') {
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }
                        }}
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span>Back to Employees</span>
                      </button>

                      <div className="rbac-operator-profile">
                        <div className="rbac-operator-profile__avatar">
                          {getInitials(selectedOperator.name)}
                        </div>
                        <div className="rbac-operator-profile__info">
                          <div className="rbac-operator-profile__title-row">
                            <h2 className="rbac-operator-profile__name">
                              {selectedOperator.name}
                            </h2>
                            <span className="rbac-status-pill rbac-status-pill--active">
                              Active
                            </span>
                            {hasUnsavedUserChanges ? (
                              <span className="rbac-unsaved-badge">
                                Unsaved Changes
                              </span>
                            ) : null}
                          </div>
                          <p className="rbac-operator-profile__sub">
                            {selectedOperator.email} &bull;{' '}
                            <strong>
                              {draftOperatorEffectivePerms.length}
                            </strong>{' '}
                            of 26 capabilities enabled
                          </p>
                        </div>
                      </div>

                      {/* Desktop Action Buttons */}
                      <div className="rbac-operator-actions-desktop">
                        <button
                          type="button"
                          className="admin-btn admin-btn--secondary admin-btn--sm"
                          onClick={handleResetUserToBaseline}
                          disabled={isSaving}
                        >
                          Restore Default Access
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn--primary admin-btn--sm"
                          onClick={handleSaveUserOverrides}
                          disabled={isSaving || !hasUnsavedUserChanges}
                        >
                          {isSaving ? 'Saving...' : 'Save Employee Access'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Independent Scrolling Permissions Body */}
                  <div className="rbac-panel__scroll rbac-panel__scroll--right">
                    {/* SECTION 1: EMPLOYEE ACCESS SUMMARY */}
                    <section className="rbac-section-card">
                      <div className="rbac-section-card__header">
                        <h3 className="rbac-section-card__title">
                          Employee Access Summary
                        </h3>
                        <p className="rbac-section-card__subtitle">
                          {draftUserGrant.length === 0 &&
                          draftUserRevoke.length === 0
                            ? 'Using default employee role access without individual exceptions.'
                            : `Custom access configured: +${draftUserGrant.length} extra permissions granted, -${draftUserRevoke.length} permissions restricted.`}
                        </p>
                      </div>

                      <div className="rbac-summary-pills-wrap">
                        {PERMISSION_MODULE_DEFINITIONS.filter(
                          (m) =>
                            !m.permissions.every(
                              (p) =>
                                p.adminOnly ||
                                ADMIN_RESERVED_PERMISSIONS.has(p.key),
                            ),
                        ).map((mod) => {
                          const activeInMod = mod.permissions.filter((p) =>
                            draftOperatorEffectivePerms.includes(p.key),
                          )
                          const restrictedInMod = mod.permissions.filter((p) =>
                            draftUserRevoke.includes(p.key),
                          )

                          if (
                            activeInMod.length === 0 &&
                            restrictedInMod.length === 0
                          ) {
                            return null
                          }

                          return (
                            <div key={mod.id} className="rbac-summary-group">
                              <span className="rbac-summary-group__label">
                                {mod.label}:
                              </span>
                              <div className="rbac-summary-group__chips">
                                {activeInMod.map((p) => {
                                  const isCustomGrant =
                                    draftUserGrant.includes(p.key)
                                  const label =
                                    PERMISSION_LABELS[p.key] || p.label
                                  return (
                                    <span
                                      key={p.key}
                                      className={`rbac-pill${
                                        isCustomGrant
                                          ? ' rbac-pill--grant'
                                          : ''
                                      }`}
                                    >
                                      {isCustomGrant ? '+ ' : ''}
                                      {label}
                                    </span>
                                  )
                                })}

                                {restrictedInMod.map((p) => {
                                  const label =
                                    PERMISSION_LABELS[p.key] || p.label
                                  return (
                                    <span
                                      key={`rev-${p.key}`}
                                      className="rbac-pill rbac-pill--revoke"
                                    >
                                      &minus; {label} (Restricted)
                                    </span>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </section>

                    {/* SECTION 2: PROJECTS THEY CAN ACCESS */}
                    <section className="rbac-section-card">
                      <div className="rbac-section-card__header">
                        <div className="rbac-section-card__title-row">
                          <div>
                            <h3 className="rbac-section-card__title">
                              Projects They Can Access
                            </h3>
                            <p className="rbac-section-card__subtitle">
                              Choose which projects this employee is allowed to
                              work on.
                            </p>
                          </div>

                          {/* Segmented Mode Selector */}
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
                              All Active Projects
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
                      </div>

                      {projectScopeMode === 'restricted' ? (
                        <div className="rbac-project-scope-box">
                          <div className="rbac-project-scope-toolbar">
                            <div className="rbac-search-wrap rbac-search-wrap--sm">
                              <input
                                type="search"
                                placeholder="Search project name or ID..."
                                value={projectSearch}
                                onChange={(e) =>
                                  setProjectSearch(e.target.value)
                                }
                                className="rbac-search-input rbac-search-input--sm"
                              />
                            </div>

                            <div className="rbac-project-scope-actions">
                              <button
                                type="button"
                                className="rbac-text-action"
                                onClick={handleSelectAllProjects}
                              >
                                Select All
                              </button>
                              <span
                                className="rbac-dot-separator"
                                aria-hidden="true"
                              >
                                &bull;
                              </span>
                              <button
                                type="button"
                                className="rbac-text-action"
                                onClick={handleClearAllProjects}
                              >
                                Clear Selection
                              </button>
                              <span className="rbac-count-pill">
                                {draftAssignedProjects.length} of{' '}
                                {projectsCatalog.length} selected
                              </span>
                            </div>
                          </div>

                          {filteredProjectsCatalog.length === 0 ? (
                            <p className="rbac-empty-state__text">
                              No matching projects found.
                            </p>
                          ) : (
                            <div className="rbac-project-grid">
                              {filteredProjectsCatalog.map((proj) => {
                                const code = proj.projectId
                                const checked =
                                  draftAssignedProjects.includes(code)
                                return (
                                  <label
                                    key={code}
                                    className={`rbac-project-check${
                                      checked
                                        ? ' rbac-project-check--checked'
                                        : ''
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() =>
                                        handleToggleAssignedProject(code)
                                      }
                                    />
                                    <div className="rbac-project-check__text">
                                      <span className="rbac-project-check__code">
                                        {code}
                                      </span>
                                      <span className="rbac-project-check__name">
                                        {proj.name}
                                      </span>
                                    </div>
                                  </label>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="rbac-hint-callout">
                          This employee can view and link vouchers to all active
                          projects permitted by their module permissions.
                        </p>
                      )}
                    </section>

                    {/* SECTION 3: GROUPED INDIVIDUAL MODULE PERMISSIONS */}
                    <section className="rbac-section-card">
                      <div className="rbac-section-card__header">
                        <h3 className="rbac-section-card__title">
                          Module Permissions
                        </h3>
                        <p className="rbac-section-card__subtitle">
                          Choose whether each capability follows the default
                          role, is granted individually, or is explicitly
                          restricted.
                        </p>
                      </div>

                      <div className="rbac-individual-modules-list">
                        {PERMISSION_MODULE_DEFINITIONS.filter(
                          (m) =>
                            !m.permissions.every(
                              (p) =>
                                p.adminOnly ||
                                ADMIN_RESERVED_PERMISSIONS.has(p.key),
                            ),
                        ).map((mod) => (
                          <div
                            key={mod.id}
                            className="rbac-individual-module-block"
                          >
                            <div className="rbac-individual-module-block__header">
                              <span className="rbac-individual-module-block__title">
                                {mod.label}
                              </span>
                              <span className="rbac-individual-module-block__desc">
                                {mod.description}
                              </span>
                            </div>

                            <div className="rbac-individual-module-block__rows">
                              {mod.permissions
                                .filter(
                                  (p) =>
                                    !p.adminOnly &&
                                    !ADMIN_RESERVED_PERMISSIONS.has(p.key),
                                )
                                .map((perm) => {
                                  const isDefaultInRole =
                                    savedRolePerms.includes(perm.key)
                                  const mode = draftUserRevoke.includes(
                                    perm.key,
                                  )
                                    ? 'revoke'
                                    : draftUserGrant.includes(perm.key)
                                      ? 'grant'
                                      : 'inherit'
                                  const friendlyLabel =
                                    PERMISSION_LABELS[perm.key] || perm.label

                                  return (
                                    <div
                                      key={perm.key}
                                      className="rbac-perm-override-row"
                                    >
                                      <div className="rbac-perm-info">
                                        <div className="rbac-perm-title">
                                          <span>{friendlyLabel}</span>
                                          <span
                                            className={`rbac-baseline-tag${
                                              isDefaultInRole
                                                ? ' rbac-baseline-tag--allowed'
                                                : ''
                                            }`}
                                          >
                                            {isDefaultInRole
                                              ? 'Allowed by default'
                                              : 'Off by default'}
                                          </span>
                                        </div>
                                        {perm.description ? (
                                          <span className="rbac-perm-sub">
                                            {perm.description}
                                          </span>
                                        ) : null}
                                      </div>

                                      <div
                                        className="rbac-segmented"
                                        role="group"
                                        aria-label={`Override for ${friendlyLabel}`}
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
                                          &minus; Restrict
                                        </button>
                                      </div>
                                    </div>
                                  )
                                })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>

                  {/* Mobile Sticky Bottom Action Bar when unsaved changes exist */}
                  {hasUnsavedUserChanges ? (
                    <div className="rbac-mobile-sticky-bar">
                      <button
                        type="button"
                        className="admin-btn admin-btn--secondary admin-btn--sm"
                        onClick={handleResetUserToBaseline}
                        disabled={isSaving}
                      >
                        Restore Default Access
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn--primary admin-btn--sm"
                        onClick={handleSaveUserOverrides}
                        disabled={isSaving}
                      >
                        {isSaving ? 'Saving...' : 'Save Employee Access'}
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="rbac-empty-state rbac-empty-state--fill">
                  <p className="rbac-empty-state__title">
                    Select an employee to manage access
                  </p>
                  <p className="rbac-empty-state__text">
                    Choose an employee from the left panel to review or
                    customize their permissions and project assignments.
                  </p>
                </div>
              )}
            </main>
          </div>
        </section>
      )}
    </div>
  )
}
export default RolesPermissionsPage
