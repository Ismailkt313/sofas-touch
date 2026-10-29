import {
  formatActivityTimestamp,
  getActivityVisualMeta,
  resolvePermittedActivityPath,
} from '../utils/activityFormatters'

function ActivityActionGlyph({ iconType }) {
  if (iconType === 'create') {
    return (
      <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path
          d="M9 3.75V14.25M3.75 9H14.25"
          stroke="currentColor"
          strokeWidth="1.65"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (iconType === 'approve') {
    return (
      <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path
          d="M3.75 9.4L7.25 12.9L14.25 5.35"
          stroke="currentColor"
          strokeWidth="1.65"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (iconType === 'cancel') {
    return (
      <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path
          d="M5.25 5.25L12.75 12.75M12.75 5.25L5.25 12.75"
          stroke="currentColor"
          strokeWidth="1.65"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (iconType === 'status') {
    return (
      <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path
          d="M3.5 9A5.5 5.5 0 0 1 13.4 5.6M14.5 9A5.5 5.5 0 0 1 4.6 12.4"
          stroke="currentColor"
          strokeWidth="1.55"
          strokeLinecap="round"
        />
        <path
          d="M11.6 5.6H13.75V3.45M6.4 12.4H4.25V14.55"
          stroke="currentColor"
          strokeWidth="1.55"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M11.8 3.6L14.4 6.2L6.5 14.1H3.9V11.5L11.8 3.6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ActivityFeedItem({
  item,
  userRole = 'data_entry',
  compact = false,
  onNavigate,
  onAfterNavigate,
}) {
  const meta = getActivityVisualMeta(item.actionType, item.entityType)
  const timeInfo = formatActivityTimestamp(item.timestamp)
  const permittedPath = resolvePermittedActivityPath(item, userRole)

  const handleLinkClick = (event) => {
    if (!permittedPath) return
    if (
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      event.preventDefault()
      onAfterNavigate?.()
      onNavigate?.(permittedPath)
    }
  }

  return (
    <li
      className={`sts-activity-item${compact ? ' sts-activity-item--compact' : ''}`}
    >
      <span
        className={`sts-activity-item__icon sts-activity-item__icon--${meta.tone}`}
        aria-hidden="true"
      >
        <ActivityActionGlyph iconType={meta.iconType} />
      </span>

      <div className="sts-activity-item__body">
        <div className="sts-activity-item__top">
          <span className="sts-activity-item__badge">{meta.entityBadge}</span>
          {item.projectCode && item.entityType !== 'project' ? (
            <span className="sts-activity-item__project-tag">
              {item.projectCode}
            </span>
          ) : null}
          <time
            className="sts-activity-item__time"
            dateTime={
              item.timestamp ? new Date(item.timestamp).toISOString() : undefined
            }
            title={timeInfo.full}
          >
            {compact ? timeInfo.relative : timeInfo.full}
          </time>
        </div>

        <p className="sts-activity-item__desc">{item.description}</p>

        <div className="sts-activity-item__footer">
          <span className="sts-activity-item__actor">
            By <strong>{item.actorName}</strong>
            {!compact ? (
              <span className="sts-activity-item__exact-sub">
                {' '}
                &middot; {timeInfo.relative}
              </span>
            ) : null}
          </span>

          {permittedPath ? (
            <a
              href={permittedPath}
              className="sts-activity-item__link"
              onClick={handleLinkClick}
            >
              <span>Open</span>
              <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path
                  d="M4.25 9.75L9.75 4.25M9.75 4.25H5.25M9.75 4.25V8.75"
                  stroke="currentColor"
                  strokeWidth="1.45"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          ) : null}
        </div>
      </div>
    </li>
  )
}
