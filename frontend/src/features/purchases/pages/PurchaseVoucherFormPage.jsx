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
import {
  FieldSourceBadge,
  FieldSuggestionBanner,
} from '../components/FieldProvenanceControl'
import { PurchaseLineItemsEditor } from '../components/PurchaseLineItemsEditor'
import { PurchaseTotalsSummary } from '../components/PurchaseTotalsSummary'
import {
  MAX_BILL_ATTACHMENTS,
  calculateVoucherPreviewTotals,
  createPurchaseVoucher,
  fetchPurchaseVoucherById,
  formatInrCurrency,
  formatPurchaseDate,
  hasActiveAuthToken,
  isAdminUser,
  toInputDateString,
  updatePurchaseVoucher,
  validateLocalBillFile,
} from '../services/purchaseService'
import { parseBillOcrText } from '../utils/billOcrParser'
import { extractBillTextLocally } from '../utils/ocrEngine'
import {
  acceptLineItemSuggestion,
  applyManualLineItemEdit,
  areFieldValuesEquivalent,
  confirmLineItemOcrValues,
  createEmptyLineItem,
  createFieldProvenance,
  createInitialHeaderFieldMeta,
  createSavedHeaderFieldMeta,
  createSavedLineItem,
  dismissLineItemSuggestion,
  isLineItemListEffectivelyEmpty,
  mergeHeaderFieldsWithOcr,
  mergeLineItemsWithOcr,
  nextVoucherLineKey,
  promoteSuggestedLineItemToRows,
} from '../utils/voucherOcrMerge'
import '../styles/purchases.css'

let uncertainKeyCounter = 1
function nextUncertainKey() {
  uncertainKeyCounter += 1
  return `pv-uncertain-${uncertainKeyCounter}`
}

