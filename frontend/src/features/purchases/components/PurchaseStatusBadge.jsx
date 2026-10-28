export function PurchaseStatusBadge({ status }) {
  const isCancelled = status === 'cancelled'
  return (
    <span
      className={`pv-badge ${
        isCancelled ? 'pv-badge--cancelled' : 'pv-badge--active'
      }`}
    >
      <span className="pv-badge__dot" aria-hidden="true" />
      {isCancelled ? 'Cancelled' : 'Active'}
    </span>
  )
}

export function PurchaseAttachmentIndicator({ count = 0 }) {
  const safeCount = Number(count) || 0
  if (safeCount <= 0) {
    return <span className="pv-att-pill pv-att-pill--empty">No bill</span>
  }

  return (
    <span
      className="pv-att-pill pv-att-pill--present"
      title={`${safeCount} bill attachment${safeCount === 1 ? '' : 's'}`}
    >
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M9.75 3.25L4.8 8.2C3.92 9.08 3.92 10.5 4.8 11.38C5.68 12.26 7.1 12.26 7.98 11.38L12.75 6.6C14.12 5.23 14.12 3.02 12.75 1.65C11.38 0.28 9.17 0.28 7.8 1.65L3.02 6.43C1.17 8.28 1.17 11.28 3.02 13.13"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
      <span>{safeCount === 1 ? 'Bill attached' : `${safeCount} files`}</span>
    </span>
  )
}

export function PurchaseEntryMethodTag({ entryMethod }) {
  const isUpload = entryMethod === 'upload_bill'
  return (
    <span className="pv-method-tag">
      {isUpload ? 'Bill Upload / OCR' : 'Manual Entry'}
    </span>
  )
}
