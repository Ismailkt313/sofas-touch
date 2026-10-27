export function MobileFilterButton({
  activeCount = 0,
  onClick,
  label = 'Filter',
  ariaLabel,
}) {
  return (
    <button
      type="button"
      className={`sts-mobile-filter-btn${
        activeCount > 0 ? ' sts-mobile-filter-btn--active' : ''
      }`}
      onClick={onClick}
      aria-label={
        ariaLabel ||
        (activeCount > 0
          ? `${label} (${activeCount} active)`
          : `${label} options`)
      }
      aria-haspopup="dialog"
    >
      <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path
          d="M2.75 4.5H15.25M5.25 9H12.75M7.5 13.5H10.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      <span>{label}</span>
      {activeCount > 0 ? (
        <span className="sts-mobile-filter-btn__badge">{activeCount}</span>
      ) : null}
    </button>
  )
}
