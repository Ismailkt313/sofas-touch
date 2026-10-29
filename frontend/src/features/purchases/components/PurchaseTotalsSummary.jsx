import { useMemo, useState } from 'react'
import { FieldSourceBadge, FieldSuggestionBanner } from './FieldProvenanceControl'
import {
  GST_PERCENTAGE_PRESETS,
  calculateTaxFromPercentage,
  formatInrCurrency,
  roundTaxPercent,
} from '../services/purchaseService'
import { reconcileInvoiceTotals } from '../utils/billOcrParser'

export function PurchaseTotalsSummary({
  notes,
  onNotesChange,
  previewTotals,
  discountAmount,
  onDiscountChange,
  taxRatePercent = '',
  taxCalculationMode = 'manual',
  onTaxRateChange,
  taxAmount,
  onTaxChange,
  onUsePrintedTax,
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

  const printedTaxAmount =
    typeof ocrState?.printedTaxAmount === 'number' &&
    Number.isFinite(ocrState.printedTaxAmount) &&
    ocrState.printedTaxAmount >= 0
      ? ocrState.printedTaxAmount
      : null

  const activeRateNum = useMemo(
    () => roundTaxPercent(taxRatePercent),
    [taxRatePercent],
  )

  const rateBasedTax = useMemo(() => {
    if (activeRateNum === null) {
      return null
    }
    return calculateTaxFromPercentage(
      previewTotals.subtotal,
      discountAmount,
      activeRateNum,
    )
  }, [previewTotals.subtotal, discountAmount, activeRateNum])

  const reconciliation = useMemo(
    () =>
      reconcileInvoiceTotals({
        calculatedSubtotal: previewTotals.subtotal,
        printedSubtotal: ocrState?.detectedSubtotal ?? null,
        printedTaxAmount,
        discountAmount,
        taxAmount,
        otherCharges,
        printedFinalTotal: ocrState?.detectedGrandTotal ?? null,
      }),
    [
      previewTotals.subtotal,
      ocrState?.detectedSubtotal,
      ocrState?.detectedGrandTotal,
      printedTaxAmount,
      discountAmount,
      taxAmount,
      otherCharges,
    ],
  )

  const hasPrintedTotals =
    reconciliation.printedSubtotal !== null ||
    reconciliation.printedTaxAmount !== null ||
    reconciliation.printedFinalTotal !== null

  const currentTaxDiffersFromPrinted =
    printedTaxAmount !== null &&
    Math.abs(previewTotals.taxAmount - printedTaxAmount) > 0.05

  const rateTaxDiffersFromPrinted =
    !currentTaxDiffersFromPrinted &&
    printedTaxAmount !== null &&
    rateBasedTax !== null &&
    Math.abs(rateBasedTax - printedTaxAmount) > 0.5

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
                    Tax / GST (+)
                  </label>
                  {ocrState?.taxBreakdownLabel ? (
                    <span className="pv-tax-breakdown-pill">
                      {ocrState.taxBreakdownLabel}
                    </span>
                  ) : null}
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

              <div className="pv-tax-rate-bar" aria-label="GST rate options">
                <div className="pv-tax-rate-presets">
                  {GST_PERCENTAGE_PRESETS.map((preset) => {
                    const isSelected =
                      activeRateNum !== null &&
                      Math.abs(activeRateNum - preset) < 0.001
                    return (
                      <button
                        key={preset}
                        type="button"
                        className={`pv-tax-preset-btn${
                          isSelected ? ' pv-tax-preset-btn--active' : ''
                        }`}
                        aria-pressed={isSelected}
                        onClick={() => onTaxRateChange?.(String(preset))}
                        disabled={isSaving}
                      >
                        {preset}%
                      </button>
                    )
                  })}
                </div>

                <div className="pv-tax-rate-custom">
                  <label htmlFor="pv-tax-rate" className="sr-only">
                    GST percentage
                  </label>
                  <input
                    id="pv-tax-rate"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    max="100"
                    className={`pv-input pv-input--tax-pct${
                      fieldErrors.taxRatePercent ? ' pv-input--error' : ''
                    }`}
                    placeholder="GST %"
                    value={taxRatePercent}
                    onChange={(e) => onTaxRateChange?.(e.target.value)}
                    disabled={isSaving}
                  />
                  <span className="pv-tax-rate-suffix" aria-hidden="true">
                    %
                  </span>
                </div>
              </div>

              {currentTaxDiffersFromPrinted ? (
                <div className="pv-tax-diff-bar" role="status">
                  <span>
                    Printed bill GST:{' '}
                    <strong>{formatInrCurrency(printedTaxAmount)}</strong> ·{' '}
                    {taxCalculationMode === 'percentage'
                      ? 'Calculated GST'
                      : 'Current voucher GST'}
                    :{' '}
                    <strong>{formatInrCurrency(previewTotals.taxAmount)}</strong>
                  </span>
                  {onUsePrintedTax ? (
                    <button
                      type="button"
                      className="pv-link-btn"
                      onClick={() => onUsePrintedTax(printedTaxAmount)}
                      disabled={isSaving}
                    >
                      Use bill GST
                    </button>
                  ) : null}
                </div>
              ) : rateTaxDiffersFromPrinted ? (
                <div className="pv-tax-diff-bar" role="status">
                  <span>
                    Printed bill GST:{' '}
                    <strong>{formatInrCurrency(printedTaxAmount)}</strong> ·{' '}
                    {activeRateNum}% on current items:{' '}
                    <strong>{formatInrCurrency(rateBasedTax)}</strong>
                  </span>
                  <button
                    type="button"
                    className="pv-link-btn"
                    onClick={() => onTaxRateChange?.(String(activeRateNum))}
                    disabled={isSaving}
                  >
                    Apply {activeRateNum}%
                  </button>
                </div>
              ) : null}

              {fieldErrors.taxRatePercent ? (
                <p className="pv-field-error">{fieldErrors.taxRatePercent}</p>
              ) : null}
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
                        reconciliation.printedSubtotal ??
                        reconciliation.printedTaxAmount,
                    )})`}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
