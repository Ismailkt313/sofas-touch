import {
  formatActivityTimestamp,
  formatHumanReadableActivity,
  resolvePermittedActivityPath,
} from '../utils/activityFormatters'

function ActivityCategoryIcon({ category, tone }) {
  if (category === 'project') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
      </svg>
    )
  }

  if (category === 'purchase') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zm6 5a1 1 0 100-2H7a1 1 0 000 2h6zm-6 2a1 1 0 100 2h3a1 1 0 100-2H7z"
          clipRule="evenodd"
        />
      </svg>
    )
  }

  if (category === 'expense') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
        <path
          fillRule="evenodd"
          d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"
          clipRule="evenodd"
        />
      </svg>
    )
  }

  if (category === 'material') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
        <path
          fillRule="evenodd"
          d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
          clipRule="evenodd"
        />
      </svg>
    )
  }

  if (category === 'user') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
          clipRule="evenodd"
        />
      </svg>
    )
  }

  if (category === 'permission') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM13.707 8.707a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
    )
  }

  if (category === 'settings') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
          clipRule="evenodd"
        />
      </svg>
    )
  }

  // Fallback icon
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export function ActivityFeedItem({
  item,
  userRole = 'data_entry',
  compact = false,
  onNavigate,
  onSelect,
}) {
  const human = formatHumanReadableActivity(item)
  const timeInfo = formatActivityTimestamp(item.timestamp)
  const permittedPath = resolvePermittedActivityPath(item, userRole)

  const handleRowClick = () => {
    if (onSelect) {
      onSelect(item)
    } else if (permittedPath && onNavigate) {
      onNavigate(permittedPath)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleRowClick()
    }
  }

  return (
    <li
      className={`sts-act-item${compact ? ' sts-act-item--compact' : ''}`}
      onClick={handleRowClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${human.title}: ${human.description}`}
    >
      {/* Icon */}
      <div
        className={`sts-act-item__icon-wrap sts-act-item__icon-wrap--${human.tone}`}
        aria-hidden="true"
      >
        <ActivityCategoryIcon
          category={human.iconCategory}
          tone={human.tone}
        />
      </div>

      {/* Main Content */}
      <div className="sts-act-item__content">
        <div className="sts-act-item__header-row">
          <span className="sts-act-item__title">{human.title}</span>
          <span
            className={`sts-act-badge sts-act-badge--${human.tone} sts-act-badge--xs`}
          >
            {human.moduleBadge}
          </span>
        </div>

        <p className="sts-act-item__desc">{human.description}</p>

        <div className="sts-act-item__sub-row">
          {human.secondaryText ? (
            <span className="sts-act-item__secondary">
              {human.secondaryText}
            </span>
          ) : null}
          <span className="sts-act-item__actor">
            By <strong>{item.actorName || 'Workspace User'}</strong> &bull;{' '}
            {timeInfo.relative}
          </span>
        </div>
      </div>

      {/* Time & Action */}
      <div className="sts-act-item__right">
        <time className="sts-act-item__time" dateTime={item.timestamp}>
          {timeInfo.full}
        </time>

        <span className="sts-act-item__details-pill" aria-hidden="true">
          <span>View</span>
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.44 8 6.22 4.78a.75.75 0 010-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </div>
    </li>
  )
}
