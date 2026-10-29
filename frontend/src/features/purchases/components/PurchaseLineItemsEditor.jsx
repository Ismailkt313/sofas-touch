import { useMemo, useState } from 'react'
import { Dropdown } from '../../../components/common'
import {
  buildUnitOptions,
  formatMaterialUnit,
} from '../../raw-materials/services/rawMaterialService'
import { BulkMissingMaterialsPanel } from './BulkMissingMaterialsPanel'
import {
  FieldSourceBadge,
  FieldSuggestionBanner,
} from './FieldProvenanceControl'
import {
  calculateLineTotalPreview,
  formatInrCurrency,
} from '../services/purchaseService'
import { computeRowLineTotal } from '../utils/purchaseMath'
import { buildCreateMaterialDropdownAction } from '../utils/purchaseMaterialCreation'

export function PurchaseLineItemsEditor({
  lineItems,
  suggestedLineItems = [],
  uncertainLineItems = [],
  rawMaterials = [],
  stagedNewMaterials = [],
  materialById,
  materialOptions,
  expenseHeadById = new Map(),
  expenseHeadOptions = [],
  bulkAnalysis = null,
  selectedBulkRowKeys = [],
  bulkRowErrors = {},
  bulkFeedbackError = '',
  onToggleSelectBulkRow,
  onSelectAllBulkProposed,
  onClearSelectedBulkProposed,
  onChangeBulkDraftField,
  onLinkBulkExistingMaterial,
  onConfirmSelectedBulkMaterials,
  onConfirmSelectedBulkAndSaveVoucher,
  fieldErrors,
  isSaving,
  onAddLineRow,
  onUpdateLineItem,
  onSwitchLineItemType,
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
  onOpenCreateMaterialModal,
  onOpenEditStagedMaterialModal,
}) {
  const [openNotesMap, setOpenNotesMap] = useState({})
  const unitOptions = useMemo(
    () => [{ value: '', label: 'Optional unit' }, ...buildUnitOptions()],
    [],
  )

  const toggleNoteOpen = (rowKey) => {
    setOpenNotesMap((prev) => ({
      ...prev,
      [rowKey]: !prev[rowKey],
    }))
  }

  return (
    <section
      className="pv-voucher-section"
      aria-labelledby="pv-materials-heading"
    >
      <div className="pv-section-head pv-section-head--wrap">
        <div className="pv-section-head__titles">
          <h2 id="pv-materials-heading" className="pv-section-title">
            Purchase Items
          </h2>
          <span className="pv-section-subtitle">
            Mix Raw Materials (stock-tracked) and Other Expenses (non-stock) on
            one voucher
          </span>
        </div>
        <div className="pv-section-head__btns">
          <button
            type="button"
            className="pv-add-row-btn"
            onClick={() => onAddLineRow('material')}
            disabled={isSaving}
          >
            + Add Material
          </button>
          <button
            type="button"
            className="pv-add-row-btn pv-add-row-btn--expense"
            onClick={() => onAddLineRow('expense')}
            disabled={isSaving}
          >
            + Add Expense
          </button>
        </div>
      </div>

      {fieldErrors.lineItems ? (
        <p className="pv-field-error">{fieldErrors.lineItems}</p>
      ) : null}

      <BulkMissingMaterialsPanel
        analysis={bulkAnalysis}
        selectedRowKeys={selectedBulkRowKeys}
        bulkRowErrors={bulkRowErrors}
        bulkFeedbackError={bulkFeedbackError}
        isSaving={isSaving}
        onToggleSelectRow={onToggleSelectBulkRow}
        onSelectAllProposed={onSelectAllBulkProposed}
        onClearSelectedProposed={onClearSelectedBulkProposed}
        onChangeDraftField={onChangeBulkDraftField}
        onLinkExistingMaterial={onLinkBulkExistingMaterial}
        onMarkRowAsExpense={(rowKey) =>
          onSwitchLineItemType?.(rowKey, 'expense')
        }
        onConfirmSelectedMaterials={onConfirmSelectedBulkMaterials}
        onConfirmSelectedAndSaveVoucher={onConfirmSelectedBulkAndSaveVoucher}
        onPromoteUncertainRow={(uncertainIdx, preferredType) => {
          const target = uncertainLineItems[uncertainIdx]
          if (target) {
            onPromoteUncertainRow?.(target.uncertainKey, preferredType)
          }
        }}
        onDismissUncertainRow={(uncertainIdx) => {
          const target = uncertainLineItems[uncertainIdx]
          if (target) {
            onDismissUncertainRow?.(target.uncertainKey)
          }
        }}
      />

      <div className="pv-mat-table-head pv-mat-table-head--mixed" aria-hidden="true">
        <span>Type</span>
        <span>Item / Expense Head</span>
        <span>Qty / Details</span>
        <span>Unit</span>
        <span>Rate / Amount (₹)</span>
        <span className="pv-mat-table-head__right">Line total</span>
        <span />
      </div>

      <div className="pv-mat-list">
        {lineItems.map((row, idx) => {
          const itemType =
            row.itemType === 'expense'
              ? 'expense'
              : row.itemType === 'material'
                ? 'material'
                : ''
          const isExpense = itemType === 'expense'
          const isUnclassified = itemType === ''

          const selectedMat = !isExpense
            ? materialById.get(row.materialId)
            : null
          const selectedHead = isExpense
            ? expenseHeadById.get(row.expenseHeadId)
            : null

          const lineTotal = computeRowLineTotal(row)

          const typeErr = fieldErrors[`lineItems[${idx}].itemType`]
          const matErr =
            fieldErrors[`lineItems[${idx}].materialId`] ||
            fieldErrors[`lineItems[${idx}].newMaterial`] ||
            fieldErrors[`lineItems[${idx}].newMaterial.name`]
          const headErr = fieldErrors[`lineItems[${idx}].expenseHeadId`]
          const descErr = fieldErrors[`lineItems[${idx}].description`]
          const amtErr =
            fieldErrors[`lineItems[${idx}].amount`] ||
            fieldErrors[`lineItems[${idx}].lineTotal`]
          const unitErr =
            fieldErrors[`lineItems[${idx}].unit`] ||
            fieldErrors[`lineItems[${idx}].newMaterial.unit`]
          const qtyErr = fieldErrors[`lineItems[${idx}].quantity`]
          const priceErr = fieldErrors[`lineItems[${idx}].unitPrice`]

          const needsReviewHighlight =
            isUnclassified ||
            (itemType === 'material' &&
              Boolean(row.extractedDescription || row.needsReview) &&
              !row.materialId) ||
            (isExpense && !row.expenseHeadId && Boolean(row.extractedDescription))

          const selectedShortUnit = selectedMat
            ? formatMaterialUnit(selectedMat.unit) || selectedMat.unit
            : ''
          const detectedShortUnit = row.detectedUnit
            ? formatMaterialUnit(row.detectedUnit) || row.detectedUnit
            : ''
          const hasUnitMismatch =
            !isExpense &&
            Boolean(selectedShortUnit && detectedShortUnit) &&
            selectedShortUnit.toLowerCase() !== detectedShortUnit.toLowerCase()

          const unitDisplay = selectedShortUnit || detectedShortUnit || '—'
          const fm = row.fieldMeta || {}
          const rowSugs = row.rowSuggestions || {}
          const hasRemarksText = Boolean(String(row.remarks || '').trim())
          const isNoteOpen = hasRemarksText || Boolean(openNotesMap[row.rowKey])

          const inlineCreateAction =
            !isExpense && !row.materialId && row.extractedDescription
              ? buildCreateMaterialDropdownAction({
                  searchQuery: '',
                  row,
                  existingMaterials: rawMaterials,
                  stagedNewMaterials,
                })
              : null

          const usesExpenseQtyRate =
            isExpense && row.expensePricingMode === 'qty_rate'

          return (
            <div
              key={row.rowKey}
              className={`pv-mat-row${
                needsReviewHighlight || hasUnitMismatch
                  ? ' pv-mat-row--review'
                  : ''
              }${isExpense ? ' pv-mat-row--expense' : ''}`}
            >
              <div className="pv-mat-row__mobile-head">
                <div className="pv-mat-row__mobile-left">
                  <span className="pv-mat-row__num">#{idx + 1}</span>
                  <span
                    className={`pv-type-badge${
                      isExpense
                        ? ' pv-type-badge--expense'
                        : isUnclassified
                          ? ' pv-type-badge--unclassified'
                          : ' pv-type-badge--material'
                    }`}
                  >
                    {isExpense
                      ? 'Other Expense'
                      : isUnclassified
                        ? 'Needs Classification'
                        : 'Raw Material'}
                  </span>
                </div>
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
                        ? `Remove item row ${idx + 1}`
                        : `Clear item row ${idx + 1}`
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

              <div className="pv-mat-row__fields pv-mat-row__fields--mixed">
                <div className="pv-mat-cell pv-mat-cell--type">
                  <span className="pv-mat-cell-label">Item type</span>
                  <div
                    className={`pv-type-seg${
                      isUnclassified || typeErr ? ' pv-type-seg--warn' : ''
                    }`}
                    role="group"
                    aria-label={`Row ${idx + 1} item type`}
                  >
                    <button
                      type="button"
                      className={`pv-type-seg__btn${
                        itemType === 'material' ? ' pv-type-seg__btn--active' : ''
                      }`}
                      onClick={() =>
                        onSwitchLineItemType?.(row.rowKey, 'material')
                      }
                      disabled={isSaving}
                    >
                      Material
                    </button>
                    <button
                      type="button"
                      className={`pv-type-seg__btn${
                        isExpense ? ' pv-type-seg__btn--active' : ''
                      }`}
                      onClick={() =>
                        onSwitchLineItemType?.(row.rowKey, 'expense')
                      }
                      disabled={isSaving}
                    >
                      Expense
                    </button>
                  </div>
                  {typeErr ? (
                    <p className="pv-field-error">{typeErr}</p>
                  ) : isUnclassified ? (
                    <p className="pv-field-review-hint">
                      Confirm Material or Expense
                    </p>
                  ) : null}
                </div>

                {isExpense ? (
                  <>
                    <div className="pv-mat-cell pv-mat-cell--material">
                      <div className="pv-mat-cell-label-row">
                        <span className="pv-mat-cell-label">Expense head</span>
                      </div>
                      <Dropdown
                        variant="form"
                        searchable
                        searchPlaceholder="Search expense heads (transport, rental...)"
                        value={row.expenseHeadId}
                        options={expenseHeadOptions}
                        placeholder="Select expense head..."
                        error={Boolean(headErr)}
                        disabled={isSaving}
                        onChange={(val) => {
                          onUpdateLineItem(row.rowKey, 'expenseHeadId', val)
                          const chosen = expenseHeadById.get(val)
                          if (
                            chosen &&
                            !String(row.description || '').trim() &&
                            !String(row.extractedDescription || '').trim()
                          ) {
                            onUpdateLineItem(
                              row.rowKey,
                              'description',
                              chosen.name,
                            )
                          }
                        }}
                        ariaLabel={`Expense head row ${idx + 1}`}
                      />
                      {headErr ? (
                        <p className="pv-field-error">{headErr}</p>
                      ) : null}
                      <span className="pv-non-stock-hint">
                        Non-stock expense{selectedHead?.category ? ` · ${selectedHead.category}` : ''}
                      </span>
                    </div>

                    <div
                      className={`pv-mat-cell ${
                        usesExpenseQtyRate
                          ? 'pv-mat-cell--qty'
                          : 'pv-mat-cell--exp-desc'
                      }`}
                    >
                      <div className="pv-mat-cell-label-row">
                        <span className="pv-mat-cell-label">
                          {usesExpenseQtyRate ? 'Qty' : 'Description'}
                        </span>
                      </div>
                      {usesExpenseQtyRate ? (
                        <>
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
                              onUpdateLineItem(
                                row.rowKey,
                                'quantity',
                                e.target.value,
                              )
                            }
                            disabled={isSaving}
                            aria-label={`Row ${idx + 1} expense quantity`}
                          />
                          {qtyErr ? (
                            <p className="pv-field-error">{qtyErr}</p>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <input
                            type="text"
                            className={`pv-input pv-input--dense${
                              descErr ? ' pv-input--error' : ''
                            }`}
                            placeholder="e.g., Tempo delivery charges"
                            value={row.description}
                            maxLength={240}
                            onChange={(e) =>
                              onUpdateLineItem(
                                row.rowKey,
                                'description',
                                e.target.value,
                              )
                            }
                            disabled={isSaving}
                            aria-label={`Row ${idx + 1} expense description`}
                          />
                          {descErr ? (
                            <p className="pv-field-error">{descErr}</p>
                          ) : null}
                        </>
                      )}
                    </div>

                    {usesExpenseQtyRate ? (
                      <div className="pv-mat-cell pv-mat-cell--unit">
                        <span className="pv-mat-cell-label">Unit</span>
                        <Dropdown
                          variant="form"
                          value={row.unit || ''}
                          options={unitOptions}
                          placeholder="Unit"
                          disabled={isSaving}
                          onChange={(val) =>
                            onUpdateLineItem(row.rowKey, 'unit', val)
                          }
                          ariaLabel={`Row ${idx + 1} expense unit`}
                        />
                      </div>
                    ) : null}

                    <div className="pv-mat-cell pv-mat-cell--price">
                      <div className="pv-mat-cell-label-row">
                        <span className="pv-mat-cell-label">
                          {usesExpenseQtyRate ? 'Rate (₹)' : 'Amount (₹)'}
                        </span>
                      </div>
                      {usesExpenseQtyRate ? (
                        <>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0.01"
                            className={`pv-input pv-input--dense${
                              priceErr || amtErr ? ' pv-input--error' : ''
                            }`}
                            placeholder="0.00"
                            value={row.unitPrice}
                            onChange={(e) =>
                              onUpdateLineItem(
                                row.rowKey,
                                'unitPrice',
                                e.target.value,
                              )
                            }
                            disabled={isSaving}
                            aria-label={`Row ${idx + 1} expense rate`}
                          />
                          {priceErr || amtErr ? (
                            <p className="pv-field-error">
                              {priceErr || amtErr}
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0.01"
                            className={`pv-input pv-input--dense${
                              amtErr ? ' pv-input--error' : ''
                            }`}
                            placeholder="0.00"
                            value={row.amount}
                            onChange={(e) =>
                              onUpdateLineItem(
                                row.rowKey,
                                'amount',
                                e.target.value,
                              )
                            }
                            disabled={isSaving}
                            aria-label={`Row ${idx + 1} expense amount`}
                          />
                          {amtErr ? (
                            <p className="pv-field-error">{amtErr}</p>
                          ) : null}
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <>
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
                        searchable
                        searchPlaceholder="Search materials or type new name..."
                        value={row.materialId}
                        options={materialOptions}
                        placeholder="Select or create material..."
                        error={Boolean(matErr || unitErr || needsReviewHighlight)}
                        disabled={isSaving}
                        createOption={(searchQuery) =>
                          buildCreateMaterialDropdownAction({
                            searchQuery,
                            row,
                            existingMaterials: rawMaterials,
                            stagedNewMaterials,
                          })
                        }
                        onCreateOption={(actionItem) =>
                          onOpenCreateMaterialModal?.(
                            row.rowKey,
                            actionItem?.createName || '',
                          )
                        }
                        onChange={(val) =>
                          onUpdateLineItem(row.rowKey, 'materialId', val)
                        }
                        ariaLabel={`Material row ${idx + 1}`}
                      />
                      {matErr ? (
                        <p className="pv-field-error">{matErr}</p>
                      ) : unitErr ? (
                        <p className="pv-field-error">{unitErr}</p>
                      ) : isUnclassified ? (
                        <p className="pv-field-review-hint">
                          Unrecognized bill item — choose Material (select/create)
                          or switch to Expense
                        </p>
                      ) : needsReviewHighlight ? (
                        <p className="pv-field-review-hint">
                          Select matching material or create a new material
                        </p>
                      ) : null}
                      {selectedMat?.isStagedNew ? (
                        <div className="pv-staged-mat-bar">
                          <span className="pv-staged-mat-bar__text">
                            New material · 0 initial stock + purchase qty on save
                          </span>
                          <button
                            type="button"
                            className="pv-link-btn"
                            onClick={() =>
                              onOpenEditStagedMaterialModal?.(
                                row.rowKey,
                                selectedMat.id,
                              )
                            }
                            disabled={isSaving}
                          >
                            Edit
                          </button>
                        </div>
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
                          onUpdateLineItem(
                            row.rowKey,
                            'quantity',
                            e.target.value,
                          )
                        }
                        disabled={isSaving}
                        aria-label={`Row ${idx + 1} quantity`}
                      />
                      {qtyErr ? (
                        <p className="pv-field-error">{qtyErr}</p>
                      ) : null}
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
                          hasUnitMismatch || unitErr
                            ? ' pv-unit-chip--mismatch'
                            : ''
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
                          onUpdateLineItem(
                            row.rowKey,
                            'unitPrice',
                            e.target.value,
                          )
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
                  </>
                )}

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
                        ? `Remove item row ${idx + 1}`
                        : `Clear item row ${idx + 1}`
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

              {isExpense && usesExpenseQtyRate ? (
                <div className="pv-mat-row__note">
                  <input
                    type="text"
                    className={`pv-input pv-input--compact${
                      descErr ? ' pv-input--error' : ''
                    }`}
                    placeholder="Expense description (required, e.g., Crane rental 2 days)"
                    value={row.description}
                    maxLength={240}
                    onChange={(e) =>
                      onUpdateLineItem(row.rowKey, 'description', e.target.value)
                    }
                    disabled={isSaving}
                    aria-label={`Row ${idx + 1} expense description`}
                  />
                  {descErr ? (
                    <p className="pv-field-error">{descErr}</p>
                  ) : null}
                </div>
              ) : null}

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

                  {!isExpense &&
                  !row.materialId &&
                  ((Array.isArray(row.suggestions) &&
                    row.suggestions.length > 0) ||
                    Boolean(inlineCreateAction)) ? (
                    <div className="pv-suggestions-row">
                      {Array.isArray(row.suggestions) &&
                      row.suggestions.length > 0 ? (
                        <>
                          <span className="pv-suggestions-row__label">
                            Suggested:
                          </span>
                          {row.suggestions.map((sug) => (
                            <button
                              key={sug.id}
                              type="button"
                              className="pv-suggestion-chip"
                              onClick={() =>
                                onUpdateLineItem(
                                  row.rowKey,
                                  'materialId',
                                  sug.id,
                                )
                              }
                              disabled={isSaving}
                            >
                              {sug.name} ({formatMaterialUnit(sug.unit)})
                            </button>
                          ))}
                        </>
                      ) : null}

                      {inlineCreateAction ? (
                        <button
                          type="button"
                          className="pv-suggestion-chip pv-suggestion-chip--create"
                          onClick={() =>
                            onOpenCreateMaterialModal?.(
                              row.rowKey,
                              inlineCreateAction.createName || '',
                            )
                          }
                          disabled={isSaving}
                        >
                          {inlineCreateAction.label}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="pv-mat-row__subactions">
                  {isExpense ? (
                    <button
                      type="button"
                      className="pv-note-toggle"
                      onClick={() => {
                        const nextMode = usesExpenseQtyRate
                          ? 'amount'
                          : 'qty_rate'
                        onUpdateLineItem(
                          row.rowKey,
                          'expensePricingMode',
                          nextMode,
                        )
                        if (
                          nextMode === 'amount' &&
                          String(row.quantity ?? '').trim() !== '' &&
                          String(row.unitPrice ?? '').trim() !== ''
                        ) {
                          const calcAmt = calculateLineTotalPreview(
                            row.quantity,
                            row.unitPrice,
                          )
                          if (calcAmt > 0) {
                            onUpdateLineItem(
                              row.rowKey,
                              'amount',
                              String(calcAmt),
                            )
                          }
                        }
                      }}
                      disabled={isSaving}
                    >
                      {usesExpenseQtyRate ? 'Use lump sum' : '+ Qty × Rate'}
                    </button>
                  ) : null}

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
              </div>

              {isNoteOpen ? (
                <div className="pv-mat-row__note">
                  <input
                    type="text"
                    className="pv-input pv-input--compact"
                    placeholder="Optional line note (challan, batch, delivery ref)"
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
                      onClick={() =>
                        onAddSuggestedLineItem?.(sug.suggestionKey, 'material')
                      }
                      disabled={isSaving}
                    >
                      + As Material
                    </button>
                    <button
                      type="button"
                      className="pv-mini-btn"
                      onClick={() =>
                        onAddSuggestedLineItem?.(sug.suggestionKey, 'expense')
                      }
                      disabled={isSaving}
                    >
                      + As Expense
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

      {uncertainLineItems.length > 0 && !bulkAnalysis?.hasReviewContent ? (
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
                    onClick={() =>
                      onPromoteUncertainRow?.(uRow.uncertainKey, 'material')
                    }
                    disabled={isSaving}
                  >
                    + As Material
                  </button>
                  <button
                    type="button"
                    className="pv-mini-btn"
                    onClick={() =>
                      onPromoteUncertainRow?.(uRow.uncertainKey, 'expense')
                    }
                    disabled={isSaving}
                  >
                    + As Expense
                  </button>
                  <button
                    type="button"
                    className="pv-mini-btn pv-mini-btn--danger"
                    onClick={() => onDismissUncertainRow?.(uRow.uncertainKey)}
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

      <div className="pv-catalog-caption">
        <span>Material not in catalogue?</span>{' '}
        <button
          type="button"
          className="pv-link-btn"
          onClick={() => {
            const targetRow =
              lineItems.find(
                (r) => r.itemType !== 'expense' && !r.materialId,
              ) || null
            onOpenCreateMaterialModal?.(targetRow ? targetRow.rowKey : '', '')
          }}
          disabled={isSaving}
        >
          + Create new material
        </button>
      </div>
    </section>
  )
}
