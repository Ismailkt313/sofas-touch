import { useRef, useState } from 'react'
import {
  MAX_BILL_ATTACHMENTS,
  formatFileSize,
} from '../services/purchaseService'

export function BillLocalPreviewPanel({
  entry,
  isExpanded = false,
  onToggleExpanded,
  onClose,
  className = '',
}) {
  if (!entry) {
    return null
  }

  const previewSrc = entry.isPdf
    ? entry.renderedPdfPreviewUrl
    : entry.localObjectUrl

  return (
    <div
      className={`pv-bill-preview${
        isExpanded ? ' pv-bill-preview--expanded' : ''
      }${className ? ` ${className}` : ''}`}
    >
      <div className="pv-bill-preview__bar">
        <span className="pv-bill-preview__name" title={entry.file.name}>
          {entry.file.name}
        </span>
        <div className="pv-bill-preview__controls">
          {previewSrc && onToggleExpanded ? (
            <button
              type="button"
              className="pv-link-btn"
              onClick={onToggleExpanded}
            >
              {isExpanded ? 'Smaller' : 'Larger'}
            </button>
          ) : null}
          {onClose ? (
            <button type="button" className="pv-link-btn" onClick={onClose}>
              Hide
            </button>
          ) : null}
        </div>
      </div>

      <div className="pv-bill-preview__stage">
        {previewSrc ? (
          <img
            src={previewSrc}
            alt={`Bill preview of ${entry.file.name}`}
            className="pv-bill-preview__img"
          />
        ) : (
          <p className="pv-bill-preview__pdf-empty">
            PDF attached ({formatFileSize(entry.file.size)}). Use{' '}
            <strong>Re-read</strong> to render a page preview.
          </p>
        )}
      </div>
    </div>
  )
}

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
  isPreviewOpen = false,
  isPreviewExpanded = false,
  onTogglePreviewForFile,
  onTogglePreviewExpanded,
  onClosePreview,
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
  const [showWarnings, setShowWarnings] = useState(false)

  const activePreviewEntry = pendingFiles[activePreviewFileIdx] || null
  const confidenceRounded = Math.round(Number(ocrState.averageConfidence) || 0)
  const isLowConfidence = confidenceRounded > 0 && confidenceRounded < 65
  const warnings = Array.isArray(ocrState.warnings) ? ocrState.warnings : []
  const hasWarnTone =
    warnings.length > 0 || isLowConfidence || !ocrState.tableDetected
  const hasAnyFiles =
    pendingFiles.length > 0 || retainedExistingAttachments.length > 0

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
    <section
      className={`pv-upload-strip${
        hasAnyFiles ? ' pv-upload-strip--populated' : ''
      }`}
      aria-label="Bill attachment"
    >
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

      {!hasAnyFiles ? (
        <div className="pv-upload-strip__empty">
          <div className="pv-upload-strip__lead">
            <span className="pv-upload-strip__icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="none">
                <path
                  d="M5.5 2.75H12L15.25 6V16.25C15.25 16.8023 14.8023 17.25 14.25 17.25H5.75C5.19772 17.25 4.75 16.8023 4.75 16.25V3.5C4.75 3.08579 5.08579 2.75 5.5 2.75Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path
                  d="M11.75 2.75V6.25H15.25M7.5 10.25H12.5M7.5 13H10.75"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>

            <div className="pv-upload-strip__copy">
              <span className="pv-upload-strip__label">
                Attach bill <span className="pv-opt">(optional)</span>
              </span>
              <span className="pv-upload-strip__sub">
                Upload an image or PDF to autofill details
              </span>
            </div>
          </div>

          <label htmlFor="pv-bill-file-input" className="pv-upload-btn">
            Upload
          </label>
        </div>
      ) : (
        <div className="pv-upload-strip__files-wrap">
          <div className="pv-uploaded-list">
            {retainedExistingAttachments.map((att) => {
              const isPdf =
                String(att.mimeType || '').toLowerCase() === 'application/pdf'
              return (
                <div
                  key={att.attachmentId}
                  className="pv-uploaded-file-row"
                >
                  <button
                    type="button"
                    className="pv-uploaded-file-row__file"
                    onClick={() => onOpenExistingAttachmentPreview?.(att)}
                  >
                    <span
                      className="pv-uploaded-thumb pv-uploaded-thumb--badge"
                      aria-hidden="true"
                    >
                      {isPdf ? 'PDF' : 'BILL'}
                    </span>
                    <span className="pv-uploaded-file-row__meta">
                      <span
                        className="pv-uploaded-file-row__name"
                        title={att.originalName}
                      >
                        {att.originalName}
                      </span>
                      <span className="pv-uploaded-file-row__size">
                        Saved · {formatFileSize(att.sizeBytes)}
                      </span>
                    </span>
                  </button>

                  <div className="pv-uploaded-file-row__actions">
                    <button
                      type="button"
                      className="pv-mini-btn"
                      onClick={() => onOpenExistingAttachmentPreview?.(att)}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      className="pv-mini-btn pv-mini-btn--danger"
                      disabled={isSaving}
                      onClick={() =>
                        onMarkExistingAttachmentRemoved?.(att.attachmentId)
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            })}

            {pendingFiles.map((entry, idx) => {
              const thumbSrc = entry.isPdf
                ? entry.renderedPdfPreviewUrl
                : entry.localObjectUrl
              const isThisPreviewOpen =
                isPreviewOpen && idx === activePreviewFileIdx

              return (
                <div
                  key={entry.localId}
                  className={`pv-uploaded-file-row${
                    isThisPreviewOpen ? ' pv-uploaded-file-row--active' : ''
                  }`}
                >
                  <button
                    type="button"
                    className="pv-uploaded-file-row__file"
                    onClick={() => onTogglePreviewForFile?.(idx)}
                  >
                    {thumbSrc ? (
                      <img
                        src={thumbSrc}
                        alt=""
                        className="pv-uploaded-thumb"
                      />
                    ) : (
                      <span
                        className="pv-uploaded-thumb pv-uploaded-thumb--badge"
                        aria-hidden="true"
                      >
                        {entry.isPdf ? 'PDF' : 'IMG'}
                      </span>
                    )}

                    <span className="pv-uploaded-file-row__meta">
                      <span
                        className="pv-uploaded-file-row__name"
                        title={entry.file.name}
                      >
                        {entry.file.name}
                      </span>
                      <span className="pv-uploaded-file-row__size">
                        {formatFileSize(entry.file.size)}
                      </span>
                    </span>
                  </button>

                  <div className="pv-uploaded-file-row__actions">
                    <button
                      type="button"
                      className="pv-mini-btn"
                      onClick={() => onTogglePreviewForFile?.(idx)}
                    >
                      {isThisPreviewOpen ? 'Hide' : 'Preview'}
                    </button>
                    <button
                      type="button"
                      className="pv-mini-btn"
                      disabled={ocrState.isRunning || isSaving}
                      onClick={() => triggerReplaceFor(entry.localId)}
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      className="pv-mini-btn pv-mini-btn--danger"
                      disabled={isSaving}
                      onClick={() => onRemovePendingFile(entry.localId)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {totalAttachmentCount < MAX_BILL_ATTACHMENTS ? (
            <div className="pv-upload-strip__more">
              <label
                htmlFor="pv-bill-file-input"
                className={`pv-link-btn${
                  isSaving ? ' pv-upload-trigger--disabled' : ''
                }`}
              >
                + Attach another page
              </label>
            </div>
          ) : null}
        </div>
      )}

      {fieldError ? (
        <p className="pv-field-error" role="alert">
          {fieldError}
        </p>
      ) : null}

      {ocrState.isRunning ? (
        <div className="pv-ocr-running" role="status" aria-live="polite">
          <div className="pv-ocr-running__row">
            <span className="pv-ocr-running__label">
              <span className="pv-ocr-spinner" aria-hidden="true" />
              <span>{ocrState.message || 'Reading bill...'}</span>
            </span>
            <strong>{ocrState.percent}%</strong>
          </div>
          <div className="pv-ocr-running__track">
            <div
              className="pv-ocr-running__fill"
              style={{ width: `${ocrState.percent}%` }}
            />
          </div>
        </div>
      ) : null}

      {!ocrState.isRunning && ocrState.completed ? (
        <div
          className={`pv-ocr-status${
            hasWarnTone ? ' pv-ocr-status--warn' : ' pv-ocr-status--ok'
          }`}
          role="status"
        >
          <div className="pv-ocr-status__main">
            <span className="pv-ocr-status__dot" aria-hidden="true" />
            <span className="pv-ocr-status__msg">
              {ocrState.summaryNote ||
                'Autofilled readable fields from bill — verify before saving.'}
            </span>
          </div>

          <div className="pv-ocr-status__links">
            {warnings.length > 0 ? (
              <button
                type="button"
                className="pv-link-btn"
                onClick={() => setShowWarnings((prev) => !prev)}
              >
                {showWarnings
                  ? 'Hide warnings'
                  : `Warnings (${warnings.length})`}
              </button>
            ) : null}
            {activePreviewEntry ? (
              <button
                type="button"
                className="pv-link-btn"
                disabled={isSaving}
                onClick={() =>
                  onRunOcrForFile(activePreviewEntry, { isReprocess: true })
                }
              >
                Re-read
              </button>
            ) : null}
          </div>

          {showWarnings && warnings.length > 0 ? (
            <div className="pv-ocr-warnings-drawer">
              <ul className="pv-ocr-warnings-list">
                {warnings.map((warn, idx) => (
                  <li key={idx}>{warn}</li>
                ))}
              </ul>
              {ocrState.rawText ? (
                <button
                  type="button"
                  className="pv-link-btn"
                  onClick={onToggleRawOcrText}
                >
                  {showRawOcrText ? 'Hide raw OCR text' : 'View raw OCR text'}
                </button>
              ) : null}
              {showRawOcrText && ocrState.rawText ? (
                <pre className="pv-ocr-raw-box">{ocrState.rawText}</pre>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {!ocrState.isRunning && ocrState.error ? (
        <div className="pv-ocr-status pv-ocr-status--warn" role="alert">
          <div className="pv-ocr-status__main">
            <span className="pv-ocr-status__dot" aria-hidden="true" />
            <span className="pv-ocr-status__msg">{ocrState.error}</span>
          </div>
          {activePreviewEntry ? (
            <div className="pv-ocr-status__links">
              <button
                type="button"
                className="pv-link-btn"
                disabled={isSaving}
                onClick={() =>
                  onRunOcrForFile(activePreviewEntry, { isReprocess: true })
                }
              >
                Retry
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {isPreviewOpen && activePreviewEntry ? (
        <BillLocalPreviewPanel
          entry={activePreviewEntry}
          isExpanded={isPreviewExpanded}
          onToggleExpanded={onTogglePreviewExpanded}
          onClose={onClosePreview}
          className="pv-bill-preview--inline"
        />
      ) : null}
    </section>
  )
}
