import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildChangedMaterialPayload,
  buildCreateMaterialPayload,
  createRawMaterial,
  fetchRawMaterialById,
  fetchRawMaterials,
  hasActiveAuthToken,
  isAdminUser,
  updateRawMaterial,
  updateRawMaterialStatus,
} from '../services/rawMaterialService'

const DEFAULT_PAGE_SIZE = 10

export function useRawMaterialsManagement({ currentUser }) {
  const adminAccess = isAdminUser(currentUser)
  const initialHasToken = hasActiveAuthToken()

  const [materials, setMaterials] = useState([])
  const [totalMaterials, setTotalMaterials] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)

  const [summaryCounts, setSummaryCounts] = useState({
    total: 0,
    active: 0,
    inactive: null,
  })

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const effectiveStatusFilter = adminAccess ? statusFilter : 'active'

  const [isLoading, setIsLoading] = useState(initialHasToken)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [authRequired, setAuthRequired] = useState(!initialHasToken)
  const [error, setError] = useState('')
  const [feedbackBanner, setFeedbackBanner] = useState(null)

  const [formModalState, setFormModalState] = useState({
    isOpen: false,
    mode: 'create',
    material: null,
    isLoadingRecord: false,
    loadError: '',
    instanceKey: 0,
  })

  const [detailsModalState, setDetailsModalState] = useState({
    isOpen: false,
    materialId: '',
    material: null,
    isLoading: false,
    error: '',
  })

  const [statusConfirmTarget, setStatusConfirmTarget] = useState(null)
  const [statusConfirmError, setStatusConfirmError] = useState('')
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  const [refreshTick, setRefreshTick] = useState(0)
  const requestSeqRef = useRef(0)
  const detailSeqRef = useRef(0)
  const editSeqRef = useRef(0)
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
        setIsRefreshing(false)
        setMaterials([])
        setTotalMaterials(0)
        setSummaryCounts({ total: 0, active: 0, inactive: null })
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

        if (adminAccess) {
          const [listRes, allRes, activeRes, inactiveRes] = await Promise.all([
            fetchRawMaterials({
              page: currentPage,
              limit: DEFAULT_PAGE_SIZE,
              search: debouncedSearch,
              category: categoryFilter,
              status: effectiveStatusFilter,
              isAdmin: true,
            }),
            fetchRawMaterials({
              page: 1,
              limit: 1,
              status: 'all',
              isAdmin: true,
            }),
            fetchRawMaterials({
              page: 1,
              limit: 1,
              status: 'active',
              isAdmin: true,
            }),
            fetchRawMaterials({
              page: 1,
              limit: 1,
              status: 'inactive',
              isAdmin: true,
            }),
          ])

          if (cancelled || requestSeqRef.current !== currentSeq) {
            return
          }

          hasLoadedOnceRef.current = true
          setMaterials(listRes.materials)
          setTotalMaterials(listRes.total)
          setTotalPages(listRes.totalPages)
          if (currentPage > listRes.totalPages && listRes.totalPages >= 1) {
            setCurrentPage(listRes.totalPages)
          }

          setSummaryCounts({
            total: allRes.total,
            active: activeRes.total,
            inactive: inactiveRes.total,
          })
        } else {
          const [listRes, activeTotalRes] = await Promise.all([
            fetchRawMaterials({
              page: currentPage,
              limit: DEFAULT_PAGE_SIZE,
              search: debouncedSearch,
              category: categoryFilter,
              status: 'active',
              isAdmin: false,
            }),
            fetchRawMaterials({
              page: 1,
              limit: 1,
              status: 'active',
              isAdmin: false,
            }),
          ])

          if (cancelled || requestSeqRef.current !== currentSeq) {
            return
          }

          hasLoadedOnceRef.current = true
          setMaterials(listRes.materials)
          setTotalMaterials(listRes.total)
          setTotalPages(listRes.totalPages)
          if (currentPage > listRes.totalPages && listRes.totalPages >= 1) {
            setCurrentPage(listRes.totalPages)
          }

          setSummaryCounts({
            total: activeTotalRes.total,
            active: activeTotalRes.total,
            inactive: null,
          })
        }
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
              : 'Unable to load raw materials from the server.',
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
    adminAccess,
    currentPage,
    debouncedSearch,
    categoryFilter,
    effectiveStatusFilter,
    refreshTick,
    currentUser,
  ])

  const reloadMaterials = useCallback(() => {
    setRefreshTick((prev) => prev + 1)
  }, [])

  const clearFeedbackBanner = useCallback(() => {
    setFeedbackBanner(null)
  }, [])

  const handleSearchChange = useCallback((value) => {
    setSearchInput(value)
    setCurrentPage(1)
  }, [])

  const handleCategoryFilterChange = useCallback((nextCategory) => {
    setCategoryFilter(nextCategory || 'all')
    setCurrentPage(1)
  }, [])

  const handleStatusFilterChange = useCallback(
    (nextStatus) => {
      if (!adminAccess) {
        return
      }
      setStatusFilter(nextStatus || 'all')
      setCurrentPage(1)
    },
    [adminAccess],
  )

  const handleApplyFilters = useCallback(
    (nextStatus, nextCategory) => {
      if (adminAccess) {
        setStatusFilter(nextStatus || 'all')
      }
      setCategoryFilter(nextCategory || 'all')
      setCurrentPage(1)
    },
    [adminAccess],
  )

  const resetFilters = useCallback(() => {
    setSearchInput('')
    setDebouncedSearch('')
    setCategoryFilter('all')
    setStatusFilter('all')
    setCurrentPage(1)
  }, [])

  const hasActiveFilters = useMemo(() => {
    const hasSearch = Boolean(searchInput.trim())
    const hasCategory = categoryFilter !== 'all'
    const hasStatus = adminAccess && statusFilter !== 'all'
    return hasSearch || hasCategory || hasStatus
  }, [searchInput, categoryFilter, adminAccess, statusFilter])

  const rangeStart =
    totalMaterials === 0 ? 0 : (currentPage - 1) * DEFAULT_PAGE_SIZE + 1
  const rangeEnd = Math.min(currentPage * DEFAULT_PAGE_SIZE, totalMaterials)

  const openCreateModal = useCallback(() => {
    if (!adminAccess) {
      return
    }
    setFormModalState((prev) => ({
      isOpen: true,
      mode: 'create',
      material: null,
      isLoadingRecord: false,
      loadError: '',
      instanceKey: prev.instanceKey + 1,
    }))
  }, [adminAccess])

  const closeFormModal = useCallback(() => {
    editSeqRef.current += 1
    setFormModalState((prev) => ({
      ...prev,
      isOpen: false,
      isLoadingRecord: false,
      loadError: '',
    }))
  }, [])

  const openEditModal = useCallback(
    async (materialSummary) => {
      if (!adminAccess || !materialSummary?.id) {
        return
      }
      const targetId = materialSummary.id
      const seq = editSeqRef.current + 1
      editSeqRef.current = seq

      setFormModalState((prev) => ({
        isOpen: true,
        mode: 'edit',
        material: materialSummary,
        isLoadingRecord: true,
        loadError: '',
        instanceKey: prev.instanceKey + 1,
      }))

      try {
        const freshMaterial = await fetchRawMaterialById(targetId)
        if (editSeqRef.current !== seq) {
          return
        }
        setFormModalState((prev) => ({
          ...prev,
          material: freshMaterial,
          isLoadingRecord: false,
          loadError: '',
          instanceKey: prev.instanceKey + 1,
        }))
      } catch (err) {
        if (editSeqRef.current !== seq) {
          return
        }
        if (err?.status === 401) {
          setFormModalState((prev) => ({ ...prev, isOpen: false }))
          setAuthRequired(true)
          return
        }
        setFormModalState((prev) => ({
          ...prev,
          isLoadingRecord: false,
          loadError:
            err instanceof Error
              ? err.message
              : 'Unable to load the latest material details.',
        }))
      }
    },
    [adminAccess],
  )

  const handleFormSubmit = useCallback(
    async (formValues) => {
      if (formModalState.mode === 'create') {
        const createPayload = buildCreateMaterialPayload(formValues)
        const createdResult = await createRawMaterial(createPayload)
        const finalMaterial = createdResult.material

        setFormModalState((prev) => ({ ...prev, isOpen: false }))
        setCurrentPage(1)
        reloadMaterials()
        setFeedbackBanner({
          tone: 'success',
          text: `Material "${finalMaterial.name}" added successfully.`,
        })
        return finalMaterial
      }

      const targetMaterial = formModalState.material
      if (!targetMaterial?.id) {
        throw new Error('Material ID is missing. Please reopen the edit form.')
      }

      const changedPayload = buildChangedMaterialPayload(
        targetMaterial,
        formValues,
      )

      if (Object.keys(changedPayload).length === 0) {
        const noChangeError = new Error(
          'No changes detected. Update at least one field before saving, or cancel.',
        )
        throw noChangeError
      }

      const updatedResult = await updateRawMaterial(
        targetMaterial.id,
        changedPayload,
      )

      setFormModalState((prev) => ({ ...prev, isOpen: false }))
      reloadMaterials()
      setDetailsModalState((prev) =>
        prev.isOpen && prev.materialId === targetMaterial.id
          ? { ...prev, material: updatedResult.material }
          : prev,
      )
      setFeedbackBanner({
        tone: 'success',
        text: `Material "${updatedResult.material.name}" updated successfully.`,
      })
      return updatedResult.material
    },
    [formModalState.mode, formModalState.material, reloadMaterials],
  )

  const openDetailsModal = useCallback(async (materialOrId) => {
    const targetId =
      typeof materialOrId === 'string'
        ? materialOrId
        : String(materialOrId?.id || '')
    const initialSnapshot =
      typeof materialOrId === 'object' && materialOrId !== null
        ? materialOrId
        : null

    if (!targetId) {
      return
    }

    const seq = detailSeqRef.current + 1
    detailSeqRef.current = seq

    setDetailsModalState({
      isOpen: true,
      materialId: targetId,
      material: initialSnapshot,
      isLoading: true,
      error: '',
    })

    try {
      const freshMaterial = await fetchRawMaterialById(targetId)
      if (detailSeqRef.current !== seq) {
        return
      }
      setDetailsModalState({
        isOpen: true,
        materialId: targetId,
        material: freshMaterial,
        isLoading: false,
        error: '',
      })
    } catch (err) {
      if (detailSeqRef.current !== seq) {
        return
      }
      if (err?.status === 401) {
        setDetailsModalState({
          isOpen: false,
          materialId: '',
          material: null,
          isLoading: false,
          error: '',
        })
        setAuthRequired(true)
        return
      }
      setDetailsModalState({
        isOpen: true,
        materialId: targetId,
        material: null,
        isLoading: false,
        error:
          err instanceof Error
            ? err.message
            : 'Unable to retrieve material details.',
      })
    }
  }, [])

  const closeDetailsModal = useCallback(() => {
    detailSeqRef.current += 1
    setDetailsModalState({
      isOpen: false,
      materialId: '',
      material: null,
      isLoading: false,
      error: '',
    })
  }, [])

  const requestStatusToggle = useCallback(
    (material, nextIsActive) => {
      if (!adminAccess || !material?.id) {
        return
      }
      setStatusConfirmError('')
      setStatusConfirmTarget({
        material,
        nextIsActive: Boolean(nextIsActive),
      })
    },
    [adminAccess],
  )

  const cancelStatusToggle = useCallback(() => {
    if (isUpdatingStatus) {
      return
    }
    setStatusConfirmTarget(null)
    setStatusConfirmError('')
  }, [isUpdatingStatus])

  const confirmStatusToggle = useCallback(async () => {
    if (!statusConfirmTarget?.material?.id || isUpdatingStatus) {
      return
    }

    setIsUpdatingStatus(true)
    setStatusConfirmError('')

    try {
      const { material, nextIsActive } = statusConfirmTarget
      const result = await updateRawMaterialStatus(material.id, nextIsActive)
      setStatusConfirmTarget(null)
      reloadMaterials()
      setDetailsModalState((prev) =>
        prev.isOpen && prev.materialId === material.id
          ? { ...prev, material: result.material }
          : prev,
      )
      setFeedbackBanner({
        tone: 'success',
        text: nextIsActive
          ? `Material "${result.material.name}" activated.`
          : `Material "${result.material.name}" deactivated.`,
      })
    } catch (err) {
      if (err?.status === 401) {
        setStatusConfirmTarget(null)
        setAuthRequired(true)
        return
      }
      setStatusConfirmError(
        err instanceof Error
          ? err.message
          : 'Unable to update material status.',
      )
    } finally {
      setIsUpdatingStatus(false)
    }
  }, [statusConfirmTarget, isUpdatingStatus, reloadMaterials])

  return {
    adminAccess,
    materials,
    totalMaterials,
    totalPages,
    currentPage,
    rangeStart,
    rangeEnd,
    setCurrentPage,

    summaryCounts,

    searchInput,
    categoryFilter,
    statusFilter: effectiveStatusFilter,
    hasActiveFilters,
    handleSearchChange,
    handleCategoryFilterChange,
    handleStatusFilterChange,
    handleApplyFilters,
    resetFilters,

    isLoading,
    isRefreshing,
    authRequired,
    error,
    reloadMaterials,

    feedbackBanner,
    clearFeedbackBanner,

    formModalState,
    openCreateModal,
    openEditModal,
    closeFormModal,
    handleFormSubmit,

    detailsModalState,
    openDetailsModal,
    closeDetailsModal,

    statusConfirmTarget,
    statusConfirmError,
    isUpdatingStatus,
    requestStatusToggle,
    cancelStatusToggle,
    confirmStatusToggle,
  }
}
