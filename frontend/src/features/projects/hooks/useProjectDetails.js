import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchProjectActivityWarnings,
  fetchProjectById,
  fetchProjectFinancialSummary,
  fetchSingleProjectCostAlerts,
  hasActiveAuthToken,
  isAdminUser,
  recalculateProjectFinancials,
  updateProject,
  updateProjectStatus,
} from '../services/projectService'

export function useProjectDetails({ projectIdentifier, currentUser }) {
  const adminAccess = isAdminUser(currentUser)
  const initialHasToken = hasActiveAuthToken()

  const [project, setProject] = useState(null)
  const [financialSummary, setFinancialSummary] = useState(null)
  const [summaryUnavailableMessage, setSummaryUnavailableMessage] = useState('')

  const [automationFeed, setAutomationFeed] = useState(() => ({
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

  const [isLoading, setIsLoading] = useState(initialHasToken)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isRecalculating, setIsRecalculating] = useState(false)
  const [authRequired, setAuthRequired] = useState(!initialHasToken)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [feedbackBanner, setFeedbackBanner] = useState(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const reqSeqRef = useRef(0)
  const loadedIdentifierRef = useRef('')

  useEffect(() => {
    const hasToken = hasActiveAuthToken()
    if (!hasToken) {
      const timer = window.setTimeout(() => {
        setAuthRequired(true)
        setIsLoading(false)
      }, 0)
      return () => window.clearTimeout(timer)
    }

    if (!projectIdentifier) {
      return undefined
    }

    let cancelled = false
    const seq = reqSeqRef.current + 1
    reqSeqRef.current = seq

    Promise.resolve()
      .then(async () => {
        if (cancelled) {
          return
        }
        setAuthRequired(false)
        setNotFound(false)
        setError('')
        setSummaryUnavailableMessage('')

        if (loadedIdentifierRef.current !== projectIdentifier) {
          setIsLoading(true)
        } else {
          setIsRefreshing(true)
        }

        const [projectOutcome, summaryOutcome] = await Promise.allSettled([
          fetchProjectById(projectIdentifier),
          fetchProjectFinancialSummary(projectIdentifier),
        ])

        if (cancelled || reqSeqRef.current !== seq) {
          return
        }

        if (projectOutcome.status === 'rejected') {
          const reason = projectOutcome.reason
          if (reason?.status === 401) {
            setAuthRequired(true)
          } else if (reason?.status === 404) {
            setNotFound(true)
          } else {
            setError(
              reason instanceof Error
                ? reason.message
                : 'Unable to load project details.',
            )
          }
          return
        }

        const loadedProject = projectOutcome.value
        loadedIdentifierRef.current = projectIdentifier
        setProject(loadedProject)

        if (summaryOutcome.status === 'fulfilled') {
          setFinancialSummary(summaryOutcome.value)
          setSummaryUnavailableMessage('')
        } else {
          setFinancialSummary(null)
          setSummaryUnavailableMessage(
            summaryOutcome.reason instanceof Error
              ? summaryOutcome.reason.message
              : 'Financial summary endpoint is currently unavailable.',
          )
        }

        if (!adminAccess) {
          setAutomationFeed({
            status: 'admin_only',
            costAlerts: [],
            activityWarnings: [],
            inactivityThresholdDays: 14,
            schedulerConfigured: false,
            errorMessage: '',
          })
          return
        }

        setAutomationFeed((prev) => ({
          ...prev,
          status: prev.status === 'ready' ? 'ready' : 'loading',
        }))

        const canonicalCode = loadedProject.projectId || projectIdentifier
        const [alertsOutcome, warningsOutcome] = await Promise.allSettled([
          fetchSingleProjectCostAlerts(canonicalCode),
          fetchProjectActivityWarnings({
            page: 1,
            limit: 20,
            projectId: canonicalCode,
            status: 'all',
            evaluate: true,
          }),
        ])

        if (cancelled || reqSeqRef.current !== seq) {
          return
        }

        const alertsOk = alertsOutcome.status === 'fulfilled'
        const warningsOk = warningsOutcome.status === 'fulfilled'

        if (!alertsOk && !warningsOk) {
          const reason = alertsOutcome.reason || warningsOutcome.reason
          setAutomationFeed({
            status: reason?.status === 403 ? 'admin_only' : 'unavailable',
            costAlerts: [],
            activityWarnings: [],
            inactivityThresholdDays: 14,
            schedulerConfigured: false,
            errorMessage:
              reason instanceof Error
                ? reason.message
                : 'Automation alert history could not be loaded.',
          })
          return
        }

        setAutomationFeed({
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
      .finally(() => {
        if (!cancelled && reqSeqRef.current === seq) {
          setIsLoading(false)
          setIsRefreshing(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [projectIdentifier, adminAccess, refreshTick])

  const reloadProjectDetails = useCallback(() => {
    setRefreshTick((prev) => prev + 1)
  }, [])

  const openEditModal = useCallback(() => {
    setIsEditModalOpen(true)
  }, [])

  const closeEditModal = useCallback(() => {
    setIsEditModalOpen(false)
  }, [])

  const clearFeedbackBanner = useCallback(() => {
    setFeedbackBanner(null)
  }, [])

  const handleEditSubmit = useCallback(
    async (_targetId, formValues) => {
      const targetIdentifier =
        project?.projectId || project?.id || projectIdentifier
      const updated = await updateProject(targetIdentifier, formValues)
      setProject(updated)
      setIsEditModalOpen(false)
      setFeedbackBanner({
        tone: 'success',
        text: `Project ${updated.projectId} details updated successfully.`,
      })
      setRefreshTick((prev) => prev + 1)
      return updated
    },
    [project, projectIdentifier],
  )

  const handleStatusSubmit = useCallback(
    async (targetIdentifier, nextStatus) => {
      setIsUpdatingStatus(true)
      try {
        const updated = await updateProjectStatus(targetIdentifier, nextStatus)
        setProject((prev) =>
          prev ? { ...prev, status: updated.status } : updated,
        )
        setFeedbackBanner({
          tone: 'success',
          text: `Project ${updated.projectId || targetIdentifier} status updated to "${updated.status}".`,
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
        setIsUpdatingStatus(false)
      }
    },
    [],
  )

  const handleRecalculateFinancials = useCallback(async () => {
    if (!adminAccess || isRecalculating) {
      return
    }
    const targetIdentifier =
      project?.projectId || project?.id || projectIdentifier
    if (!targetIdentifier) {
      return
    }

    setIsRecalculating(true)
    try {
      const refreshedSummary =
        await recalculateProjectFinancials(targetIdentifier)
      setFinancialSummary(refreshedSummary)
      setSummaryUnavailableMessage('')
      setFeedbackBanner({
        tone: 'info',
        text: `Financial summary for ${refreshedSummary.projectId || targetIdentifier} recalculated from backend records.`,
      })
      setRefreshTick((prev) => prev + 1)
    } catch (err) {
      setFeedbackBanner({
        tone: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Unable to recalculate financial summary.',
      })
    } finally {
      setIsRecalculating(false)
    }
  }, [adminAccess, isRecalculating, project, projectIdentifier])

  return {
    project,
    financialSummary,
    summaryUnavailableMessage,
    automationFeed,
    adminAccess,

    isLoading,
    isRefreshing,
    isRecalculating,
    authRequired,
    notFound,
    error,
    reloadProjectDetails,
    handleRecalculateFinancials,

    isEditModalOpen,
    openEditModal,
    closeEditModal,
    handleEditSubmit,

    isUpdatingStatus,
    handleStatusSubmit,

    feedbackBanner,
    clearFeedbackBanner,
  }
}
