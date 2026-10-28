import { useEffect, useId, useRef, useState } from 'react'
import {
  downloadAuthorizedAttachment,
  fetchAuthorizedAttachmentBlobUrl,
  formatFileSize,
} from '../services/purchaseService'

export function BillAttachmentModal({
  attachment,
  onClose,
}) {
  const titleId = useId()
  const closeBtnRef = useRef(null)
  const backdropMouseDownRef = useRef(false)
  const [viewerState, setViewerState] = useState({
    blobUrl: '',
    error: '',
    loadedForUrl: '',
  })
  const [zoomScale, setZoomScale] = useState(1)
  const [isDownloading, setIsDownloading] = useState(false)

  const targetViewUrl = attachment?.viewUrl || ''
  const isPdf = attachment?.mimeType === 'application/pdf'

  useEffect(() => {
    if (!targetViewUrl || typeof document === 'undefined') {
      return undefined
    }

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.requestAnimationFrame(() => {
      closeBtnRef.current?.focus()
    })

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose?.()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    let cancelled = false
    let activeBlobUrl = ''

    fetchAuthorizedAttachmentBlobUrl(targetViewUrl)
      .then((blobUrl) => {
        if (cancelled) {
          URL.revokeObjectURL(blobUrl)
          return
        }
        activeBlobUrl = blobUrl
        setViewerState({
          blobUrl,
          error: '',
          loadedForUrl: targetViewUrl,
        })
      })
      .catch((err) => {
        if (!cancelled) {
          setViewerState({
            blobUrl: '',
            error: err?.message || 'Unable to load bill preview.',
            loadedForUrl: targetViewUrl,
          })
        }
      })

    return () => {
      cancelled = true
      window.cancelAnimationFrame(focusTimer)
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', handleKeyDown)
      if (activeBlobUrl) {
        URL.revokeObjectURL(activeBlobUrl)
      }
    }
  }, [targetViewUrl, onClose])

  if (!attachment) {
    return null
  }

  const isLoading = viewerState.loadedForUrl !== targetViewUrl

  const handleDownload = async () => {
    if (isDownloading || !attachment.downloadUrl) {
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
    <div
      className="admin-modal-backdrop pv-viewer-backdrop"
      onMouseDown={(event) => {
        backdropMouseDownRef.current = event.target === event.currentTarget
      }}
      onClick={(event) => {
        if (
          backdropMouseDownRef.current &&
          event.target === event.currentTarget
        ) {
          onClose?.()
        }
        backdropMouseDownRef.current = false
      }}
    >
      <div
        className="admin-modal pv-viewer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="admin-modal__header pv-viewer-modal__header">
          <div>
            <h2 id={titleId} className="admin-modal__title">
              {attachment.originalName}
            </h2>
            <p className="admin-modal__subtitle">
              {isPdf ? 'PDF Supplier Invoice' : 'Supplier Bill Image'} ·{' '}
              {formatFileSize(attachment.sizeBytes)}
            </p>
          </div>

          <div className="pv-viewer-modal__toolbar">
            {!isPdf && viewerState.blobUrl ? (
              <div className="pv-viewer-zoom">
                <button
                  type="button"
                  className="pv-action-btn"
                  onClick={() =>
                    setZoomScale((prev) => Math.max(0.5, Number((prev - 0.25).toFixed(2))))
                  }
                >
                  −
                </button>
                <span className="pv-viewer-zoom__label">
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  type="button"
                  className="pv-action-btn"
                  onClick={() =>
                    setZoomScale((prev) => Math.min(3, Number((prev + 0.25).toFixed(2))))
                  }
                >
                  +
                </button>
              </div>
            ) : null}

            <button
              type="button"
              className="admin-btn admin-btn--secondary"
              onClick={handleDownload}
              disabled={isDownloading}
            >
              {isDownloading ? 'Downloading...' : 'Download Original'}
            </button>

            <button
              ref={closeBtnRef}
              type="button"
              className="admin-modal__close"
              onClick={onClose}
              aria-label="Close bill viewer"
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M5 5L15 15M15 5L5 15"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="pv-viewer-modal__stage">
          {isLoading ? (
            <div className="pv-viewer-modal__state">
              Loading protected bill document...
            </div>
          ) : viewerState.error ? (
            <div className="pv-viewer-modal__state pv-viewer-modal__state--error">
              {viewerState.error}
            </div>
          ) : isPdf ? (
            <iframe
              title={attachment.originalName}
              src={viewerState.blobUrl}
              className="pv-viewer-modal__pdf-frame"
            />
          ) : (
            <div className="pv-viewer-modal__image-scroll">
              <img
                src={viewerState.blobUrl}
                alt={attachment.originalName}
                className="pv-viewer-modal__image"
                style={{ transform: `scale(${zoomScale})` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
