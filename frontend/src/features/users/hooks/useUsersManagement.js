import { useListingState } from '../../../services/navigationState'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createManagedUser,
  fetchManagedUsers,
  normalizeUserRecord,
  updateManagedUserStatus,
  updateManagedUser,
} from '../services/userManagementService'

const DEFAULT_PAGE_SIZE = 5
const USER_LISTING_SCHEMA = {
  page: { type: 'number', default: 1, min: 1 },
  search: { type: 'string', default: '' },
  role: { type: 'string', default: 'all' },
  status: { type: 'string', default: 'all' },
  view: { type: 'string', default: '' },
}


export function useUsersManagement({ currentUser }) {
  const [users, setUsers] = useState([])
  const [dataSource, setDataSource] = useState('api')
  const [fallbackReason, setFallbackReason] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedbackBanner, setFeedbackBanner] = useState(null)

  // Search & Filter states synced with URL
  const { values, setValue, resetAll, clampPage } = useListingState(USER_LISTING_SCHEMA, {
    routeKey: 'users',
  })
  const searchQuery = values.search
  const roleFilter = values.role
  const statusFilter = values.status
  const currentPage = values.page

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [viewingUser, setViewingUser] = useState(null)
  const [editingUser, setEditingUser] = useState(null)
  const [statusActionTarget, setStatusActionTarget] = useState(null)
  const [statusActionError, setStatusActionError] = useState('')
  const [isStatusSubmitting, setIsStatusSubmitting] = useState(false)

  const reloadUsers = useCallback(async ({ allowDevFallback = true } = {}) => {
    setIsLoading(true)
    setError('')

    try {
      const result = await fetchManagedUsers({ allowDevFallback })
      setUsers(result.users)
      setDataSource(result.source)
      setFallbackReason(result.fallbackReason)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load users right now. Please try again.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    fetchManagedUsers({ allowDevFallback: true })
      .then((result) => {
        if (!cancelled) {
          setUsers(result.users)
          setDataSource(result.source)
          setFallbackReason(result.fallbackReason)
          setError('')
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load users right now. Please try again.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [currentUser?.id, currentUser?.email])

  const isSelfUser = useCallback(
    (targetUser) => {
      if (!targetUser) {
        return false
      }

      if (currentUser?.id && String(targetUser.id) === String(currentUser.id)) {
        return true
      }

      if (
        currentUser?.email &&
        targetUser.email &&
        targetUser.email.toLowerCase() === currentUser.email.toLowerCase()
      ) {
        return true
      }

      if (!currentUser && dataSource === 'dev-fallback') {
        return targetUser.id === 'dev_preview_01'
      }

      return false
    },
    [currentUser, dataSource],
  )

  const handleSearchChange = (value) => {
    setValue('search', value, { resetPage: true })
  }

  const handleRoleFilterChange = (value) => {
    setValue('role', value, { resetPage: true })
  }

  const handleStatusFilterChange = (value) => {
    setValue('status', value, { resetPage: true })
  }

  const setCurrentPage = (pageNumber) => {
    setValue('page', pageNumber, { push: true })
  }

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    roleFilter !== 'all' ||
    statusFilter !== 'all'

  const resetFilters = () => {
    resetAll()
  }

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const queryDigits = query.replace(/\D/g, '')

    return users.filter((user) => {
      if (roleFilter !== 'all' && user.roleKey !== roleFilter) {
        return false
      }

      if (statusFilter !== 'all' && user.statusKey !== statusFilter) {
        return false
      }

      if (!query) {
        return true
      }

      const nameMatch = user.name.toLowerCase().includes(query)
      const emailMatch = user.email.toLowerCase().includes(query)
      const phoneRawMatch = user.phone.toLowerCase().includes(query)
      const phoneDigitsMatch =
        queryDigits.length >= 3 &&
        user.phone.replace(/\D/g, '').includes(queryDigits)

      return nameMatch || emailMatch || phoneRawMatch || phoneDigitsMatch
    })
  }, [users, searchQuery, roleFilter, statusFilter])

  const totalFiltered = filteredUsers.length
  const totalPages = Math.max(1, Math.ceil(totalFiltered / DEFAULT_PAGE_SIZE))
  const activePage = Math.min(Math.max(1, currentPage), totalPages)

  const paginatedUsers = useMemo(() => {
    const startIndex = (activePage - 1) * DEFAULT_PAGE_SIZE
    return filteredUsers.slice(startIndex, startIndex + DEFAULT_PAGE_SIZE)
  }, [filteredUsers, activePage])

  const rangeStart =
    totalFiltered === 0 ? 0 : (activePage - 1) * DEFAULT_PAGE_SIZE + 1
  const rangeEnd = Math.min(activePage * DEFAULT_PAGE_SIZE, totalFiltered)

  const handleUserCreated = async (formData) => {
    const createdUser = await createManagedUser(formData)

    if (dataSource === 'dev-fallback') {
      await reloadUsers({ allowDevFallback: false })
    } else {
      setUsers((prev) => [createdUser, ...prev])
    }

    setCurrentPage(1)
    setIsAddModalOpen(false)
    setFeedbackBanner({
      tone: 'success',
      text: `Created ${createdUser.roleLabel} account for ${createdUser.name}.`,
    })
  }

  const handleEditUserSubmit = async (updatedFields) => {
    if (!editingUser) {
      return
    }

    if (isSelfUser(editingUser) && updatedFields.roleKey !== editingUser.roleKey) {
      throw new Error('You cannot change the role of your own Admin account.')
    }

    let updatedUser
    if (dataSource === 'api') {
      updatedUser = await updateManagedUser(editingUser.id, updatedFields)
    } else {
      updatedUser = normalizeUserRecord({
        ...editingUser,
        name: updatedFields.name,
        email: updatedFields.email,
        phone: updatedFields.phone,
        role: updatedFields.roleKey,
        isActive: editingUser.isActive,
      })
    }

    setUsers((prev) =>
      prev.map((item) => (item.id === editingUser.id ? updatedUser : item)),
    )

    setEditingUser(null)
    setFeedbackBanner({
      tone: 'success',
      text: `Updated account details for ${updatedUser.name}.${
        dataSource === 'dev-fallback' ? ' (preview mode)' : ''
      }`,
    })
  }

  const requestStatusToggle = (user) => {
    if (!user) {
      return
    }
    if (isSelfUser(user) && user.isActive) {
      return
    }
    setStatusActionError('')
    setStatusActionTarget({
      user,
      nextIsActive: !user.isActive,
    })
  }

  const confirmStatusToggle = async () => {
    if (!statusActionTarget || isStatusSubmitting) {
      return
    }

    const { user, nextIsActive } = statusActionTarget

    if (isSelfUser(user) && !nextIsActive) {
      setStatusActionError('You cannot deactivate your own Admin account.')
      return
    }

    try {
      setIsStatusSubmitting(true)
      setStatusActionError('')

      let updatedUser
      if (dataSource === 'api') {
        updatedUser = await updateManagedUserStatus(user.id, nextIsActive)
      } else {
        updatedUser = normalizeUserRecord({
          ...user,
          role: user.roleKey,
          isActive: nextIsActive,
        })
      }

      setUsers((prev) =>
        prev.map((item) => (item.id === user.id ? updatedUser : item)),
      )

      setStatusActionTarget(null)
      setStatusActionError('')
      setFeedbackBanner({
        tone: 'success',
        text: `${updatedUser.name} marked as ${
          nextIsActive ? 'Active' : 'Inactive'
        }.${dataSource === 'dev-fallback' ? ' (preview mode)' : ''}`,
      })
    } catch (err) {
      setStatusActionError(err?.message || 'Failed to update user status.')
    } finally {
      setIsStatusSubmitting(false)
    }
  }

  useEffect(() => {
    if (values.view) {
      const match = users.find((u) => String(u.id) === String(values.view))
      if (match) {
        setViewingUser(match)
      }
    } else {
      setViewingUser(null)
    }
  }, [values.view, users])

  useEffect(() => {
    if (totalPages >= 1 && currentPage > totalPages) {
      clampPage(totalPages)
    }
  }, [totalPages, currentPage, clampPage])

  return {
    users,
    paginatedUsers,
    filteredUsers,
    dataSource,
    fallbackReason,
    isLoading,
    error,
    feedbackBanner,
    clearFeedbackBanner: () => setFeedbackBanner(null),

    // Filters & search
    searchQuery,
    roleFilter,
    statusFilter,
    hasActiveFilters,
    handleSearchChange,
    handleRoleFilterChange,
    handleStatusFilterChange,
    resetFilters,

    // Pagination
    activePage,
    totalPages,
    totalFiltered,
    rangeStart,
    rangeEnd,
    setCurrentPage,

    // Helpers & actions
    isSelfUser,
    reloadUsers,

    // Modals
    isAddModalOpen,
    openAddModal: () => setIsAddModalOpen(true),
    closeAddModal: () => setIsAddModalOpen(false),
    handleUserCreated,

    viewingUser,
    openViewModal: (user) => {
      setViewingUser(user)
      if (user?.id) {
        setValue('view', String(user.id), { push: true })
      }
    },
    closeViewModal: () => {
      setViewingUser(null)
      setValue('view', '', { push: false })
    },

    editingUser,
    openEditModal: (user) => setEditingUser(user),
    closeEditModal: () => setEditingUser(null),
    handleEditUserSubmit,

    statusActionTarget,
    statusActionError,
    isStatusSubmitting,
    requestStatusToggle,
    confirmStatusToggle,
    closeStatusModal: () => {
      setStatusActionTarget(null)
      setStatusActionError('')
    },
  }
}
