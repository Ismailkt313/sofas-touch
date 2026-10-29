import { useMemo, useState } from 'react'
import {
  buildProjectChartBars,
  formatCompactCurrency,
  formatDashboardCurrency,
  formatDashboardPercent,
  getProjectHealthBadgeMeta,
} from '../utils/dashboardFormatters'

export function ProjectPerformanceChart({ items = [], onNavigate }) {
  const chartData = useMemo(() => buildProjectChartBars(items, 8), [items])
  const [activeId, setActiveId] = useState(null)

  const activeItem = useMemo(() => {
    if (!activeId) return chartData.items[0] || null
    return (
      chartData.items.find((row) => row.id === activeId) ||
      chartData.items[0] ||
      null
    )
  }, [activeId, chartData.items])

  if (chartData.items.length === 0) {
    return (
      <div className="sts-dash-chart-empty">
        <p className="sts-dash-chart-empty__title">
          No projects available to chart
        </p>
        <p className="sts-dash-chart-empty__sub">
          Create a project or adjust your search and status filters to compare
          contract values against recorded project costs.
        </p>
      </div>
    )
  }

  return (
    <div className="sts-dash-perf-chart">
      <div className="sts-dash-perf-chart__header">
        <div className="sts-dash-chart-legend" aria-label="Chart color legend">
          <span className="sts-dash-chart-legend__item">
            <span className="sts-dash-chart-legend__swatch sts-dash-chart-legend__swatch--contract" />
            Contract Value
          </span>
          <span className="sts-dash-chart-legend__item">
            <span className="sts-dash-chart-legend__swatch sts-dash-chart-legend__swatch--cost" />
            Total Project Costs
          </span>
          <span className="sts-dash-chart-legend__item">
            <span className="sts-dash-chart-legend__swatch sts-dash-chart-legend__swatch--over" />
            Over Budget
          </span>
        </div>

        <span className="sts-dash-perf-chart__scale-note">
          Peak scale: {formatCompactCurrency(chartData.maxAmount)}
        </span>
      </div>

      {activeItem ? (
        <div
          className="sts-dash-chart-tooltip"
          role="region"
          aria-label="Selected project financial breakdown"
        >
          <div className="sts-dash-chart-tooltip__top">
            <div>
              <span className="sts-dash-chart-tooltip__code">
                {activeItem.projectId}
              </span>
              <strong className="sts-dash-chart-tooltip__name">
                {activeItem.name}
              </strong>
            </div>
            <span
              className={`sts-dash-pill sts-dash-pill--${getProjectHealthBadgeMeta(activeItem.healthStatus).tone}`}
            >
              {getProjectHealthBadgeMeta(activeItem.healthStatus).label}
            </span>
          </div>

          <div className="sts-dash-chart-tooltip__metrics">
            <div>
              <span>Contract</span>
              <strong>{formatDashboardCurrency(activeItem.contractValue)}</strong>
            </div>
            <div>
              <span>Purchases</span>
              <strong>
                {formatDashboardCurrency(activeItem.materialPurchaseCosts)}
              </strong>
            </div>
            <div>
              <span>Expenses</span>
              <strong>
                {formatDashboardCurrency(activeItem.otherProjectExpenses)}
              </strong>
            </div>
            <div>
              <span>Total Cost</span>
              <strong>
                {formatDashboardCurrency(activeItem.totalProjectCosts)}
              </strong>
            </div>
            <div>
              <span>Est. Profit</span>
              <strong
                className={
                  activeItem.estimatedProfit < 0
                    ? 'sts-dash-num--neg'
                    : 'sts-dash-num--pos'
                }
              >
                {formatDashboardCurrency(activeItem.estimatedProfit)} (
                {formatDashboardPercent(
                  activeItem.profitMargin,
                  activeItem.marginApplicable,
                )}
                )
              </strong>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className="sts-dash-perf-bars"
        role="list"
        aria-label="Contract value versus total project costs by project"
      >
        {chartData.items.map((row) => {
          const isSelected = activeItem?.id === row.id
          const costTone =
            row.healthStatus === 'loss'
              ? 'over'
              : row.healthStatus === 'near_limit'
                ? 'warn'
                : 'ok'

          return (
            <div
              key={row.id}
              role="listitem"
              tabIndex={0}
              className={`sts-dash-perf-bar-row${isSelected ? ' sts-dash-perf-bar-row--active' : ''}`}
              onMouseEnter={() => setActiveId(row.id)}
              onFocus={() => setActiveId(row.id)}
              onClick={() => setActiveId(row.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && row.detailPath) {
                  onNavigate?.(row.detailPath)
                }
              }}
            >
              <div className="sts-dash-perf-bar-row__meta">
                <div className="sts-dash-perf-bar-row__title">
                  <span className="sts-dash-code-tag">{row.projectId}</span>
                  <span className="sts-dash-perf-bar-row__name">{row.name}</span>
                </div>
                <div className="sts-dash-perf-bar-row__figures">
                  <span>{formatCompactCurrency(row.totalProjectCosts)}</span>
                  <span className="sts-dash-perf-bar-row__sep">/</span>
                  <span>{formatCompactCurrency(row.contractValue)}</span>
                </div>
              </div>

              <svg
                className="sts-dash-perf-bar-svg"
                viewBox="0 0 100 16"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <rect
                  x="0"
                  y="1"
                  width="100"
                  height="6"
                  rx="2"
                  className="sts-dash-svg-track"
                />
                <rect
                  x="0"
                  y="1"
                  width={Math.max(row.contractValue > 0 ? 1.2 : 0, row.contractRatio)}
                  height="6"
                  rx="2"
                  className="sts-dash-svg-contract"
                />
                <rect
                  x="0"
                  y="9"
                  width="100"
                  height="6"
                  rx="2"
                  className="sts-dash-svg-track"
                />
                <rect
                  x="0"
                  y="9"
                  width={Math.max(row.totalProjectCosts > 0 ? 1.2 : 0, row.costRatio)}
                  height="6"
                  rx="2"
                  className={`sts-dash-svg-cost sts-dash-svg-cost--${costTone}`}
                />
              </svg>
            </div>
          )
        })}
      </div>
    </div>
  )
}
