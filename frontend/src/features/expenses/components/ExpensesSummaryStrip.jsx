import { formatExpenseCurrency } from '../utils/expenseValidation'

export function ExpensesSummaryStrip({
  summary,
  projectFilter,
  statusFilter,
  onSelectProjectFilter,
  onSelectStatusFilter,
}) {
  const activeTotal = summary?.activeTotalAmount ?? 0
  const activeCount = summary?.activeCount ?? 0
  const projectLinkedTotal = summary?.projectLinkedTotalAmount ?? 0
  const projectLinkedCount = summary?.projectLinkedCount ?? 0
  const generalTotal = summary?.generalTotalAmount ?? 0
  const generalCount = summary?.generalExpenseCount ?? 0
  const withReceiptCount = summary?.withReceiptCount ?? 0
  const cancelledCount = summary?.cancelledCount ?? 0

  const isAllActiveSelected =
    statusFilter === 'active' && projectFilter === 'all'
  const isGeneralSelected =
    statusFilter === 'active' && projectFilter === 'unassigned'

  return (
    <section className="exp-summary-strip" aria-label="Expense summary">
      <button
        type="button"
        className={`exp-summary-tile exp-summary-tile--interactive ${
          isAllActiveSelected ? 'exp-summary-tile--active' : ''
        }`}
        onClick={() => {
          onSelectStatusFilter('active')
          onSelectProjectFilter('all')
        }}
      >
        <span className="exp-summary-tile__label">Total Active Expenses</span>
        <span className="exp-summary-tile__value">
          {formatExpenseCurrency(activeTotal)}
        </span>
        <span className="exp-summary-tile__meta">
          {activeCount} {activeCount === 1 ? 'voucher' : 'vouchers'}
          {cancelledCount > 0 ? ` · ${cancelledCount} cancelled` : ''}
        </span>
      </button>

      <div className="exp-summary-tile">
        <span className="exp-summary-tile__label">Project Expenses</span>
        <span className="exp-summary-tile__value">
          {formatExpenseCurrency(projectLinkedTotal)}
        </span>
        <span className="exp-summary-tile__meta">
          {projectLinkedCount} linked to client projects
        </span>
      </div>

      <button
        type="button"
        className={`exp-summary-tile exp-summary-tile--interactive ${
          isGeneralSelected ? 'exp-summary-tile--active' : ''
        }`}
        onClick={() => {
          onSelectStatusFilter('active')
          onSelectProjectFilter(isGeneralSelected ? 'all' : 'unassigned')
        }}
      >
        <span className="exp-summary-tile__label">General Workshop</span>
        <span className="exp-summary-tile__value">
          {formatExpenseCurrency(generalTotal)}
        </span>
        <span className="exp-summary-tile__meta">
          {generalCount} non-project overhead
        </span>
      </button>

      <div className="exp-summary-tile">
        <span className="exp-summary-tile__label">Receipts Attached</span>
        <span className="exp-summary-tile__value">
          {withReceiptCount} / {activeCount}
        </span>
        <span className="exp-summary-tile__meta">
          Optional image or PDF proof
        </span>
      </div>
    </section>
  )
}
