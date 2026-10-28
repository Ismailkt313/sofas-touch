import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Dropdown } from '../../../components/common'
import { fetchProjects } from '../../projects'
import {
  fetchRawMaterials,
  formatMaterialStockOnHand,
  formatMaterialUnit,
} from '../../raw-materials'
import { BillAttachmentModal } from '../components/BillAttachmentModal'
import { BillUploadOcrPanel } from '../components/BillUploadOcrPanel'
import { PurchaseLineItemsEditor } from '../components/PurchaseLineItemsEditor'
import { PurchaseTotalsSummary } from '../components/PurchaseTotalsSummary'
import {
  MAX_BILL_ATTACHMENTS,
  calculateVoucherPreviewTotals,
  createPurchaseVoucher,
  fetchPurchaseVoucherById,
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

let uncertainKeyCounter = 1
function nextUncertainKey() {
  uncertainKeyCounter += 1
  return `pv-uncertain-${uncertainKeyCounter}`
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

function makeInitialOcrState() {
  return {
    isRunning: false,
    percent: 0,
    message: '',
    error: '',
    completed: false,
    draftDiscarded: false,
    tableDetected: false,
    rawText: '',
    warnings: [],
    detectedSubtotal: null,
    detectedGrandTotal: null,
    averageConfidence: 0,
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
  const [uncertainLineItems, setUncertainLineItems] = useState([])
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

  const [ocrState, setOcrState] = useState(() => makeInitialOcrState())
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

    if (Array.isArray(parsed.lineItems) && parsed.lineItems.length > 0) {
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

    if (
      Array.isArray(parsed.uncertainLineItems) &&
      parsed.uncertainLineItems.length > 0
    ) {
      setUncertainLineItems(
        parsed.uncertainLineItems.map((uRow) => ({
          ...uRow,
          uncertainKey: nextUncertainKey(),
        })),
      )
    } else {
      setUncertainLineItems([])
    }
  }, [])

  const handleDiscardOcrDraft = useCallback(() => {
    setSupplierName('')
    setSupplierInvoiceNumber('')
    setPurchaseDate(toInputDateString())
    setDiscountAmount('')
    setTaxAmount('')
    setOtherCharges('')
    setLineItems([makeEmptyLineItem()])
    setUncertainLineItems([])
    setFieldErrors({})
    setSubmitError('')
    setShowRawOcrText(false)
    setOcrState({
      ...makeInitialOcrState(),
      draftDiscarded: true,
    })
  }, [])

  const runOcrForPendingFile = useCallback(
    async (fileEntry) => {
      if (!fileEntry?.file) {
        return
      }

      setShowRawOcrText(false)
      setOcrState({
        ...makeInitialOcrState(),
        isRunning: true,
        percent: 5,
        message: 'Preparing bill document for local OCR...',
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

        const parsed = parseBillOcrText(extraction, rawMaterialsRef.current)

        if (!parsed.hasContent) {
          setUncertainLineItems([])
          setOcrState({
            ...makeInitialOcrState(),
            error:
              'Local OCR could not read clear text from this bill (it may be blurry, rotated, or low-contrast). You can still keep the bill attached and enter the fields manually below.',
            warnings: parsed.warnings,
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
          draftDiscarded: false,
          tableDetected: Boolean(parsed.tableDetected),
          rawText: parsed.normalizedText,
          warnings: parsed.warnings,
          detectedSubtotal: parsed.detectedSubtotal,
          detectedGrandTotal: parsed.detectedGrandTotal,
          averageConfidence: extraction.averageConfidence,
        })
      } catch (err) {
        setUncertainLineItems([])
        setOcrState({
          ...makeInitialOcrState(),
          error:
            err?.message ||
            'Local OCR could not read this file. You can continue by entering the purchase details manually below.',
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

  const handlePromoteUncertainRow = (uncertainKey) => {
    const target = uncertainLineItems.find(
      (item) => item.uncertainKey === uncertainKey,
    )
    if (!target) {
      return
    }

    setUncertainLineItems((prev) =>
      prev.filter((item) => item.uncertainKey !== uncertainKey),
    )

    const qtyNum = Number(target.quantity)
    const priceNum = Number(target.unitPrice)
    const amtNum =
      target.lineAmount !== null && target.lineAmount !== undefined
        ? Number(target.lineAmount)
        : NaN
    const isMathConsistent =
      Number.isFinite(qtyNum) &&
      qtyNum > 0 &&
      Number.isFinite(priceNum) &&
      priceNum > 0 &&
      Number.isFinite(amtNum) &&
      amtNum > 0 &&
      Math.abs(qtyNum * priceNum - amtNum) <= Math.max(2, amtNum * 0.02)

    const promotedRow = {
      rowKey: nextRowKey(),
      materialId: '',
      quantity: isMathConsistent ? String(target.quantity) : '',
      unitPrice: isMathConsistent ? String(target.unitPrice) : '',
      remarks: '',
      extractedDescription:
        target.extractedDescription || target.rawRowText || '',
      detectedUnit: target.detectedUnit || '',
      suggestions: target.suggestions || [],
      needsReview: true,
    }

    setLineItems((prev) => {
      const isSingleEmpty =
        prev.length === 1 &&
        !prev[0].materialId &&
        !String(prev[0].quantity).trim() &&
        !String(prev[0].unitPrice).trim() &&
        !prev[0].extractedDescription
      return isSingleEmpty ? [promotedRow] : [...prev, promotedRow]
    })
  }

  const handleDismissUncertainRow = (uncertainKey) => {
    setUncertainLineItems((prev) =>
      prev.filter((item) => item.uncertainKey !== uncertainKey),
    )
  }

  const handleDismissAllUncertainRows = () => {
    setUncertainLineItems([])
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
        err?.message ||
          'Unable to save purchase voucher. Please review the form.',
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
            <div
              className="pv-method-tabs"
              role="tablist"
              aria-label="Purchase entry method"
            >
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

          {entryMethod === 'upload_bill' ||
          isEditMode ||
          pendingFiles.length > 0 ? (
            <BillUploadOcrPanel
              isEditMode={isEditMode}
              isSaving={isSaving}
              totalAttachmentCount={totalAttachmentCount}
              fileInputRef={fileInputRef}
              fieldError={fieldErrors.attachments}
              ocrState={ocrState}
              showRawOcrText={showRawOcrText}
              onToggleRawOcrText={() => setShowRawOcrText((prev) => !prev)}
              onDiscardOcrDraft={handleDiscardOcrDraft}
              pendingFiles={pendingFiles}
              activePreviewFileIdx={activePreviewFileIdx}
              onSelectPreviewFile={setActivePreviewFileIdx}
              onFilesSelected={handleFilesSelected}
              onRunOcrForFile={runOcrForPendingFile}
              onRemovePendingFile={handleRemovePendingFile}
              retainedExistingAttachments={retainedExistingAttachments}
              onOpenExistingAttachmentPreview={setPreviewModalAttachment}
              onMarkExistingAttachmentRemoved={(attachmentId) =>
                setRemovedAttachmentIds((prev) => [...prev, attachmentId])
              }
            />
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
            <h2 className="pv-section-card__title">
              Supplier &amp; Project Details
            </h2>
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

          <PurchaseLineItemsEditor
            lineItems={lineItems}
            uncertainLineItems={uncertainLineItems}
            materialById={materialById}
            materialOptions={materialOptions}
            fieldErrors={fieldErrors}
            isSaving={isSaving}
            adminAccess={adminAccess}
            onAddLineRow={handleAddLineRow}
            onUpdateLineItem={updateLineItem}
            onRemoveLineRow={handleRemoveLineRow}
            onPromoteUncertainRow={handlePromoteUncertainRow}
            onDismissUncertainRow={handleDismissUncertainRow}
            onDismissAllUncertainRows={handleDismissAllUncertainRows}
            onRequestCancelToCatalog={() =>
              requestControlledCancel('/raw-materials')
            }
          />

          <PurchaseTotalsSummary
            notes={notes}
            onNotesChange={setNotes}
            previewTotals={previewTotals}
            discountAmount={discountAmount}
            onDiscountChange={setDiscountAmount}
            taxAmount={taxAmount}
            onTaxChange={setTaxAmount}
            otherCharges={otherCharges}
            onOtherChargesChange={setOtherCharges}
            fieldErrors={fieldErrors}
            ocrState={ocrState}
            isSaving={isSaving}
          />

          {isSaving && pendingFiles.length > 0 ? (
            <div className="pv-progress-panel" role="status">
              <div className="pv-progress-panel__top">
                <span>
                  Uploading bill attachment &amp; recording voucher...
                </span>
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
          <div
            className="admin-modal pv-cancel-modal"
            role="dialog"
            aria-modal="true"
          >
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
