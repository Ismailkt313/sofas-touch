import { useEffect, useState } from 'react'
import {
  downloadAuthorizedAttachment,
  fetchAuthorizedAttachmentBlobUrl,
  formatFileSize,
  formatPurchaseDateTime,
} from '../services/purchaseService'

export function BillAttachmentCard({
  attachment,
  onOpenPreview,
}) {
  const isPdf = attachment?.mimeType === 'application/pdf'
  const [thumbState, setThumbState] = useState({
    url: '',
    error: false,
  })
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    if (!attachment?.viewUrl || isPdf) {
      return undefined
    }

    let cancelled = false
    let generatedBlobUrl = ''

    fetchAuthorizedAttachmentBlobUrl(attachment.viewUrl)
      .then((blobUrl) => {
        if (cancelled) {
          URL.revokeObjectURL(blobUrl)
          return
        }
        generatedBlobUrl = blobUrl
        setThumbState({ url: blobUrl, error: false })
      })
      .catch(() => {
        if (!cancelled) {
          setThumbState({ url: '', error: true })
        }
      })

    return () => {
      cancelled = true
      if (generatedBlobUrl) {
        URL.revokeObjectURL(generatedBlobUrl)
      }
    }
  }, [attachment?.viewUrl, isPdf])

  const handleDownload = async () => {
    if (isDownloading || !attachment?.downloadUrl) {
      return
    }
    setIsDownloading(true)
    try {
      await downloadAuthorizedAttachment(
        attachment.downloadUrl,
        attachment.originalName,
      )
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="pv-bill-card">
      <button
        type="button"
        className="pv-bill-card__thumb-btn"
        onClick={() => onOpenPreview?.(attachment)}
        aria-label={`Preview bill ${attachment.originalName}`}
      >
        {isPdf ? (
          <div className="pv-bill-card__pdf-placeholder">
            <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <path
                d="M7 3.5H16.5L21.5 8.5V23.5C21.5 24.33 20.83 25 20 25H7C6.17 25 5.5 24.33 5.5 23.5V5C5.5 4.17 6.17 3.5 7 3.5Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M16 3.5V9H21.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M9.5 16.5H18.5M9.5 20H15.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <span className="pv-bill-card__pdf-tag">PDF Document</span>
            <span className="pv-bill-card__zoom-hint">Click to preview</span>
          </div>
        ) : thumbState.url ? (
          <div className="pv-bill-card__img-wrap">
            <img
              src={thumbState.url}
              alt={attachment.originalName}
              className="pv-bill-card__img"
            />
            <span className="pv-bill-card__overlay">View Full Bill</span>
          </div>
        ) : thumbState.error ? (
          <div className="pv-bill-card__pdf-placeholder">
            <span className="pv-bill-card__pdf-tag">Preview unavailable</span>
          </div>
        ) : (
          <div className="pv-bill-card__pdf-placeholder">
            <span className="pv-bill-card__zoom-hint">Loading preview...</span>
          </div>
        )}
      </button>

      <div className="pv-bill-card__meta">
        <span
          className="pv-bill-card__filename"
          title={attachment.originalName}
        >
          {attachment.originalName}
        </span>
        <span className="pv-bill-card__submeta">
          {formatFileSize(attachment.sizeBytes)}
          {attachment.uploadedAt
            ? ` · ${formatPurchaseDateTime(attachment.uploadedAt)}`
            : ''}
        </span>

        <div className="pv-bill-card__actions">
          <button
            type="button"
            className="pv-action-btn"
            onClick={() => onOpenPreview?.(attachment)}
          >
            Open Viewer
          </button>
          <button
            type="button"
            className="pv-action-btn"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? 'Saving...' : 'Download'}
          </button>
        </div>
      </div>
    </div>
  )
}
