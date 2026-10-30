import { ConfirmMaterialStatusModal } from '../components/ConfirmMaterialStatusModal'
import { RawMaterialDetailsModal } from '../components/RawMaterialDetailsModal'
import { RawMaterialFormModal } from '../components/RawMaterialFormModal'
import { RawMaterialsFiltersBar } from '../components/RawMaterialsFiltersBar'
import { RawMaterialsMobileList } from '../components/RawMaterialsMobileList'
import { RawMaterialsPagination } from '../components/RawMaterialsPagination'
import { RawMaterialsSummaryStrip } from '../components/RawMaterialsSummaryStrip'
import { RawMaterialsTable } from '../components/RawMaterialsTable'
import { useRawMaterialsManagement } from '../hooks/useRawMaterialsManagement'
import '../styles/raw-materials.css'

export function RawMaterialsPage({ currentUser, onNavigate }) {
  const {
    adminAccess,
    canCreateMaterial,
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
    statusFilter,
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
  } = useRawMaterialsManagement({ currentUser })

  return (
    <div className="rm-page">
      <header className="rm-header">
        <div className="rm-header__text">
          <h1 className="rm-header__title">Raw Materials</h1>
          <p className="rm-header__subtitle">
            Manage materials used across sofa and curtain manufacturing
            projects.
          </p>
        </div>

        {!authRequired && canCreateMaterial ? (
          <div className="rm-header__actions">
            <button
              type="button"
              className="admin-btn admin-btn--primary rm-add-btn"
              onClick={openCreateModal}
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M10 4.25V15.75M4.25 10H15.75"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
              <span>Add Material</span>
            </button>
          </div>
        ) : null}
      </header>

      {feedbackBanner ? (
        <div
          className={`rm-feedback rm-feedback--${feedbackBanner.tone}`}
          role="status"
        >
          <span>{feedbackBanner.text}</span>
          <button
            type="button"
            className="rm-feedback__dismiss"
            onClick={clearFeedbackBanner}
            aria-label="Dismiss notification"
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M5.5 5.5L14.5 14.5M14.5 5.5L5.5 14.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      ) : null}

      {authRequired ? (
        <section className="rm-surface">
          <div className="rm-state">
            <div className="rm-state__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <rect
                  x="4"
                  y="11"
                  width="16"
                  height="9"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M8 11V7.5C8 5.29 9.79 3.5 12 3.5C14.21 3.5 16 5.29 16 7.5V11"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h2 className="rm-state__title">Sign in required</h2>
            <p className="rm-state__message">
              Please sign in with an approved Administrator or Data Entry
              account to view raw materials.
            </p>
            <div className="rm-state__actions">
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={() => onNavigate?.('/login')}
              >
                Go to Sign In
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          <RawMaterialsSummaryStrip
            summaryCounts={summaryCounts}
            activeStatusFilter={statusFilter}
            adminAccess={adminAccess}
            onSelectStatus={handleStatusFilterChange}
          />

          <section
            className={`rm-surface${
              isRefreshing ? ' rm-surface--refreshing' : ''
            }`}
            aria-label="Raw materials directory"
          >
            <RawMaterialsFiltersBar
              adminAccess={adminAccess}
              searchQuery={searchInput}
              categoryFilter={categoryFilter}
              statusFilter={statusFilter}
              hasActiveFilters={hasActiveFilters}
              totalMatching={totalMaterials}
              onSearchChange={handleSearchChange}
              onCategoryFilterChange={handleCategoryFilterChange}
              onStatusFilterChange={handleStatusFilterChange}
              onApplyFilters={handleApplyFilters}
              onResetFilters={resetFilters}
            />

            {isLoading ? (
              <div
                className="rm-loading"
                role="status"
                aria-live="polite"
                aria-busy="true"
              >
                <span className="sr-only">Loading raw materials...</span>
                {[1, 2, 3, 4].map((row) => (
                  <div key={row} className="rm-skeleton-row" aria-hidden="true">
                    <div className="rm-skeleton-lines">
                      <div className="rm-skeleton-line rm-skeleton-line--title" />
                      <div className="rm-skeleton-line rm-skeleton-line--sub" />
                    </div>
                    <div className="rm-skeleton-pill" />
                    <div className="rm-skeleton-pill" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="rm-state" role="alert">
                <div
                  className="rm-state__icon rm-state__icon--error"
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 24 24" fill="none">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M12 7.5V12.5M12 16H12.01"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <h2 className="rm-state__title">
                  Unable to load raw materials
                </h2>
                <p className="rm-state__message">{error}</p>
                <div className="rm-state__actions">
                  <button
                    type="button"
                    className="admin-btn admin-btn--secondary"
                    onClick={reloadMaterials}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : materials.length === 0 ? (
              <div className="rm-state">
                <div className="rm-state__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 3.5L20 7.75L12 12L4 7.75L12 3.5Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 12L12 16.25L20 12M4 16.25L12 20.5L20 16.25"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h2 className="rm-state__title">
                  {hasActiveFilters
                    ? 'No matching raw materials'
                    : 'No raw materials recorded yet'}
                </h2>
                <p className="rm-state__message">
                  {hasActiveFilters
                    ? 'Adjust your search query or filters to find matching catalog items.'
                    : adminAccess
                      ? 'Add upholstery fabrics, timber, foam, hardware, and curtain materials used across manufacturing projects.'
                      : 'Active raw materials added by an Administrator will appear here for purchase voucher selection.'}
                </p>
                <div className="rm-state__actions">
                  {hasActiveFilters ? (
                    <button
                      type="button"
                      className="admin-btn admin-btn--secondary"
                      onClick={resetFilters}
                    >
                      Reset Filters
                    </button>
                  ) : canCreateMaterial ? (
                    <button
                      type="button"
                      className="admin-btn admin-btn--primary"
                      onClick={openCreateModal}
                    >
                      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path
                          d="M10 4.25V15.75M4.25 10H15.75"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span>Add Material</span>
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <>
                <RawMaterialsTable
                  materials={materials}
                  adminAccess={adminAccess}
                  onViewDetails={openDetailsModal}
                  onEdit={openEditModal}
                  onToggleStatus={requestStatusToggle}
                />

                <RawMaterialsMobileList
                  materials={materials}
                  adminAccess={adminAccess}
                  onViewDetails={openDetailsModal}
                  onEdit={openEditModal}
                  onToggleStatus={requestStatusToggle}
                />

                <RawMaterialsPagination
                  activePage={currentPage}
                  totalPages={totalPages}
                  totalMatching={totalMaterials}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  onPageChange={setCurrentPage}
                />
              </>
            )}
          </section>
        </>
      )}

      <RawMaterialFormModal
        key={formModalState.instanceKey}
        isOpen={formModalState.isOpen}
        mode={formModalState.mode}
        material={formModalState.material}
        isLoadingRecord={formModalState.isLoadingRecord}
        loadError={formModalState.loadError}
        onClose={closeFormModal}
        onSubmit={handleFormSubmit}
      />

      <RawMaterialDetailsModal
        isOpen={detailsModalState.isOpen}
        material={detailsModalState.material}
        isLoading={detailsModalState.isLoading}
        error={detailsModalState.error}
        adminAccess={adminAccess}
        onClose={closeDetailsModal}
        onRetry={() => {
          if (detailsModalState.materialId) {
            openDetailsModal(detailsModalState.materialId)
          }
        }}
        onEdit={openEditModal}
        onToggleStatus={requestStatusToggle}
      />

      <ConfirmMaterialStatusModal
        target={statusConfirmTarget}
        errorMessage={statusConfirmError}
        isSubmitting={isUpdatingStatus}
        onConfirm={confirmStatusToggle}
        onCancel={cancelStatusToggle}
      />
    </div>
  )
}
