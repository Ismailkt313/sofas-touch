import { useRef, useState } from 'react'
import { BillAttachmentCard } from './BillAttachmentCard'
import {
  MAX_BILL_ATTACHMENTS,
  formatFileSize,
} from '../services/purchaseService'

export function BillUploadOcrPanel({
  isSaving,
  totalAttachmentCount,
  fileInputRef,
  fieldError,
  ocrState,
  showRawOcrText,
  onToggleRawOcrText,
  pendingFiles,
  activePreviewFileIdx,
  onSelectPreviewFile,
  onFilesSelected,
  onReplacePendingFile,
  onRunOcrForFile,
  onRemovePendingFile,
  retainedExistingAttachments,
  onOpenExistingAttachmentPreview,
  onMarkExistingAttachmentRemoved,
}) {
  const replaceInputRef = useRef(null)
  const [replacingLocalId, setReplacingLocalId] = useState('')
  const [isPreviewVisible, setIsPreviewVisible] = useState(true)
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false)
  const [showAllWarnings, setShowAllWarnings] = useState(false)

  const activePreviewEntry = pendingFiles[activePreviewFileIdx] || null
  const confidenceRounded = Math.round(Number(ocrState.averageConfidence) || 0)
  const isLowConfidence = confidenceRounded > 0 && confidenceRounded < 65
  const warnings = Array.isArray(ocrState.warnings) ? ocrState.warnings : []
  const visibleWarnings = showAllWarnings ? warnings : warnings.slice(0, 2)

  const triggerReplaceFor = (localId) => {
    if (isSaving || ocrState.isRunning) return
    setReplacingLocalId(localId)
    replaceInputRef.current?.click()
  }

  const handleReplaceInputChange = (event) => {
    const file = event.target.files?.[0]
    if (event.target) {
      event.target.value = ''
    }
    if (file && replacingLocalId) {
      onReplacePendingFile?.(replacingLocalId, file)
    }
    setReplacingLocalId('')
  }

  return (
    <section className="pv-surface pv-section-card pv-bill-panel">
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

      <input
        ref={replaceInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={handleReplaceInputChange}
        className="sr-only"
        aria-label="Replace bill file"
        disabled={isSaving || ocrState.isRunning}
      />

      {pendingFiles.length === 0 && retainedExistingAttachments.length === 0 ? (
        <div className="pv-compact-upload-bar">
          <div className="pv-compact-upload-bar__info">
            <div className="pv-compact-upload-bar__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 16V6M12 6L8.25 9.75M12 6L15.75 9.75M5 18.5H19"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <h2 className="pv-compact-upload-bar__title">
                Supplier Bill <span className="pv-opt">(Optional — Local OCR)</span>
              </h2>
              <p className="pv-compact-upload-bar__desc">
                Upload an invoice image or PDF (max 10 MB) to preview and
                autofill empty fields, or enter details manually below.
              </p>
            </div>
          </div>

          <label
            htmlFor="pv-bill-file-input"
            className="admin-btn admin-btn--secondary pv-upload-trigger"
          >
            <span>Upload Bill</span>
          </label>
        </div>
      ) : (
        <div className="pv-section-card__header pv-bill-panel__header">
          <div>
            <h2 className="pv-section-card__title">
              Supplier Bill <span className="pv-opt">(Optional)</span>
            </h2>
            <p className="pv-section-card__subtitle">
              Edited and confirmed fields are protected whenever OCR runs or a
              bill is replaced.
            </p>
          </div>

          <div className="pv-bill-panel__top-btns">
            {pendingFiles.length > 0 ? (
              <button
                type="button"
                className="pv-text-btn"
                onClick={() => setIsPreviewVisible((prev) => !prev)}
              >
                {isPreviewVisible ? 'Hide Preview' : 'Show Preview'}
              </button>
            ) : null}

            <label
              htmlFor="pv-bill-file-input"
              className={`admin-btn admin-btn--secondary pv-upload-trigger${
                totalAttachmentCount >= MAX_BILL_ATTACHMENTS
                  ? ' pv-upload-trigger--disabled'
                  : ''
              }`}
            >
              <span>+ Add File</span>
            </label>
          </div>
        </div>
      )}

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

      {ocrState.completed ? (
        <div className="pv-alert pv-alert--review pv-alert--compact" role="status">
          <div className="pv-alert__header">
            <div className="pv-alert__title-group">
              <strong>OCR Review Needed Before Saving</strong>
              {confidenceRounded > 0 ? (
                <span
                  className={`pv-ocr-badge${
                    isLowConfidence
                      ? ' pv-ocr-badge--warn'
                      : ' pv-ocr-badge--ok'
                  }`}
                >
                  Confidence: {confidenceRounded}%
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
                  ? 'Table Detected'
                  : 'Table Header Unclear'}
              </span>
            </div>

            <div className="pv-alert__actions">
              {activePreviewEntry ? (
                <button
                  type="button"
                  className="pv-text-btn"
                  disabled={ocrState.isRunning || isSaving}
                  onClick={() =>
                    onRunOcrForFile(activePreviewEntry, { isReprocess: true })
                  }
                >
                  Reprocess OCR
                </button>
              ) : null}
              {ocrState.rawText ? (
                <button
                  type="button"
                  className="pv-text-btn"
                  onClick={onToggleRawOcrText}
                >
                  {showRawOcrText ? 'Hide OCR Text' : 'Raw OCR Text'}
                </button>
              ) : null}
            </div>
          </div>

          <p className="pv-alert__body">
            {ocrState.summaryNote ||
              'Empty fields were autofilled from the bill while your manual and confirmed entries were preserved. Verify all values before saving.'}
          </p>

          {warnings.length > 0 ? (
            <div className="pv-alert__warnings-wrap">
              <ul className="pv-alert__list">
                {visibleWarnings.map((warn, i) => (
                  <li key={i}>{warn}</li>
                ))}
              </ul>
              {warnings.length > 2 ? (
                <button
                  type="button"
                  className="pv-text-btn pv-text-btn--sm"
                  onClick={() => setShowAllWarnings((prev) => !prev)}
                >
                  {showAllWarnings
                    ? 'Show fewer notices'
                    : `Show ${warnings.length - 2} more notice${
                        warnings.length - 2 === 1 ? '' : 's'
                      }`}
                </button>
              ) : null}
            </div>
          ) : null}

          {showRawOcrText && ocrState.rawText ? (
            <pre className="pv-ocr-raw-box">{ocrState.rawText}</pre>
          ) : null}
        </div>
      ) : null}

      {ocrState.error ? (
        <div className="pv-alert pv-alert--warning pv-alert--compact" role="alert">
          <div className="pv-alert__header">
            <strong>Local OCR Notice: {ocrState.error}</strong>
            <div className="pv-alert__actions">
              {activePreviewEntry ? (
                <button
                  type="button"
                  className="pv-text-btn"
                  disabled={ocrState.isRunning || isSaving}
                  onClick={() =>
                    onRunOcrForFile(activePreviewEntry, { isReprocess: true })
                  }
                >
                  Retry OCR
                </button>
              ) : null}
              {ocrState.rawText ? (
                <button
                  type="button"
                  className="pv-text-btn"
                  onClick={onToggleRawOcrText}
                >
                  {showRawOcrText ? 'Hide OCR Text' : 'Raw OCR Text'}
                </button>
              ) : null}
            </div>
          </div>
          {showRawOcrText && ocrState.rawText ? (
            <pre className="pv-ocr-raw-box">{ocrState.rawText}</pre>
          ) : null}
        </div>
      ) : null}

      {pendingFiles.length > 0 ? (
        <div
          className={`pv-upload-workspace${
            !isPreviewVisible ? ' pv-upload-workspace--collapsed' : ''
          }`}
        >
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
                  onClick={() => {
                    onSelectPreviewFile(idx)
                    setIsPreviewVisible(true)
                  }}
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
                    disabled={ocrState.isRunning || isSaving}
                    onClick={() =>
                      onRunOcrForFile(entry, {
                        isReprocess: Boolean(entry.ocrProcessedOnce),
                      })
                    }
                  >
                    {ocrState.isRunning
                      ? 'Reading...'
                      : entry.ocrProcessedOnce
                        ? 'Reprocess OCR'
                        : 'Run OCR'}
                  </button>
                  <button
                    type="button"
                    className="pv-action-btn"
                    disabled={ocrState.isRunning || isSaving}
                    onClick={() => triggerReplaceFor(entry.localId)}
                  >
                    Replace
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

          {isPreviewVisible && activePreviewEntry ? (
            <div
              className={`pv-local-preview-box${
                isPreviewExpanded ? ' pv-local-preview-box--expanded' : ''
              }`}
            >
              <div className="pv-local-preview-box__head">
                <span>
                  Bill Preview: <strong>{activePreviewEntry.file.name}</strong>
                </span>
                <button
                  type="button"
                  className="pv-text-btn pv-text-btn--sm"
                  onClick={() => setIsPreviewExpanded((prev) => !prev)}
                >
                  {isPreviewExpanded ? 'Compact Size' : 'Expand Size'}
                </button>
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
                        PDF attached (
                        {formatFileSize(activePreviewEntry.file.size)}). Click{' '}
                        <strong>Run OCR</strong> to render a local page preview
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
  )
}
