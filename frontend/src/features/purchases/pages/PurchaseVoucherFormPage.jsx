import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Dropdown } from '../../../components/common'
import { fetchProjects } from '../../projects'
import {
  fetchRawMaterials,
  formatMaterialStockOnHand,
  formatMaterialUnit,
  formatMaterialUnitOptionLabel,
} from '../../raw-materials'
import { BillAttachmentCard } from '../components/BillAttachmentCard'
import { BillAttachmentModal } from '../components/BillAttachmentModal'
import {
  MAX_BILL_ATTACHMENTS,
  calculateLineTotalPreview,
  calculateVoucherPreviewTotals,
  createPurchaseVoucher,
  fetchPurchaseVoucherById,
  formatFileSize,
  formatInrCurrency,
  hasActiveAuthToken,
  isAdminUser,
  toInputDateString,
  updatePurchaseVoucher,
  validateLocalBillFile,
} from '../services/purchaseService'
import { parseBillOcrText } from '../utils/billOcrParser'
import { extractBillTextLocally } from '../utils/ocrEngine'
import '../styles/purchases.css'

let rowKeyCounter = 1
function nextRowKey() {
  rowKeyCounter += 1
  return `pv-line-${rowKeyCounter}`
}

function makeEmptyLineItem() {
  return {
    rowKey: nextRowKey(),
    materialId: '',
    quantity: '',
    unitPrice: '',
    remarks: '',
    extractedDescription: '',
    detectedUnit: '',
    suggestions: [],
    needsReview: false,
  }
}

function makeClientRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `pv-${crypto.randomUUID()}`
  }
  return `pv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function getInitialEntryMethodFromUrl() {
  if (typeof window === 'undefined') {
    return 'upload_bill'
  }
  const params = new URLSearchParams(window.location.search || '')
  const mode = params.get('mode')
  return mode === 'manual' ? 'manual' : 'upload_bill'
}

export function PurchaseVoucherFormPage({
  mode = 'create',
  voucherIdentifier = '',
  currentUser,
  onNavigate,
}) {
  const isEditMode = mode === 'edit'
  const adminAccess = isAdminUser(currentUser)
  const [authRequired, setAuthRequired] = useState(() => !hasActiveAuthToken())

  const [entryMethod, setEntryMethod] = useState(() =>
    isEditMode ? 'manual' : getInitialEntryMethodFromUrl(),
  )
  const [purchaseDate, setPurchaseDate] = useState(() => toInputDateString())
  const [supplierName, setSupplierName] = useState('')
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('')
  const [projectId, setProjectId] = useState('')
  const [lineItems, setLineItems] = useState(() => [makeEmptyLineItem()])
  const [discountAmount, setDiscountAmount] = useState('')
  const [taxAmount, setTaxAmount] = useState('')
  const [otherCharges, setOtherCharges] = useState('')
  const [notes, setNotes] = useState('')

  const [existingVoucher, setExistingVoucher] = useState(null)
  const [existingAttachments, setExistingAttachments] = useState([])
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState([])
  const [previewModalAttachment, setPreviewModalAttachment] = useState(null)

  const [pendingFiles, setPendingFiles] = useState([])
  const [activePreviewFileIdx, setActivePreviewFileIdx] = useState(0)

  const [rawMaterials, setRawMaterials] = useState([])
  const [projects, setProjects] = useState([])
  const [isLoadingRefs, setIsLoadingRefs] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [ocrState, setOcrState] = useState({
    isRunning: false,
    percent: 0,
    message: '',
    error: '',
    completed: false,
    rawText: '',
    warnings: [],
    detectedSubtotal: null,
    detectedGrandTotal: null,
    averageConfidence: 0,
  })
  const [showRawOcrText, setShowRawOcrText] = useState(false)

  const [fieldErrors, setFieldErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [confirmLeaveTarget, setConfirmLeaveTarget] = useState('')

  const clientRequestIdRef = useRef(makeClientRequestId())
  const fileInputRef = useRef(null)
  const pendingFilesRef = useRef(pendingFiles)
  const rawMaterialsRef = useRef(rawMaterials)

  useEffect(() => {
    pendingFilesRef.current = pendingFiles
    rawMaterialsRef.current = rawMaterials
  }, [pendingFiles, rawMaterials])

  useEffect(() => {
    return () => {
      pendingFilesRef.current.forEach((entry) => {
        if (entry.localObjectUrl) {
          URL.revokeObjectURL(entry.localObjectUrl)
        }
      })
    }
  }, [])

  useEffect(() => {
    if (!hasActiveAuthToken()) {
      return undefined
    }

    let cancelled = false

    const loadPromises = [
      fetchRawMaterials({
        page: 1,
        limit: 100,
        status: 'active',
        isAdmin: adminAccess,
      }),
      fetchProjects({ page: 1, limit: 100 }),
    ]

    if (isEditMode && voucherIdentifier) {
      loadPromises.push(fetchPurchaseVoucherById(voucherIdentifier))
    }

    Promise.all(loadPromises)
      .then(([matRes, projRes, voucherRes]) => {
        if (cancelled) return

        const activeMats = matRes?.materials || []
        const loadedProjects = projRes?.projects || []

        if (isEditMode && voucherRes?.voucher) {
          const v = voucherRes.voucher
          if (v.status === 'cancelled') {
            setLoadError(
              `Voucher ${v.voucherNumber} has been cancelled and can no longer be edited.`,
            )
          }
          setExistingVoucher(v)
          setEntryMethod(v.entryMethod || 'manual')
          setPurchaseDate(toInputDateString(v.purchaseDate))
          setSupplierName(v.supplierName || '')
          setSupplierInvoiceNumber(v.supplierInvoiceNumber || '')
          setProjectId(v.projectRecordId || '')
          setDiscountAmount(v.discountAmount > 0 ? String(v.discountAmount) : '')
          setTaxAmount(v.taxAmount > 0 ? String(v.taxAmount) : '')
          setOtherCharges(v.otherCharges > 0 ? String(v.otherCharges) : '')
          setNotes(v.notes || '')
          setExistingAttachments(v.attachments || [])

          const existingMatMap = new Map(activeMats.map((m) => [m.id, m]))
          v.lineItems.forEach((li) => {
            if (li.materialId && !existingMatMap.has(li.materialId)) {
              existingMatMap.set(li.materialId, {
                id: li.materialId,
                name: li.materialName,
                category: li.materialCategory,
                unit: li.unit,
                quantityOnHand: 0,
                isActive: false,
              })
            }
          })
          setRawMaterials(Array.from(existingMatMap.values()))

          setLineItems(
            v.lineItems.length > 0
              ? v.lineItems.map((li) => ({
                  rowKey: nextRowKey(),
                  materialId: li.materialId,
                  quantity: String(li.quantity),
                  unitPrice: String(li.unitPrice),
                  remarks: li.remarks || '',
                  extractedDescription: '',
                  detectedUnit: '',
                  suggestions: [],
                  needsReview: false,
                }))
              : [makeEmptyLineItem()],
          )
        } else {
          setRawMaterials(activeMats)
        }

        setProjects(loadedProjects)
        setIsLoadingRefs(false)
      })
      .catch((err) => {
        if (cancelled) return
        if (err?.status === 401) {
          setAuthRequired(true)
        } else {
          setLoadError(
            err?.message || 'Unable to load purchase form dependencies.',
          )
        }
        setIsLoadingRefs(false)
      })

    return () => {
      cancelled = true
    }
  }, [isEditMode, voucherIdentifier, adminAccess])

  const materialById = useMemo(() => {
    const map = new Map()
    rawMaterials.forEach((mat) => {
      map.set(mat.id, mat)
    })
    return map
  }, [rawMaterials])

  const materialOptions = useMemo(() => {
    return rawMaterials.map((mat) => {
      const shortUnit = formatMaterialUnit(mat.unit)
      const stockLabel = formatMaterialStockOnHand(
        mat.quantityOnHand,
        mat.unit,
      )
      return {
        value: mat.id,
        label: shortUnit ? `${mat.name} (${shortUnit})` : mat.name,
        description: `${mat.category || 'Uncategorized'} · Stock: ${stockLabel}${
          mat.isActive === false ? ' · Inactive' : ''
        }`,
      }
    })
  }, [rawMaterials])

  const projectOptions = useMemo(() => {
    const base = [
      {
        value: '',
        label: 'None — General Workshop Stock',
        description: 'Material added to general stock without a specific project',
      },
    ]
    const mapped = projects.map((proj) => {
      const isCompleted = proj.status === 'Completed'
      const isCurrentVoucherProject =
        existingVoucher?.projectRecordId &&
        existingVoucher.projectRecordId === proj.id
      return {
        value: proj.id,
        label: `${proj.projectId} — ${proj.name}${isCompleted ? ' (Completed)' : ''}`,
        description: `Client: ${proj.clientName} · Status: ${proj.status}`,
        disabled: isCompleted && !isCurrentVoucherProject,
      }
    })
    return [...base, ...mapped]
  }, [projects, existingVoucher])

  const previewTotals = useMemo(
    () =>
      calculateVoucherPreviewTotals(lineItems, {
        discountAmount,
        taxAmount,
        otherCharges,
      }),
    [lineItems, discountAmount, taxAmount, otherCharges],
  )

  const retainedExistingAttachments = useMemo(
    () =>
      existingAttachments.filter(
        (att) => !removedAttachmentIds.includes(att.attachmentId),
      ),
    [existingAttachments, removedAttachmentIds],
  )

  const totalAttachmentCount =
    retainedExistingAttachments.length + pendingFiles.length

  const applyParsedOcrToForm = useCallback((parsed) => {
    if (parsed.supplierName) {
      setSupplierName((prev) => (prev.trim() ? prev : parsed.supplierName))
    }
    if (parsed.supplierInvoiceNumber) {
      setSupplierInvoiceNumber((prev) =>
        prev.trim() ? prev : parsed.supplierInvoiceNumber,
      )
    }
    if (parsed.purchaseDate) {
      setPurchaseDate(parsed.purchaseDate)
    }
    if (parsed.discountAmount) {
      setDiscountAmount((prev) => (prev.trim() ? prev : parsed.discountAmount))
    }
    if (parsed.taxAmount) {
      setTaxAmount((prev) => (prev.trim() ? prev : parsed.taxAmount))
    }
    if (parsed.otherCharges) {
      setOtherCharges((prev) => (prev.trim() ? prev : parsed.otherCharges))
    }

    if (parsed.lineItems.length > 0) {
      setLineItems((prev) => {
        const hasPopulatedExisting = prev.some(
          (row) =>
            row.materialId ||
            String(row.quantity).trim() ||
            String(row.unitPrice).trim(),
        )
        const mappedOcrRows = parsed.lineItems.map((ocrRow) => ({
          rowKey: nextRowKey(),
          materialId: ocrRow.materialId || '',
          quantity: ocrRow.quantity || '',
          unitPrice: ocrRow.unitPrice || '',
          remarks: '',
          extractedDescription: ocrRow.extractedDescription || '',
          detectedUnit: ocrRow.detectedUnit || '',
          suggestions: ocrRow.suggestions || [],
          needsReview: true,
        }))
        return hasPopulatedExisting
          ? [...prev, ...mappedOcrRows]
          : mappedOcrRows
      })
    }
  }, [])

  const runOcrForPendingFile = useCallback(
    async (fileEntry) => {
      if (!fileEntry?.file) {
        return
      }

      setOcrState({
        isRunning: true,
        percent: 5,
        message: 'Preparing bill document for local OCR...',
        error: '',
        completed: false,
        rawText: '',
        warnings: [],
        detectedSubtotal: null,
        detectedGrandTotal: null,
        averageConfidence: 0,
      })

      try {
        const extraction = await extractBillTextLocally(fileEntry.file, {
          onProgress: (prog) => {
            setOcrState((prev) => ({
              ...prev,
              isRunning: true,
              percent: prog.percent,
              message: prog.message,
            }))
          },
        })

        if (extraction.previewDataUrl) {
          setPendingFiles((prev) =>
            prev.map((item) =>
              item.localId === fileEntry.localId
                ? { ...item, renderedPdfPreviewUrl: extraction.previewDataUrl }
                : item,
            ),
          )
        }

        const parsed = parseBillOcrText(
          extraction.rawText,
          rawMaterialsRef.current,
        )

        if (!parsed.hasContent) {
          setOcrState({
            isRunning: false,
            percent: 0,
            message: '',
            error:
              'Local OCR could not read clear text from this bill (it may be blurry, rotated, or low-contrast). You can still keep the bill attached and enter the fields manually below.',
            completed: false,
            rawText: '',
            warnings: parsed.warnings,
            detectedSubtotal: null,
            detectedGrandTotal: null,
            averageConfidence: extraction.averageConfidence,
          })
          return
        }

        applyParsedOcrToForm(parsed)

        setOcrState({
          isRunning: false,
          percent: 100,
          message:
            'Local OCR finished. Please review and verify every field before saving.',
          error: '',
          completed: true,
          rawText: parsed.normalizedText,
          warnings: parsed.warnings,
          detectedSubtotal: parsed.detectedSubtotal,
          detectedGrandTotal: parsed.detectedGrandTotal,
          averageConfidence: extraction.averageConfidence,
        })
      } catch (err) {
        setOcrState({
          isRunning: false,
          percent: 0,
          message: '',
          error:
            err?.message ||
            'Local OCR could not read this file. You can continue by entering the purchase details manually below.',
          completed: false,
          rawText: '',
          warnings: [],
          detectedSubtotal: null,
          detectedGrandTotal: null,
          averageConfidence: 0,
        })
      }
    },
    [applyParsedOcrToForm],
  )

  const handleFilesSelected = (event) => {
    const chosen = Array.from(event.target.files || [])
    if (event.target) {
      event.target.value = ''
    }
    if (chosen.length === 0) {
      return
    }

    if (totalAttachmentCount + chosen.length > MAX_BILL_ATTACHMENTS) {
      setFieldErrors((prev) => ({
        ...prev,
        attachments: `You can attach up to ${MAX_BILL_ATTACHMENTS} bill files per voucher.`,
      }))
      return
    }

    const validEntries = []
    for (const file of chosen) {
      const validationMsg = validateLocalBillFile(file)
      if (validationMsg) {
        setFieldErrors((prev) => ({ ...prev, attachments: validationMsg }))
        return
      }
      const isPdf =
        String(file.type || '').toLowerCase() === 'application/pdf' ||
        /\.pdf$/i.test(String(file.name || ''))
      validEntries.push({
        localId: `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        isPdf,
        localObjectUrl: isPdf ? '' : URL.createObjectURL(file),
        renderedPdfPreviewUrl: '',
      })
    }

    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next.attachments
      return next
    })

    const nextIndex = pendingFiles.length
    setPendingFiles((prev) => [...prev, ...validEntries])
    setActivePreviewFileIdx(nextIndex)

    if (entryMethod === 'upload_bill' && validEntries[0] && !ocrState.isRunning) {
      runOcrForPendingFile(validEntries[0])
    }
  }

  const handleRemovePendingFile = (localId) => {
    setPendingFiles((prev) => {
      const target = prev.find((item) => item.localId === localId)
      if (target?.localObjectUrl) {
        URL.revokeObjectURL(target.localObjectUrl)
      }
      const filtered = prev.filter((item) => item.localId !== localId)
      setActivePreviewFileIdx((idx) =>
        Math.max(0, Math.min(idx, filtered.length - 1)),
      )
      return filtered
    })
  }

  const updateLineItem = (rowKey, field, value) => {
    setLineItems((prev) =>
      prev.map((row) => {
        if (row.rowKey !== rowKey) {
          return row
        }
        const updated = { ...row, [field]: value }
        if (field === 'materialId') {
          updated.needsReview = false
        }
        return updated
      }),
    )
    setFieldErrors((prev) => {
      if (!Object.keys(prev).length) return prev
      const next = { ...prev }
      delete next.lineItems
      return next
    })
  }

  const handleAddLineRow = () => {
    setLineItems((prev) => [...prev, makeEmptyLineItem()])
  }

  const handleRemoveLineRow = (rowKey) => {
    setLineItems((prev) => {
      if (prev.length <= 1) {
        return [makeEmptyLineItem()]
      }
      return prev.filter((row) => row.rowKey !== rowKey)
    })
  }

  const isDirty = useMemo(() => {
    if (isEditMode) {
      return true
    }
    return Boolean(
      supplierName.trim() ||
        supplierInvoiceNumber.trim() ||
        pendingFiles.length > 0 ||
        lineItems.some(
          (r) =>
            r.materialId ||
            String(r.quantity).trim() ||
            String(r.unitPrice).trim(),
        ),
    )
  }, [
    isEditMode,
    supplierName,
    supplierInvoiceNumber,
    pendingFiles.length,
    lineItems,
  ])

  const requestControlledCancel = (destinationPath) => {
    if (isSaving) return
    if (isDirty) {
      setConfirmLeaveTarget(destinationPath)
      return
    }
    onNavigate?.(destinationPath)
  }

  const validateClientForm = () => {
    const errors = {}

    if (!purchaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
      errors.purchaseDate = 'Purchase date is required.'
    }

    if (!supplierName.trim()) {
      errors.supplierName = 'Supplier name is required.'
    } else if (supplierName.trim().length > 200) {
      errors.supplierName = 'Supplier name cannot exceed 200 characters.'
    }

    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      errors.lineItems = 'Add at least one material line item.'
    } else {
      lineItems.forEach((row, idx) => {
        const prefix = `lineItems[${idx}]`
        if (!row.materialId) {
          errors[`${prefix}.materialId`] =
            `Line #${idx + 1}: select an existing Raw Material.`
        }

        const qty = Number(row.quantity)
        if (String(row.quantity).trim() === '' || !Number.isFinite(qty)) {
          errors[`${prefix}.quantity`] =
            `Line #${idx + 1}: enter a valid quantity.`
        } else if (qty <= 0) {
          errors[`${prefix}.quantity`] =
            `Line #${idx + 1}: quantity must be greater than zero.`
        }

        const price = Number(row.unitPrice)
        if (String(row.unitPrice).trim() === '' || !Number.isFinite(price)) {
          errors[`${prefix}.unitPrice`] =
            `Line #${idx + 1}: enter a valid unit price.`
        } else if (price <= 0) {
          errors[`${prefix}.unitPrice`] =
            `Line #${idx + 1}: unit price must be greater than zero.`
        }
      })
    }

    const checkCharge = (val, key, label) => {
      if (String(val).trim() === '') return
      const num = Number(val)
      if (!Number.isFinite(num) || num < 0) {
        errors[key] = `${label} must be zero or a positive amount.`
      }
    }
    checkCharge(discountAmount, 'discountAmount', 'Discount')
    checkCharge(taxAmount, 'taxAmount', 'Tax / GST')
    checkCharge(otherCharges, 'otherCharges', 'Other charges')

    if (previewTotals.discountExceedsSubtotal) {
      errors.discountAmount =
        'Discount amount cannot exceed the material items subtotal.'
    }

    return errors
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isSaving || ocrState.isRunning) {
      return
    }

    setSubmitError('')
    const validationErrors = validateClientForm()
    setFieldErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      const firstMsg = Object.values(validationErrors)[0]
      setSubmitError(firstMsg)
      return
    }

    setIsSaving(true)
    setUploadProgress(pendingFiles.length > 0 ? 5 : 0)

    const payload = {
      purchaseDate,
      supplierName: supplierName.trim(),
      supplierInvoiceNumber: supplierInvoiceNumber.trim(),
      projectId: projectId || null,
      entryMethod,
      lineItems: lineItems.map((row) => {
        const mat = materialById.get(row.materialId)
        return {
          materialId: row.materialId,
          unit: mat?.unit || undefined,
          quantity: Number(row.quantity),
          unitPrice: Number(row.unitPrice),
          remarks: String(row.remarks || '').trim(),
        }
      }),
      discountAmount: discountAmount === '' ? 0 : Number(discountAmount),
      taxAmount: taxAmount === '' ? 0 : Number(taxAmount),
      otherCharges: otherCharges === '' ? 0 : Number(otherCharges),
      notes: notes.trim(),
    }

    const filesToSend = pendingFiles.map((item) => item.file)

    try {
      let savedVoucher = null
      if (isEditMode && existingVoucher) {
        if (removedAttachmentIds.length > 0) {
          payload.removeAttachmentIds = removedAttachmentIds
        }
        const res = await updatePurchaseVoucher(existingVoucher.id, {
          payload,
          files: filesToSend,
          onUploadProgress: setUploadProgress,
        })
        savedVoucher = res.voucher
      } else {
        payload.clientRequestId = clientRequestIdRef.current
        const res = await createPurchaseVoucher({
          payload,
          files: filesToSend,
          onUploadProgress: setUploadProgress,
        })
        savedVoucher = res.voucher
      }

      onNavigate?.(`/purchases/${encodeURIComponent(savedVoucher.id)}`)
    } catch (err) {
      if (err?.fieldErrors) {
        setFieldErrors(err.fieldErrors)
      }
      setSubmitError(
        err?.message || 'Unable to save purchase voucher. Please review the form.',
      )
      setIsSaving(false)
      setUploadProgress(0)
    }
  }

  if (authRequired) {
    return (
      <div className="pv-page">
        <section className="pv-surface">
          <div className="pv-state">
            <h2 className="pv-state__title">Sign in required</h2>
            <p className="pv-state__message">
              Please sign in to record or edit purchase vouchers.
            </p>
            <div className="pv-state__actions">
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={() => onNavigate?.('/login')}
              >
                Go to Sign In
              </button>
            </div>
          </div>
        </section>
      </div>
    )
  }

  const activePreviewEntry = pendingFiles[activePreviewFileIdx] || null

  return (
    <div className="pv-page">
      <div className="pv-breadcrumb-bar">
        <button
          type="button"
          className="pv-back-btn"
          onClick={() => requestControlledCancel('/purchases')}
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M12.5 5L7.5 10L12.5 15"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Back to Purchases</span>
        </button>
      </div>

      <header className="pv-header">
        <div className="pv-header__text">
          <h1 className="pv-header__title">
            {isEditMode
              ? `Edit Purchase Voucher ${existingVoucher?.voucherNumber || ''}`
              : 'New Purchase Voucher'}
          </h1>
          <p className="pv-header__subtitle">
            {isEditMode
              ? 'Update supplier details, material quantities, project link, or attached bills. Stock and project totals resynchronize automatically.'
              : 'Upload a supplier bill for local OCR extraction or enter material lines manually. Totals are verified on the server upon save.'}
          </p>
        </div>
      </header>

      {isLoadingRefs ? (
        <section className="pv-surface">
          <div className="pv-loading" role="status" aria-busy="true">
            <div className="pv-skeleton-row">
              <div className="pv-skeleton-lines">
                <div className="pv-skeleton-line pv-skeleton-line--title" />
                <div className="pv-skeleton-line pv-skeleton-line--sub" />
              </div>
            </div>
          </div>
        </section>
      ) : loadError ? (
        <section className="pv-surface">
          <div className="pv-state" role="alert">
            <h2 className="pv-state__title">Cannot edit voucher</h2>
            <p className="pv-state__message">{loadError}</p>
            <div className="pv-state__actions">
              <button
                type="button"
                className="admin-btn admin-btn--secondary"
                onClick={() => onNavigate?.('/purchases')}
              >
                Return to Purchases
              </button>
            </div>
          </div>
        </section>
      ) : (
        <form className="pv-form-layout" onSubmit={handleSubmit} noValidate>
          {!isEditMode ? (
            <div className="pv-method-tabs" role="tablist" aria-label="Purchase entry method">
              <button
                type="button"
                role="tab"
                aria-selected={entryMethod === 'upload_bill'}
                className={`pv-method-tab${
                  entryMethod === 'upload_bill' ? ' pv-method-tab--active' : ''
                }`}
                onClick={() => setEntryMethod('upload_bill')}
              >
                <span className="pv-method-tab__title">
                  1. Upload Bill (Local OCR)
                </span>
                <span className="pv-method-tab__desc">
                  Upload or photograph an invoice image/PDF, preview locally,
                  and autofill fields via free browser OCR
                </span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={entryMethod === 'manual'}
                className={`pv-method-tab${
                  entryMethod === 'manual' ? ' pv-method-tab--active' : ''
                }`}
                onClick={() => setEntryMethod('manual')}
              >
                <span className="pv-method-tab__title">2. Enter Manually</span>
                <span className="pv-method-tab__desc">
                  Enter supplier and raw material lines directly without a bill
                  (attach a bill later anytime)
                </span>
              </button>
            </div>
          ) : null}

          {submitError ? (
            <div className="pv-alert pv-alert--error" role="alert">
              <strong>Unable to save voucher:</strong> {submitError}
            </div>
          ) : null}

          {ocrState.completed ? (
            <div className="pv-alert pv-alert--review" role="status">
              <div className="pv-alert__header">
                <strong>
                  OCR Extraction Complete — Verification Required Before Saving
                </strong>
                {ocrState.rawText ? (
                  <button
                    type="button"
                    className="pv-text-btn"
                    onClick={() => setShowRawOcrText((prev) => !prev)}
                  >
                    {showRawOcrText ? 'Hide OCR Text' : 'Inspect Raw OCR Text'}
                  </button>
                ) : null}
              </div>
              <p className="pv-alert__body">
                Extracted values have been placed into the form below using
                deterministic rules. Please verify the supplier name, invoice
                date, Raw Material matches, quantities, and unit prices before
                saving.
              </p>
              {ocrState.warnings.length > 0 ? (
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

          {ocrState.error ? (
            <div className="pv-alert pv-alert--warning" role="alert">
              <strong>Local OCR Notice:</strong> {ocrState.error}
            </div>
          ) : null}

          {(entryMethod === 'upload_bill' || isEditMode || pendingFiles.length > 0) ? (
            <section className="pv-surface pv-section-card">
              <div className="pv-section-card__header">
                <div>
                  <h2 className="pv-section-card__title">
                    Supplier Bill Attachment &amp; Local OCR
                  </h2>
                  <p className="pv-section-card__subtitle">
                    Accepts JPG, PNG, WEBP images, or PDF bills up to 10 MB per
                    file. OCR runs 100% locally in your browser before upload.
                  </p>
                </div>

                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    multiple
                    onChange={handleFilesSelected}
                    className="sr-only"
                    id="pv-bill-file-input"
                    disabled={
                      isSaving || totalAttachmentCount >= MAX_BILL_ATTACHMENTS
                    }
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

              {fieldErrors.attachments ? (
                <p className="pv-field-error" role="alert">
                  {fieldErrors.attachments}
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
                          onClick={() => setActivePreviewFileIdx(idx)}
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
                            onClick={() => runOcrForPendingFile(entry)}
                          >
                            {ocrState.isRunning ? 'Reading...' : 'Run OCR'}
                          </button>
                          <button
                            type="button"
                            className="pv-action-btn pv-action-btn--danger"
                            disabled={isSaving}
                            onClick={() => handleRemovePendingFile(entry.localId)}
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
                                PDF selected ({formatFileSize(activePreviewEntry.file.size)}
                                ). Click <strong>Run OCR</strong> to render PDF
                                pages locally and extract text.
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
                    Supports JPG, PNG, WEBP, or PDF (max 10 MB). Or switch to
                    Enter Manually if no bill is available yet.
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
                          onOpenPreview={setPreviewModalAttachment}
                        />
                        <button
                          type="button"
                          className="pv-remove-saved-att-btn"
                          onClick={() =>
                            setRemovedAttachmentIds((prev) => [
                              ...prev,
                              att.attachmentId,
                            ])
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
          ) : (
            <section className="pv-surface pv-section-card pv-optional-bill-bar">
              <div>
                <strong>Entering manually without a bill?</strong>
                <span>
                  You can save this voucher without any attachment now, or
                  attach a bill image/PDF later from Edit Voucher.
                </span>
              </div>
              <button
                type="button"
                className="admin-btn admin-btn--secondary"
                onClick={() => setEntryMethod('upload_bill')}
              >
                Attach a Bill Instead
              </button>
            </section>
          )}

          <section className="pv-surface pv-section-card">
            <h2 className="pv-section-card__title">Supplier &amp; Project Details</h2>
            <div className="pv-form-grid">
              <div className="pv-form-field">
                <label htmlFor="pv-purchase-date" className="pv-form-label">
                  Purchase Date <span className="pv-req">*</span>
                </label>
                <input
                  id="pv-purchase-date"
                  type="date"
                  className={`pv-input${
                    fieldErrors.purchaseDate ? ' pv-input--error' : ''
                  }`}
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  disabled={isSaving}
                />
                {fieldErrors.purchaseDate ? (
                  <p className="pv-field-error">{fieldErrors.purchaseDate}</p>
                ) : null}
              </div>

              <div className="pv-form-field">
                <label htmlFor="pv-supplier-name" className="pv-form-label">
                  Supplier Name <span className="pv-req">*</span>
                </label>
                <input
                  id="pv-supplier-name"
                  type="text"
                  className={`pv-input${
                    fieldErrors.supplierName ? ' pv-input--error' : ''
                  }`}
                  placeholder="e.g., Malabar Woods & Veneers"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  maxLength={200}
                  disabled={isSaving}
                />
                {fieldErrors.supplierName ? (
                  <p className="pv-field-error">{fieldErrors.supplierName}</p>
                ) : null}
              </div>

              <div className="pv-form-field">
                <label htmlFor="pv-invoice-number" className="pv-form-label">
                  Supplier Invoice No <span className="pv-opt">(Optional)</span>
                </label>
                <input
                  id="pv-invoice-number"
                  type="text"
                  className={`pv-input${
                    fieldErrors.supplierInvoiceNumber ? ' pv-input--error' : ''
                  }`}
                  placeholder="e.g., INV-2026-104"
                  value={supplierInvoiceNumber}
                  onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                  maxLength={100}
                  disabled={isSaving}
                />
                {fieldErrors.supplierInvoiceNumber ? (
                  <p className="pv-field-error">
                    {fieldErrors.supplierInvoiceNumber}
                  </p>
                ) : null}
              </div>

              <div className="pv-form-field">
                <label htmlFor="pv-project-select" className="pv-form-label">
                  Associated Project <span className="pv-opt">(Optional)</span>
                </label>
                <Dropdown
                  id="pv-project-select"
                  variant="form"
                  value={projectId}
                  options={projectOptions}
                  placeholder="None — General Workshop Stock"
                  error={Boolean(fieldErrors.projectId)}
                  disabled={isSaving}
                  onChange={(val) => setProjectId(val)}
                  ariaLabel="Associated project"
                />
                {fieldErrors.projectId ? (
                  <p className="pv-field-error">{fieldErrors.projectId}</p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="pv-surface pv-section-card">
            <div className="pv-section-card__header">
              <div>
                <h2 className="pv-section-card__title">Material Line Items</h2>
                <p className="pv-section-card__subtitle">
                  Select an existing Raw Material to lock in its supported unit
                  and update stock on hand when saved.
                </p>
              </div>
              <button
                type="button"
                className="admin-btn admin-btn--secondary"
                onClick={handleAddLineRow}
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
                  Boolean(row.extractedDescription) && !row.materialId

                return (
                  <div
                    key={row.rowKey}
                    className={`pv-line-card${
                      needsMaterialReview ? ' pv-line-card--review' : ''
                    }`}
                  >
                    <div className="pv-line-card__top">
                      <span className="pv-line-card__index">
                        Item #{idx + 1}
                      </span>

                      {row.extractedDescription ? (
                        <span className="pv-ocr-detected-pill">
                          Detected on bill: &ldquo;{row.extractedDescription}&rdquo;
                          {row.detectedUnit ? ` (${row.detectedUnit})` : ''}
                        </span>
                      ) : null}

                      <button
                        type="button"
                        className="pv-line-remove-btn"
                        onClick={() => handleRemoveLineRow(row.rowKey)}
                        disabled={isSaving}
                        aria-label={`Remove line item ${idx + 1}`}
                      >
                        {lineItems.length > 1 ? 'Remove' : 'Clear'}
                      </button>
                    </div>

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
                              updateLineItem(row.rowKey, 'materialId', sug.id)
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
                            updateLineItem(row.rowKey, 'materialId', val)
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
                          className="pv-readonly-unit"
                          title={
                            selectedMat
                              ? formatMaterialUnitOptionLabel(selectedMat.unit)
                              : 'Select a material to auto-fill unit'
                          }
                        >
                          {selectedMat
                            ? formatMaterialUnitOptionLabel(selectedMat.unit)
                            : 'Auto-filled'}
                        </div>
                      </div>

                      <div className="pv-form-field">
                        <label className="pv-form-label">
                          Quantity <span className="pv-req">*</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0.001"
                          className={`pv-input${
                            qtyErr ? ' pv-input--error' : ''
                          }`}
                          placeholder="0"
                          value={row.quantity}
                          onChange={(e) =>
                            updateLineItem(row.rowKey, 'quantity', e.target.value)
                          }
                          disabled={isSaving}
                          aria-label={`Line item ${idx + 1} quantity`}
                        />
                        {qtyErr ? (
                          <p className="pv-field-error">{qtyErr}</p>
                        ) : null}
                      </div>

                      <div className="pv-form-field">
                        <label className="pv-form-label">
                          Unit Price (₹) <span className="pv-req">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          className={`pv-input${
                            priceErr ? ' pv-input--error' : ''
                          }`}
                          placeholder="0.00"
                          value={row.unitPrice}
                          onChange={(e) =>
                            updateLineItem(
                              row.rowKey,
                              'unitPrice',
                              e.target.value,
                            )
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
                          updateLineItem(row.rowKey, 'remarks', e.target.value)
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

            <div className="pv-missing-material-callout">
              <div>
                <strong>Need a material not listed in the catalog?</strong>
                <p>
                  Unrecognized bill items are never auto-created as Raw
                  Materials.{' '}
                  {adminAccess
                    ? 'Cancel this draft to add the new material with its canonical unit in Raw Materials first.'
                    : 'Please ask an Administrator to register the material in Raw Materials before recording this voucher.'}
                </p>
              </div>
              {adminAccess ? (
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary"
                  onClick={() => requestControlledCancel('/raw-materials')}
                >
                  Cancel &amp; Go to Raw Materials
                </button>
              ) : null}
            </div>
          </section>

          <section className="pv-surface pv-section-card pv-totals-grid">
            <div className="pv-notes-column">
              <div className="pv-form-field">
                <label htmlFor="pv-notes" className="pv-form-label">
                  Voucher Notes <span className="pv-opt">(Optional)</span>
                </label>
                <textarea
                  id="pv-notes"
                  rows={4}
                  className="pv-textarea"
                  placeholder="Delivery challan reference, quality inspection remarks, or unloading notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={1000}
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="pv-financial-box">
              <h3 className="pv-financial-box__title">Voucher Totals</h3>

              <div className="pv-financial-row">
                <span>Items Subtotal</span>
                <strong>{formatInrCurrency(previewTotals.subtotal)}</strong>
              </div>

              <div className="pv-financial-input-row">
                <label htmlFor="pv-discount">Discount (− ₹)</label>
                <input
                  id="pv-discount"
                  type="number"
                  step="0.01"
                  min="0"
                  className={`pv-input pv-input--num${
                    fieldErrors.discountAmount ? ' pv-input--error' : ''
                  }`}
                  placeholder="0.00"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  disabled={isSaving}
                />
              </div>
              {fieldErrors.discountAmount ? (
                <p className="pv-field-error">{fieldErrors.discountAmount}</p>
              ) : null}

              <div className="pv-financial-input-row">
                <label htmlFor="pv-tax">GST / Tax (+ ₹)</label>
                <input
                  id="pv-tax"
                  type="number"
                  step="0.01"
                  min="0"
                  className={`pv-input pv-input--num${
                    fieldErrors.taxAmount ? ' pv-input--error' : ''
                  }`}
                  placeholder="0.00"
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(e.target.value)}
                  disabled={isSaving}
                />
              </div>

              <div className="pv-financial-input-row">
                <label htmlFor="pv-other-charges">
                  Freight / Other Charges (+ ₹)
                </label>
                <input
                  id="pv-other-charges"
                  type="number"
                  step="0.01"
                  min="0"
                  className={`pv-input pv-input--num${
                    fieldErrors.otherCharges ? ' pv-input--error' : ''
                  }`}
                  placeholder="0.00"
                  value={otherCharges}
                  onChange={(e) => setOtherCharges(e.target.value)}
                  disabled={isSaving}
                />
              </div>

              <div className="pv-financial-row pv-financial-row--final">
                <span>Final Total</span>
                <strong>{formatInrCurrency(previewTotals.finalTotal)}</strong>
              </div>

              {ocrState.detectedGrandTotal !== null &&
              Math.abs(ocrState.detectedGrandTotal - previewTotals.finalTotal) >
                1 ? (
                <p className="pv-ocr-diff-note">
                  Bill total detected by OCR:{' '}
                  <strong>
                    {formatInrCurrency(ocrState.detectedGrandTotal)}
                  </strong>
                  . Verify line items, tax, or discount if totals differ.
                </p>
              ) : null}
            </div>
          </section>

          {isSaving && pendingFiles.length > 0 ? (
            <div className="pv-progress-panel" role="status">
              <div className="pv-progress-panel__top">
                <span>Uploading bill attachment &amp; recording voucher...</span>
                <strong>{uploadProgress}%</strong>
              </div>
              <div className="pv-progress-bar">
                <div
                  className="pv-progress-bar__fill"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : null}

          <footer className="pv-form-footer">
            <button
              type="button"
              className="admin-btn admin-btn--secondary"
              onClick={() =>
                requestControlledCancel(
                  isEditMode && existingVoucher
                    ? `/purchases/${encodeURIComponent(existingVoucher.id)}`
                    : '/purchases',
                )
              }
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="admin-btn admin-btn--primary"
              disabled={isSaving || ocrState.isRunning}
            >
              {isSaving
                ? isEditMode
                  ? 'Saving Changes...'
                  : 'Recording Purchase...'
                : isEditMode
                  ? 'Save Voucher Changes'
                  : 'Save Purchase Voucher'}
            </button>
          </footer>
        </form>
      )}

      {confirmLeaveTarget ? (
        <div className="admin-modal-backdrop">
          <div className="admin-modal pv-cancel-modal" role="dialog" aria-modal="true">
            <div className="admin-modal__header">
              <h2 className="admin-modal__title">Discard unsaved voucher?</h2>
            </div>
            <div className="admin-modal__body">
              <p className="pv-cancel-modal__notice">
                Your unsaved purchase voucher entries and local bill previews
                will be discarded. No stock or project totals have been changed.
              </p>
            </div>
            <div className="admin-modal__footer">
              <button
                type="button"
                className="admin-btn admin-btn--secondary"
                onClick={() => setConfirmLeaveTarget('')}
              >
                Continue Editing
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={() => {
                  const target = confirmLeaveTarget
                  setConfirmLeaveTarget('')
                  onNavigate?.(target)
                }}
              >
                Discard &amp; Leave
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <BillAttachmentModal
        attachment={previewModalAttachment}
        onClose={() => setPreviewModalAttachment(null)}
      />
    </div>
  )
}
