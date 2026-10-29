import { useMemo } from 'react'
import { Dropdown } from '../../../components/common'
import {
  MAX_MATERIAL_NAME_LENGTH,
  RAW_MATERIAL_CATEGORIES,
  buildUnitOptions,
  formatMaterialUnit,
} from '../../raw-materials/services/rawMaterialService'

const BULK_CATEGORY_OPTIONS = RAW_MATERIAL_CATEGORIES.map((category) => ({
  value: category,
  label: category,
}))

export function BulkMissingMaterialsPanel({
  analysis,
  selectedRowKeys = [],
  bulkRowErrors = {},
  bulkFeedbackError = '',
  isSaving = false,
  onToggleSelectRow,
  onSelectAllProposed,
  onClearSelectedProposed,
  onChangeDraftField,
  onLinkExistingMaterial,
  onMarkRowAsExpense,
  onConfirmSelectedMaterials,
  onConfirmSelectedAndSaveVoucher,
  onPromoteUncertainRow,
  onDismissUncertainRow,
}) {
  const unitOptions = useMemo(() => buildUnitOptions(), [])

  if (!analysis || !analysis.hasReviewContent) {
    return null
  }

  const { matchedItems = [], proposedItems = [], unresolvedItems = [] } =
    analysis
  const selectedSet = new Set(selectedRowKeys)
  const selectedCount = proposedItems.filter((p) =>
    selectedSet.has(p.rowKey),
  ).length
  const allProposedSelected =
    proposedItems.length > 0 && selectedCount === proposedItems.length

  return (
    <div
      className="pv-bulk-panel"
      role="region"
      aria-label="Missing raw materials review"
    >
      <div className="pv-bulk-panel__header">
        <div className="pv-bulk-panel__title-wrap">
          <h3 className="pv-bulk-panel__title">
            Bill Item &amp; Missing Materials Review
          </h3>
          <p className="pv-bulk-panel__sub">
            Review items detected from the bill. Confirm proposed raw materials
            in bulk (created at 0 stock and incremented once on voucher save) or
            classify non-stock items as Other Expenses.
          </p>
        </div>

        {proposedItems.length > 0 ? (
          <div className="pv-bulk-panel__select-controls">
            <button
              type="button"
              className="pv-link-btn"
              onClick={
                allProposedSelected
                  ? onClearSelectedProposed
                  : onSelectAllProposed
              }
              disabled={isSaving}
            >
              {allProposedSelected
                ? 'Clear selection'
                : `Select all (${proposedItems.length})`}
            </button>
          </div>
        ) : null}
      </div>

      {matchedItems.length > 0 ? (
        <div className="pv-bulk-group">
          <span className="pv-bulk-group__label">
            Matched &amp; classified ({matchedItems.length})
          </span>
          <div className="pv-bulk-matched-chips">
            {matchedItems.map((item) => (
              <span
                key={item.rowKey}
                className={`pv-bulk-chip${
                  item.kind === 'staged_new'
                    ? ' pv-bulk-chip--staged'
                    : item.kind === 'expense'
                      ? ' pv-bulk-chip--expense'
                      : ''
                }`}
              >
                <span className="pv-bulk-chip__line">#{item.lineNumber}</span>
                <strong>{item.label}</strong>
                {item.unit ? (
                  <span>({formatMaterialUnit(item.unit) || item.unit})</span>
                ) : item.kind === 'expense' ? (
                  <span>(Expense)</span>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {proposedItems.length > 0 ? (
        <div className="pv-bulk-group">
          <span className="pv-bulk-group__label">
            Proposed new raw materials ({proposedItems.length})
          </span>

          <div className="pv-bulk-proposed-list">
            {proposedItems.map((prop) => {
              const isChecked = selectedSet.has(prop.rowKey)
              const rowErr = bulkRowErrors[prop.rowKey] || ''
              const isConflict =
                prop.status === 'unit_conflict' ||
                prop.status === 'inactive_existing' ||
                prop.status === 'staged_unit_conflict' ||
                prop.status === 'intra_batch_unit_conflict'
              const isExistingReuse =
                prop.status === 'existing_compatible' ||
                prop.status === 'staged_compatible'

              return (
                <div
                  key={prop.rowKey}
                  className={`pv-bulk-prop-row${
                    isConflict || rowErr ? ' pv-bulk-prop-row--warn' : ''
                  }`}
                >
                  <div className="pv-bulk-prop-row__main">
                    <label className="pv-bulk-check">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggleSelectRow?.(prop.rowKey)}
                        disabled={isSaving}
                        aria-label={`Select line ${prop.lineNumber} ${prop.name}`}
                      />
                      <span className="pv-bulk-check__num">
                        #{prop.lineNumber}
                      </span>
                    </label>

                    <div className="pv-bulk-prop-row__field pv-bulk-prop-row__field--name">
                      <span className="pv-bulk-mini-label">Material name</span>
                      <input
                        type="text"
                        className={`pv-input pv-input--dense${
                          prop.status === 'missing_name' || rowErr
                            ? ' pv-input--error'
                            : ''
                        }`}
                        value={prop.name}
                        maxLength={MAX_MATERIAL_NAME_LENGTH}
                        placeholder="Material name"
                        onChange={(e) =>
                          onChangeDraftField?.(
                            prop.rowKey,
                            'name',
                            e.target.value,
                          )
                        }
                        disabled={isSaving}
                        aria-label={`Proposed material name for line ${prop.lineNumber}`}
                      />
                    </div>

                    <div className="pv-bulk-prop-row__field pv-bulk-prop-row__field--unit">
                      <span className="pv-bulk-mini-label">Unit</span>
                      <Dropdown
                        variant="form"
                        value={prop.unit}
                        options={unitOptions}
                        placeholder="Select unit..."
                        error={
                          prop.status === 'missing_unit' ||
                          prop.status === 'unit_conflict' ||
                          prop.status === 'staged_unit_conflict' ||
                          prop.status === 'intra_batch_unit_conflict'
                        }
                        disabled={isSaving}
                        onChange={(val) =>
                          onChangeDraftField?.(prop.rowKey, 'unit', val)
                        }
                        ariaLabel={`Proposed unit for line ${prop.lineNumber}`}
                      />
                    </div>

                    <div className="pv-bulk-prop-row__field pv-bulk-prop-row__field--cat">
                      <span className="pv-bulk-mini-label">Category</span>
                      <Dropdown
                        variant="form"
                        value={prop.category || 'General'}
                        options={BULK_CATEGORY_OPTIONS}
                        placeholder="General"
                        disabled={isSaving}
                        onChange={(val) =>
                          onChangeDraftField?.(prop.rowKey, 'category', val)
                        }
                        ariaLabel={`Category for line ${prop.lineNumber}`}
                      />
                    </div>
                  </div>

                  <div className="pv-bulk-prop-row__foot">
                    <span
                      className={`pv-bulk-status${
                        isConflict || rowErr
                          ? ' pv-bulk-status--warn'
                          : isExistingReuse
                            ? ' pv-bulk-status--reuse'
                            : ''
                      }`}
                    >
                      {rowErr || prop.statusMessage}
                    </span>

                    <div className="pv-bulk-prop-row__actions">
                      {prop.existingMatch &&
                      prop.existingMatch.isActive !== false ? (
                        <button
                          type="button"
                          className="pv-mini-btn"
                          onClick={() =>
                            onLinkExistingMaterial?.(
                              prop.rowKey,
                              prop.existingMatch.id,
                            )
                          }
                          disabled={isSaving}
                        >
                          Use Existing ({prop.existingMatch.unit})
                        </button>
                      ) : null}

                      {prop.stagedMatch ? (
                        <button
                          type="button"
                          className="pv-mini-btn"
                          onClick={() =>
                            onLinkExistingMaterial?.(
                              prop.rowKey,
                              prop.stagedMatch.tempId,
                            )
                          }
                          disabled={isSaving}
                        >
                          Use Staged ({prop.stagedMatch.unit})
                        </button>
                      ) : null}

                      <button
                        type="button"
                        className="pv-link-btn pv-link-btn--muted"
                        onClick={() => onMarkRowAsExpense?.(prop.rowKey)}
                        disabled={isSaving}
                      >
                        Mark as Expense
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {unresolvedItems.length > 0 ? (
        <div className="pv-bulk-group">
          <span className="pv-bulk-group__label">
            Unresolved / unverified rows ({unresolvedItems.length}) — excluded
            from totals until confirmed
          </span>
          <div className="pv-bulk-unresolved-list">
            {unresolvedItems.map((uItem) => (
              <div key={uItem.key} className="pv-bulk-unresolved-row">
                <div className="pv-bulk-unresolved-row__info">
                  <strong>{uItem.rawText}</strong>
                  <span>{uItem.reason}</span>
                </div>
                {uItem.source === 'uncertain' ? (
                  <div className="pv-bulk-prop-row__actions">
                    <button
                      type="button"
                      className="pv-mini-btn"
                      onClick={() =>
                        onPromoteUncertainRow?.(uItem.uncertainIndex, 'material')
                      }
                      disabled={isSaving}
                    >
                      + As Material
                    </button>
                    <button
                      type="button"
                      className="pv-mini-btn"
                      onClick={() =>
                        onPromoteUncertainRow?.(uItem.uncertainIndex, 'expense')
                      }
                      disabled={isSaving}
                    >
                      + As Expense
                    </button>
                    <button
                      type="button"
                      className="pv-mini-btn pv-mini-btn--danger"
                      onClick={() =>
                        onDismissUncertainRow?.(uItem.uncertainIndex)
                      }
                      disabled={isSaving}
                    >
                      Dismiss
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {bulkFeedbackError ? (
        <p className="pv-field-error" role="alert">
          {bulkFeedbackError}
        </p>
      ) : null}

      {proposedItems.length > 0 ? (
        <div className="pv-bulk-panel__footer">
          <span className="pv-bulk-panel__count">
            {selectedCount} of {proposedItems.length} proposed{' '}
            {proposedItems.length === 1 ? 'material' : 'materials'} selected
          </span>
          <div className="pv-bulk-panel__cta">
            <button
              type="button"
              className="admin-btn admin-btn--secondary"
              onClick={onConfirmSelectedMaterials}
              disabled={isSaving || selectedCount === 0}
            >
              Create Selected Materials ({selectedCount})
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={onConfirmSelectedAndSaveVoucher}
              disabled={isSaving || selectedCount === 0}
            >
              Create Missing Materials &amp; Save Voucher
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