function makeInitialOcrState() {
  return {
    isRunning: false,
    percent: 0,
    message: '',
    error: '',
    completed: false,
    tableDetected: false,
    summaryNote: '',
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

export function PurchaseVoucherFormPage({
  mode = 'create',
  voucherIdentifier = '',
  currentUser,
  onNavigate,
}) {
  const isEditMode = mode === 'edit'
  const adminAccess = isAdminUser(currentUser)
  const [authRequired, setAuthRequired] = useState(() => !hasActiveAuthToken())

  const [headerValues, setHeaderValues] = useState(() => ({
    purchaseDate: toInputDateString(),
    supplierName: '',
    supplierInvoiceNumber: '',
    projectId: '',
    discountAmount: '',
    taxAmount: '',
    otherCharges: '',
    notes: '',
  }))
  const [fieldMeta, setFieldMeta] = useState(() =>
    createInitialHeaderFieldMeta(),
  )
  const [fieldSuggestions, setFieldSuggestions] = useState({})

  const [lineItems, setLineItems] = useState(() => [createEmptyLineItem()])
  const [suggestedLineItems, setSuggestedLineItems] = useState([])
  const [uncertainLineItems, setUncertainLineItems] = useState([])
  const [dismissedFingerprints, setDismissedFingerprints] = useState([])
  const [hasUsedOcr, setHasUsedOcr] = useState(false)

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
  const latestFormSnapshotRef = useRef({
    headerValues,
    fieldMeta,
    fieldSuggestions,
    lineItems,
    suggestedLineItems,
    dismissedFingerprints,
  })

  useEffect(() => {
    pendingFilesRef.current = pendingFiles
    rawMaterialsRef.current = rawMaterials
    latestFormSnapshotRef.current = {
      headerValues,
      fieldMeta,
      fieldSuggestions,
      lineItems,
      suggestedLineItems,
      dismissedFingerprints,
    }
  }, [
    pendingFiles,
    rawMaterials,
    headerValues,
    fieldMeta,
    fieldSuggestions,
    lineItems,
    suggestedLineItems,
    dismissedFingerprints,
  ])

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
          setHeaderValues({
            purchaseDate: toInputDateString(v.purchaseDate),
            supplierName: v.supplierName || '',
            supplierInvoiceNumber: v.supplierInvoiceNumber || '',
            projectId: v.projectRecordId || '',
            discountAmount:
              v.discountAmount > 0 ? String(v.discountAmount) : '',
            taxAmount: v.taxAmount > 0 ? String(v.taxAmount) : '',
            otherCharges: v.otherCharges > 0 ? String(v.otherCharges) : '',
            notes: v.notes || '',
          })
          setFieldMeta(createSavedHeaderFieldMeta(v))
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
              ? v.lineItems.map((li) => createSavedLineItem(li))
              : [createEmptyLineItem()],
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
        discountAmount: headerValues.discountAmount,
        taxAmount: headerValues.taxAmount,
        otherCharges: headerValues.otherCharges,
      }),
    [
      lineItems,
      headerValues.discountAmount,
      headerValues.taxAmount,
      headerValues.otherCharges,
    ],
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

  const ocrActive = Boolean(
    hasUsedOcr ||
      ocrState.completed ||
      Object.keys(fieldSuggestions).length > 0 ||
      suggestedLineItems.length > 0,
  )

  const handleHeaderFieldChange = useCallback((fieldKey, nextValue) => {
    setHeaderValues((prev) => ({
      ...prev,
      [fieldKey]: nextValue,
    }))
    setFieldMeta((prev) => ({
      ...prev,
      [fieldKey]: createFieldProvenance('manual', {
        touched: true,
        confirmed: false,
      }),
    }))
    setFieldSuggestions((prev) => {
      if (
        prev[fieldKey] &&
        areFieldValuesEquivalent(fieldKey, nextValue, prev[fieldKey].value)
      ) {
        const next = { ...prev }
        delete next[fieldKey]
        return next
      }
      return prev
    })
    setFieldErrors((prev) => {
      if (!prev[fieldKey]) return prev
      const next = { ...prev }
      delete next[fieldKey]
      return next
    })
  }, [])

  const handleConfirmHeaderField = useCallback((fieldKey) => {
    setFieldMeta((prev) => {
      const current = prev[fieldKey] || createFieldProvenance('ocr')
      return {
        ...prev,
        [fieldKey]: {
          ...current,
          confirmed: true,
        },
      }
    })
  }, [])

  const handleAcceptHeaderSuggestion = useCallback((fieldKey) => {
    setFieldSuggestions((prev) => {
      const target = prev[fieldKey]
      if (!target) return prev
      setHeaderValues((vals) => ({
        ...vals,
        [fieldKey]: target.value,
      }))
      setFieldMeta((meta) => ({
        ...meta,
        [fieldKey]: createFieldProvenance('ocr', {
          touched: false,
          confirmed: true,
        }),
      }))
      const next = { ...prev }
      delete next[fieldKey]
      return next
    })
  }, [])

  const handleDismissHeaderSuggestion = useCallback((fieldKey) => {
    setFieldSuggestions((prev) => {
      if (!prev[fieldKey]) return prev
      const next = { ...prev }
      delete next[fieldKey]
      return next
    })
  }, [])

  const applyParsedOcrToForm = useCallback(
    (parsed, { isAdditionalBill = false } = {}) => {
      const snapshot = latestFormSnapshotRef.current

      const headerMerged = mergeHeaderFieldsWithOcr({
        values: snapshot.headerValues,
        fieldMeta: snapshot.fieldMeta,
        fieldSuggestions: snapshot.fieldSuggestions,
        parsedOcr: parsed,
        isAdditionalBill,
      })

      const linesMerged = mergeLineItemsWithOcr({
        existingRows: snapshot.lineItems,
        existingSuggestedRows: snapshot.suggestedLineItems,
        incomingOcrRows: parsed.lineItems || [],
        dismissedFingerprints: snapshot.dismissedFingerprints,
        isAdditionalBill,
      })

      setHeaderValues(headerMerged.values)
      setFieldMeta(headerMerged.fieldMeta)
      setFieldSuggestions(headerMerged.fieldSuggestions)
      setLineItems(linesMerged.lineItems)
      setSuggestedLineItems(linesMerged.suggestedLineItems)
      setHasUsedOcr(true)

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

      const preservedCount = headerMerged.preservedFields.length
      const hasRowConflicts = linesMerged.lineItems.some(
        (r) => Object.keys(r.rowSuggestions || {}).length > 0,
      )

      if (
        preservedCount > 0 ||
        hasRowConflicts ||
        linesMerged.suggestedLineItems.length > 0
      ) {
        return 'Empty untouched fields were autofilled. Your edited or confirmed entries were preserved — review any inline bill suggestions below.'
      }

      return 'Eligible empty fields were autofilled from the bill. Please review and verify every field before saving.'
    },
    [],
  )

  const runOcrForPendingFile = useCallback(
    async (fileEntry, { isAdditionalBill = false } = {}) => {
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

        setPendingFiles((prev) =>
          prev.map((item) =>
            item.localId === fileEntry.localId
              ? {
                  ...item,
                  ocrProcessedOnce: true,
                  renderedPdfPreviewUrl:
                    extraction.previewDataUrl || item.renderedPdfPreviewUrl,
                }
              : item,
          ),
        )

        const parsed = parseBillOcrText(extraction, rawMaterialsRef.current)

        if (!parsed.hasContent) {
          setUncertainLineItems([])
          setOcrState({
            ...makeInitialOcrState(),
            error:
              'Local OCR could not read clear text from this bill. Your existing form entries and bill attachment remain intact so you can continue manually.',
            warnings: parsed.warnings,
            averageConfidence: extraction.averageConfidence,
          })
          return
        }

        const summaryNote = applyParsedOcrToForm(parsed, { isAdditionalBill })

        setOcrState({
          isRunning: false,
          percent: 100,
          message:
            'Local OCR finished. Please review and verify every field before saving.',
          error: '',
          completed: true,
          tableDetected: Boolean(parsed.tableDetected),
          summaryNote,
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
            'Local OCR could not read this file. Your form entries and bill attachment remain intact.',
        })
      }
    },
    [applyParsedOcrToForm],
  )

  const buildLocalFileEntry = (file) => {
    const isPdf =
      String(file.type || '').toLowerCase() === 'application/pdf' ||
      /\.pdf$/i.test(String(file.name || ''))
    return {
      localId: `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      isPdf,
      ocrProcessedOnce: false,
      localObjectUrl: isPdf ? '' : URL.createObjectURL(file),
      renderedPdfPreviewUrl: '',
    }
  }

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
      validEntries.push(buildLocalFileEntry(file))
    }

    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next.attachments
      return next
    })

    const hadExistingBills =
      pendingFiles.length > 0 || retainedExistingAttachments.length > 0
    const nextIndex = pendingFiles.length
    setPendingFiles((prev) => [...prev, ...validEntries])
    setActivePreviewFileIdx(nextIndex)

    if (validEntries[0] && !ocrState.isRunning) {
      runOcrForPendingFile(validEntries[0], {
        isAdditionalBill: hadExistingBills,
      })
    }
  }

  const handleReplacePendingFile = (targetLocalId, replacementFile) => {
    const validationMsg = validateLocalBillFile(replacementFile)
    if (validationMsg) {
      setFieldErrors((prev) => ({ ...prev, attachments: validationMsg }))
      return
    }

    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next.attachments
      return next
    })

    const newEntry = buildLocalFileEntry(replacementFile)
    let replacedIndex = 0
    const hadMultipleBills =
      pendingFiles.length + retainedExistingAttachments.length > 1

    setPendingFiles((prev) =>
      prev.map((item, idx) => {
        if (item.localId !== targetLocalId) {
          return item
        }
        replacedIndex = idx
        if (item.localObjectUrl) {
          URL.revokeObjectURL(item.localObjectUrl)
        }
        return newEntry
      }),
    )

    setActivePreviewFileIdx(replacedIndex)

    if (!ocrState.isRunning) {
      runOcrForPendingFile(newEntry, {
        isAdditionalBill: hadMultipleBills,
      })
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
      if (filtered.length === 0) {
        setOcrState(makeInitialOcrState())
        setShowRawOcrText(false)
      }
      return filtered
    })
  }

  const updateLineItem = (rowKey, field, value) => {
    setLineItems((prev) =>
      prev.map((row) =>
        row.rowKey === rowKey ? applyManualLineItemEdit(row, field, value) : row,
      ),
    )
    setFieldErrors((prev) => {
      if (!Object.keys(prev).length) return prev
      const next = { ...prev }
      delete next.lineItems
      return next
    })
  }

  const handleConfirmLineRow = (rowKey) => {
    setLineItems((prev) =>
      prev.map((row) =>
        row.rowKey === rowKey ? confirmLineItemOcrValues(row) : row,
      ),
    )
  }

  const handleAcceptRowSuggestion = (rowKey, fieldKey) => {
    setLineItems((prev) =>
      prev.map((row) =>
        row.rowKey === rowKey ? acceptLineItemSuggestion(row, fieldKey) : row,
      ),
    )
  }

  const handleDismissRowSuggestion = (rowKey, fieldKey) => {
    setLineItems((prev) =>
      prev.map((row) =>
        row.rowKey === rowKey ? dismissLineItemSuggestion(row, fieldKey) : row,
      ),
    )
  }

  const handleAddLineRow = () => {
    setLineItems((prev) => [...prev, createEmptyLineItem()])
  }

  const handleRemoveLineRow = (rowKey) => {
    setLineItems((prev) => {
      const target = prev.find((r) => r.rowKey === rowKey)
      if (target?.ocrFingerprint) {
        setDismissedFingerprints((fps) =>
          fps.includes(target.ocrFingerprint)
            ? fps
            : [...fps, target.ocrFingerprint],
        )
      }
      if (prev.length <= 1) {
        return [createEmptyLineItem()]
      }
      return prev.filter((row) => row.rowKey !== rowKey)
    })
  }

  const handleAddSuggestedLineItem = (suggestionKey) => {
    const target = suggestedLineItems.find(
      (item) => item.suggestionKey === suggestionKey,
    )
    if (!target) return
    setSuggestedLineItems((prev) =>
      prev.filter((item) => item.suggestionKey !== suggestionKey),
    )
    if (target.ocrFingerprint) {
      setDismissedFingerprints((prev) =>
        prev.filter((fp) => fp !== target.ocrFingerprint),
      )
    }
    setLineItems((prev) => promoteSuggestedLineItemToRows(prev, target))
  }

  const handleAddAllSuggestedLineItems = () => {
    if (suggestedLineItems.length === 0) return
    const itemsToAdd = [...suggestedLineItems]
    setSuggestedLineItems([])
    setLineItems((prev) => {
      let current = prev
      for (const item of itemsToAdd) {
        current = promoteSuggestedLineItemToRows(current, item)
      }
      return current
    })
  }

  const handleDismissSuggestedLineItem = (suggestionKey) => {
    const target = suggestedLineItems.find(
      (item) => item.suggestionKey === suggestionKey,
    )
    if (target?.ocrFingerprint) {
      setDismissedFingerprints((prev) =>
        prev.includes(target.ocrFingerprint)
          ? prev
          : [...prev, target.ocrFingerprint],
      )
    }
    setSuggestedLineItems((prev) =>
      prev.filter((item) => item.suggestionKey !== suggestionKey),
    )
  }

  const handleDismissAllSuggestedLineItems = () => {
    const fps = suggestedLineItems
      .map((s) => s.ocrFingerprint)
      .filter(Boolean)
    if (fps.length > 0) {
      setDismissedFingerprints((prev) => Array.from(new Set([...prev, ...fps])))
    }
    setSuggestedLineItems([])
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
      ...createEmptyLineItem(),
      rowKey: nextVoucherLineKey(),
      materialId: '',
      quantity: isMathConsistent ? String(target.quantity) : '',
      unitPrice: isMathConsistent ? String(target.unitPrice) : '',
      remarks: '',
      extractedDescription:
        target.extractedDescription || target.rawRowText || '',
      detectedUnit: target.detectedUnit || '',
      suggestions: target.suggestions || [],
      needsReview: true,
      fieldMeta: {
        materialId: createFieldProvenance('initial'),
        quantity: isMathConsistent
          ? createFieldProvenance('ocr')
          : createFieldProvenance('initial'),
        unitPrice: isMathConsistent
          ? createFieldProvenance('ocr')
          : createFieldProvenance('initial'),
        remarks: createFieldProvenance('initial'),
        extractedDescription: createFieldProvenance('ocr'),
        detectedUnit: target.detectedUnit
          ? createFieldProvenance('ocr')
          : createFieldProvenance('initial'),
      },
    }

    setLineItems((prev) =>
      isLineItemListEffectivelyEmpty(prev) ? [promotedRow] : [...prev, promotedRow],
    )
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
      headerValues.supplierName.trim() ||
        headerValues.supplierInvoiceNumber.trim() ||
        headerValues.notes.trim() ||
        pendingFiles.length > 0 ||
        !isLineItemListEffectivelyEmpty(lineItems),
    )
  }, [
    isEditMode,
    headerValues.supplierName,
    headerValues.supplierInvoiceNumber,
    headerValues.notes,
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

    if (
      !headerValues.purchaseDate ||
      !/^\d{4}-\d{2}-\d{2}$/.test(headerValues.purchaseDate)
    ) {
      errors.purchaseDate = 'Purchase date is required.'
    }

    if (!headerValues.supplierName.trim()) {
      errors.supplierName = 'Supplier name is required.'
    } else if (headerValues.supplierName.trim().length > 200) {
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
    checkCharge(headerValues.discountAmount, 'discountAmount', 'Discount')
    checkCharge(headerValues.taxAmount, 'taxAmount', 'Tax / GST')
    checkCharge(headerValues.otherCharges, 'otherCharges', 'Other charges')

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

    const resolvedEntryMethod =
      pendingFiles.length > 0 ||
      retainedExistingAttachments.length > 0 ||
      hasUsedOcr
        ? 'upload_bill'
        : existingVoucher?.entryMethod || 'manual'

    const payload = {
      purchaseDate: headerValues.purchaseDate,
      supplierName: headerValues.supplierName.trim(),
      supplierInvoiceNumber: headerValues.supplierInvoiceNumber.trim(),
      projectId: headerValues.projectId || null,
      entryMethod: resolvedEntryMethod,
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
      discountAmount:
        headerValues.discountAmount === ''
          ? 0
          : Number(headerValues.discountAmount),
      taxAmount:
        headerValues.taxAmount === '' ? 0 : Number(headerValues.taxAmount),
      otherCharges:
        headerValues.otherCharges === ''
          ? 0
          : Number(headerValues.otherCharges),
      notes: headerValues.notes.trim(),
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
          {submitError ? (
            <div className="pv-alert pv-alert--error" role="alert">
              <strong>Unable to save voucher:</strong> {submitError}
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
                    Supplier Bill Attachment 
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
            <h2 className="pv-section-card__title">
              Supplier &amp; Purchase Details
            </h2>
            <div className="pv-form-grid">
              <div className="pv-form-field">
                <div className="pv-label-row">
                  <label htmlFor="pv-purchase-date" className="pv-form-label">
                    Purchase Date <span className="pv-req">*</span>
                  </label>
                  <FieldSourceBadge
                    meta={fieldMeta.purchaseDate}
                    hasValue={Boolean(headerValues.purchaseDate)}
                    ocrActive={ocrActive}
                    onConfirm={() => handleConfirmHeaderField('purchaseDate')}
                    disabled={isSaving}
                  />
                </div>
                <input
                  id="pv-purchase-date"
                  type="date"
                  className={`pv-input${
                    fieldErrors.purchaseDate ? ' pv-input--error' : ''
                  }`}
                  value={headerValues.purchaseDate}
                  onChange={(e) =>
                    handleHeaderFieldChange('purchaseDate', e.target.value)
                  }
                  disabled={isSaving}
                />
                {fieldErrors.purchaseDate ? (
                  <p className="pv-field-error">{fieldErrors.purchaseDate}</p>
                ) : null}
                <FieldSuggestionBanner
                  suggestion={fieldSuggestions.purchaseDate}
                  labelPrefix="Bill date"
                  formatValue={(val) => `${formatPurchaseDate(val)} (${val})`}
                  onAccept={() => handleAcceptHeaderSuggestion('purchaseDate')}
                  onDismiss={() =>
                    handleDismissHeaderSuggestion('purchaseDate')
                  }
                  disabled={isSaving}
                />
              </div>

              <div className="pv-form-field">
                <div className="pv-label-row">
                  <label htmlFor="pv-supplier-name" className="pv-form-label">
                    Supplier Name <span className="pv-req">*</span>
                  </label>
                  <FieldSourceBadge
                    meta={fieldMeta.supplierName}
                    hasValue={Boolean(headerValues.supplierName.trim())}
                    ocrActive={ocrActive}
                    onConfirm={() => handleConfirmHeaderField('supplierName')}
                    disabled={isSaving}
                  />
                </div>
                <input
                  id="pv-supplier-name"
                  type="text"
                  className={`pv-input${
                    fieldErrors.supplierName ? ' pv-input--error' : ''
                  }`}
                  placeholder="e.g., Malabar Woods & Veneers"
                  value={headerValues.supplierName}
                  onChange={(e) =>
                    handleHeaderFieldChange('supplierName', e.target.value)
                  }
                  maxLength={200}
                  disabled={isSaving}
                />
                {fieldErrors.supplierName ? (
                  <p className="pv-field-error">{fieldErrors.supplierName}</p>
                ) : null}
                <FieldSuggestionBanner
                  suggestion={fieldSuggestions.supplierName}
                  labelPrefix="Bill supplier"
                  onAccept={() => handleAcceptHeaderSuggestion('supplierName')}
                  onDismiss={() =>
                    handleDismissHeaderSuggestion('supplierName')
                  }
                  disabled={isSaving}
                />
              </div>

              <div className="pv-form-field">
                <div className="pv-label-row">
                  <label htmlFor="pv-invoice-number" className="pv-form-label">
                    Supplier Invoice No <span className="pv-opt">(Optional)</span>
                  </label>
                  <FieldSourceBadge
                    meta={fieldMeta.supplierInvoiceNumber}
                    hasValue={Boolean(
                      headerValues.supplierInvoiceNumber.trim(),
                    )}
                    ocrActive={ocrActive}
                    onConfirm={() =>
                      handleConfirmHeaderField('supplierInvoiceNumber')
                    }
                    disabled={isSaving}
                  />
                </div>
                <input
                  id="pv-invoice-number"
                  type="text"
                  className={`pv-input${
                    fieldErrors.supplierInvoiceNumber ? ' pv-input--error' : ''
                  }`}
                  placeholder="e.g., INV-2026-104"
                  value={headerValues.supplierInvoiceNumber}
                  onChange={(e) =>
                    handleHeaderFieldChange(
                      'supplierInvoiceNumber',
                      e.target.value,
                    )
                  }
                  maxLength={100}
                  disabled={isSaving}
                />
                {fieldErrors.supplierInvoiceNumber ? (
                  <p className="pv-field-error">
                    {fieldErrors.supplierInvoiceNumber}
                  </p>
                ) : null}
                <FieldSuggestionBanner
                  suggestion={fieldSuggestions.supplierInvoiceNumber}
                  labelPrefix="Bill invoice #"
                  onAccept={() =>
                    handleAcceptHeaderSuggestion('supplierInvoiceNumber')
                  }
                  onDismiss={() =>
                    handleDismissHeaderSuggestion('supplierInvoiceNumber')
                  }
                  disabled={isSaving}
                />
              </div>

              <div className="pv-form-field">
                <div className="pv-label-row">
                  <label htmlFor="pv-project-select" className="pv-form-label">
                    Associated Project <span className="pv-opt">(Optional)</span>
                  </label>
                  <FieldSourceBadge
                    meta={fieldMeta.projectId}
                    hasValue={Boolean(headerValues.projectId)}
                    ocrActive={ocrActive}
                    onConfirm={() => handleConfirmHeaderField('projectId')}
                    disabled={isSaving}
                  />
                </div>
                <Dropdown
                  id="pv-project-select"
                  variant="form"
                  value={headerValues.projectId}
                  options={projectOptions}
                  placeholder="None — General Workshop Stock"
                  error={Boolean(fieldErrors.projectId)}
                  disabled={isSaving}
                  onChange={(val) => handleHeaderFieldChange('projectId', val)}
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
            suggestedLineItems={suggestedLineItems}
            uncertainLineItems={uncertainLineItems}
            materialById={materialById}
            materialOptions={materialOptions}
            fieldErrors={fieldErrors}
            ocrActive={ocrActive}
            isSaving={isSaving}
            adminAccess={adminAccess}
            onAddLineRow={handleAddLineRow}
            onUpdateLineItem={updateLineItem}
            onConfirmLineRow={handleConfirmLineRow}
            onAcceptRowSuggestion={handleAcceptRowSuggestion}
            onDismissRowSuggestion={handleDismissRowSuggestion}
            onRemoveLineRow={handleRemoveLineRow}
            onAddSuggestedLineItem={handleAddSuggestedLineItem}
            onAddAllSuggestedLineItems={handleAddAllSuggestedLineItems}
            onDismissSuggestedLineItem={handleDismissSuggestedLineItem}
            onDismissAllSuggestedLineItems={handleDismissAllSuggestedLineItems}
            onPromoteUncertainRow={handlePromoteUncertainRow}
            onDismissUncertainRow={handleDismissUncertainRow}
            onDismissAllUncertainRows={handleDismissAllUncertainRows}
            onRequestCancelToCatalog={() =>
              requestControlledCancel('/raw-materials')
            }
          />

          <PurchaseTotalsSummary
            notes={headerValues.notes}
            onNotesChange={(val) => handleHeaderFieldChange('notes', val)}
            previewTotals={previewTotals}
            discountAmount={headerValues.discountAmount}
            onDiscountChange={(val) =>
              handleHeaderFieldChange('discountAmount', val)
            }
            taxAmount={headerValues.taxAmount}
            onTaxChange={(val) => handleHeaderFieldChange('taxAmount', val)}
            otherCharges={headerValues.otherCharges}
            onOtherChargesChange={(val) =>
              handleHeaderFieldChange('otherCharges', val)
            }
            fieldMeta={fieldMeta}
            fieldSuggestions={fieldSuggestions}
            ocrActive={ocrActive}
            onConfirmField={handleConfirmHeaderField}
            onAcceptFieldSuggestion={handleAcceptHeaderSuggestion}
            onDismissFieldSuggestion={handleDismissHeaderSuggestion}
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

          <footer className="pv-form-footer pv-form-footer--sticky">
            <div className="pv-form-footer__summary">
              <span>
                {lineItems.length}{' '}
                {lineItems.length === 1 ? 'material row' : 'material rows'}
              </span>
              <strong>
                Final Total: {formatInrCurrency(previewTotals.finalTotal)}
              </strong>
            </div>

            <div className="pv-form-footer__actions">
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
            </div>
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
