import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchProjects } from '../../projects'
import { CancelExpenseModal } from '../components/CancelExpenseModal'
import { ExpenseCategoriesModal } from '../components/ExpenseCategoriesModal'
import { ExpenseFormModal } from '../components/ExpenseFormModal'
import { ExpenseReceiptModal } from '../components/ExpenseReceiptModal'
import { ExpensesFiltersBar } from '../components/ExpensesFiltersBar'
import { ExpensesMobileList } from '../components/ExpensesMobileList'
import { ExpensesPagination } from '../components/ExpensesPagination'
import { ExpensesSummaryStrip } from '../components/ExpensesSummaryStrip'
import { ExpensesTable } from '../components/ExpensesTable'
import {
  cancelExpense,
  createExpense,
  createExpenseCategory,
  fetchExpenseCategories,
  fetchExpenses,
  hasActiveAuthToken,
  isAdminUser,
  updateExpense,
  updateExpenseCategory,
} from '../services/expenseService'
import '../styles/expenses.css'

const PAGE_LIMIT = 10

export function ExpensesPage({ currentUser, onNavigate }) {
  const adminAccess = isAdminUser(currentUser)
  const [authRequired, setAuthRequired] = useState(() => !hasActiveAuthToken())

  const [expenses, setExpenses] = useState([])
  const [totalExpenses, setTotalExpenses] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [summary, setSummary] = useState({
    activeCount: 0,
    cancelledCount: 0,
    activeTotalAmount: 0,
    projectLinkedCount: 0,
    projectLinkedTotalAmount: 0,
    generalExpenseCount: 0,
    generalTotalAmount: 0,
    withReceiptCount: 0,
  })

  const [categories, setCategories] = useState([])
  const [projects, setProjects] = useState([])

  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const [reloadTick, setReloadTick] = useState(0)
  const hasLoadedOnceRef = useRef(false)

  const [formModalState, setFormModalState] = useState(null)
  const [isSavingExpense, setIsSavingExpense] = useState(false)
  const [formServerError, setFormServerError] = useState('')

  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false)

  const [cancelTarget, setCancelTarget] = useState(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

  const [receiptModalState, setReceiptModalState] = useState(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch((prev) => {
        const next = searchInput.trim()
        if (prev !== next) {
          setCurrentPage(1)
        }
        return next
      })
    }, 260)

    return () => window.clearTimeout(timer)
  }, [searchInput])

  const loadReferenceData = useCallback(() => {
    if (!hasActiveAuthToken()) {
      return undefined
    }
    let cancelled = false

    Promise.all([
      fetchExpenseCategories({ includeInactive: adminAccess }),
      fetchProjects({ page: 1, limit: 100 }).catch(() => ({ projects: [] })),
    ])
      .then(([cats, projResult]) => {
        if (cancelled) return
        setCategories(cats)
        setProjects(projResult.projects || [])
      })
      .catch(() => {
        void 0
      })

    return () => {
      cancelled = true
    }
  }, [adminAccess])

  useEffect(() => {
    return loadReferenceData()
  }, [loadReferenceData])

  useEffect(() => {
    if (!hasActiveAuthToken()) {
      return undefined
    }

    let cancelled = false

    fetchExpenses({
      page: currentPage,
      limit: PAGE_LIMIT,
      search: appliedSearch,
      categoryId: categoryFilter,
      projectId: projectFilter,
      fromDate,
      toDate,
      status: statusFilter,
    })
      .then((result) => {
        if (cancelled) return
        hasLoadedOnceRef.current = true
        setAuthRequired(false)
        setExpenses(result.expenses)
        setTotalExpenses(result.total)
        setTotalPages(result.totalPages)
        setSummary(result.summary)
        setError('')
        setIsLoading(false)
        setIsRefreshing(false)
      })
      .catch((err) => {
        if (cancelled) return
        if (err?.status === 401) {
          setAuthRequired(true)
        } else {
          setError(err?.message || 'Unable to load expense records.')
        }
        setIsLoading(false)
        setIsRefreshing(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    currentPage,
    appliedSearch,
    categoryFilter,
    projectFilter,
    fromDate,
    toDate,
    statusFilter,
    reloadTick,
  ])

  const markRefreshing = useCallback(() => {
    if (hasLoadedOnceRef.current) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
  }, [])

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      appliedSearch ||
        categoryFilter !== 'all' ||
        projectFilter !== 'all' ||
        fromDate ||
        toDate ||
        statusFilter !== 'active',
    )
  }, [
    appliedSearch,
    categoryFilter,
    projectFilter,
    fromDate,
    toDate,
    statusFilter,
  ])

  const handleCategoryFilterChange = useCallback(
    (val) => {
      markRefreshing()
      setCategoryFilter(val)
      setCurrentPage(1)
    },
    [markRefreshing],
  )

  const handleProjectFilterChange = useCallback(
    (val) => {
      markRefreshing()
      setProjectFilter(val)
      setCurrentPage(1)
    },
    [markRefreshing],
  )

  const handleFromDateChange = useCallback(
    (val) => {
      markRefreshing()
      setFromDate(val)
      setCurrentPage(1)
    },
    [markRefreshing],
  )

  const handleToDateChange = useCallback(
    (val) => {
      markRefreshing()
      setToDate(val)
      setCurrentPage(1)
    },
    [markRefreshing],
  )

  const handleStatusFilterChange = useCallback(
    (val) => {
      markRefreshing()
      setStatusFilter(val)
      setCurrentPage(1)
    },
    [markRefreshing],
  )

  const handleResetFilters = useCallback(() => {
    markRefreshing()
    setSearchInput('')
    setAppliedSearch('')
    setCategoryFilter('all')
    setProjectFilter('all')
    setFromDate('')
    setToDate('')
    setStatusFilter('active')
    setCurrentPage(1)
  }, [markRefreshing])

  const handleOpenCreateModal = () => {
    setFormServerError('')
    setFormModalState({
      key: `create-${Date.now()}`,
      mode: 'create',
      expense: null,
    })
  }

  const handleOpenViewModal = (expense) => {
    setFormServerError('')
    setFormModalState({
      key: `view-${expense.id}`,
      mode: 'view',
      expense,
    })
  }

  const handleOpenEditModal = (expense) => {
    setFormServerError('')
    setFormModalState({
      key: `edit-${expense.id}-${expense.updatedAt || ''}`,
      mode: 'edit',
      expense,
    })
  }

  const handleSaveExpense = async (payload, receiptFiles) => {
    if (!formModalState) return
    setIsSavingExpense(true)
    setFormServerError('')

    try {
      const isEdit = formModalState.mode === 'edit' && formModalState.expense
      const saved = isEdit
        ? await updateExpense(formModalState.expense.id, payload, receiptFiles)
        : await createExpense(payload, receiptFiles)

      if (payload.newCategoryName) {
        const refreshedCats = await fetchExpenseCategories({
          includeInactive: adminAccess,
        }).catch(() => null)
        if (refreshedCats) {
          setCategories(refreshedCats)
        }
      }

      setFormModalState(null)
      setToastMessage(
        isEdit
          ? `${saved.voucherNumber} updated successfully.`
          : `${saved.voucherNumber} recorded successfully.`,
      )
      markRefreshing()
      setReloadTick((t) => t + 1)
    } catch (err) {
      setFormServerError(err?.message || 'Unable to save expense record.')
    } finally {
      setIsSavingExpense(false)
    }
  }

  const handleCreateCategoryFromManager = async (payload) => {
    const created = await createExpenseCategory(payload)
    const refreshed = await fetchExpenseCategories({
      includeInactive: adminAccess,
    })
    setCategories(refreshed)
    setToastMessage(`Category '${created.name}' added.`)
    return created
  }

  const handleUpdateCategoryFromManager = async (categoryId, payload) => {
    const updated = await updateExpenseCategory(categoryId, payload)
    const refreshed = await fetchExpenseCategories({
      includeInactive: adminAccess,
    })
    setCategories(refreshed)
    if (payload.name) {
      markRefreshing()
      setReloadTick((t) => t + 1)
    }
    return updated
  }

  const handleConfirmCancelExpense = async (reason) => {
    if (!cancelTarget) return
    setIsCancelling(true)
    setCancelError('')

    try {
      const cancelled = await cancelExpense(cancelTarget.id, reason)
      setCancelTarget(null)
      if (formModalState?.expense?.id === cancelled.id) {
        setFormModalState(null)
      }
      setToastMessage(`${cancelled.voucherNumber} has been voided.`)
      markRefreshing()
      setReloadTick((t) => t + 1)
    } catch (err) {
      setCancelError(err?.message || 'Unable to void expense.')
    } finally {
      setIsCancelling(false)
    }
  }

  const handlePreviewSavedReceipt = (expense, index = 0) => {
    if (!expense?.attachments?.length) return
    setReceiptModalState({
      key: `saved-${expense.id}-${index}-${Date.now()}`,
      title: `${expense.voucherNumber} — Receipt`,
      attachments: expense.attachments,
      initialIndex: index,
      localPreview: null,
    })
  }

  const handlePreviewLocalReceipt = (localItem) => {
    if (!localItem?.blobUrl) return
    setReceiptModalState({
      key: `local-${localItem.blobUrl}`,
      title: 'Receipt Preview (Unsaved)',
      attachments: [],
      initialIndex: 0,
      localPreview: localItem,
    })
  }

  const handleNavigateProject = (projectRecordId) => {
    if (!projectRecordId || !onNavigate) return
    onNavigate(`/projects/${encodeURIComponent(projectRecordId)}`)
  }

  if (authRequired) {
    return (
      <div className="exp-page">
        <div className="exp-surface exp-empty-state">
          <h2 className="exp-empty-state__title">Sign In Required</h2>
          <p className="exp-empty-state__text">
            Please sign in with an authorized Soft Touch Sofas account to view
            or record workshop and project expenses.
          </p>
          <button
            type="button"
            className="exp-btn exp-btn--primary"
            onClick={() => onNavigate?.('/login')}
          >
            Go to Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="exp-page">
      <header className="exp-header">
        <div>
          <h1 className="exp-header__title">Expenses</h1>
          <p className="exp-header__subtitle">
            Record workshop, delivery, labour, installation, and project
            expenses in one place.
          </p>
        </div>

        <div className="exp-header__actions">
          {adminAccess ? (
            <button
              type="button"
              className="exp-btn exp-btn--secondary"
              onClick={() => setIsCategoriesModalOpen(true)}
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M3.5 5.5h13M3.5 10h13M3.5 14.5h8.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
              Categories ({categories.length})
            </button>
          ) : null}

          <button
            type="button"
            className="exp-btn exp-btn--primary"
            onClick={handleOpenCreateModal}
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M10 4.25v11.5M4.25 10h11.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            Record Expense
          </button>
        </div>
      </header>

      <ExpensesSummaryStrip
        summary={summary}
        projectFilter={projectFilter}
        statusFilter={statusFilter}
        onSelectProjectFilter={handleProjectFilterChange}
        onSelectStatusFilter={handleStatusFilterChange}
      />

      {toastMessage ? (
        <div className="exp-banner exp-banner--success" role="status">
          <span>{toastMessage}</span>
          <button
            type="button"
            className="exp-banner__dismiss"
            onClick={() => setToastMessage('')}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="exp-banner exp-banner--error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="exp-banner__dismiss"
            onClick={() => {
              markRefreshing()
              setReloadTick((t) => t + 1)
            }}
          >
            Retry
          </button>
        </div>
      ) : null}

      <ExpensesFiltersBar
        searchQuery={searchInput}
        categoryFilter={categoryFilter}
        projectFilter={projectFilter}
        fromDate={fromDate}
        toDate={toDate}
        statusFilter={statusFilter}
        categories={categories}
        projects={projects}
        hasActiveFilters={hasActiveFilters}
        totalMatching={totalExpenses}
        onSearchChange={setSearchInput}
        onCategoryFilterChange={handleCategoryFilterChange}
        onProjectFilterChange={handleProjectFilterChange}
        onFromDateChange={handleFromDateChange}
        onToDateChange={handleToDateChange}
        onStatusFilterChange={handleStatusFilterChange}
        onApplySearch={() => {
          const next = searchInput.trim()
          if (next !== appliedSearch) {
            markRefreshing()
            setAppliedSearch(next)
            setCurrentPage(1)
          }
        }}
        onResetFilters={handleResetFilters}
      />

      <section
        className={`exp-surface ${
          isRefreshing ? 'exp-surface--refreshing' : ''
        }`}
      >
        {isLoading ? (
          <div className="exp-empty-state">
            <p className="exp-empty-state__text">Loading expense records…</p>
          </div>
        ) : expenses.length === 0 ? (
          <div className="exp-empty-state">
            <h2 className="exp-empty-state__title">
              {hasActiveFilters
                ? 'No matching expenses found'
                : 'No expenses recorded yet'}
            </h2>
            <p className="exp-empty-state__text">
              {hasActiveFilters
                ? 'Try adjusting or clearing your filters to view other expense vouchers.'
                : 'Record transportation, labour, installation, repair, or miscellaneous workshop expenses here.'}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
              {hasActiveFilters ? (
                <button
                  type="button"
                  className="exp-btn exp-btn--secondary"
                  onClick={handleResetFilters}
                >
                  Reset Filters
                </button>
              ) : null}
              <button
                type="button"
                className="exp-btn exp-btn--primary"
                onClick={handleOpenCreateModal}
              >
                Record Expense
              </button>
            </div>
          </div>
        ) : (
          <>
            <ExpensesTable
              expenses={expenses}
              isAdmin={adminAccess}
              onViewExpense={handleOpenViewModal}
              onEditExpense={handleOpenEditModal}
              onCancelExpense={(exp) => {
                setCancelError('')
                setCancelTarget(exp)
              }}
              onPreviewReceipt={handlePreviewSavedReceipt}
              onViewProject={handleNavigateProject}
            />

            <ExpensesMobileList
              expenses={expenses}
              isAdmin={adminAccess}
              onViewExpense={handleOpenViewModal}
              onEditExpense={handleOpenEditModal}
              onCancelExpense={(exp) => {
                setCancelError('')
                setCancelTarget(exp)
              }}
              onPreviewReceipt={handlePreviewSavedReceipt}
              onViewProject={handleNavigateProject}
            />

            <ExpensesPagination
              page={currentPage}
              totalPages={totalPages}
              totalItems={totalExpenses}
              limit={PAGE_LIMIT}
              onPageChange={(nextPage) => {
                markRefreshing()
                setCurrentPage(nextPage)
              }}
            />
          </>
        )}
      </section>

      {formModalState ? (
        <ExpenseFormModal
          key={formModalState.key}
          mode={formModalState.mode}
          expense={formModalState.expense}
          categories={categories}
          projects={projects}
          isAdmin={adminAccess}
          isSubmitting={isSavingExpense}
          serverError={formServerError}
          onSave={handleSaveExpense}
          onSwitchToEdit={() => {
            if (formModalState.expense) {
              handleOpenEditModal(formModalState.expense)
            }
          }}
          onRequestCancelExpense={(exp) => {
            setCancelError('')
            setCancelTarget(exp)
          }}
          onPreviewSavedReceipt={handlePreviewSavedReceipt}
          onPreviewLocalReceipt={handlePreviewLocalReceipt}
          onClose={() => {
            if (!isSavingExpense) {
              setFormModalState(null)
              setFormServerError('')
            }
          }}
        />
      ) : null}

      {isCategoriesModalOpen && adminAccess ? (
        <ExpenseCategoriesModal
          categories={categories}
          onCreateCategory={handleCreateCategoryFromManager}
          onUpdateCategory={handleUpdateCategoryFromManager}
          onClose={() => setIsCategoriesModalOpen(false)}
        />
      ) : null}

      {cancelTarget ? (
        <CancelExpenseModal
          key={cancelTarget.id}
          expense={cancelTarget}
          isSubmitting={isCancelling}
          error={cancelError}
          onConfirm={handleConfirmCancelExpense}
          onClose={() => {
            if (!isCancelling) {
              setCancelTarget(null)
              setCancelError('')
            }
          }}
        />
      ) : null}

      {receiptModalState ? (
        <ExpenseReceiptModal
          key={receiptModalState.key}
          title={receiptModalState.title}
          attachments={receiptModalState.attachments}
          initialIndex={receiptModalState.initialIndex}
          localPreview={receiptModalState.localPreview}
          onClose={() => setReceiptModalState(null)}
        />
      ) : null}
    </div>
  )
}
