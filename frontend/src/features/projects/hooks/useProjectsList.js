import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { hasPermission } from '../../permissions/constants/permissionsCatalog'
import {
  createProject,
  fetchProjectActivityWarnings,
  fetchProjectCostAlerts,
  fetchProjects,
  hasActiveAuthToken,
  isAdminUser,
  triggerActivityWarningsEvaluation,
  updateProject,
  updateProjectStatus,
} from '../services/projectService'

const DEFAULT_PAGE_SIZE = 10

export function useProjectsList({ currentUser }) {
  const adminAccess = isAdminUser(currentUser)
  const canCreateProject = hasPermission(currentUser, 'projects.create')
  const canEditProject = hasPermission(currentUser, 'projects.edit')
  const canViewProfitability = hasPermission(
    currentUser,
    'reports.viewProfitability',
  )
  const initialHasToken = hasActiveAuthToken()

  const [projects, setProjects] = useState([])
  const [totalProjects, setTotalProjects] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)

  const [statusCounts, setStatusCounts] = useState({
    all: 0,
    inProgress: 0,
    underReview: 0,
    completed: 0,
  })

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const [isLoading, setIsLoading] = useState(initialHasToken)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [authRequired, setAuthRequired] = useState(!initialHasToken)
  const [error, setError] = useState('')

  const [automationState, setAutomationState] = useState(() => ({
    status: !initialHasToken
      ? 'unauthenticated'
      : adminAccess
        ? 'loading'
        : 'admin_only',
    costAlerts: [],
    activityWarnings: [],
    inactivityThresholdDays: 14,
    schedulerConfigured: false,
    errorMessage: '',
  }))
  const [isEvaluatingInactivity, setIsEvaluatingInactivity] = useState(false)

  const [feedbackBanner, setFeedbackBanner] = useState(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [updatingStatusKey, setUpdatingStatusKey] = useState('')

  const [refreshTick, setRefreshTick] = useState(0)
  const requestSeqRef = useRef(0)
  const hasLoadedOnceRef = useRef(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, 240)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    const hasToken = hasActiveAuthToken()
    if (!hasToken) {
      const resetTimer = window.setTimeout(() => {
        setAuthRequired(true)
        setIsLoading(false)
        setProjects([])
        setTotalProjects(0)
        setAutomationState((prev) => ({
          ...prev,
          status: 'unauthenticated',
          costAlerts: [],
          activityWarnings: [],
        }))
      }, 0)
      return () => window.clearTimeout(resetTimer)
    }

    let cancelled = false
    const currentSeq = requestSeqRef.current + 1
    requestSeqRef.current = currentSeq

    Promise.resolve()
      .then(async () => {
        if (cancelled) {
          return
        }
        setAuthRequired(false)
        setError('')
        if (!hasLoadedOnceRef.current) {
          setIsLoading(true)
        } else {
          setIsRefreshing(true)
        }

        const [
          listResult,
          allTotalRes,
          inProgressRes,
          underReviewRes,
          completedRes,
        ] = await Promise.all([
          fetchProjects({
            page: currentPage,
            limit: DEFAULT_PAGE_SIZE,
            search: debouncedSearch,
            status: statusFilter,
            category: categoryFilter,
          }),
          fetchProjects({ page: 1, limit: 1 }),
          fetchProjects({ page: 1, limit: 1, status: 'In Progress' }),
          fetchProjects({ page: 1, limit: 1, status: 'Under Review' }),
          fetchProjects({ page: 1, limit: 1, status: 'Completed' }),
        ])

        if (cancelled || requestSeqRef.current !== currentSeq) {
          return
        }

        hasLoadedOnceRef.current = true
        setProjects(listResult.projects)
        setTotalProjects(listResult.total)
        setTotalPages(listResult.totalPages)
        if (currentPage > listResult.totalPages && listResult.totalPages >= 1) {
          setCurrentPage(listResult.totalPages)
        }

        setStatusCounts({
          all: allTotalRes.total,
          inProgress: inProgressRes.total,
          underReview: underReviewRes.total,
          completed: completedRes.total,
        })
      })
      .catch((err) => {
        if (cancelled || requestSeqRef.current !== currentSeq) {
          return
        }
        if (err?.status === 401) {
          setAuthRequired(true)
          setError('')
        } else {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load projects from the server.',
          )
        }
      })
      .finally(() => {
        if (!cancelled && requestSeqRef.current === currentSeq) {
          setIsLoading(false)
          setIsRefreshing(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    currentPage,
    debouncedSearch,
    statusFilter,
    categoryFilter,
    refreshTick,
    currentUser,
  ])

  useEffect(() => {
    const hasToken = hasActiveAuthToken()
    if (!hasToken) {
      return undefined
    }

    let cancelled = false

    if (!adminAccess) {
      const timer = window.setTimeout(() => {
        if (!cancelled) {
          setAutomationState({
            status: 'admin_only',
            costAlerts: [],
            activityWarnings: [],
            inactivityThresholdDays: 14,
            schedulerConfigured: false,
            errorMessage: '',
          })
        }
      }, 0)
      return () => {
        cancelled = true
        window.clearTimeout(timer)
      }
    }

    Promise.resolve()
      .then(async () => {
        if (cancelled) {
          return
        }
        setAutomationState((prev) => ({
          ...prev,
          status: prev.status === 'ready' ? 'ready' : 'loading',
          errorMessage: '',
        }))

        const [alertsOutcome, warningsOutcome] = await Promise.allSettled([
          fetchProjectCostAlerts({ page: 1, limit: 50, status: 'active' }),
          fetchProjectActivityWarnings({
            page: 1,
            limit: 50,
            status: 'active',
            evaluate: true,
          }),
        ])

        if (cancelled) {
          return
        }

        const alertsOk = alertsOutcome.status === 'fulfilled'
        const warningsOk = warningsOutcome.status === 'fulfilled'

        if (!alertsOk && !warningsOk) {
          const reason = alertsOutcome.reason || warningsOutcome.reason
          setAutomationState({
            status: reason?.status === 403 ? 'admin_only' : 'unavailable',
            costAlerts: [],
            activityWarnings: [],
            inactivityThresholdDays: 14,
            schedulerConfigured: false,
            errorMessage:
              reason instanceof Error
                ? reason.message
                : 'Automation alert feeds are currently unavailable.',
          })
          return
        }

        setAutomationState({
          status: 'ready',
          costAlerts: alertsOk ? alertsOutcome.value.alerts : [],
          activityWarnings: warningsOk ? warningsOutcome.value.warnings : [],
          inactivityThresholdDays: warningsOk
            ? warningsOutcome.value.inactivityThresholdDays
            : 14,
          schedulerConfigured: warningsOk
            ? warningsOutcome.value.schedulerConfigured
            : false,
          errorMessage: '',
        })
      })

    return () => {
      cancelled = true
    }
  }, [adminAccess, refreshTick])

  const hasActiveFilters = Boolean(
    searchInput.trim() || statusFilter !== 'all' || categoryFilter !== 'all',
  )

  const handleSearchChange = useCallback((value) => {
    setSearchInput(value)
    setCurrentPage(1)
  }, [])

  const handleStatusFilterChange = useCallback((value) => {
    setStatusFilter(value)
    setCurrentPage(1)
  }, [])

  const handleCategoryFilterChange = useCallback((value) => {
    setCategoryFilter(value)
    setCurrentPage(1)
  }, [])

  const handleApplyFilters = useCallback((nextStatus, nextCategory) => {
    setStatusFilter(nextStatus || 'all')
    setCategoryFilter(nextCategory || 'all')
    setCurrentPage(1)
  }, [])

  const resetFilters = useCallback(() => {
    setSearchInput('')
    setDebouncedSearch('')
    setStatusFilter('all')
    setCategoryFilter('all')
    setCurrentPage(1)
  }, [])

  const reloadProjects = useCallback(() => {
    setRefreshTick((prev) => prev + 1)
  }, [])

  const openCreateModal = useCallback(() => {
    setIsCreateModalOpen(true)
  }, [])

  const closeCreateModal = useCallback(() => {
    setIsCreateModalOpen(false)
  }, [])

  const openEditModal = useCallback((project) => {
    setEditingProject(project)
  }, [])

  const closeEditModal = useCallback(() => {
    setEditingProject(null)
  }, [])

  const clearFeedbackBanner = useCallback(() => {
    setFeedbackBanner(null)
  }, [])

  const handleCreateSubmit = useCallback(async (formValues) => {
    const created = await createProject(formValues)
    setIsCreateModalOpen(false)
    setCurrentPage(1)
    setFeedbackBanner({
      tone: 'success',
      text: `Project ${created.projectId} ("${created.name}") was created successfully.`,
      projectId: created.projectId || created.id,
    })
    setRefreshTick((prev) => prev + 1)
    return created
  }, [])

  const handleEditSubmit = useCallback(async (projectIdentifier, formValues) => {
    const updated = await updateProject(projectIdentifier, formValues)
    setEditingProject(null)
    setFeedbackBanner({
      tone: 'success',
      text: `Project ${updated.projectId} ("${updated.name}") was updated successfully.`,
      projectId: updated.projectId || updated.id,
    })
    setRefreshTick((prev) => prev + 1)
    return updated
  }, [])

  const handleStatusSubmit = useCallback(
    async (projectIdentifier, nextStatus) => {
      const normalizedTarget = String(projectIdentifier || '').trim()
      if (!normalizedTarget) {
        return null
      }

      const previousItem = projects.find(
        (item) =>
          String(item.projectId || '').toUpperCase() ===
            normalizedTarget.toUpperCase() ||
          String(item.id || '') === normalizedTarget,
      )
      const oldStatus = previousItem?.status

      setUpdatingStatusKey(normalizedTarget)
      try {
        const updated = await updateProjectStatus(normalizedTarget, nextStatus)
        const targetCode = (updated.projectId || normalizedTarget).trim()
        const targetId = updated.id || normalizedTarget

        setProjects((prev) =>
          prev.map((item) => {
            const isMatch =
              (targetCode &&
                String(item.projectId).toUpperCase() ===
                  targetCode.toUpperCase()) ||
              (targetId && String(item.id) === String(targetId))
            if (!isMatch) {
              return item
            }
            return {
              ...item,
              status: updated.status,
            }
          }),
        )

        setStatusCounts((prev) => {
          const newStatus = updated.status
          if (!oldStatus || oldStatus === newStatus) {
            return prev
          }
          const next = { ...prev }
          if (oldStatus === 'In Progress' && next.inProgress > 0)
            next.inProgress -= 1
          if (oldStatus === 'Under Review' && next.underReview > 0)
            next.underReview -= 1
          if (oldStatus === 'Completed' && next.completed > 0)
            next.completed -= 1

          if (newStatus === 'In Progress') next.inProgress += 1
          if (newStatus === 'Under Review') next.underReview += 1
          if (newStatus === 'Completed') next.completed += 1
          return next
        })

        const filterExcludes =
          statusFilter !== 'all' && statusFilter !== updated.status
        setFeedbackBanner({
          tone: 'success',
          text: filterExcludes
            ? `Project ${targetCode} status updated to "${updated.status}" (moved out of the "${statusFilter}" filter).`
            : `Project ${targetCode} status updated to "${updated.status}".`,
          projectId: targetCode || targetId,
        })

        setRefreshTick((prev) => prev + 1)
        return updated
      } catch (err) {
        setFeedbackBanner({
          tone: 'error',
          text:
            err instanceof Error
              ? err.message
              : 'Failed to update project status. Please try again.',
        })
        throw err
      } finally {
        setUpdatingStatusKey('')
      }
    },
    [projects, statusFilter],
  )

  const handleRunInactivityEvaluation = useCallback(async () => {
    if (!adminAccess || isEvaluatingInactivity) {
      return
    }
    setIsEvaluatingInactivity(true)
    try {
      const result = await triggerActivityWarningsEvaluation()
      setAutomationState((prev) => ({
        ...prev,
        status: 'ready',
        activityWarnings: result.warnings,
        inactivityThresholdDays: result.inactivityThresholdDays,
        schedulerConfigured: result.schedulerConfigured,
      }))
      setFeedbackBanner({
        tone: 'info',
        text: `Inactivity check evaluated ${result.evaluatedCount} active project(s). ${result.activeWarningsCount} project(s) currently flagged.`,
      })
    } catch (err) {
      setFeedbackBanner({
        tone: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Unable to run inactivity evaluation.',
      })
    } finally {
      setIsEvaluatingInactivity(false)
    }
  }, [adminAccess, isEvaluatingInactivity])

  const activeWarningByProjectCode = useMemo(() => {
    const map = new Map()
    for (const warning of automationState.activityWarnings) {
      if (warning.status === 'active' && warning.projectId) {
        map.set(warning.projectId.toUpperCase(), warning)
      }
    }
    return map
  }, [automationState.activityWarnings])

  const rangeStart =
    totalProjects === 0 ? 0 : (currentPage - 1) * DEFAULT_PAGE_SIZE + 1
  const rangeEnd = Math.min(currentPage * DEFAULT_PAGE_SIZE, totalProjects)

  return {
    projects,
    totalProjects,
    totalPages,
    currentPage,
    pageSize: DEFAULT_PAGE_SIZE,
    rangeStart,
    rangeEnd,
    setCurrentPage,

    statusCounts,
    adminAccess,
    canCreateProject,
    canEditProject,
    canViewProfitability,

    searchInput,
    statusFilter,
    categoryFilter,
    hasActiveFilters,
    handleSearchChange,
    handleStatusFilterChange,
    handleCategoryFilterChange,
    handleApplyFilters,
    resetFilters,

    isLoading,
    isRefreshing,
    authRequired,
    error,
    reloadProjects,

    automationState,
    activeWarningByProjectCode,
    isEvaluatingInactivity,
    handleRunInactivityEvaluation,

    feedbackBanner,
    clearFeedbackBanner,

    isCreateModalOpen,
    openCreateModal,
    closeCreateModal,
    handleCreateSubmit,

    editingProject,
    openEditModal,
    closeEditModal,
    handleEditSubmit,

    updatingStatusKey,
    handleStatusSubmit,
  }
}
