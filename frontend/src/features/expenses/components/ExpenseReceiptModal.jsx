import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  downloadAuthorizedReceipt,
  fetchAuthorizedReceiptBlobUrl,
} from '../services/expenseService'
import {
  formatReceiptByteSize,
  isPdfReceiptMime,
} from '../utils/expenseValidation'

export function ExpenseReceiptModal({
  title = 'Receipt Preview',
  attachments = [],
  initialIndex = 0,
  localPreview = null,
  onClose,
}) {
  const isLocalMode = Boolean(localPreview?.blobUrl)
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const activeAttachment = isLocalMode
    ? localPreview
    : attachments[activeIndex] || attachments[0] || null

  const remoteViewUrl = !isLocalMode ? activeAttachment?.viewUrl || '' : ''

  const [remoteState, setRemoteState] = useState(() => ({
    forUrl: '',
    blobUrl: '',
    mimeType: '',
    error: '',
  }))
  const [zoom, setZoom] = useState(1)
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    if (!remoteViewUrl) {
      return undefined
    }

    let cancelled = false
    let generatedBlobUrl = ''

    fetchAuthorizedReceiptBlobUrl(remoteViewUrl)
      .then((res) => {
        if (cancelled) {
          if (res.blobUrl && res.blobUrl.startsWith('blob:')) {
            URL.revokeObjectURL(res.blobUrl)
          }
          return
        }
        generatedBlobUrl = res.blobUrl
        setRemoteState({
          forUrl: remoteViewUrl,
          blobUrl: res.blobUrl,
          mimeType: res.mimeType,
          error: '',
        })
      })
      .catch((err) => {
        if (cancelled) return
        setRemoteState({
          forUrl: remoteViewUrl,
          blobUrl: '',
          mimeType: '',
          error: err?.message || 'Unable to load receipt preview.',
        })
      })

    return () => {
      cancelled = true
      if (generatedBlobUrl && generatedBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(generatedBlobUrl)
      }
    }
  }, [remoteViewUrl])

  if (!activeAttachment) {
    return null
  }

  const effectiveBlobUrl = isLocalMode
    ? localPreview.blobUrl
    : remoteState.forUrl === remoteViewUrl
      ? remoteState.blobUrl
      : ''
  const effectiveError = isLocalMode
    ? ''
    : remoteState.forUrl === remoteViewUrl
      ? remoteState.error
      : ''
  const isLoading = !isLocalMode && remoteState.forUrl !== remoteViewUrl

  const displayName =
    activeAttachment.originalName || activeAttachment.name || 'Receipt'
  const effectiveMime =
    (isLocalMode ? localPreview.mimeType : remoteState.mimeType) ||
    activeAttachment.mimeType ||
    ''
  const isPdf = isPdfReceiptMime(effectiveMime, displayName)

  const handleSelectAttachment = (nextIndex) => {
    setActiveIndex(nextIndex)
    setZoom(1)
  }

  const handleDownload = async () => {
    if (isLocalMode && localPreview.blobUrl) {
      const anchor = document.createElement('a')
      anchor.href = localPreview.blobUrl
      anchor.download = displayName
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      return
    }

    if (!activeAttachment.downloadUrl) {
      return
    }
    setIsDownloading(true)
    try {
      await downloadAuthorizedReceipt(activeAttachment.downloadUrl, displayName)
    } finally {
      setIsDownloading(false)
    }
  }

  return createPortal(
    <div
      className="exp-modal-backdrop admin-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div className="exp-modal exp-modal--preview admin-modal">
        <div className="exp-modal__header">
          <div>
            <h2 className="exp-modal__title">{title}</h2>
            <p className="exp-modal__subtitle">
              {displayName}
              {activeAttachment.sizeBytes
                ? ` · ${formatReceiptByteSize(activeAttachment.sizeBytes)}`
                : ''}
            </p>
          </div>
          <button
            type="button"
            className="exp-modal__close"
            onClick={onClose}
            aria-label="Close receipt preview"
          >
            ×
          </button>
        </div>

        <div className="exp-modal__body">
          {!isLocalMode && attachments.length > 1 ? (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {attachments.map((att, idx) => (
                <button
                  key={att.attachmentId || idx}
                  type="button"
                  className={`exp-btn exp-btn--sm ${
                    idx === activeIndex
                      ? 'exp-btn--primary'
                      : 'exp-btn--secondary'
                  }`}
                  onClick={() => handleSelectAttachment(idx)}
                >
                  Receipt {idx + 1}: {att.originalName}
                </button>
              ))}
            </div>
          ) : null}

          {!isPdf && effectiveBlobUrl ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.4rem',
              }}
            >
              <button
                type="button"
                className="exp-btn exp-btn--secondary exp-btn--sm"
                onClick={() =>
                  setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))
                }
              >
                − Zoom Out
              </button>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                className="exp-btn exp-btn--secondary exp-btn--sm"
                onClick={() =>
                  setZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))
                }
              >
                + Zoom In
              </button>
              {zoom !== 1 ? (
                <button
                  type="button"
                  className="exp-btn exp-btn--ghost exp-btn--sm"
                  onClick={() => setZoom(1)}
                >
                  Reset
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="exp-preview-stage">
            {isLoading ? (
              <span style={{ color: 'var(--sts-charcoal-muted)' }}>
                Loading receipt preview…
              </span>
            ) : effectiveError ? (
              <span style={{ color: 'var(--sts-error-text)' }}>
                {effectiveError}
              </span>
            ) : effectiveBlobUrl ? (
              isPdf ? (
                <iframe src={effectiveBlobUrl} title={displayName} />
              ) : (
                <img
                  src={effectiveBlobUrl}
                  alt={displayName}
                  style={{ transform: `scale(${zoom})` }}
                />
              )
            ) : null}
          </div>
        </div>

        <div className="exp-modal__footer">
          <button
            type="button"
            className="exp-btn exp-btn--secondary"
            onClick={handleDownload}
            disabled={isDownloading || isLoading || Boolean(effectiveError)}
          >
            {isDownloading ? 'Downloading…' : 'Download Receipt'}
          </button>
          <button
            type="button"
            className="exp-btn exp-btn--primary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
