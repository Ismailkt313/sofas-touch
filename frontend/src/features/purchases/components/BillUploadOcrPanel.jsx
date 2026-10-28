import { BillAttachmentCard } from './BillAttachmentCard'
import {
  MAX_BILL_ATTACHMENTS,
  formatFileSize,
} from '../services/purchaseService'

export function BillUploadOcrPanel({
  isEditMode,
  isSaving,
  totalAttachmentCount,
  fileInputRef,
  fieldError,
  ocrState,
  showRawOcrText,
  onToggleRawOcrText,
  onDiscardOcrDraft,
  pendingFiles,
  activePreviewFileIdx,
  onSelectPreviewFile,
  onFilesSelected,
  onRunOcrForFile,
  onRemovePendingFile,
  retainedExistingAttachments,
  onOpenExistingAttachmentPreview,
  onMarkExistingAttachmentRemoved,
}) {
  const activePreviewEntry = pendingFiles[activePreviewFileIdx] || null
  const confidenceRounded = Math.round(Number(ocrState.averageConfidence) || 0)
  const isLowConfidence = confidenceRounded > 0 && confidenceRounded < 65

  return (
    <>
      {ocrState.completed ? (
        <div className="pv-alert pv-alert--review" role="status">
          <div className="pv-alert__header">
            <div className="pv-alert__title-group">
              <strong>
                OCR Extraction Complete — Verification Required Before Saving
              </strong>
              {confidenceRounded > 0 ? (
                <span
                  className={`pv-ocr-badge${
                    isLowConfidence
                      ? ' pv-ocr-badge--warn'
                      : ' pv-ocr-badge--ok'
                  }`}
                >
                  OCR Confidence: {confidenceRounded}%
                </span>
              ) : null}
              <span
                className={`pv-ocr-badge${
                  ocrState.tableDetected
                    ? ' pv-ocr-badge--ok'
                    : ' pv-ocr-badge--warn'
                }`}
              >
                {ocrState.tableDetected
                  ? 'Item Table Detected'
                  : 'Table Header Unclear'}
              </span>
            </div>

            <div className="pv-alert__actions">
              {ocrState.rawText ? (
                <button
                  type="button"
                  className="pv-text-btn"
                  onClick={onToggleRawOcrText}
                >
                  {showRawOcrText ? 'Hide OCR Text' : 'Inspect Raw OCR Text'}
                </button>
              ) : null}
              <button
                type="button"
                className="pv-discard-ocr-btn"
                onClick={onDiscardOcrDraft}
                disabled={isSaving}
              >
                Discard OCR Draft &amp; Enter Manually
              </button>
            </div>
          </div>

          <p className="pv-alert__body">
            Validated table values have been placed into the draft below. Please
            verify the supplier name, invoice date, Raw Material matches,
            quantities, units, unit prices, and invoice totals against the bill
            preview before saving.
          </p>

          {ocrState.warnings && ocrState.warnings.length > 0 ? (
            <ul className="pv-alert__list">
              {ocrState.warnings.map((warn, i) => (
                <li key={i}>{warn}</li>
              ))}
            </ul>
          ) : null}

          {showRawOcrText && ocrState.rawText ? (
            <pre className="pv-ocr-raw-box">{ocrState.rawText}</pre>
          ) : null}
        </div>
      ) : null}

      {ocrState.draftDiscarded ? (
        <div className="pv-alert pv-alert--info" role="status">
          <strong>OCR draft cleared:</strong> All OCR-prefilled values were
          reset so you can enter the purchase details manually while keeping the
          uploaded bill preview attached below.
        </div>
      ) : null}

      {ocrState.error ? (
        <div className="pv-alert pv-alert--warning" role="alert">
          <div className="pv-alert__header">
            <strong>Local OCR Notice: {ocrState.error}</strong>
            {ocrState.rawText ? (
              <button
                type="button"
                className="pv-text-btn"
                onClick={onToggleRawOcrText}
              >
                {showRawOcrText ? 'Hide OCR Text' : 'Inspect Raw OCR Text'}
              </button>
            ) : null}
          </div>
          {showRawOcrText && ocrState.rawText ? (
            <pre className="pv-ocr-raw-box">{ocrState.rawText}</pre>
          ) : null}
        </div>
      ) : null}

      <section className="pv-surface pv-section-card">
        <div className="pv-section-card__header">
          <div>
            <h2 className="pv-section-card__title">
              Supplier Bill Attachment &amp; Local OCR
            </h2>
            <p className="pv-section-card__subtitle">
              Accepts JPG, PNG, WEBP images, or PDF bills up to 10 MB per file.
              OCR runs 100% locally in your browser before upload.
            </p>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              multiple
              onChange={onFilesSelected}
              className="sr-only"
              id="pv-bill-file-input"
              disabled={isSaving || totalAttachmentCount >= MAX_BILL_ATTACHMENTS}
            />
            <label
              htmlFor="pv-bill-file-input"
              className={`admin-btn admin-btn--secondary pv-upload-trigger${
                totalAttachmentCount >= MAX_BILL_ATTACHMENTS
                  ? ' pv-upload-trigger--disabled'
                  : ''
              }`}
            >
              <span>
                {pendingFiles.length > 0 ||
                retainedExistingAttachments.length > 0
                  ? '+ Add Another Page / File'
                  : 'Choose Bill Image or PDF'}
              </span>
            </label>
          </div>
        </div>

        {fieldError ? (
          <p className="pv-field-error" role="alert">
            {fieldError}
          </p>
        ) : null}

        {ocrState.isRunning ? (
          <div className="pv-progress-panel" role="status" aria-live="polite">
            <div className="pv-progress-panel__top">
              <span>{ocrState.message}</span>
              <strong>{ocrState.percent}%</strong>
            </div>
            <div className="pv-progress-bar">
              <div
                className="pv-progress-bar__fill"
                style={{ width: `${ocrState.percent}%` }}
              />
            </div>
          </div>
        ) : null}

        {pendingFiles.length > 0 ? (
          <div className="pv-upload-workspace">
            <div className="pv-pending-files-list">
              {pendingFiles.map((entry, idx) => (
                <div
                  key={entry.localId}
                  className={`pv-pending-file-item${
                    idx === activePreviewFileIdx
                      ? ' pv-pending-file-item--active'
                      : ''
                  }`}
                >
                  <button
                    type="button"
                    className="pv-pending-file-item__select"
                    onClick={() => onSelectPreviewFile(idx)}
                  >
                    <span className="pv-pending-file-item__name">
                      {entry.file.name}
                    </span>
                    <span className="pv-pending-file-item__size">
                      {entry.isPdf ? 'PDF' : 'Image'} ·{' '}
                      {formatFileSize(entry.file.size)}
                    </span>
                  </button>

                  <div className="pv-pending-file-item__btns">
                    <button
                      type="button"
                      className="pv-action-btn"
                      disabled={ocrState.isRunning}
                      onClick={() => onRunOcrForFile(entry)}
                    >
                      {ocrState.isRunning ? 'Reading...' : 'Run OCR'}
                    </button>
                    <button
                      type="button"
                      className="pv-action-btn pv-action-btn--danger"
                      disabled={isSaving}
                      onClick={() => onRemovePendingFile(entry.localId)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {activePreviewEntry ? (
              <div className="pv-local-preview-box">
                <div className="pv-local-preview-box__head">
                  <span>
                    Local Preview: <strong>{activePreviewEntry.file.name}</strong>{' '}
                    (not uploaded until you save)
                  </span>
                </div>
                <div className="pv-local-preview-box__body">
                  {activePreviewEntry.isPdf ? (
                    activePreviewEntry.renderedPdfPreviewUrl ? (
                      <img
                        src={activePreviewEntry.renderedPdfPreviewUrl}
                        alt={`Rendered page 1 of ${activePreviewEntry.file.name}`}
                        className="pv-local-preview-img"
                      />
                    ) : (
                      <div className="pv-local-pdf-note">
                        <p>
                          PDF selected (
                          {formatFileSize(activePreviewEntry.file.size)}). Click{' '}
                          <strong>Run OCR</strong> to render PDF pages locally
                          and extract text.
                        </p>
                      </div>
                    )
                  ) : (
                    <img
                      src={activePreviewEntry.localObjectUrl}
                      alt={`Preview of ${activePreviewEntry.file.name}`}
                      className="pv-local-preview-img"
                    />
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : !isEditMode ? (
          <label htmlFor="pv-bill-file-input" className="pv-dropzone">
            <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <path
                d="M14 19V7M14 7L9.5 11.5M14 7L18.5 11.5M5.5 21.5H22.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <strong>Click to select or photograph a supplier bill</strong>
            <span>
              Supports JPG, PNG, WEBP, or PDF (max 10 MB). Or switch to Enter
              Manually if no bill is available yet.
            </span>
          </label>
        ) : null}

        {retainedExistingAttachments.length > 0 ? (
          <div className="pv-existing-att-block">
            <h3 className="pv-subsection-title">
              Saved Bill Attachments ({retainedExistingAttachments.length})
            </h3>
            <div className="pv-bill-cards-grid">
              {retainedExistingAttachments.map((att) => (
                <div key={att.attachmentId} className="pv-edit-att-wrap">
                  <BillAttachmentCard
                    attachment={att}
                    onOpenPreview={onOpenExistingAttachmentPreview}
                  />
                  <button
                    type="button"
                    className="pv-remove-saved-att-btn"
                    onClick={() =>
                      onMarkExistingAttachmentRemoved(att.attachmentId)
                    }
                  >
                    Remove attachment on save
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </>
  )
}
