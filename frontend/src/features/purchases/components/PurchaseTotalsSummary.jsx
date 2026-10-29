import { useMemo, useState } from 'react'
import { FieldSourceBadge, FieldSuggestionBanner } from './FieldProvenanceControl'
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
  fieldMeta = {},
  fieldSuggestions = {},
  onAcceptFieldSuggestion,
  onDismissFieldSuggestion,
  fieldErrors,
  ocrState,
  isSaving,
}) {
  const [notesExpanded, setNotesExpanded] = useState(false)
  const [discountExpanded, setDiscountExpanded] = useState(false)

  const hasNotesValue = Boolean(String(notes || '').trim())
  const showNotesInput =
    hasNotesValue || Boolean(fieldSuggestions.notes) || notesExpanded

  const hasDiscountValue = String(discountAmount ?? '').trim() !== ''
  const showDiscountInput =
    hasDiscountValue ||
    Boolean(fieldErrors.discountAmount) ||
    Boolean(fieldSuggestions.discountAmount) ||
    discountExpanded

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

  const hasPrintedTotals =
    reconciliation.printedSubtotal !== null ||
    reconciliation.printedFinalTotal !== null

  return (
    <section
      className="pv-voucher-section pv-totals-section"
      aria-labelledby="pv-totals-heading"
    >
      <div className="pv-totals-layout">
        <div className="pv-totals-notes">
          {!showNotesInput ? (
            <button
              type="button"
              className="pv-note-toggle pv-note-toggle--voucher"
              onClick={() => setNotesExpanded(true)}
              disabled={isSaving}
            >
              + Add voucher note
            </button>
          ) : (
            <div className="pv-form-field">
              <div className="pv-label-row">
                <label htmlFor="pv-notes" className="pv-form-label">
                  Voucher note <span className="pv-opt">(optional)</span>
                </label>
                <div className="pv-label-row__right">
                  <FieldSourceBadge
                    meta={fieldMeta.notes}
                    hasValue={hasNotesValue}
                  />
                  {!hasNotesValue ? (
                    <button
                      type="button"
                      className="pv-note-toggle"
                      onClick={() => setNotesExpanded(false)}
                    >
                      Hide
                    </button>
                  ) : null}
                </div>
              </div>
              <textarea
                id="pv-notes"
                rows={2}
                className="pv-textarea pv-textarea--compact"
                placeholder="Delivery challan ref, inspection note, or unloading remarks..."
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                maxLength={1000}
                disabled={isSaving}
              />
              <FieldSuggestionBanner
                suggestion={fieldSuggestions.notes}
                onAccept={() => onAcceptFieldSuggestion?.('notes')}
                onDismiss={() => onDismissFieldSuggestion?.('notes')}
                disabled={isSaving}
              />
            </div>
          )}
        </div>

        <div className="pv-ledger">
          <h2 id="pv-totals-heading" className="pv-section-title">
            Totals
          </h2>

          <div className="pv-ledger__rows">
            <div className="pv-ledger__row">
              <span className="pv-ledger__label">Subtotal</span>
              <strong className="pv-ledger__amount">
                {formatInrCurrency(previewTotals.subtotal)}
              </strong>
            </div>

            {!showDiscountInput ? (
              <div className="pv-ledger__discount-trigger">
                <button
                  type="button"
                  className="pv-note-toggle"
                  onClick={() => setDiscountExpanded(true)}
                  disabled={isSaving}
                >
                  + Add discount
                </button>
              </div>
            ) : (
              <div className="pv-ledger__field-block">
                <div className="pv-ledger__row">
                  <span className="pv-ledger__label-group">
                    <label htmlFor="pv-discount" className="pv-ledger__label">
                      Discount (−)
                    </label>
                    <FieldSourceBadge
                      meta={fieldMeta.discountAmount}
                      hasValue={hasDiscountValue}
                    />
                    {!hasDiscountValue && !fieldErrors.discountAmount ? (
                      <button
                        type="button"
                        className="pv-note-toggle"
                        onClick={() => setDiscountExpanded(false)}
                      >
                        Hide
                      </button>
                    ) : null}
                  </span>
                  <input
                    id="pv-discount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    className={`pv-input pv-input--ledger${
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
                <FieldSuggestionBanner
                  suggestion={fieldSuggestions.discountAmount}
                  labelPrefix="Bill discount"
                  formatValue={(v) => formatInrCurrency(Number(v))}
                  onAccept={() => onAcceptFieldSuggestion?.('discountAmount')}
                  onDismiss={() => onDismissFieldSuggestion?.('discountAmount')}
                  disabled={isSaving}
                />
              </div>
            )}

            <div className="pv-ledger__field-block">
              <div className="pv-ledger__row">
                <span className="pv-ledger__label-group">
                  <label htmlFor="pv-tax" className="pv-ledger__label">
                    Tax (+)
                  </label>
                  <FieldSourceBadge
                    meta={fieldMeta.taxAmount}
                    hasValue={String(taxAmount ?? '').trim() !== ''}
                  />
                </span>
                <input
                  id="pv-tax"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  className={`pv-input pv-input--ledger${
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
              <FieldSuggestionBanner
                suggestion={fieldSuggestions.taxAmount}
                labelPrefix="Bill tax"
                formatValue={(v) => formatInrCurrency(Number(v))}
                onAccept={() => onAcceptFieldSuggestion?.('taxAmount')}
                onDismiss={() => onDismissFieldSuggestion?.('taxAmount')}
                disabled={isSaving}
              />
            </div>

            <div className="pv-ledger__field-block">
              <div className="pv-ledger__row">
                <span className="pv-ledger__label-group">
                  <label
                    htmlFor="pv-other-charges"
                    className="pv-ledger__label"
                  >
                    Other charges (+)
                  </label>
                  <FieldSourceBadge
                    meta={fieldMeta.otherCharges}
                    hasValue={String(otherCharges ?? '').trim() !== ''}
                  />
                </span>
                <input
                  id="pv-other-charges"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  className={`pv-input pv-input--ledger${
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
              <FieldSuggestionBanner
                suggestion={fieldSuggestions.otherCharges}
                labelPrefix="Bill charges"
                formatValue={(v) => formatInrCurrency(Number(v))}
                onAccept={() => onAcceptFieldSuggestion?.('otherCharges')}
                onDismiss={() => onDismissFieldSuggestion?.('otherCharges')}
                disabled={isSaving}
              />
            </div>

            <div className="pv-ledger__row pv-ledger__row--final">
              <span>Final total</span>
              <strong>{formatInrCurrency(previewTotals.finalTotal)}</strong>
            </div>

            {hasPrintedTotals ? (
              <div
                className={`pv-reconcile-inline${
                  reconciliation.hasMismatch
                    ? ' pv-reconcile-inline--warn'
                    : ' pv-reconcile-inline--ok'
                }`}
                role="status"
              >
                {reconciliation.hasMismatch
                  ? reconciliation.mismatchMessages[0]
                  : `Matches printed bill total (${formatInrCurrency(
                      reconciliation.printedFinalTotal ??
                        reconciliation.printedSubtotal,
                    )})`}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
