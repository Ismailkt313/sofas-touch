import { useMemo } from 'react'
import { formatInrCurrency } from '../services/purchaseService'
import { reconcileInvoiceTotals } from '../utils/billOcrParser'

export function PurchaseTotalsSummary({
  notes,
  onNotesChange,
  previewTotals,
  discountAmount,
  onDiscountChange,
  taxAmount,
  onTaxChange,
  otherCharges,
  onOtherChargesChange,
  fieldErrors,
  ocrState,
  isSaving,
}) {
  const reconciliation = useMemo(
    () =>
      reconcileInvoiceTotals({
        calculatedSubtotal: previewTotals.subtotal,
        printedSubtotal: ocrState?.detectedSubtotal ?? null,
        discountAmount,
        taxAmount,
        otherCharges,
        printedFinalTotal: ocrState?.detectedGrandTotal ?? null,
      }),
    [
      previewTotals.subtotal,
      ocrState?.detectedSubtotal,
      ocrState?.detectedGrandTotal,
      discountAmount,
      taxAmount,
      otherCharges,
    ],
  )

  const showReconciliation = Boolean(
    ocrState?.completed ||
      reconciliation.printedSubtotal !== null ||
      reconciliation.printedFinalTotal !== null,
  )

  return (
    <section className="pv-surface pv-section-card pv-totals-grid">
      <div className="pv-notes-column">
        <div className="pv-form-field">
          <label htmlFor="pv-notes" className="pv-form-label">
            Voucher Notes <span className="pv-opt">(Optional)</span>
          </label>
          <textarea
            id="pv-notes"
            rows={4}
            className="pv-textarea"
            placeholder="Delivery challan reference, quality inspection remarks, or unloading notes..."
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            maxLength={1000}
            disabled={isSaving}
          />
        </div>
      </div>

      <div className="pv-financial-box">
        <h3 className="pv-financial-box__title">Voucher Totals</h3>

        <div className="pv-financial-row">
          <span>Items Subtotal</span>
          <strong>{formatInrCurrency(previewTotals.subtotal)}</strong>
        </div>

        <div className="pv-financial-input-row">
          <label htmlFor="pv-discount">Discount (− ₹)</label>
          <input
            id="pv-discount"
            type="number"
            step="0.01"
            min="0"
            className={`pv-input pv-input--num${
              fieldErrors.discountAmount ? ' pv-input--error' : ''
            }`}
            placeholder="0.00"
            value={discountAmount}
            onChange={(e) => onDiscountChange(e.target.value)}
            disabled={isSaving}
          />
        </div>
        {fieldErrors.discountAmount ? (
          <p className="pv-field-error">{fieldErrors.discountAmount}</p>
        ) : null}

        <div className="pv-financial-input-row">
          <label htmlFor="pv-tax">GST / Tax (+ ₹)</label>
          <input
            id="pv-tax"
            type="number"
            step="0.01"
            min="0"
            className={`pv-input pv-input--num${
              fieldErrors.taxAmount ? ' pv-input--error' : ''
            }`}
            placeholder="0.00"
            value={taxAmount}
            onChange={(e) => onTaxChange(e.target.value)}
            disabled={isSaving}
          />
        </div>
        {fieldErrors.taxAmount ? (
          <p className="pv-field-error">{fieldErrors.taxAmount}</p>
        ) : null}

        <div className="pv-financial-input-row">
          <label htmlFor="pv-other-charges">
            Freight / Other Charges (+ ₹)
          </label>
          <input
            id="pv-other-charges"
            type="number"
            step="0.01"
            min="0"
            className={`pv-input pv-input--num${
              fieldErrors.otherCharges ? ' pv-input--error' : ''
            }`}
            placeholder="0.00"
            value={otherCharges}
            onChange={(e) => onOtherChargesChange(e.target.value)}
            disabled={isSaving}
          />
        </div>
        {fieldErrors.otherCharges ? (
          <p className="pv-field-error">{fieldErrors.otherCharges}</p>
        ) : null}

        <div className="pv-financial-row pv-financial-row--final">
          <span>Final Total</span>
          <strong>{formatInrCurrency(previewTotals.finalTotal)}</strong>
        </div>

        {showReconciliation ? (
          <div
            className={`pv-reconcile-box${
              reconciliation.hasMismatch
                ? ' pv-reconcile-box--mismatch'
                : reconciliation.printedSubtotal !== null ||
                    reconciliation.printedFinalTotal !== null
                  ? ' pv-reconcile-box--matched'
                  : ''
            }`}
            role="status"
          >
            <div className="pv-reconcile-box__title">
              Invoice Totals Verification
            </div>

            {reconciliation.printedSubtotal !== null ? (
              <div className="pv-reconcile-row">
                <span>Printed Bill Subtotal</span>
                <span>
                  <strong>
                    {formatInrCurrency(reconciliation.printedSubtotal)}
                  </strong>{' '}
                  <span
                    className={`pv-reconcile-pill${
                      reconciliation.subtotalMatches
                        ? ' pv-reconcile-pill--ok'
                        : ' pv-reconcile-pill--warn'
                    }`}
                  >
                    {reconciliation.subtotalMatches ? 'Matched' : 'Mismatch'}
                  </span>
                </span>
              </div>
            ) : null}

            {reconciliation.printedFinalTotal !== null ? (
              <div className="pv-reconcile-row">
                <span>Printed Bill Final Total</span>
                <span>
                  <strong>
                    {formatInrCurrency(reconciliation.printedFinalTotal)}
                  </strong>{' '}
                  <span
                    className={`pv-reconcile-pill${
                      reconciliation.finalTotalMatches
                        ? ' pv-reconcile-pill--ok'
                        : ' pv-reconcile-pill--warn'
                    }`}
                  >
                    {reconciliation.finalTotalMatches ? 'Matched' : 'Mismatch'}
                  </span>
                </span>
              </div>
            ) : null}

            {reconciliation.hasMismatch ? (
              <ul className="pv-reconcile-warnings">
                {reconciliation.mismatchMessages.map((msg, idx) => (
                  <li key={idx}>{msg}</li>
                ))}
              </ul>
            ) : reconciliation.printedSubtotal === null &&
              reconciliation.printedFinalTotal === null ? (
              <p className="pv-reconcile-note">
                Printed invoice subtotal and final total could not be read
                automatically. Verify the calculated totals against the bill
                preview before saving.
              </p>
            ) : (
              <p className="pv-reconcile-note">
                Calculated voucher totals match the printed bill totals.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  )
}
