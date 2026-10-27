export function ActiveFilterChips({ chips = [], onClearAll }) {
  if (!Array.isArray(chips) || chips.length === 0) {
    return null
  }

  return (
    <div className="sts-active-chips" aria-label="Active filters">
      <div className="sts-active-chips__list">
        {chips.map((chip) => (
          <span key={chip.key} className="sts-active-chip">
            <span className="sts-active-chip__label">{chip.label}:</span>
            <strong className="sts-active-chip__value">{chip.value}</strong>
            <button
              type="button"
              className="sts-active-chip__remove"
              onClick={chip.onRemove}
              aria-label={`Remove ${chip.label} filter (${chip.value})`}
            >
              <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path
                  d="M4 4L10 10M10 4L4 10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </span>
        ))}
      </div>

      {chips.length > 1 && typeof onClearAll === 'function' ? (
        <button
          type="button"
          className="sts-active-chips__clear"
          onClick={onClearAll}
        >
          Clear all
        </button>
      ) : null}
    </div>
  )
}
