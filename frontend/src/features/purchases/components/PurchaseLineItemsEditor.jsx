import { useState } from 'react'
import { Dropdown } from '../../../components/common'
import {
  RAW_MATERIAL_UNITS,
  formatMaterialUnit,
  formatMaterialUnitOptionLabel,
} from '../../raw-materials'
import {
  calculateLineTotalPreview,
  formatInrCurrency,
} from '../services/purchaseService'

const DETECTED_UNIT_OPTIONS = [
  { value: '', label: 'Unspecified bill unit' },
  ...RAW_MATERIAL_UNITS.map((u) => ({
    value: u,
    label: formatMaterialUnitOptionLabel(u),
  })),
]

export function PurchaseLineItemsEditor({
  lineItems,
  uncertainLineItems = [],
  materialById,
  materialOptions,
  fieldErrors,
  isSaving,
  adminAccess,
  onAddLineRow,
  onUpdateLineItem,
  onRemoveLineRow,
  onPromoteUncertainRow,
  onDismissUncertainRow,
  onDismissAllUncertainRows,
  onRequestCancelToCatalog,
}) {
  const [editingOcrRefMap, setEditingOcrRefMap] = useState({})

  const toggleEditOcrRef = (rowKey) => {
    setEditingOcrRefMap((prev) => ({
      ...prev,
      [rowKey]: !prev[rowKey],
    }))
  }

  return (
    <section className="pv-surface pv-section-card">
      <div className="pv-section-card__header">
        <div>
          <h2 className="pv-section-card__title">Material Line Items</h2>
          <p className="pv-section-card__subtitle">
            Select an existing Raw Material to lock in its supported unit and
            update stock on hand when saved.
          </p>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn--secondary"
          onClick={onAddLineRow}
          disabled={isSaving}
        >
          + Add Material Row
        </button>
      </div>

      {fieldErrors.lineItems ? (
        <p className="pv-field-error">{fieldErrors.lineItems}</p>
      ) : null}

      <div className="pv-lines-list">
        {lineItems.map((row, idx) => {
          const selectedMat = materialById.get(row.materialId)
          const lineTotal = calculateLineTotalPreview(
            row.quantity,
            row.unitPrice,
          )
          const matErr = fieldErrors[`lineItems[${idx}].materialId`]
          const qtyErr = fieldErrors[`lineItems[${idx}].quantity`]
          const priceErr = fieldErrors[`lineItems[${idx}].unitPrice`]
          const needsMaterialReview =
            Boolean(row.extractedDescription || row.needsReview) &&
            !row.materialId
          const hasUnitMismatch =
            Boolean(selectedMat && row.detectedUnit) &&
            String(formatMaterialUnit(selectedMat.unit) || selectedMat.unit || '').toLowerCase() !==
              String(formatMaterialUnit(row.detectedUnit) || row.detectedUnit || '').toLowerCase()
          const isEditingOcrRef = Boolean(editingOcrRefMap[row.rowKey])

          return (
            <div
              key={row.rowKey}
              className={`pv-line-card${
                needsMaterialReview || hasUnitMismatch
                  ? ' pv-line-card--review'
                  : ''
              }`}
            >
              <div className="pv-line-card__top">
                <span className="pv-line-card__index">Item #{idx + 1}</span>

                {row.extractedDescription ? (
                  <span className="pv-ocr-detected-pill">
                    Detected on bill: &ldquo;{row.extractedDescription}&rdquo;
                    {row.detectedUnit
                      ? ` (${formatMaterialUnit(row.detectedUnit) || row.detectedUnit})`
                      : ''}
                  </span>
                ) : null}

                <div className="pv-line-card__top-actions">
                  {row.extractedDescription || row.detectedUnit ? (
                    <button
                      type="button"
                      className="pv-text-btn pv-text-btn--sm"
                      onClick={() => toggleEditOcrRef(row.rowKey)}
                      disabled={isSaving}
                    >
                      {isEditingOcrRef ? 'Done Editing Bill Ref' : 'Edit Bill Ref'}
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="pv-line-remove-btn"
                    onClick={() => onRemoveLineRow(row.rowKey)}
                    disabled={isSaving}
                    aria-label={`Remove line item ${idx + 1}`}
                  >
                    {lineItems.length > 1 ? 'Remove' : 'Clear'}
                  </button>
                </div>
              </div>

              {isEditingOcrRef ? (
                <div className="pv-ocr-ref-edit-grid">
                  <div className="pv-form-field">
                    <label className="pv-form-label">
                      Extracted Bill Description
                    </label>
                    <input
                      type="text"
                      className="pv-input pv-input--compact"
                      value={row.extractedDescription || ''}
                      onChange={(e) =>
                        onUpdateLineItem(
                          row.rowKey,
                          'extractedDescription',
                          e.target.value,
                        )
                      }
                      disabled={isSaving}
                      aria-label={`Line item ${idx + 1} extracted description`}
                    />
                  </div>
                  <div className="pv-form-field">
                    <label className="pv-form-label">Detected Bill Unit</label>
                    <select
                      className="pv-input pv-input--compact"
                      value={row.detectedUnit || ''}
                      onChange={(e) =>
                        onUpdateLineItem(
                          row.rowKey,
                          'detectedUnit',
                          e.target.value,
                        )
                      }
                      disabled={isSaving}
                      aria-label={`Line item ${idx + 1} detected unit`}
                    >
                      {DETECTED_UNIT_OPTIONS.map((opt) => (
                        <option key={opt.value || 'none'} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

              {!row.materialId &&
              Array.isArray(row.suggestions) &&
              row.suggestions.length > 0 ? (
                <div className="pv-suggestions-row">
                  <span className="pv-suggestions-row__label">
                    Likely catalog match (click to confirm):
                  </span>
                  {row.suggestions.map((sug) => (
                    <button
                      key={sug.id}
                      type="button"
                      className="pv-suggestion-chip"
                      onClick={() =>
                        onUpdateLineItem(row.rowKey, 'materialId', sug.id)
                      }
                    >
                      {sug.name} ({formatMaterialUnit(sug.unit)})
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="pv-line-card__grid">
                <div className="pv-form-field pv-line-card__mat-col">
                  <label className="pv-form-label">
                    Raw Material <span className="pv-req">*</span>
                  </label>
                  <Dropdown
                    variant="form"
                    value={row.materialId}
                    options={materialOptions}
                    placeholder="Select raw material..."
                    error={Boolean(matErr || needsMaterialReview)}
                    disabled={isSaving}
                    onChange={(val) =>
                      onUpdateLineItem(row.rowKey, 'materialId', val)
                    }
                    ariaLabel={`Line item ${idx + 1} raw material`}
                  />
                  {matErr ? (
                    <p className="pv-field-error">{matErr}</p>
                  ) : needsMaterialReview ? (
                    <p className="pv-field-review-hint">
                      Confirm the matching Raw Material for this bill line.
                    </p>
                  ) : null}
                </div>

                <div className="pv-form-field pv-line-card__unit-col">
                  <label className="pv-form-label">Unit</label>
                  <div
                    className={`pv-readonly-unit${
                      hasUnitMismatch ? ' pv-readonly-unit--mismatch' : ''
                    }`}
                    title={
                      selectedMat
                        ? formatMaterialUnitOptionLabel(selectedMat.unit)
                        : row.detectedUnit
                          ? `Bill unit: ${formatMaterialUnitOptionLabel(row.detectedUnit)}`
                          : 'Select a material to auto-fill unit'
                    }
                  >
                    {selectedMat
                      ? formatMaterialUnitOptionLabel(selectedMat.unit)
                      : row.detectedUnit
                        ? `Bill: ${formatMaterialUnit(row.detectedUnit) || row.detectedUnit}`
                        : 'Auto-filled'}
                  </div>
                  {hasUnitMismatch ? (
                    <p className="pv-field-review-hint">
                      Bill unit ({formatMaterialUnit(row.detectedUnit)}) differs
                      from catalog unit ({formatMaterialUnit(selectedMat.unit)})
                      — verify quantity.
                    </p>
                  ) : null}
                </div>

                <div className="pv-form-field">
                  <label className="pv-form-label">
                    Quantity <span className="pv-req">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    className={`pv-input${qtyErr ? ' pv-input--error' : ''}`}
                    placeholder="0"
                    value={row.quantity}
                    onChange={(e) =>
                      onUpdateLineItem(row.rowKey, 'quantity', e.target.value)
                    }
                    disabled={isSaving}
                    aria-label={`Line item ${idx + 1} quantity`}
                  />
                  {qtyErr ? <p className="pv-field-error">{qtyErr}</p> : null}
                </div>

                <div className="pv-form-field">
                  <label className="pv-form-label">
                    Unit Price (₹) <span className="pv-req">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className={`pv-input${priceErr ? ' pv-input--error' : ''}`}
                    placeholder="0.00"
                    value={row.unitPrice}
                    onChange={(e) =>
                      onUpdateLineItem(row.rowKey, 'unitPrice', e.target.value)
                    }
                    disabled={isSaving}
                    aria-label={`Line item ${idx + 1} unit price`}
                  />
                  {priceErr ? (
                    <p className="pv-field-error">{priceErr}</p>
                  ) : null}
                </div>

                <div className="pv-form-field pv-line-card__total-col">
                  <label className="pv-form-label">Line Total</label>
                  <div className="pv-readonly-total">
                    {formatInrCurrency(lineTotal)}
                  </div>
                </div>
              </div>

              <div className="pv-line-card__remarks">
                <input
                  type="text"
                  className="pv-input pv-input--compact"
                  placeholder="Line item note / shade / batch code (optional)"
                  value={row.remarks}
                  onChange={(e) =>
                    onUpdateLineItem(row.rowKey, 'remarks', e.target.value)
                  }
                  maxLength={300}
                  disabled={isSaving}
                  aria-label={`Line item ${idx + 1} remarks`}
                />
              </div>
            </div>
          )
        })}
      </div>

      {uncertainLineItems.length > 0 ? (
        <div className="pv-uncertain-panel" role="region" aria-label="Unverified bill rows">
          <div className="pv-uncertain-panel__header">
            <div>
              <h3 className="pv-uncertain-panel__title">
                Unverified Bill Rows Excluded from Totals (
                {uncertainLineItems.length})
              </h3>
              <p className="pv-uncertain-panel__subtitle">
                These OCR rows had missing columns, unreadable units, or
                mismatched quantity × rate math. They are excluded from financial
                totals until you manually verify or dismiss them.
              </p>
            </div>
            <button
              type="button"
              className="pv-text-btn"
              onClick={onDismissAllUncertainRows}
              disabled={isSaving}
            >
              Dismiss All
            </button>
          </div>

          <div className="pv-uncertain-list">
            {uncertainLineItems.map((uRow) => (
              <div key={uRow.uncertainKey} className="pv-uncertain-item">
                <div className="pv-uncertain-item__main">
                  <div className="pv-uncertain-item__text">
                    <strong>
                      {uRow.extractedDescription || uRow.rawRowText}
                    </strong>
                    {uRow.extractedDescription &&
                    uRow.rawRowText &&
                    uRow.extractedDescription !== uRow.rawRowText ? (
                      <span className="pv-uncertain-item__raw">
                        Raw OCR: {uRow.rawRowText}
                      </span>
                    ) : null}
                  </div>

                  <div className="pv-uncertain-item__meta">
                    {uRow.quantity ? (
                      <span>Qty read: {uRow.quantity}</span>
                    ) : (
                      <span>Qty: unclear</span>
                    )}
                    {uRow.detectedUnit ? (
                      <span>
                        Unit read:{' '}
                        {formatMaterialUnit(uRow.detectedUnit) ||
                          uRow.detectedUnit}
                      </span>
                    ) : (
                      <span>Unit: unclear</span>
                    )}
                    {uRow.unitPrice ? (
                      <span>Rate read: ₹{uRow.unitPrice}</span>
                    ) : (
                      <span>Rate: unclear</span>
                    )}
                    {uRow.lineAmount !== null &&
                    uRow.lineAmount !== undefined ? (
                      <span>
                        Amount read: {formatInrCurrency(uRow.lineAmount)}
                      </span>
                    ) : null}
                  </div>

                  {Array.isArray(uRow.validationReasons) &&
                  uRow.validationReasons.length > 0 ? (
                    <ul className="pv-uncertain-item__reasons">
                      {uRow.validationReasons.map((reason, rIdx) => (
                        <li key={rIdx}>{reason}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className="pv-uncertain-item__actions">
                  <button
                    type="button"
                    className="pv-action-btn"
                    onClick={() => onPromoteUncertainRow(uRow.uncertainKey)}
                    disabled={isSaving}
                  >
                    Add for Manual Entry
                  </button>
                  <button
                    type="button"
                    className="pv-action-btn pv-action-btn--danger"
                    onClick={() => onDismissUncertainRow(uRow.uncertainKey)}
                    disabled={isSaving}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="pv-missing-material-callout">
        <div>
          <strong>Need a material not listed in the catalog?</strong>
          <p>
            Unrecognized bill items are never auto-created as Raw Materials.{' '}
            {adminAccess
              ? 'Cancel this draft to add the new material with its canonical unit in Raw Materials first.'
              : 'Please ask an Administrator to register the material in Raw Materials before recording this voucher.'}
          </p>
        </div>
        {adminAccess ? (
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={onRequestCancelToCatalog}
          >
            Cancel &amp; Go to Raw Materials
          </button>
        ) : null}
      </div>
    </section>
  )
}
