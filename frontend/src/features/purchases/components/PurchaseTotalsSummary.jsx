import { useMemo, useState } from 'react'
import { FieldSourceBadge, FieldSuggestionBanner } from './FieldProvenanceControl'
import { formatInrCurrency } from '../services/purchaseService'
import { reconcileInvoiceTotals } from '../utils/billOcrParser'
import { GST_PERCENTAGE_PRESETS } from '../utils/purchaseMath'

export function PurchaseTotalsSummary({
  notes,
  onNotesChange,
  previewTotals,
  discountAmount,
  onDiscountChange,
  taxMode = 'bill_amount',
  onTaxModeChange,
  taxRatePercent = '',
  onTaxRatePercentChange,
  taxAmount,
  onTaxChange,
  otherCharges,
  onOtherChargesChange,
  printedInvoiceSummary = null,
  hasSelectedProject = false,
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

  const isPercentageMode = taxMode === 'percentage'

  const effectivePrintedSummary = useMemo(() => {
    if (printedInvoiceSummary) {
      return printedInvoiceSummary
    }
    if (
      ocrState?.detectedSubtotal !== null ||
      ocrState?.detectedGrandTotal !== null
    ) {
      return {
        printedSubtotal: ocrState?.detectedSubtotal ?? null,
        printedDiscountAmount: ocrState?.printedDiscountAmount ?? null,
        printedTaxAmount: ocrState?.printedTaxAmount ?? null,
        printedTaxRatePercent: ocrState?.extractedTaxRatePercent ?? null,
        printedCgstAmount: ocrState?.cgstAmount ?? null,
        printedSgstAmount: ocrState?.sgstAmount ?? null,
        printedIgstAmount: ocrState?.igstAmount ?? null,
        printedOtherCharges: ocrState?.printedOtherCharges ?? null,
        printedGrandTotal: ocrState?.detectedGrandTotal ?? null,
      }
    }
    return null
  }, [printedInvoiceSummary, ocrState])

  const reconciliation = useMemo(
    () =>
      reconcileInvoiceTotals({
        calculatedSubtotal: previewTotals.subtotal,
        printedSubtotal: effectivePrintedSummary?.printedSubtotal ?? null,
        discountAmount: previewTotals.discount,
        printedDiscountAmount:
          effectivePrintedSummary?.printedDiscountAmount ?? undefined,
        taxAmount: previewTotals.tax,
        printedTaxAmount:
          effectivePrintedSummary?.printedTaxAmount ?? undefined,
        otherCharges: previewTotals.charges,
        printedOtherCharges:
          effectivePrintedSummary?.printedOtherCharges ?? undefined,
        printedFinalTotal: effectivePrintedSummary?.printedGrandTotal ?? null,
        hasConfirmedItems: previewTotals.subtotal > 0,
      }),
    [
      previewTotals.subtotal,
      previewTotals.discount,
      previewTotals.tax,
      previewTotals.charges,
      effectivePrintedSummary,
    ],
  )

  const hasPrintedTotals = Boolean(
    reconciliation.printedSubtotal !== null ||
      reconciliation.printedDiscountAmount !== null ||
      reconciliation.printedTaxAmount !== null ||
      reconciliation.printedOtherCharges !== null ||
      reconciliation.printedFinalTotal !== null,
  )

  const showSplitSubtotals = previewTotals.expenseSubtotal > 0
  const explicitPrintedRate =
    effectivePrintedSummary?.printedTaxRatePercent ?? null
  const printedCgst = effectivePrintedSummary?.printedCgstAmount ?? null
  const printedSgst = effectivePrintedSummary?.printedSgstAmount ?? null
  const printedIgst = effectivePrintedSummary?.printedIgstAmount ?? null

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

          {hasPrintedTotals ? (
            <div
              className="pv-printed-bill-card"
              aria-label="Printed bill figures"
            >
              <span className="pv-printed-bill-card__title">
                Printed figures on bill (retained for verification)
              </span>
              <div className="pv-printed-bill-card__grid">
                {reconciliation.printedSubtotal !== null ? (
                  <span>
                    Subtotal:{' '}
                    <strong>
                      {formatInrCurrency(reconciliation.printedSubtotal)}
                    </strong>
                  </span>
                ) : null}
                {reconciliation.printedDiscountAmount !== null ? (
                  <span>
                    Discount:{' '}
                    <strong>
                      {formatInrCurrency(reconciliation.printedDiscountAmount)}
                    </strong>
                  </span>
                ) : null}
                {reconciliation.printedTaxAmount !== null ? (
                  <span>
                    GST/Tax:{' '}
                    <strong>
                      {formatInrCurrency(reconciliation.printedTaxAmount)}
                    </strong>
                  </span>
                ) : null}
                {reconciliation.printedOtherCharges !== null ? (
                  <span>
                    Charges:{' '}
                    <strong>
                      {formatInrCurrency(reconciliation.printedOtherCharges)}
                    </strong>
                  </span>
                ) : null}
                {reconciliation.printedFinalTotal !== null ? (
                  <span>
                    Grand Total:{' '}
                    <strong>
                      {formatInrCurrency(reconciliation.printedFinalTotal)}
                    </strong>
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="pv-ledger">
          <h2 id="pv-totals-heading" className="pv-section-title">
            Totals &amp; GST
          </h2>

          <div className="pv-ledger__rows">
            {showSplitSubtotals ? (
              <>
                <div className="pv-ledger__row pv-ledger__row--sub">
                  <span className="pv-ledger__label">Raw materials</span>
                  <span className="pv-ledger__amount">
                    {formatInrCurrency(previewTotals.materialSubtotal)}
                  </span>
                </div>
                <div className="pv-ledger__row pv-ledger__row--sub">
                  <span className="pv-ledger__label">Other expenses</span>
                  <span className="pv-ledger__amount">
                    {formatInrCurrency(previewTotals.expenseSubtotal)}
                  </span>
                </div>
              </>
            ) : null}

            {previewTotals.unclassifiedCount > 0 ? (
              <div className="pv-ledger__row pv-ledger__row--sub">
                <span className="pv-ledger__label">
                  Unclassified ({previewTotals.unclassifiedCount})
                </span>
                <span className="pv-ledger__amount">
                  {formatInrCurrency(previewTotals.unclassifiedSubtotal)}
                </span>
              </div>
            ) : null}

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

            {previewTotals.discount > 0 || isPercentageMode ? (
              <div className="pv-ledger__row pv-ledger__row--sub">
                <span className="pv-ledger__label">Taxable subtotal</span>
                <span className="pv-ledger__amount">
                  {formatInrCurrency(previewTotals.taxableSubtotal)}
                </span>
              </div>
            ) : null}

            <div className="pv-tax-box">
              <div className="pv-tax-box__head">
                <span className="pv-ledger__label">GST / Tax (+)</span>
                <div
                  className="pv-tax-mode-seg"
                  role="group"
                  aria-label="GST calculation mode"
                >
                  <button
                    type="button"
                    className={`pv-tax-mode-seg__btn${
                      !isPercentageMode ? ' pv-tax-mode-seg__btn--active' : ''
                    }`}
                    onClick={() => onTaxModeChange?.('bill_amount')}
                    disabled={isSaving}
                  >
                    Bill Amount
                  </button>
                  <button
                    type="button"
                    className={`pv-tax-mode-seg__btn${
                      isPercentageMode ? ' pv-tax-mode-seg__btn--active' : ''
                    }`}
                    onClick={() => onTaxModeChange?.('percentage')}
                    disabled={isSaving}
                  >
                    By %
                  </button>
                </div>
              </div>

              {!isPercentageMode ? (
                <div className="pv-ledger__field-block">
                  <div className="pv-ledger__row">
                    <span className="pv-ledger__label-group">
                      <label htmlFor="pv-tax" className="pv-tax-sub-label">
                        Tax from bill (₹)
                      </label>
                      <FieldSourceBadge
                        meta={fieldMeta.taxAmount}
                        hasValue={String(taxAmount ?? '').trim() !== ''}
                      />
                      {explicitPrintedRate !== null ? (
                        <span className="pv-tax-rate-pill">
                          Printed {explicitPrintedRate}%
                        </span>
                      ) : null}
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
                  {(printedCgst !== null ||
                    printedSgst !== null ||
                    printedIgst !== null) ? (
                    <span className="pv-tax-comp-caption">
                      Bill GST breakdown:{' '}
                      {[
                        printedCgst !== null
                          ? `CGST ${formatInrCurrency(printedCgst)}`
                          : '',
                        printedSgst !== null
                          ? `SGST ${formatInrCurrency(printedSgst)}`
                          : '',
                        printedIgst !== null
                          ? `IGST ${formatInrCurrency(printedIgst)}`
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' + ')}
                    </span>
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
              ) : (
                <div className="pv-ledger__field-block">
                  <div className="pv-tax-presets">
                    {GST_PERCENTAGE_PRESETS.map((preset) => {
                      const activePreset =
                        String(taxRatePercent ?? '').trim() !== '' &&
                        Number(taxRatePercent) === preset
                      return (
                        <button
                          key={preset}
                          type="button"
                          className={`pv-tax-preset-chip${
                            activePreset ? ' pv-tax-preset-chip--active' : ''
                          }`}
                          onClick={() =>
                            onTaxRatePercentChange?.(String(preset))
                          }
                          disabled={isSaving}
                        >
                          {preset}%
                        </button>
                      )
                    })}
                  </div>
                  <div className="pv-ledger__row">
                    <span className="pv-ledger__label-group">
                      <label htmlFor="pv-tax-rate" className="pv-tax-sub-label">
                        GST rate (%)
                      </label>
                      <input
                        id="pv-tax-rate"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        max="100"
                        className={`pv-input pv-input--pct${
                          fieldErrors.taxRatePercent ? ' pv-input--error' : ''
                        }`}
                        placeholder="18"
                        value={taxRatePercent}
                        onChange={(e) =>
                          onTaxRatePercentChange?.(e.target.value)
                        }
                        disabled={isSaving}
                      />
                    </span>
                    <strong className="pv-ledger__amount">
                      {formatInrCurrency(previewTotals.percentageTax)}
                    </strong>
                  </div>
                  {fieldErrors.taxRatePercent ? (
                    <p className="pv-field-error">
                      {fieldErrors.taxRatePercent}
                    </p>
                  ) : null}
                </div>
              )}
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

            {hasSelectedProject &&
            showSplitSubtotals &&
            previewTotals.unclassifiedCount === 0 ? (
              <div
                className="pv-allocation-box"
                aria-label="Project cost allocation"
              >
                <span className="pv-allocation-box__title">
                  Project financial summary allocation
                </span>
                <div className="pv-allocation-box__row">
                  <span>Purchases (materials + allocated tax/charges)</span>
                  <strong>
                    {formatInrCurrency(previewTotals.materialAllocatedTotal)}
                  </strong>
                </div>
                <div className="pv-allocation-box__row">
                  <span>Other Expenses (expenses + allocated tax/charges)</span>
                  <strong>
                    {formatInrCurrency(previewTotals.expenseAllocatedTotal)}
                  </strong>
                </div>
              </div>
            ) : null}

            {hasPrintedTotals ? (
              <div
                className={`pv-reconcile-inline${
                  reconciliation.hasMismatch
                    ? ' pv-reconcile-inline--warn'
                    : ' pv-reconcile-inline--ok'
                }`}
                role={reconciliation.hasMismatch ? 'alert' : 'status'}
              >
                {reconciliation.hasMismatch ? (
                  <ul className="pv-reconcile-inline__list">
                    {reconciliation.mismatchMessages.map((msg) => (
                      <li key={msg}>{msg}</li>
                    ))}
                  </ul>
                ) : (
                  `Reconciled with printed bill total (${formatInrCurrency(
                    reconciliation.printedFinalTotal ??
                      reconciliation.printedSubtotal,
                  )})`
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
