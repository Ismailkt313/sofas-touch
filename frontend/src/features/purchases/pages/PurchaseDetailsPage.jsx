import { useCallback, useEffect, useState } from 'react'
import { formatMaterialUnit } from '../../raw-materials'
import { BillAttachmentCard } from '../components/BillAttachmentCard'
import { BillAttachmentModal } from '../components/BillAttachmentModal'
import { CancelPurchaseModal } from '../components/CancelPurchaseModal'
import {
  PurchaseEntryMethodTag,
  PurchaseStatusBadge,
} from '../components/PurchaseStatusBadge'
import {
  cancelPurchaseVoucher,
  fetchPurchaseVoucherById,
  formatInrCurrency,
  formatPurchaseDate,
  formatPurchaseDateTime,
  formatPurchaseQuantity,
  hasActiveAuthToken,
  isAdminUser,
} from '../services/purchaseService'
import '../styles/purchases.css'

function formatMovementLabel(movementType) {
  if (movementType === 'purchase_created') return 'Voucher Recorded'
  if (movementType === 'purchase_revised') return 'Voucher Edited (Delta)'
  if (movementType === 'purchase_cancelled') return 'Voucher Cancelled (Reversal)'
  return movementType
}

export function PurchaseDetailsPage({
  voucherIdentifier,
  currentUser,
  onNavigate,
}) {
  const adminAccess = isAdminUser(currentUser)
  const [authRequired, setAuthRequired] = useState(() => !hasActiveAuthToken())
  const [voucher, setVoucher] = useState(null)
  const [stockMovements, setStockMovements] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadTick, setReloadTick] = useState(0)

  const [previewAttachment, setPreviewAttachment] = useState(null)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [feedbackBanner, setFeedbackBanner] = useState('')

  useEffect(() => {
    if (!hasActiveAuthToken() || !voucherIdentifier) {
      return undefined
    }

    let cancelled = false

    fetchPurchaseVoucherById(voucherIdentifier)
      .then((res) => {
        if (cancelled) return
        setAuthRequired(false)
        setVoucher(res.voucher)
        setStockMovements(res.stockMovements || [])
        setError('')
        setIsLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        if (err?.status === 401) {
          setAuthRequired(true)
        } else {
          setError(err?.message || 'Unable to load purchase voucher details.')
        }
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [voucherIdentifier, reloadTick])

  const handleConfirmCancel = useCallback(
    async (reason) => {
      if (!voucher || isCancelling) return
      setIsCancelling(true)
      setCancelError('')

      try {
        const res = await cancelPurchaseVoucher(voucher.id, reason)
        setIsCancelModalOpen(false)
        setFeedbackBanner(
          res.message ||
            'Purchase voucher cancelled and raw material stock reversed.',
        )
        setReloadTick((prev) => prev + 1)
      } catch (err) {
        setCancelError(err?.message || 'Unable to cancel purchase voucher.')
      } finally {
        setIsCancelling(false)
      }
    },
    [voucher, isCancelling],
  )

  if (authRequired) {
    return (
      <div className="pv-page">
        <section className="pv-surface">
          <div className="pv-state">
            <h2 className="pv-state__title">Sign in required</h2>
            <p className="pv-state__message">
              Please sign in to view purchase voucher details and bill
              attachments.
            </p>
            <div className="pv-state__actions">
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={() => onNavigate?.('/login')}
              >
                Go to Sign In
              </button>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="pv-page">
      <div className="pv-breadcrumb-bar">
        <button
          type="button"
          className="pv-back-btn"
          onClick={() => onNavigate?.('/purchases')}
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M12.5 5L7.5 10L12.5 15"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Back to Purchases</span>
        </button>
      </div>

      {feedbackBanner ? (
        <div className="pv-alert pv-alert--success" role="status">
          <span>{feedbackBanner}</span>
        </div>
      ) : null}

      {isLoading ? (
        <section className="pv-surface">
          <div className="pv-loading" role="status" aria-busy="true">
            <div className="pv-skeleton-row">
              <div className="pv-skeleton-lines">
                <div className="pv-skeleton-line pv-skeleton-line--title" />
                <div className="pv-skeleton-line pv-skeleton-line--sub" />
              </div>
            </div>
          </div>
        </section>
      ) : error || !voucher ? (
        <section className="pv-surface">
          <div className="pv-state" role="alert">
            <h2 className="pv-state__title">Purchase voucher unavailable</h2>
            <p className="pv-state__message">
              {error || 'Requested purchase voucher was not found.'}
            </p>
            <div className="pv-state__actions">
              <button
                type="button"
                className="admin-btn admin-btn--secondary"
                onClick={() => onNavigate?.('/purchases')}
              >
                Back to Purchases
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={() => {
                  setIsLoading(true)
                  setReloadTick((prev) => prev + 1)
                }}
              >
                Retry
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          <header className="pv-details-header">
            <div className="pv-details-header__main">
              <div className="pv-details-header__badges">
                <span className="pv-voucher-code-hero">
                  {voucher.voucherNumber}
                </span>
                <PurchaseStatusBadge status={voucher.status} />
                <PurchaseEntryMethodTag entryMethod={voucher.entryMethod} />
              </div>
              <h1 className="pv-header__title">{voucher.supplierName}</h1>
              <p className="pv-header__subtitle">
                Purchase Date: {formatPurchaseDate(voucher.purchaseDate)}
                {voucher.supplierInvoiceNumber
                  ? ` · Supplier Invoice #${voucher.supplierInvoiceNumber}`
                  : ' · No supplier invoice number'}
              </p>
            </div>

            {voucher.status === 'active' ? (
              <div className="pv-header__actions">
                {adminAccess ? (
                  <button
                    type="button"
                    className="admin-btn admin-btn--secondary pv-cancel-trigger"
                    onClick={() => setIsCancelModalOpen(true)}
                  >
                    Cancel Voucher
                  </button>
                ) : null}
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  onClick={() =>
                    onNavigate?.(
                      `/purchases/${encodeURIComponent(voucher.id)}/edit`,
                    )
                  }
                >
                  Edit Voucher
                </button>
              </div>
            ) : null}
          </header>

          {voucher.status === 'cancelled' ? (
            <div className="pv-alert pv-alert--warning" role="status">
              <strong>Cancelled Voucher:</strong> Stock additions and project
              cost contributions from this voucher have been reversed.
              {voucher.cancelReason ? ` Reason: ${voucher.cancelReason}` : ''}
            </div>
          ) : null}

          <section className="pv-details-meta-grid">
            <div className="pv-meta-card">
              <span className="pv-meta-card__label">Associated Project</span>
              {voucher.projectCode ? (
                <button
                  type="button"
                  className="pv-project-chip pv-project-chip--lg"
                  onClick={() =>
                    onNavigate?.(
                      `/projects/${encodeURIComponent(
                        voucher.projectCode || voucher.projectRecordId,
                      )}`,
                    )
                  }
                >
                  <span className="pv-project-chip__code">
                    {voucher.projectCode}
                  </span>
                  <span className="pv-project-chip__name">
                    {voucher.projectName || 'View Project'}
                  </span>
                </button>
              ) : (
                <strong className="pv-meta-card__val">
                  General Workshop Stock
                </strong>
              )}
            </div>

            <div className="pv-meta-card">
              <span className="pv-meta-card__label">Final Voucher Total</span>
              <strong className="pv-meta-card__val pv-meta-card__val--highlight">
                {formatInrCurrency(voucher.finalTotal)}
              </strong>
            </div>

            <div className="pv-meta-card">
              <span className="pv-meta-card__label">Created By</span>
              <strong className="pv-meta-card__val">
                {voucher.createdByName || '—'}
              </strong>
              <span className="pv-meta-card__sub">
                {formatPurchaseDateTime(voucher.createdAt)}
              </span>
            </div>

            <div className="pv-meta-card">
              <span className="pv-meta-card__label">Last Updated</span>
              <strong className="pv-meta-card__val">
                {formatPurchaseDateTime(voucher.updatedAt)}
              </strong>
              <span className="pv-meta-card__sub">
                Revision #{voucher.revision}
              </span>
            </div>
          </section>

          <section className="pv-surface pv-section-card">
            <h2 className="pv-section-card__title">
              Purchase Items ({voucher.lineItems.length})
            </h2>

            <div className="pv-table-wrap">
              <table className="pv-table pv-details-lines-table">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Type</th>
                    <th scope="col">Material / Expense Head</th>
                    <th scope="col" className="pv-table__num-col">
                      Quantity
                    </th>
                    <th scope="col">Unit</th>
                    <th scope="col" className="pv-table__num-col">
                      Unit Price
                    </th>
                    <th scope="col" className="pv-table__num-col">
                      Line Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {voucher.lineItems.map((item, index) => {
                    const isExpense = item.itemType === 'expense'
                    const primaryTitle = isExpense
                      ? item.expenseHeadName || item.description || 'Expense'
                      : item.materialName
                    const secondaryDesc =
                      isExpense &&
                      item.description &&
                      item.description !== primaryTitle
                        ? item.description
                        : !isExpense &&
                            item.description &&
                            item.description !== item.materialName
                          ? item.description
                          : ''

                    return (
                      <tr
                        key={`${item.materialId || item.expenseHeadId || 'line'}-${index}`}
                      >
                        <td>{index + 1}</td>
                        <td>
                          <span
                            className={`pv-type-badge ${
                              isExpense
                                ? 'pv-type-badge--expense'
                                : 'pv-type-badge--material'
                            }`}
                          >
                            {isExpense ? 'Expense' : 'Material'}
                          </span>
                        </td>
                        <td>
                          <div className="pv-supplier-cell">
                            <span className="pv-supplier-cell__name">
                              {primaryTitle}
                            </span>
                            {secondaryDesc ? (
                              <span className="pv-supplier-cell__inv">
                                {secondaryDesc}
                              </span>
                            ) : null}
                            {item.remarks ? (
                              <span className="pv-supplier-cell__inv">
                                Note: {item.remarks}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="pv-table__num-col">
                          {item.quantity !== null && item.quantity !== undefined
                            ? formatPurchaseQuantity(item.quantity, '')
                            : '—'}
                        </td>
                        <td>
                          {item.unit ? (
                            <span className="rm-unit-pill" title={item.unit}>
                              {formatMaterialUnit(item.unit) || item.unit}
                            </span>
                          ) : (
                            <span className="pv-muted-dash">—</span>
                          )}
                        </td>
                        <td className="pv-table__num-col">
                          {item.unitPrice !== null &&
                          item.unitPrice !== undefined
                            ? formatInrCurrency(item.unitPrice)
                            : '—'}
                        </td>
                        <td className="pv-table__num-col pv-table__total-cell">
                          {formatInrCurrency(item.lineTotal)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="pv-details-mobile-lines">
              {voucher.lineItems.map((item, index) => {
                const isExpense = item.itemType === 'expense'
                const primaryTitle = isExpense
                  ? item.expenseHeadName || item.description || 'Expense'
                  : item.materialName

                return (
                  <div
                    key={`${item.materialId || item.expenseHeadId || 'line'}-${index}`}
                    className="pv-details-mobile-line"
                  >
                    <div className="pv-details-mobile-line__top">
                      <strong>
                        {index + 1}. {primaryTitle}
                      </strong>
                      <span>{formatInrCurrency(item.lineTotal)}</span>
                    </div>
                    <div className="pv-details-mobile-line__sub">
                      <span>
                        {isExpense ? 'Other Expense · Non-stock' : 'Raw Material'}
                        {item.quantity !== null &&
                        item.quantity !== undefined &&
                        item.unitPrice !== null &&
                        item.unitPrice !== undefined
                          ? ` · ${formatPurchaseQuantity(item.quantity, item.unit)} × ${formatInrCurrency(item.unitPrice)}`
                          : ''}
                      </span>
                      {isExpense &&
                      item.description &&
                      item.description !== primaryTitle ? (
                        <span>{item.description}</span>
                      ) : null}
                      {item.remarks ? <span>Note: {item.remarks}</span> : null}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="pv-details-summary-wrap">
              <div className="pv-notes-display">
                <span className="pv-meta-card__label">Notes</span>
                <p>{voucher.notes || 'No voucher notes recorded.'}</p>

                {Array.isArray(voucher.reconciliationWarnings) &&
                voucher.reconciliationWarnings.length > 0 ? (
                  <div
                    className="pv-reconcile-inline pv-reconcile-inline--warn pv-details-reconcile-warn"
                    role="status"
                  >
                    <ul className="pv-reconcile-inline__list">
                      {voucher.reconciliationWarnings.map((warn) => (
                        <li key={warn}>{warn}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <div className="pv-financial-box">
                {voucher.expenseSubtotal > 0 ? (
                  <>
                    <div className="pv-financial-row">
                      <span>Raw Materials Subtotal</span>
                      <span>{formatInrCurrency(voucher.materialSubtotal)}</span>
                    </div>
                    <div className="pv-financial-row">
                      <span>Other Expenses Subtotal</span>
                      <span>{formatInrCurrency(voucher.expenseSubtotal)}</span>
                    </div>
                  </>
                ) : null}
                <div className="pv-financial-row">
                  <span>Subtotal</span>
                  <strong>{formatInrCurrency(voucher.subtotal)}</strong>
                </div>
                <div className="pv-financial-row">
                  <span>Discount</span>
                  <span>− {formatInrCurrency(voucher.discountAmount)}</span>
                </div>
                <div className="pv-financial-row">
                  <span>
                    GST / Tax{' '}
                    {voucher.taxMode === 'percentage' &&
                    voucher.taxRatePercent !== null
                      ? `(${voucher.taxRatePercent}%)`
                      : voucher.taxRatePercent !== null
                        ? `(Bill · ${voucher.taxRatePercent}%)`
                        : '(Bill)'}
                  </span>
                  <span>+ {formatInrCurrency(voucher.taxAmount)}</span>
                </div>
                <div className="pv-financial-row">
                  <span>Other Charges</span>
                  <span>+ {formatInrCurrency(voucher.otherCharges)}</span>
                </div>
                <div className="pv-financial-row pv-financial-row--final">
                  <span>Final Total</span>
                  <strong>{formatInrCurrency(voucher.finalTotal)}</strong>
                </div>

                {voucher.projectRecordId && voucher.expenseSubtotal > 0 ? (
                  <div className="pv-allocation-box">
                    <span className="pv-allocation-box__title">
                      Project Financial Allocation
                    </span>
                    <div className="pv-allocation-box__row">
                      <span>Project Purchases</span>
                      <strong>
                        {formatInrCurrency(voucher.materialAllocatedTotal)}
                      </strong>
                    </div>
                    <div className="pv-allocation-box__row">
                      <span>Project Other Expenses</span>
                      <strong>
                        {formatInrCurrency(voucher.expenseAllocatedTotal)}
                      </strong>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="pv-surface pv-section-card">
            <div className="pv-section-card__header">
              <div>
                <h2 className="pv-section-card__title">
                  Attached Supplier Bill
                </h2>
                <p className="pv-section-card__subtitle">
                  Protected original bill images and PDF invoices stored for
                  authorized verification.
                </p>
              </div>
              {voucher.status === 'active' && voucher.attachments.length < 5 ? (
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary"
                  onClick={() =>
                    onNavigate?.(
                      `/purchases/${encodeURIComponent(voucher.id)}/edit`,
                    )
                  }
                >
                  {voucher.attachments.length === 0
                    ? '+ Attach Bill'
                    : 'Manage Attachments'}
                </button>
              ) : null}
            </div>

            {voucher.attachments.length === 0 ? (
              <div className="pv-no-bill-state">
                <strong>No bill attached</strong>
                <p>
                  This purchase voucher was recorded without a supplier bill
                  file.
                  {voucher.status === 'active'
                    ? ' You can attach a scanned bill image or PDF anytime via Edit Voucher.'
                    : ''}
                </p>
              </div>
            ) : (
              <div className="pv-bill-cards-grid">
                {voucher.attachments.map((att) => (
                  <BillAttachmentCard
                    key={att.attachmentId}
                    attachment={att}
                    onOpenPreview={setPreviewAttachment}
                  />
                ))}
              </div>
            )}
          </section>

          {stockMovements.length > 0 ? (
            <section className="pv-surface pv-section-card">
              <h2 className="pv-section-card__title">
                Traceable Stock Synchronization History
              </h2>
              <div className="pv-movements-list">
                {stockMovements.map((mov) => (
                  <div key={mov.id} className="pv-movement-row">
                    <div>
                      <strong>{mov.materialName}</strong>
                      <span className="pv-movement-row__type">
                        {formatMovementLabel(mov.movementType)} · Rev #
                        {mov.revision}
                      </span>
                    </div>
                    <div className="pv-movement-row__right">
                      <span
                        className={`pv-delta-pill ${
                          mov.quantityDelta >= 0
                            ? 'pv-delta-pill--pos'
                            : 'pv-delta-pill--neg'
                        }`}
                      >
                        {mov.quantityDelta >= 0 ? '+' : ''}
                        {formatPurchaseQuantity(mov.quantityDelta, mov.unit)}
                      </span>
                      <span className="pv-movement-row__after">
                        Balance:{' '}
                        {formatPurchaseQuantity(
                          mov.resultingQuantityOnHand,
                          mov.unit,
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      <BillAttachmentModal
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />

      {isCancelModalOpen ? (
        <CancelPurchaseModal
          voucher={voucher}
          isSubmitting={isCancelling}
          errorMessage={cancelError}
          onConfirm={handleConfirmCancel}
          onClose={() => {
            if (!isCancelling) {
              setIsCancelModalOpen(false)
              setCancelError('')
            }
          }}
        />
      ) : null}
    </div>
  )
}
