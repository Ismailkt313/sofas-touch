import { useMemo, useState } from 'react'
import {
  buildMonthlyChartScale,
  formatDashboardCurrency,
} from '../utils/dashboardFormatters'

export function MonthlyExpenseChart({ buckets = [] }) {
  const scale = useMemo(() => buildMonthlyChartScale(buckets), [buckets])
  const [selectedKey, setSelectedKey] = useState(null)

  const activeBucket = useMemo(() => {
    if (scale.bars.length === 0) return null
    if (selectedKey) {
      const found = scale.bars.find((b) => b.monthKey === selectedKey)
      if (found) return found
    }
    return scale.bars[scale.bars.length - 1]
  }, [scale.bars, selectedKey])

  if (!scale.hasData || scale.bars.length === 0) {
    return (
      <div className="sts-dash-chart-empty">
        <p className="sts-dash-chart-empty__title">
          No recorded purchases or expenses in this period
        </p>
        <p className="sts-dash-chart-empty__sub">
          Active purchase vouchers and operational expenses dated within the
          selected range will appear here by month.
        </p>
      </div>
    )
  }

  const colWidth = 64
  const chartPaddingLeft = 54
  const chartPaddingRight = 18
  const chartTop = 16
  const plotHeight = 168
  const chartBottom = 38
  const svgWidth = Math.max(
    420,
    chartPaddingLeft + scale.bars.length * colWidth + chartPaddingRight,
  )
  const svgHeight = chartTop + plotHeight + chartBottom

  return (
    <div className="sts-dash-monthly-chart">
      <div className="sts-dash-perf-chart__header">
        <div
          className="sts-dash-chart-legend"
          aria-label="Monthly expense legend"
        >
          <span className="sts-dash-chart-legend__item">
            <span className="sts-dash-chart-legend__swatch sts-dash-chart-legend__swatch--purchase" />
            Material Purchases
          </span>
          <span className="sts-dash-chart-legend__item">
            <span className="sts-dash-chart-legend__swatch sts-dash-chart-legend__swatch--expense" />
            Other Expenses
          </span>
        </div>

        {activeBucket ? (
          <span className="sts-dash-perf-chart__scale-note">
            {activeBucket.label}:{' '}
            <strong>{formatDashboardCurrency(activeBucket.totalExpenses)}</strong>
          </span>
        ) : null}
      </div>

      {activeBucket ? (
        <div
          className="sts-dash-chart-tooltip sts-dash-chart-tooltip--compact"
          role="region"
          aria-label="Selected month spending details"
        >
          <div className="sts-dash-chart-tooltip__metrics">
            <div>
              <span>Month</span>
              <strong>{activeBucket.label}</strong>
            </div>
            <div>
              <span>Material Purchases ({activeBucket.purchaseCount})</span>
              <strong>
                {formatDashboardCurrency(activeBucket.purchaseCosts)}
              </strong>
            </div>
            <div>
              <span>Other Expenses ({activeBucket.expenseCount})</span>
              <strong>
                {formatDashboardCurrency(activeBucket.otherExpenses)}
              </strong>
            </div>
            <div>
              <span>Combined Spend</span>
              <strong>
                {formatDashboardCurrency(activeBucket.totalExpenses)}
              </strong>
            </div>
          </div>
        </div>
      ) : null}

      <div className="sts-dash-monthly-svg-scroll">
        <svg
          className="sts-dash-monthly-svg"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          role="img"
          aria-label="Monthly material purchases versus other expenses chart"
        >
          {scale.ticks.map((tick) => {
            const y = chartTop + plotHeight - tick.ratio * plotHeight
            return (
              <g key={tick.ratio}>
                <line
                  x1={chartPaddingLeft}
                  y1={y}
                  x2={svgWidth - chartPaddingRight}
                  y2={y}
                  className="sts-dash-svg-gridline"
                />
                <text
                  x={chartPaddingLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="sts-dash-svg-axis-text"
                >
                  {tick.label}
                </text>
              </g>
            )
          })}

          {scale.bars.map((bucket, idx) => {
            const groupCenterX =
              chartPaddingLeft + idx * colWidth + colWidth / 2
            const barW = 15
            const gap = 4
            const pHeight = (bucket.purchaseRatio / 100) * plotHeight
            const eHeight = (bucket.expenseRatio / 100) * plotHeight
            const pY = chartTop + plotHeight - pHeight
            const eY = chartTop + plotHeight - eHeight
            const isSelected = activeBucket?.monthKey === bucket.monthKey

            return (
              <g
                key={bucket.monthKey}
                className={`sts-dash-svg-month-group${isSelected ? ' sts-dash-svg-month-group--active' : ''}`}
                tabIndex={0}
                role="button"
                aria-label={`${bucket.label}: Purchases ${formatDashboardCurrency(bucket.purchaseCosts)}, Other Expenses ${formatDashboardCurrency(bucket.otherExpenses)}`}
                onMouseEnter={() => setSelectedKey(bucket.monthKey)}
                onFocus={() => setSelectedKey(bucket.monthKey)}
                onClick={() => setSelectedKey(bucket.monthKey)}
              >
                <rect
                  x={groupCenterX - colWidth / 2 + 4}
                  y={chartTop}
                  width={colWidth - 8}
                  height={plotHeight + 24}
                  rx="6"
                  className="sts-dash-svg-hover-band"
                />
                <rect
                  x={groupCenterX - barW - gap / 2}
                  y={bucket.purchaseCosts > 0 ? Math.min(pY, chartTop + plotHeight - 3) : chartTop + plotHeight}
                  width={barW}
                  height={bucket.purchaseCosts > 0 ? Math.max(3, pHeight) : 0}
                  rx="3"
                  className="sts-dash-svg-bar-purchase"
                />
                <rect
                  x={groupCenterX + gap / 2}
                  y={bucket.otherExpenses > 0 ? Math.min(eY, chartTop + plotHeight - 3) : chartTop + plotHeight}
                  width={barW}
                  height={bucket.otherExpenses > 0 ? Math.max(3, eHeight) : 0}
                  rx="3"
                  className="sts-dash-svg-bar-expense"
                />
                <text
                  x={groupCenterX}
                  y={chartTop + plotHeight + 20}
                  textAnchor="middle"
                  className="sts-dash-svg-month-label"
                >
                  {bucket.shortLabel}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
