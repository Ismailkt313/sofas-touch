import { getStockAlertBadgeMeta } from '../utils/dashboardFormatters'

function formatQty(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0'
  return num.toLocaleString('en-IN', { maximumFractionDigits: 3 })
}

export function StockAlertsCard({ stockAlerts, isAdmin, onNavigate }) {
  const items = stockAlerts?.items || []
  const outCount = Number(stockAlerts?.outOfStockCount || 0)
  const lowCount = Number(stockAlerts?.lowStockCount || 0)
  const totalActive = Number(stockAlerts?.totalActiveMaterials || 0)
  const configuredCount = Number(stockAlerts?.configuredThresholdCount || 0)

  const handleLinkClick = (event, path) => {
    if (
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      event.preventDefault()
      onNavigate?.(path)
    }
  }

  return (
    <section
      className="sts-dash-card sts-dash-stock-card"
      aria-labelledby="sts-dash-stock-heading"
    >
      <header className="sts-dash-card__header">
        <div>
          <h2 id="sts-dash-stock-heading" className="sts-dash-card__title">
            Stock Alerts
          </h2>
        </div>

        <a
          href="/raw-materials"
          className="sts-dash-link-btn sts-dash-link-btn--subtle"
          onClick={(e) => handleLinkClick(e, '/raw-materials')}
        >
          Raw Materials
        </a>
      </header>

      <div className="sts-dash-stock-summary">
        <span
          className={`sts-dash-pill ${outCount > 0 ? 'sts-dash-pill--danger' : 'sts-dash-pill--completed'}`}
        >
          {outCount} Out of Stock
        </span>
        <span
          className={`sts-dash-pill ${lowCount > 0 ? 'sts-dash-pill--warning' : 'sts-dash-pill--completed'}`}
        >
          {lowCount} Low Stock
        </span>
      </div>

      {items.length === 0 ? (
        <div className="sts-dash-empty-box sts-dash-empty-box--compact">
          <p className="sts-dash-empty-box__title">
            {totalActive === 0
              ? 'No active raw materials registered'
              : 'All monitored stock levels are healthy'}
          </p>
          <p className="sts-dash-empty-box__sub">
            {totalActive === 0
              ? 'Add raw materials to monitor upholstery, foam, and timber inventory.'
              : configuredCount === 0 && isAdmin
                ? 'No active materials are at zero stock. Edit a material in Raw Materials to set an optional minimum stock alert level.'
                : 'No active materials are out of stock or at/below their configured minimum level.'}
          </p>
        </div>
      ) : (
        <ul className="sts-dash-stock-list" aria-label="Low stock materials">
          {items.map((mat) => {
            const badge = getStockAlertBadgeMeta(mat.alertStatus)

            return (
              <li key={mat.id} className="sts-dash-stock-item">
                <a
                  href={mat.detailPath}
                  className="sts-dash-stock-row"
                  onClick={(e) => handleLinkClick(e, mat.detailPath)}
                >
                  <div className="sts-dash-stock-row__left">
                    <div className="sts-dash-stock-row__top">
                      <strong className="sts-dash-stock-row__name">
                        {mat.name}
                      </strong>
                      <span
                        className={`sts-dash-pill sts-dash-pill--${badge.tone}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <span className="sts-dash-stock-row__meta">
                      {mat.category || 'Uncategorized'} &bull;{' '}
                      {mat.minStockLevel !== null &&
                      mat.minStockLevel !== undefined
                        ? `Min level: ${formatQty(mat.minStockLevel)} ${mat.unit}`
                        : 'Zero-stock alert (no min level set)'}
                    </span>
                  </div>

                  <div className="sts-dash-stock-row__right">
                    <strong
                      className={`sts-dash-stock-row__qty${mat.alertStatus === 'out_of_stock' ? ' sts-dash-num--neg' : ''}`}
                    >
                      {formatQty(mat.quantityOnHand)} {mat.unit}
                    </strong>
                    <span className="sts-dash-tx-row__open">Details &rarr;</span>
                  </div>
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
