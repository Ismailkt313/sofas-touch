import { AddUserModal } from '../components/AddUserModal'
import { ConfirmUserStatusModal } from '../components/ConfirmUserStatusModal'
import { EditUserModal } from '../components/EditUserModal'
import { UserDetailsModal } from '../components/UserDetailsModal'
import { UserFiltersBar } from '../components/UserFiltersBar'
import { UsersMobileList } from '../components/UsersMobileList'
import { UsersPagination } from '../components/UsersPagination'
import { UsersTable } from '../components/UsersTable'
import { useUsersManagement } from '../hooks/useUsersManagement'
import '../styles/users.css'

export function UserManagementPage({ currentUser, onNavigate }) {
  const {
    users,
    paginatedUsers,
    filteredUsers,
    dataSource,
    fallbackReason,
    isLoading,
    error,
    feedbackBanner,
    clearFeedbackBanner,

    searchQuery,
    roleFilter,
    statusFilter,
    hasActiveFilters,
    handleSearchChange,
    handleRoleFilterChange,
    handleStatusFilterChange,
    resetFilters,

    activePage,
    totalPages,
    totalFiltered,
    rangeStart,
    rangeEnd,
    setCurrentPage,

    isSelfUser,
    reloadUsers,

    isAddModalOpen,
    openAddModal,
    closeAddModal,
    handleUserCreated,

    viewingUser,
    openViewModal,
    closeViewModal,

    editingUser,
    openEditModal,
    closeEditModal,
    handleEditUserSubmit,

    statusActionTarget,
    statusActionError,
    isStatusSubmitting,
    requestStatusToggle,
    confirmStatusToggle,
    closeStatusModal,
  } = useUsersManagement({ currentUser })

  return (
    <div className="users-page">
      <header className="users-header">
        <div className="users-header__text">
          <h1 className="users-header__title">User Management</h1>
          <p className="users-header__subtitle">
            Manage user accounts, roles, and access.
          </p>
        </div>

        <div className="users-header__actions">
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={openAddModal}
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M10 4.25V15.75M4.25 10H15.75"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
            <span>Add User</span>
          </button>
        </div>
      </header>

      {dataSource === 'dev-fallback' && !error ? (
        <div className="users-dev-banner" role="status">
          <div className="users-dev-banner__content">
            <span className="users-dev-banner__tag">Dev Preview</span>
            <p className="users-dev-banner__text">{fallbackReason}</p>
          </div>
          <div className="users-dev-banner__actions">
            {!currentUser ? (
              <button
                type="button"
                className="users-dev-banner__btn users-dev-banner__btn--primary"
                onClick={() => onNavigate?.('/login')}
              >
                Sign in
              </button>
            ) : null}
            <button
              type="button"
              className="users-dev-banner__btn"
              onClick={() => reloadUsers({ allowDevFallback: false })}
            >
              Retry live API
            </button>
          </div>
        </div>
      ) : null}

      {feedbackBanner ? (
        <div
          className={`users-feedback users-feedback--${feedbackBanner.tone}`}
          role="status"
        >
          <span>{feedbackBanner.text}</span>
          <button
            type="button"
            className="users-feedback__dismiss"
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

      <section className="users-surface" aria-label="Users directory">
        {!error && (isLoading || users.length > 0) ? (
          <UserFiltersBar
            searchQuery={searchQuery}
            roleFilter={roleFilter}
            statusFilter={statusFilter}
            hasActiveFilters={hasActiveFilters}
            totalFiltered={totalFiltered}
            onSearchChange={handleSearchChange}
            onRoleFilterChange={handleRoleFilterChange}
            onStatusFilterChange={handleStatusFilterChange}
            onResetFilters={resetFilters}
          />
        ) : null}

        {isLoading ? (
          <div
            className="users-loading"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <span className="sr-only">Loading user accounts...</span>
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="users-skeleton-row" aria-hidden="true">
                <div className="users-skeleton-avatar" />
                <div className="users-skeleton-lines">
                  <div className="users-skeleton-line users-skeleton-line--title" />
                  <div className="users-skeleton-line users-skeleton-line--sub" />
                </div>
                <div className="users-skeleton-pill" />
                <div className="users-skeleton-pill" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="users-state" role="alert">
            <div className="users-state__icon users-state__icon--error" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                <path
                  d="M12 7.5V12.5M12 16H12.01"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h2 className="users-state__title">Unable to load users</h2>
            <p className="users-state__message">{error}</p>
            <div className="users-state__actions">
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={() => reloadUsers({ allowDevFallback: false })}
              >
                Retry
              </button>
              {!currentUser ? (
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary"
                  onClick={() => onNavigate?.('/login')}
                >
                  Go to Sign In
                </button>
              ) : null}
              {import.meta.env.DEV ? (
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary"
                  onClick={() => reloadUsers({ allowDevFallback: true })}
                >
                  Load Dev Preview
                </button>
              ) : null}
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="users-state">
            <div className="users-state__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="9.5" cy="8.5" r="3.25" stroke="currentColor" strokeWidth="1.6" />
                <path
                  d="M4 18.5C4.6 15.6 6.8 14 9.5 14C12.2 14 14.4 15.6 15 18.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M18 8V13M15.5 10.5H20.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h2 className="users-state__title">No user accounts yet</h2>
            <p className="users-state__message">
              Add your first team member to grant Admin or Data Entry access to
              Soft Touch Sofas.
            </p>
            <div className="users-state__actions">
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={openAddModal}
              >
                Add User
              </button>
            </div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="users-state">
            <div className="users-state__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.6" />
                <path
                  d="M15.5 15.5L20 20"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h2 className="users-state__title">No matching users found</h2>
            <p className="users-state__message">
              No accounts matched your current search or filter criteria. Try a
              different keyword or reset the filters.
            </p>
            <div className="users-state__actions">
              <button
                type="button"
                className="admin-btn admin-btn--secondary"
                onClick={resetFilters}
              >
                Reset filters
              </button>
            </div>
          </div>
        ) : (
          <>
            <UsersTable
              users={paginatedUsers}
              isSelfUser={isSelfUser}
              onView={openViewModal}
              onEdit={openEditModal}
              onToggleStatus={requestStatusToggle}
            />

            <UsersMobileList
              users={paginatedUsers}
              isSelfUser={isSelfUser}
              onView={openViewModal}
              onEdit={openEditModal}
              onToggleStatus={requestStatusToggle}
            />

            <UsersPagination
              activePage={activePage}
              totalPages={totalPages}
              totalFiltered={totalFiltered}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </section>

      {isAddModalOpen ? (
        <AddUserModal
          isOpen={isAddModalOpen}
          onClose={closeAddModal}
          onSubmit={handleUserCreated}
        />
      ) : null}

      <UserDetailsModal
        user={viewingUser}
        isSelf={viewingUser ? isSelfUser(viewingUser) : false}
        onClose={closeViewModal}
        onEdit={openEditModal}
      />

      {editingUser ? (
        <EditUserModal
          key={editingUser.id}
          user={editingUser}
          isSelf={isSelfUser(editingUser)}
          dataSource={dataSource}
          onClose={closeEditModal}
          onSubmit={handleEditUserSubmit}
        />
      ) : null}

      <ConfirmUserStatusModal
        target={statusActionTarget}
        errorMessage={statusActionError}
        isSubmitting={isStatusSubmitting}
        onConfirm={confirmStatusToggle}
        onCancel={closeStatusModal}
      />
    </div>
  )
}
 