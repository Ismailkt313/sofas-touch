import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createManagedUser,
  fetchManagedUsers,
  normalizeUserRecord,
} from '../services/userManagementService'

const DEFAULT_PAGE_SIZE = 5

export function useUsersManagement({ currentUser }) {
  const [users, setUsers] = useState([])
  const [dataSource, setDataSource] = useState('api')
  const [fallbackReason, setFallbackReason] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedbackBanner, setFeedbackBanner] = useState(null)

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [viewingUser, setViewingUser] = useState(null)
  const [editingUser, setEditingUser] = useState(null)
  const [statusActionTarget, setStatusActionTarget] = useState(null)
  const [statusActionError, setStatusActionError] = useState('')

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
    setSearchQuery(value)
    setCurrentPage(1)
  }

  const handleRoleFilterChange = (value) => {
    setRoleFilter(value)
    setCurrentPage(1)
  }

  const handleStatusFilterChange = (value) => {
    setStatusFilter(value)
    setCurrentPage(1)
  }

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    roleFilter !== 'all' ||
    statusFilter !== 'all'

  const resetFilters = () => {
    setSearchQuery('')
    setRoleFilter('all')
    setStatusFilter('all')
    setCurrentPage(1)
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

    if (dataSource === 'api') {
      throw new Error(
        'User update endpoint (PATCH /api/admin/users/:id) is not yet implemented on the backend. Changes were not saved to the server.',
      )
    }

    setUsers((prev) =>
      prev.map((item) => {
        if (item.id !== editingUser.id) {
          return item
        }
        return normalizeUserRecord({
          ...item,
          name: updatedFields.name,
          email: updatedFields.email,
          phone: updatedFields.phone,
          role: updatedFields.roleKey,
          isActive: item.isActive,
        })
      }),
    )

    setEditingUser(null)
    setFeedbackBanner({
      tone: 'info',
      text: `Updated ${updatedFields.name} in development preview only (backend PATCH /api/admin/users/:id pending).`,
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

  const confirmStatusToggle = () => {
    if (!statusActionTarget) {
      return
    }

    const { user, nextIsActive } = statusActionTarget

    if (isSelfUser(user) && !nextIsActive) {
      setStatusActionError('You cannot deactivate your own Admin account.')
      return
    }

    if (dataSource === 'api') {
      setStatusActionError(
        'User status endpoint (PATCH /api/admin/users/:id) is not yet implemented on the backend. No changes were applied.',
      )
      return
    }

    setUsers((prev) =>
      prev.map((item) =>
        item.id === user.id
          ? normalizeUserRecord({
              ...item,
              role: item.roleKey,
              isActive: nextIsActive,
            })
          : item,
      ),
    )

    setStatusActionTarget(null)
    setStatusActionError('')
    setFeedbackBanner({
      tone: 'info',
      text: `${user.name} marked as ${
        nextIsActive ? 'Active' : 'Inactive'
      } in development preview only (backend PATCH endpoint pending).`,
    })
  }

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
    openViewModal: (user) => setViewingUser(user),
    closeViewModal: () => setViewingUser(null),

    editingUser,
    openEditModal: (user) => setEditingUser(user),
    closeEditModal: () => setEditingUser(null),
    handleEditUserSubmit,

    statusActionTarget,
    statusActionError,
    requestStatusToggle,
    confirmStatusToggle,
    closeStatusModal: () => {
      setStatusActionTarget(null)
      setStatusActionError('')
    },
  }
}
