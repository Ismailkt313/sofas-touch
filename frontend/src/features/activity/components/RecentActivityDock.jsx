import { useCallback, useEffect, useRef, useState } from 'react'
import { ACTIVITY_UPDATED_EVENT } from '../../../services/api'
import { fetchRecentActivities } from '../services/activityService'
import { ActivityFeedItem } from './ActivityFeedItem'
import '../styles/recent-activity-dock.css'

function checkIsMobileViewport() {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768
}

export function RecentActivityDock({ pathname, currentUser, onNavigate }) {
  const [isMobile, setIsMobile] = useState(checkIsMobileViewport)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const closeSheetBtnRef = useRef(null)
  const triggerBtnRef = useRef(null)

  const userRole = currentUser?.role === 'admin' ? 'admin' : 'data_entry'
  const isActivityPage = pathname === '/activity'

  const loadRecent = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setErrorMessage('')

    try {
      const result = await fetchRecentActivities(50)
      setActivities(result.items)
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        'Unable to load recent activity right now.'
      setErrorMessage(msg)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    fetchRecentActivities(50)
      .then((result) => {
        if (!active) return
        setActivities(result.items)
        setErrorMessage('')
        setLoading(false)
      })
      .catch((error) => {
        if (!active) return
        setErrorMessage(
          error?.response?.data?.message ||
            'Unable to load recent activity right now.',
        )
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [userRole])

  useEffect(() => {
    const handleMutationBroadcast = () => {
      loadRecent({ silent: true })
    }
    window.addEventListener(ACTIVITY_UPDATED_EVENT, handleMutationBroadcast)
    return () => {
      window.removeEventListener(
        ACTIVITY_UPDATED_EVENT,
        handleMutationBroadcast,
      )
    }
  }, [loadRecent])

  useEffect(() => {
    const handleResize = () => {
      const nextMobile = checkIsMobileViewport()
      setIsMobile((prev) => {
        if (prev !== nextMobile) {
          setIsExpanded(false)
        }
        return nextMobile
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!isMobile || !isExpanded) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeSheetBtnRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsExpanded(false)
        requestAnimationFrame(() => {
          triggerBtnRef.current?.focus()
        })
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMobile, isExpanded])

  if (isActivityPage) {
    return null
  }

  const handleOpenHistoryPage = (event) => {
    event.preventDefault()
    setIsExpanded(false)
    onNavigate?.('/activity')
  }

  const renderPanelContent = () => {
    if (loading) {
      return (
        <div className="sts-activity-dock__state" role="status">
          <div className="sts-activity-dock__skeleton" />
          <div className="sts-activity-dock__skeleton" />
          <div className="sts-activity-dock__skeleton" />
        </div>
      )
    }

    if (errorMessage) {
      return (
        <div className="sts-activity-dock__state sts-activity-dock__state--error">
          <p className="sts-activity-dock__state-text">{errorMessage}</p>
          <button
            type="button"
            className="sts-activity-dock__retry-btn"
            onClick={() => loadRecent({ silent: false })}
          >
            Retry
          </button>
        </div>
      )
    }

    if (activities.length === 0) {
      return (
        <div className="sts-activity-dock__state">
          <p className="sts-activity-dock__state-title">No recorded activity yet</p>
          <p className="sts-activity-dock__state-text">
            Actions across projects, purchases, expenses, and materials will
            appear here automatically.
          </p>
        </div>
      )
    }

    return (
      <ul className="sts-activity-dock__list" aria-label="Latest 50 activities">
        {activities.map((entry) => (
          <ActivityFeedItem
            key={entry.id}
            item={entry}
            userRole={currentUser || userRole}
            compact
            onNavigate={onNavigate}
            onAfterNavigate={() => setIsExpanded(false)}
          />
        ))}
      </ul>
    )
  }

  if (isMobile) {
    return (
      <>
        <div className="sts-activity-mobile-trigger-wrap">
          <button
            ref={triggerBtnRef}
            type="button"
            className="sts-activity-mobile-trigger"
            onClick={() => setIsExpanded(true)}
            aria-expanded={isExpanded}
            aria-controls="sts-recent-activity-sheet"
          >
            <span className="sts-activity-dock__pulse" aria-hidden="true" />
            <span className="sts-activity-mobile-trigger__label">Activity</span>
            {!loading && !errorMessage ? (
              <span className="sts-activity-dock__count">
                {activities.length}
              </span>
            ) : null}
          </button>
        </div>

        {isExpanded ? (
          <div className="sts-activity-sheet-layer">
            <div
              className="sts-activity-sheet-backdrop"
              onClick={() => setIsExpanded(false)}
              aria-hidden="true"
            />
            <section
              id="sts-recent-activity-sheet"
              className="sts-activity-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Recent platform activity"
            >
              <div className="sts-activity-sheet__grabber" aria-hidden="true" />
              <header className="sts-activity-dock__header">
                <div className="sts-activity-dock__title-group">
                  <h2 className="sts-activity-dock__title">Recent Activity</h2>
                  <span className="sts-activity-dock__subtitle">
                    Latest {activities.length || 50} recorded events
                  </span>
                </div>

                <div className="sts-activity-dock__actions">
                  <button
                    type="button"
                    className="sts-activity-dock__icon-btn"
                    onClick={() => loadRecent({ silent: true })}
                    disabled={loading || refreshing}
                    aria-label="Refresh recent activity"
                  >
                    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
                      <path
                        d="M3.5 9A5.5 5.5 0 0 1 13.4 5.6M14.5 9A5.5 5.5 0 0 1 4.6 12.4"
                        stroke="currentColor"
                        strokeWidth="1.55"
                        strokeLinecap="round"
                      />
                      <path
                        d="M11.5 5.6H13.75V3.35"
                        stroke="currentColor"
                        strokeWidth="1.55"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    ref={closeSheetBtnRef}
                    type="button"
                    className="sts-activity-dock__icon-btn"
                    onClick={() => setIsExpanded(false)}
                    aria-label="Close recent activity sheet"
                  >
                    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
                      <path
                        d="M4.75 4.75L13.25 13.25M13.25 4.75L4.75 13.25"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              </header>

              <div className="sts-activity-sheet__body">
                {renderPanelContent()}
              </div>

              <footer className="sts-activity-dock__footer">
                <a
                  href="/activity"
                  className="sts-activity-dock__history-link"
                  onClick={handleOpenHistoryPage}
                >
                  <span>View Full Activity History</span>
                  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M3.5 8H12.5M12.5 8L8.75 4.25M12.5 8L8.75 11.75"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
              </footer>
            </section>
          </div>
        ) : null}
      </>
    )
  }

  if (isMinimized) {
    return (
      <div className="sts-activity-dock sts-activity-dock--minimized">
        <button
          type="button"
          className="sts-activity-dock__restore-btn"
          onClick={() => setIsMinimized(false)}
          aria-label="Restore recent activity bar"
          title="Recent Activity"
        >
          <span className="sts-activity-dock__pulse" aria-hidden="true" />
          <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path
              d="M9 4.5V9L12 10.75M15.5 9A6.5 6.5 0 1 1 2.5 9A6.5 6.5 0 0 1 15.5 9Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    )
  }

  if (!isExpanded) {
    return (
      <div className="sts-activity-dock sts-activity-dock--collapsed">
        <button
          type="button"
          className="sts-activity-dock__pill"
          onClick={() => setIsExpanded(true)}
          aria-expanded="false"
          aria-controls="sts-recent-activity-panel"
        >
          <span className="sts-activity-dock__pulse" aria-hidden="true" />
          <span className="sts-activity-dock__pill-label">Recent Activity</span>
          {!loading && !errorMessage ? (
            <span className="sts-activity-dock__count">{activities.length}</span>
          ) : null}
          <svg
            className="sts-activity-dock__chevron"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 10L8 6L12 10"
              stroke="currentColor"
              strokeWidth="1.55"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          className="sts-activity-dock__min-btn"
          onClick={() => setIsMinimized(true)}
          aria-label="Minimize activity dock"
          title="Minimize"
        >
          <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M3 7H11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <aside
      id="sts-recent-activity-panel"
      className="sts-activity-dock sts-activity-dock--expanded"
      aria-label="Recent platform activity"
    >
      <header className="sts-activity-dock__header">
        <div className="sts-activity-dock__title-group">
          <h2 className="sts-activity-dock__title">Recent Activity</h2>
          <span className="sts-activity-dock__subtitle">
            Latest {activities.length || 50} operational updates
          </span>
        </div>

        <div className="sts-activity-dock__actions">
          <button
            type="button"
            className="sts-activity-dock__icon-btn"
            onClick={() => loadRecent({ silent: true })}
            disabled={loading || refreshing}
            aria-label="Refresh recent activity"
            title="Refresh"
          >
            <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M3.5 9A5.5 5.5 0 0 1 13.4 5.6M14.5 9A5.5 5.5 0 0 1 4.6 12.4"
                stroke="currentColor"
                strokeWidth="1.55"
                strokeLinecap="round"
              />
              <path
                d="M11.5 5.6H13.75V3.35"
                stroke="currentColor"
                strokeWidth="1.55"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            type="button"
            className="sts-activity-dock__icon-btn"
            onClick={() => setIsExpanded(false)}
            aria-label="Collapse recent activity panel"
            title="Collapse"
          >
            <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M4.5 7L9 11.5L13.5 7"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </header>

      <div className="sts-activity-dock__body">{renderPanelContent()}</div>

      <footer className="sts-activity-dock__footer">
        <a
          href="/activity"
          className="sts-activity-dock__history-link"
          onClick={handleOpenHistoryPage}
        >
          <span>View Full Activity History</span>
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3.5 8H12.5M12.5 8L8.75 4.25M12.5 8L8.75 11.75"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </footer>
    </aside>
  )
}
