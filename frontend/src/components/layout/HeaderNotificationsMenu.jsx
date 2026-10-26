import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useApprovalsContext } from '../../features/approvals/context/ApprovalsContext'
import { formatApprovalDate } from '../../features/approvals/services/approvalService'
import { UserAvatar } from '../../features/users/components/UserAvatar'
import { NotificationBellIcon } from './SidebarIcons'

export function HeaderNotificationsMenu({
  pathname,
  onNavigate,
}) {
  const {
    notifications,
    pendingCount,
    isLoading,
    isRefreshing,
    error,
    integrationStatus,
    refreshApprovals,
    focusApprovalRequest,
  } = useApprovalsContext()

  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const popoverRef = useRef(null)
  const popoverId = useId()
  const headingId = useId()

  const closePopover = useCallback((restoreFocus = false) => {
    setIsOpen(false)
    if (restoreFocus) {
      requestAnimationFrame(() => {
        triggerRef.current?.focus()
      })
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closePopover(true)
        return
      }

      if (
        !popoverRef.current ||
        !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)
      ) {
        return
      }

      const focusables = Array.from(
        popoverRef.current.querySelectorAll(
          '[data-notif-focusable="true"]:not([disabled])',
        ),
      )

      if (focusables.length === 0) {
        return
      }

      event.preventDefault()
      const currentIndex = focusables.indexOf(document.activeElement)

      if (event.key === 'Home') {
        focusables[0]?.focus()
      } else if (event.key === 'End') {
        focusables[focusables.length - 1]?.focus()
      } else if (event.key === 'ArrowDown') {
        const nextIndex =
          currentIndex < 0 ? 0 : (currentIndex + 1) % focusables.length
        focusables[nextIndex]?.focus()
      } else if (event.key === 'ArrowUp') {
        const prevIndex =
          currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1
        focusables[prevIndex]?.focus()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, closePopover])

  const handleToggle = () => {
    const nextOpen = !isOpen
    setIsOpen(nextOpen)
    if (nextOpen && !isLoading && !isRefreshing) {
      refreshApprovals({ silent: true })
    }
  }

  const handleSelectNotification = (item) => {
    setIsOpen(false)
    if (item?.requestId) {
      focusApprovalRequest(item.requestId)
    }
    onNavigate?.('/user-approvals')
  }

  const handleViewAllClick = (event) => {
    if (
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      event.preventDefault()
      setIsOpen(false)
      onNavigate?.('/user-approvals')
    }
  }

  const badgeText = pendingCount > 99 ? '99+' : String(pendingCount)
  const triggerLabel =
    pendingCount > 0
      ? `Signup approval notifications, ${pendingCount} pending`
      : 'Signup approval notifications'

  return (
    <div
      ref={containerRef}
      className="header-notifications"
      data-pathname={pathname}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`header-notifications__trigger${isOpen ? ' header-notifications__trigger--active' : ''
          }`}
        onClick={handleToggle}
        aria-label={triggerLabel}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls={isOpen ? popoverId : undefined}
      >
        <NotificationBellIcon className="header-notifications__bell-icon" />
        {pendingCount > 0 ? (
          <span className="header-notifications__badge" aria-hidden="true">
            {badgeText}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          id={popoverId}
          ref={popoverRef}
          className="header-notifications__popover"
          role="dialog"
          aria-labelledby={headingId}
        >
          <div className="header-notifications__header">
            <div className="header-notifications__title-wrap">
              <h2 id={headingId} className="header-notifications__title">
                Signup Approvals
              </h2>
              {pendingCount > 0 ? (
                <span className="header-notifications__count-pill">
                  {pendingCount} pending
                </span>
              ) : null}
            </div>

            <button
              type="button"
              className="header-notifications__refresh-btn"
              onClick={() => refreshApprovals({ silent: false })}
              disabled={isLoading || isRefreshing}
              aria-label="Refresh notifications"
              title="Refresh notifications"
              data-notif-focusable="true"
            >
              <svg
                className={
                  isLoading || isRefreshing
                    ? 'header-notifications__spin'
                    : ''
                }
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M16.5 10A6.5 6.5 0 1 1 14.6 5.4L16.5 7.25V3.25"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <div className="header-notifications__body">
            {isLoading ? (
              <div
                className="header-notifications__skeleton-list"
                role="status"
                aria-label="Loading signup approval notifications"
              >
                {[0, 1, 2].map((index) => (
                  <div key={index} className="header-notifications__skeleton">
                    <span className="header-notifications__skeleton-avatar" />
                    <div className="header-notifications__skeleton-lines">
                      <span className="header-notifications__skeleton-line header-notifications__skeleton-line--primary" />
                      <span className="header-notifications__skeleton-line header-notifications__skeleton-line--secondary" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="header-notifications__state" role="alert">
                <p className="header-notifications__state-title">
                  Unable to load notifications
                </p>
                <p className="header-notifications__state-desc">{error}</p>
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary header-notifications__state-btn"
                  onClick={() => refreshApprovals({ silent: false })}
                  data-notif-focusable="true"
                >
                  Retry
                </button>
              </div>
            ) : integrationStatus === 'unauthenticated' ? (
              <div className="header-notifications__state">
                <p className="header-notifications__state-title">
                  Admin sign-in required
                </p>
                <p className="header-notifications__state-desc">
                  Sign in with an Administrator account to view live Data Entry
                  signup requests.
                </p>
                <button
                  type="button"
                  className="admin-btn admin-btn--primary header-notifications__state-btn"
                  onClick={() => {
                    setIsOpen(false)
                    onNavigate?.('/login')
                  }}
                  data-notif-focusable="true"
                >
                  Go to Sign In
                </button>
              </div>
            ) : integrationStatus === 'missing_backend_api' ? (
              <div className="header-notifications__state">
                <p className="header-notifications__state-title">
                  Approval API not yet configured
                </p>
                <p className="header-notifications__state-desc">
                  Backend signup approval &amp; notification endpoints are not
                  yet available in this workspace. Pending requests will appear
                  here automatically once connected.
                </p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="header-notifications__state">
                <p className="header-notifications__state-title">
                  No pending signup requests
                </p>
                <p className="header-notifications__state-desc">
                  All Data Entry signup requests have been reviewed.
                </p>
              </div>
            ) : (
              <ul className="header-notifications__list">
                {notifications.map((item) => {
                  const formattedDate = item.createdAt
                    ? formatApprovalDate(item.createdAt)
                    : ''
                  const hasValidDate = formattedDate && formattedDate !== '—'

                  return (
                    <li
                      key={item.id}
                      className="header-notifications__list-item"
                    >
                      <button
                        type="button"
                        className="header-notifications__item-btn"
                        onClick={() => handleSelectNotification(item)}
                        data-notif-focusable="true"
                      >
                        <UserAvatar
                          name={item.applicantName}
                          image={item.image}
                          size="sm"
                        />
                        <span className="header-notifications__item-content">
                          <span className="header-notifications__item-top">
                            <span className="header-notifications__item-name">
                              {item.applicantName}
                            </span>
                            {hasValidDate ? (
                              <span className="header-notifications__item-date">
                                {formattedDate}
                              </span>
                            ) : null}
                          </span>
                          <span className="header-notifications__item-msg">
                            {item.message}
                          </span>
                        </span>
                        <span
                          className="header-notifications__unread-dot"
                          aria-hidden="true"
                        />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="header-notifications__footer">
            <a
              href="/user-approvals"
              className="header-notifications__view-all"
              onClick={handleViewAllClick}
              data-notif-focusable="true"
            >
              <span>View all approval requests</span>
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M6 3.5L10.5 8L6 12.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>
        </div>
      ) : null}
    </div>
  )
}
