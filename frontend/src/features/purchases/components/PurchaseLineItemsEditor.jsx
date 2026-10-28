import { useState } from 'react'
import { Dropdown } from '../../../components/common'
import { formatMaterialUnit } from '../../raw-materials'
import { FieldSourceBadge, FieldSuggestionBanner } from './FieldProvenanceControl'
import {
  calculateLineTotalPreview,
  formatInrCurrency,
} from '../services/purchaseService'

export function PurchaseLineItemsEditor({
  lineItems,
  suggestedLineItems = [],
  uncertainLineItems = [],
  materialById,
  materialOptions,
  fieldErrors,
  isSaving,
  adminAccess,
  onAddLineRow,
  onUpdateLineItem,
  onAcceptRowSuggestion,
  onDismissRowSuggestion,
  onRemoveLineRow,
  onAddSuggestedLineItem,
  onAddAllSuggestedLineItems,
  onDismissSuggestedLineItem,
  onDismissAllSuggestedLineItems,
  onPromoteUncertainRow,
  onDismissUncertainRow,
  onDismissAllUncertainRows,
  onRequestCancelToCatalog,
}) {
  const [openNotesMap, setOpenNotesMap] = useState({})

  const toggleNoteOpen = (rowKey) => {
    setOpenNotesMap((prev) => ({
      ...prev,
      [rowKey]: !prev[rowKey],
    }))
  }

  return (
    <section className="pv-voucher-section" aria-labelledby="pv-materials-heading">
      <div className="pv-section-head">
        <h2 id="pv-materials-heading" className="pv-section-title">
          Materials
        </h2>
        <button
          type="button"
          className="pv-add-row-btn"
          onClick={onAddLineRow}
          disabled={isSaving}
        >
          + Add Material
        </button>
      </div>

      {fieldErrors.lineItems ? (
        <p className="pv-field-error">{fieldErrors.lineItems}</p>
      ) : null}

      <div className="pv-mat-table-head" aria-hidden="true">
        <span>Material</span>
        <span>Qty</span>
        <span>Unit</span>
        <span>Unit price (₹)</span>
        <span className="pv-mat-table-head__right">Line total</span>
        <span />
      </div>

      <div className="pv-mat-list">
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

          const selectedShortUnit = selectedMat
            ? formatMaterialUnit(selectedMat.unit) || selectedMat.unit
            : ''
          const detectedShortUnit = row.detectedUnit
            ? formatMaterialUnit(row.detectedUnit) || row.detectedUnit
            : ''
          const hasUnitMismatch =
            Boolean(selectedShortUnit && detectedShortUnit) &&
            selectedShortUnit.toLowerCase() !== detectedShortUnit.toLowerCase()

          const unitDisplay = selectedShortUnit || detectedShortUnit || '—'
          const fm = row.fieldMeta || {}
          const rowSugs = row.rowSuggestions || {}
          const hasRemarksText = Boolean(String(row.remarks || '').trim())
          const isNoteOpen = hasRemarksText || Boolean(openNotesMap[row.rowKey])

          return (
            <div
              key={row.rowKey}
              className={`pv-mat-row${
                needsMaterialReview || hasUnitMismatch
                  ? ' pv-mat-row--review'
                  : ''
              }`}
            >
              <div className="pv-mat-row__mobile-head">
                <span className="pv-mat-row__num">#{idx + 1}</span>
                <div className="pv-mat-row__mobile-right">
                  <span className="pv-mat-row__mobile-total">
                    {formatInrCurrency(lineTotal)}
                  </span>
                  <button
                    type="button"
                    className="pv-row-icon-remove"
                    onClick={() => onRemoveLineRow(row.rowKey)}
                    disabled={isSaving}
                    aria-label={
                      lineItems.length > 1
                        ? `Remove material row ${idx + 1}`
                        : `Clear material row ${idx + 1}`
                    }
                    title={lineItems.length > 1 ? 'Remove row' : 'Clear row'}
                  >
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path
                        d="M4 4L12 12M12 4L4 12"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="pv-mat-row__fields">
                <div className="pv-mat-cell pv-mat-cell--material">
                  <div className="pv-mat-cell-label-row">
                    <span className="pv-mat-cell-label">Material</span>
                    <FieldSourceBadge
                      meta={fm.materialId}
                      hasValue={Boolean(row.materialId)}
                    />
                  </div>
                  <Dropdown
                    variant="form"
                    value={row.materialId}
                    options={materialOptions}
                    placeholder="Select material..."
                    error={Boolean(matErr || needsMaterialReview)}
                    disabled={isSaving}
                    onChange={(val) =>
                      onUpdateLineItem(row.rowKey, 'materialId', val)
                    }
                    ariaLabel={`Material row ${idx + 1}`}
                  />
                  {matErr ? (
                    <p className="pv-field-error">{matErr}</p>
                  ) : needsMaterialReview ? (
                    <p className="pv-field-review-hint">
                      Select matching catalog material
                    </p>
                  ) : null}
                  {rowSugs.materialId ? (
                    <FieldSuggestionBanner
                      suggestion={rowSugs.materialId}
                      labelPrefix="Bill match"
                      formatValue={(id) =>
                        materialById.get(id)?.name || String(id)
                      }
                      onAccept={() =>
                        onAcceptRowSuggestion?.(row.rowKey, 'materialId')
                      }
                      onDismiss={() =>
                        onDismissRowSuggestion?.(row.rowKey, 'materialId')
                      }
                      disabled={isSaving}
                    />
                  ) : null}
                </div>

                <div className="pv-mat-cell pv-mat-cell--qty">
                  <div className="pv-mat-cell-label-row">
                    <span className="pv-mat-cell-label">Qty</span>
                    <FieldSourceBadge
                      meta={fm.quantity}
                      hasValue={String(row.quantity ?? '').trim() !== ''}
                    />
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0.001"
                    className={`pv-input pv-input--dense${
                      qtyErr ? ' pv-input--error' : ''
                    }`}
                    placeholder="0"
                    value={row.quantity}
                    onChange={(e) =>
                      onUpdateLineItem(row.rowKey, 'quantity', e.target.value)
                    }
                    disabled={isSaving}
                    aria-label={`Row ${idx + 1} quantity`}
                  />
                  {qtyErr ? <p className="pv-field-error">{qtyErr}</p> : null}
                  {rowSugs.quantity ? (
                    <FieldSuggestionBanner
                      suggestion={rowSugs.quantity}
                      labelPrefix="Bill qty"
                      onAccept={() =>
                        onAcceptRowSuggestion?.(row.rowKey, 'quantity')
                      }
                      onDismiss={() =>
                        onDismissRowSuggestion?.(row.rowKey, 'quantity')
                      }
                      disabled={isSaving}
                    />
                  ) : null}
                </div>

                <div className="pv-mat-cell pv-mat-cell--unit">
                  <span className="pv-mat-cell-label">Unit</span>
                  <div
                    className={`pv-unit-chip${
                      hasUnitMismatch ? ' pv-unit-chip--mismatch' : ''
                    }`}
                    title={
                      selectedMat
                        ? selectedMat.unit
                        : row.detectedUnit
                          ? `Bill unit: ${row.detectedUnit}`
                          : 'Unit set from material'
                    }
                  >
                    {unitDisplay}
                  </div>
                </div>

                <div className="pv-mat-cell pv-mat-cell--price">
                  <div className="pv-mat-cell-label-row">
                    <span className="pv-mat-cell-label">Unit price</span>
                    <FieldSourceBadge
                      meta={fm.unitPrice}
                      hasValue={String(row.unitPrice ?? '').trim() !== ''}
                    />
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    className={`pv-input pv-input--dense${
                      priceErr ? ' pv-input--error' : ''
                    }`}
                    placeholder="0.00"
                    value={row.unitPrice}
                    onChange={(e) =>
                      onUpdateLineItem(row.rowKey, 'unitPrice', e.target.value)
                    }
                    disabled={isSaving}
                    aria-label={`Row ${idx + 1} unit price`}
                  />
                  {priceErr ? (
                    <p className="pv-field-error">{priceErr}</p>
                  ) : null}
                  {rowSugs.unitPrice ? (
                    <FieldSuggestionBanner
                      suggestion={rowSugs.unitPrice}
                      labelPrefix="Bill rate"
                      formatValue={(v) => formatInrCurrency(Number(v))}
                      onAccept={() =>
                        onAcceptRowSuggestion?.(row.rowKey, 'unitPrice')
                      }
                      onDismiss={() =>
                        onDismissRowSuggestion?.(row.rowKey, 'unitPrice')
                      }
                      disabled={isSaving}
                    />
                  ) : null}
                </div>

                <div className="pv-mat-cell pv-mat-cell--total">
                  <div className="pv-line-total-text">
                    {formatInrCurrency(lineTotal)}
                  </div>
                </div>

                <div className="pv-mat-cell pv-mat-cell--remove">
                  <button
                    type="button"
                    className="pv-row-icon-remove"
                    onClick={() => onRemoveLineRow(row.rowKey)}
                    disabled={isSaving}
                    aria-label={
                      lineItems.length > 1
                        ? `Remove material row ${idx + 1}`
                        : `Clear material row ${idx + 1}`
                    }
                    title={lineItems.length > 1 ? 'Remove row' : 'Clear row'}
                  >
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path
                        d="M4 4L12 12M12 4L4 12"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {row.extractedDescription ||
              hasUnitMismatch ||
              (!row.materialId &&
                Array.isArray(row.suggestions) &&
                row.suggestions.length > 0) ||
              !isNoteOpen ? (
                <div className="pv-mat-row__subbar">
                  <div className="pv-mat-row__submeta">
                    {row.extractedDescription ? (
                      <span className="pv-bill-line-caption">
                        Bill: &ldquo;{row.extractedDescription}&rdquo;
                      </span>
                    ) : null}

                    {hasUnitMismatch ? (
                      <span className="pv-unit-mismatch-caption">
                        Bill unit ({detectedShortUnit}) differs from catalog (
                        {selectedShortUnit})
                      </span>
                    ) : null}

                    {!row.materialId &&
                    Array.isArray(row.suggestions) &&
                    row.suggestions.length > 0 ? (
                      <div className="pv-suggestions-row">
                        <span className="pv-suggestions-row__label">
                          Suggested:
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
                  </div>

                  {!isNoteOpen ? (
                    <button
                      type="button"
                      className="pv-note-toggle"
                      onClick={() => toggleNoteOpen(row.rowKey)}
                      disabled={isSaving}
                    >
                      + Note
                    </button>
                  ) : null}
                </div>
              ) : null}

              {isNoteOpen ? (
                <div className="pv-mat-row__note">
                  <input
                    type="text"
                    className="pv-input pv-input--compact"
                    placeholder="Optional line note (shade, batch, dimensions)"
                    value={row.remarks}
                    onChange={(e) =>
                      onUpdateLineItem(row.rowKey, 'remarks', e.target.value)
                    }
                    maxLength={300}
                    disabled={isSaving}
                    aria-label={`Row ${idx + 1} note`}
                  />
                  {!hasRemarksText ? (
                    <button
                      type="button"
                      className="pv-note-toggle"
                      onClick={() => toggleNoteOpen(row.rowKey)}
                    >
                      Hide
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      {suggestedLineItems.length > 0 ? (
        <div
          className="pv-compact-tray"
          role="region"
          aria-label="Additional bill items"
        >
          <div className="pv-compact-tray__head">
            <span className="pv-compact-tray__title">
              Additional bill items ({suggestedLineItems.length})
            </span>
            <div className="pv-compact-tray__head-actions">
              <button
                type="button"
                className="pv-link-btn"
                onClick={onAddAllSuggestedLineItems}
                disabled={isSaving}
              >
                + Add all
              </button>
              <button
                type="button"
                className="pv-link-btn pv-link-btn--muted"
                onClick={onDismissAllSuggestedLineItems}
                disabled={isSaving}
              >
                Dismiss
              </button>
            </div>
          </div>

          <div className="pv-compact-tray__list">
            {suggestedLineItems.map((sug) => {
              const matchedMat = sug.materialId
                ? materialById.get(sug.materialId)
                : null
              const sugTotal = calculateLineTotalPreview(
                sug.quantity,
                sug.unitPrice,
              )
              return (
                <div key={sug.suggestionKey} className="pv-compact-tray__item">
                  <div className="pv-compact-tray__info">
                    <strong>{sug.extractedDescription}</strong>
                    <span>
                      {matchedMat ? `${matchedMat.name} · ` : ''}
                      {sug.quantity}{' '}
                      {sug.detectedUnit
                        ? formatMaterialUnit(sug.detectedUnit) ||
                          sug.detectedUnit
                        : ''}{' '}
                      × {formatInrCurrency(Number(sug.unitPrice))} ={' '}
                      {formatInrCurrency(sugTotal)}
                    </span>
                  </div>
                  <div className="pv-compact-tray__btns">
                    <button
                      type="button"
                      className="pv-mini-btn"
                      onClick={() => onAddSuggestedLineItem?.(sug.suggestionKey)}
                      disabled={isSaving}
                    >
                      + Add
                    </button>
                    <button
                      type="button"
                      className="pv-mini-btn pv-mini-btn--danger"
                      onClick={() =>
                        onDismissSuggestedLineItem?.(sug.suggestionKey)
                      }
                      disabled={isSaving}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {uncertainLineItems.length > 0 ? (
        <div
          className="pv-compact-tray pv-compact-tray--warn"
          role="region"
          aria-label="Unverified bill rows"
        >
          <div className="pv-compact-tray__head">
            <span className="pv-compact-tray__title">
              Unverified bill rows excluded from totals (
              {uncertainLineItems.length})
            </span>
            <button
              type="button"
              className="pv-link-btn pv-link-btn--muted"
              onClick={onDismissAllUncertainRows}
              disabled={isSaving}
            >
              Dismiss all
            </button>
          </div>

          <div className="pv-compact-tray__list">
            {uncertainLineItems.map((uRow) => (
              <div key={uRow.uncertainKey} className="pv-compact-tray__item">
                <div className="pv-compact-tray__info">
                  <strong>
                    {uRow.extractedDescription || uRow.rawRowText}
                  </strong>
                  <span>
                    Qty: {uRow.quantity || 'unclear'} · Unit:{' '}
                    {uRow.detectedUnit
                      ? formatMaterialUnit(uRow.detectedUnit) ||
                        uRow.detectedUnit
                      : 'unclear'}{' '}
                    · Rate: {uRow.unitPrice ? `₹${uRow.unitPrice}` : 'unclear'}
                  </span>
                  {Array.isArray(uRow.validationReasons) &&
                  uRow.validationReasons.length > 0 ? (
                    <span className="pv-compact-tray__reason">
                      {uRow.validationReasons[0]}
                    </span>
                  ) : null}
                </div>

                <div className="pv-compact-tray__btns">
                  <button
                    type="button"
                    className="pv-mini-btn"
                    onClick={() => onPromoteUncertainRow(uRow.uncertainKey)}
                    disabled={isSaving}
                  >
                    Add row
                  </button>
                  <button
                    type="button"
                    className="pv-mini-btn pv-mini-btn--danger"
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

      {adminAccess ? (
        <div className="pv-catalog-caption">
          <span>Material not in catalog?</span>{' '}
          <button
            type="button"
            className="pv-link-btn"
            onClick={onRequestCancelToCatalog}
          >
            Open Raw Materials
          </button>
        </div>
      ) : null}
    </section>
  )
}
