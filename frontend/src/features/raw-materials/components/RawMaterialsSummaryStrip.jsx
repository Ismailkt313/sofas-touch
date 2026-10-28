export function RawMaterialsSummaryStrip({
  summaryCounts,
  activeStatusFilter,
  adminAccess,
  onSelectStatus,
}) {
  const totalValue = summaryCounts?.total ?? 0
  const activeValue = summaryCounts?.active ?? 0
  const inactiveValue = adminAccess ? (summaryCounts?.inactive ?? 0) : '—'

  if (!adminAccess) {
    return (
      <section
        className="rm-summary-strip"
        aria-label="Raw materials summary"
      >
        <div className="rm-summary-grid">
          <div className="rm-summary-card rm-summary-card--static">
            <span className="rm-summary-card__label">Total Materials</span>
            <span className="rm-summary-card__value">{totalValue}</span>
            <span className="rm-summary-card__caption">
              Accessible catalog
            </span>
          </div>

          <div className="rm-summary-card rm-summary-card--static rm-summary-card--selected">
            <span className="rm-summary-card__label">Active Materials</span>
            <span className="rm-summary-card__value">{activeValue}</span>
            <span className="rm-summary-card__caption">
              Ready for purchases
            </span>
          </div>

          <div
            className="rm-summary-card rm-summary-card--static rm-summary-card--muted"
            aria-disabled="true"
          >
            <span className="rm-summary-card__label">Inactive Materials</span>
            <span className="rm-summary-card__value">{inactiveValue}</span>
            <span className="rm-summary-card__caption">Admin view only</span>
          </div>
        </div>
      </section>
    )
  }

  const cards = [
    {
      key: 'all',
      label: 'Total Materials',
      value: totalValue,
      caption: 'All catalog items',
    },
    {
      key: 'active',
      label: 'Active Materials',
      value: activeValue,
      caption: 'Available for purchases',
    },
    {
      key: 'inactive',
      label: 'Inactive Materials',
      value: inactiveValue,
      caption: 'Hidden from selection',
    },
  ]

  return (
    <section
      className="rm-summary-strip"
      aria-label="Raw materials summary"
    >
      <div className="rm-summary-grid">
        {cards.map((card) => {
          const isSelected = activeStatusFilter === card.key
          return (
            <button
              key={card.key}
              type="button"
              className={`rm-summary-card${
                isSelected ? ' rm-summary-card--selected' : ''
              }`}
              onClick={() => onSelectStatus?.(card.key)}
              aria-pressed={isSelected}
            >
              <span className="rm-summary-card__label">{card.label}</span>
              <span className="rm-summary-card__value">{card.value}</span>
              <span className="rm-summary-card__caption">{card.caption}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
