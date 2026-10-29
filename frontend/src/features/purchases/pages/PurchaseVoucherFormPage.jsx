import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Dropdown } from '../../../components/common'
import { fetchProjects } from '../../projects'
import {
  fetchRawMaterials,
  formatMaterialStockOnHand,
  formatMaterialUnit,
} from '../../raw-materials'
import { BillAttachmentModal } from '../components/BillAttachmentModal'
import {
  BillLocalPreviewPanel,
  BillUploadOcrPanel,
} from '../components/BillUploadOcrPanel'
import {
  FieldSourceBadge,
  FieldSuggestionBanner,
} from '../components/FieldProvenanceControl'
import { NewMaterialConfirmModal } from '../components/NewMaterialConfirmModal'
import { PurchaseLineItemsEditor } from '../components/PurchaseLineItemsEditor'
import { PurchaseTotalsSummary } from '../components/PurchaseTotalsSummary'
import { TotalMismatchConfirmModal } from '../components/TotalMismatchConfirmModal'
import {
  MAX_BILL_ATTACHMENTS,
  calculateTaxFromPercentage,
  calculateVoucherPreviewTotals,
  createPurchaseVoucher,
  evaluateFinalTotalMismatchModal,
  fetchPurchaseVoucherById,
  formatInrCurrency,
  formatPurchaseDate,
  hasActiveAuthToken,
  isAdminUser,
  roundTaxPercent,
  toInputDateString,
  updatePurchaseVoucher,
  validateLocalBillFile,
} from '../services/purchaseService'
import { parseBillOcrText } from '../utils/billOcrParser'
import { extractBillTextLocally } from '../utils/ocrEngine'
import {
  buildNewMaterialDraft,
  buildVoucherLineItemPayload,
  nextStagedMaterialTempId,
} from '../utils/purchaseMaterialCreation'
import {
  acceptLineItemSuggestion,
  applyManualLineItemEdit,
  areFieldValuesEquivalent,
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
  prependEmptyLineItem,
  promoteSuggestedLineItemToRows,
  shiftLineItemFieldErrorsOnPrepend,
  shiftLineItemFieldErrorsOnRemove,
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
    printedTaxAmount: null,
    detectedTaxRatePercent: null,
    taxBreakdownLabel: '',
    averageConfidence: 0,
  }
}

function makeClientRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `pv-${crypto.randomUUID()}`
  }
  return `pv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

async function loadAllCatalogMaterials(adminAccess) {
  const firstPage = await fetchRawMaterials({
    page: 1,
    limit: 100,
    status: adminAccess ? 'all' : 'active',
    isAdmin: adminAccess,
  })
  const byId = new Map()
  ;(firstPage?.materials || []).forEach((mat) => {
    if (mat?.id) {
      byId.set(mat.id, mat)
    }
  })

  const totalPages = Math.min(Number(firstPage?.totalPages || 1), 10)
  if (totalPages > 1) {
    const restPages = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        fetchRawMaterials({
          page: i + 2,
          limit: 100,
          status: adminAccess ? 'all' : 'active',
          isAdmin: adminAccess,
        }),
      ),
    )
    restPages.forEach((pageRes) => {
      ;(pageRes?.materials || []).forEach((mat) => {
        if (mat?.id) {
          byId.set(mat.id, mat)
        }
      })
    })
  }

  return Array.from(byId.values())
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
    taxRatePercent: '',
    taxAmount: '',
    otherCharges: '',
    notes: '',
  }))
  const [taxCalculationMode, setTaxCalculationMode] = useState('manual')
  const [fieldMeta, setFieldMeta] = useState(() =>
    createInitialHeaderFieldMeta(),
  )
  const [fieldSuggestions, setFieldSuggestions] = useState({})

  const [lineItems, setLineItems] = useState(() => [createEmptyLineItem()])
  const [pendingFocusRowKey, setPendingFocusRowKey] = useState('')
  const [totalMismatchModal, setTotalMismatchModal] = useState(null)
  const savingGuardRef = useRef(false)
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
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false)

  const [rawMaterials, setRawMaterials] = useState([])
  const [allCatalogMaterials, setAllCatalogMaterials] = useState([])
  const [stagedNewMaterials, setStagedNewMaterials] = useState([])
  const [materialModalState, setMaterialModalState] = useState(null)
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
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)

  const clientRequestIdRef = useRef(makeClientRequestId())
  const fileInputRef = useRef(null)
  const formRef = useRef(null)
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
    return () => {
      pendingFilesRef.current.forEach((entry) => {
        if (entry.localObjectUrl) {
          URL.revokeObjectURL(entry.localObjectUrl)
        }
      })
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    let blurTimer = 0
    const vv = window.visualViewport

    const handleViewportResize = () => {
      if (!vv || window.innerWidth > 768) {
        setIsKeyboardOpen(false)
        return
      }
      setIsKeyboardOpen(vv.height < window.innerHeight * 0.78)
    }

    const handleFocusIn = (event) => {
      if (window.innerWidth > 768) return
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        const inputType = String(event.target?.type || '').toLowerCase()
        if (inputType !== 'file' && inputType !== 'checkbox') {
          window.clearTimeout(blurTimer)
          setIsKeyboardOpen(true)
        }
      }
    }

    const handleFocusOut = () => {
      window.clearTimeout(blurTimer)
      blurTimer = window.setTimeout(() => {
        const activeTag = document.activeElement?.tagName
        if (
          activeTag !== 'INPUT' &&
          activeTag !== 'TEXTAREA' &&
          activeTag !== 'SELECT'
        ) {
          setIsKeyboardOpen(false)
        }
      }, 120)
    }

    vv?.addEventListener('resize', handleViewportResize)
    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)

    return () => {
      window.clearTimeout(blurTimer)
      vv?.removeEventListener('resize', handleViewportResize)
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
    }
  }, [])

  useEffect(() => {
    if (!hasActiveAuthToken()) {
      return undefined
    }

    let cancelled = false

    const loadPromises = [
      loadAllCatalogMaterials(adminAccess),
      fetchProjects({ page: 1, limit: 100 }),
    ]

    if (isEditMode && voucherIdentifier) {
      loadPromises.push(fetchPurchaseVoucherById(voucherIdentifier))
    }

    Promise.all(loadPromises)
      .then(([allMats, projRes, voucherRes]) => {
        if (cancelled) return

        const catalogList = Array.isArray(allMats) ? allMats : []
        const activeMats = catalogList.filter((m) => m.isActive !== false)
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
            taxRatePercent: '',
            taxAmount: v.taxAmount > 0 ? String(v.taxAmount) : '',
            otherCharges: v.otherCharges > 0 ? String(v.otherCharges) : '',
            notes: v.notes || '',
          })
          setTaxCalculationMode('manual')
          setFieldMeta(createSavedHeaderFieldMeta(v))
          setExistingAttachments(v.attachments || [])

          const existingMatMap = new Map(activeMats.map((m) => [m.id, m]))
          const fullCatalogMap = new Map(catalogList.map((m) => [m.id, m]))
          v.lineItems.forEach((li) => {
            if (li.materialId && !existingMatMap.has(li.materialId)) {
              const fallbackMat = fullCatalogMap.get(li.materialId) || {
                id: li.materialId,
                name: li.materialName,
                category: li.materialCategory,
                unit: li.unit,
                quantityOnHand: 0,
                isActive: false,
              }
              existingMatMap.set(li.materialId, fallbackMat)
              fullCatalogMap.set(li.materialId, fallbackMat)
            }
          })
          setRawMaterials(Array.from(existingMatMap.values()))
          setAllCatalogMaterials(Array.from(fullCatalogMap.values()))

          setLineItems(
            v.lineItems.length > 0
              ? v.lineItems.map((li) => createSavedLineItem(li))
              : [createEmptyLineItem()],
          )
        } else {
          setRawMaterials(activeMats)
          setAllCatalogMaterials(catalogList)
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
    stagedNewMaterials.forEach((staged) => {
      map.set(staged.tempId, {
        id: staged.tempId,
        tempId: staged.tempId,
        name: staged.name,
        category: staged.category || null,
        unit: staged.unit,
        description: staged.description || '',
        quantityOnHand: 0,
        isActive: true,
        isStagedNew: true,
      })
    })
    return map
  }, [rawMaterials, stagedNewMaterials])

  const materialOptions = useMemo(() => {
    const stagedOpts = stagedNewMaterials.map((mat) => {
      const shortUnit = formatMaterialUnit(mat.unit)
      return {
        value: mat.tempId,
        label: shortUnit ? `${mat.name} (${shortUnit})` : mat.name,
        badge: 'New',
        searchText: `${mat.name} ${mat.unit} ${shortUnit || ''} ${mat.category || ''} new`,
        description: `${mat.category || 'Uncategorized'} · Created when voucher is saved`,
      }
    })

    const catalogOpts = rawMaterials.map((mat) => {
      const shortUnit = formatMaterialUnit(mat.unit)
      const stockLabel = formatMaterialStockOnHand(
        mat.quantityOnHand,
        mat.unit,
      )
      return {
        value: mat.id,
        label: shortUnit ? `${mat.name} (${shortUnit})` : mat.name,
        searchText: `${mat.name} ${mat.unit} ${shortUnit || ''} ${mat.category || ''}`,
        description: `${mat.category || 'Uncategorized'} · Stock: ${stockLabel}${
          mat.isActive === false ? ' · Inactive' : ''
        }`,
      }
    })

    return [...stagedOpts, ...catalogOpts]
  }, [rawMaterials, stagedNewMaterials])

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

  const baseSubtotalPreview = useMemo(
    () =>
      calculateVoucherPreviewTotals(lineItems, {
        discountAmount: headerValues.discountAmount,
        taxAmount: 0,
        otherCharges: 0,
      }),
    [lineItems, headerValues.discountAmount],
  )

  const effectiveTaxAmount = useMemo(() => {
    if (taxCalculationMode === 'percentage') {
      const pct = roundTaxPercent(headerValues.taxRatePercent)
      if (pct !== null) {
        return String(
          calculateTaxFromPercentage(
            baseSubtotalPreview.subtotal,
            headerValues.discountAmount,
            pct,
          ),
        )
      }
    }
    return headerValues.taxAmount
  }, [
    taxCalculationMode,
    headerValues.taxRatePercent,
    headerValues.taxAmount,
    headerValues.discountAmount,
    baseSubtotalPreview.subtotal,
  ])

  const previewTotals = useMemo(
    () =>
      calculateVoucherPreviewTotals(lineItems, {
        discountAmount: headerValues.discountAmount,
        taxAmount: effectiveTaxAmount,
        otherCharges: headerValues.otherCharges,
      }),
    [
      lineItems,
      headerValues.discountAmount,
      effectiveTaxAmount,
      headerValues.otherCharges,
    ],
  )

  useEffect(() => {
    pendingFilesRef.current = pendingFiles
    rawMaterialsRef.current = rawMaterials
    latestFormSnapshotRef.current = {
      headerValues: {
        ...headerValues,
        taxAmount: effectiveTaxAmount,
      },
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
    effectiveTaxAmount,
    fieldMeta,
    fieldSuggestions,
    lineItems,
    suggestedLineItems,
    dismissedFingerprints,
  ])

  const retainedExistingAttachments = useMemo(
    () =>
      existingAttachments.filter(
        (att) => !removedAttachmentIds.includes(att.attachmentId),
      ),
    [existingAttachments, removedAttachmentIds],
  )

  const totalAttachmentCount =
    retainedExistingAttachments.length + pendingFiles.length

  const activePreviewEntry = pendingFiles[activePreviewFileIdx] || null

  const handleTogglePreviewForFile = useCallback(
    (idx) => {
      if (isPreviewOpen && activePreviewFileIdx === idx) {
        setIsPreviewOpen(false)
        return
      }
      setActivePreviewFileIdx(idx)
      setIsPreviewOpen(true)
    },
    [isPreviewOpen, activePreviewFileIdx],
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

  const detectedOcrTaxRate = ocrState.detectedTaxRatePercent

  const handleTaxRateChange = useCallback(
    (nextRateInput) => {
      const rawStr = String(nextRateInput ?? '')
      const trimmed = rawStr.trim()

      setFieldMeta((prev) => ({
        ...prev,
        taxRatePercent: createFieldProvenance('manual', {
          touched: true,
          confirmed: false,
        }),
      }))

      setFieldErrors((prev) => {
        if (!prev.taxRatePercent && !prev.taxAmount) {
          return prev
        }
        const next = { ...prev }
        delete next.taxRatePercent
        delete next.taxAmount
        return next
      })

      if (trimmed === '') {
        setTaxCalculationMode('manual')
        setHeaderValues((prev) => ({
          ...prev,
          taxRatePercent: '',
        }))
        return
      }

      const pct = roundTaxPercent(trimmed)
      if (pct === null) {
        setTaxCalculationMode('manual')
        setHeaderValues((prev) => ({
          ...prev,
          taxRatePercent: rawStr,
        }))
        return
      }

      const computedTax = calculateTaxFromPercentage(
        previewTotals.subtotal,
        headerValues.discountAmount,
        pct,
      )
      const computedTaxStr = String(computedTax)

      setTaxCalculationMode('percentage')
      setHeaderValues((prev) => ({
        ...prev,
        taxRatePercent: rawStr,
        taxAmount: computedTaxStr,
      }))
      setFieldMeta((prev) => ({
        ...prev,
        taxRatePercent: createFieldProvenance('manual', {
          touched: true,
          confirmed: false,
        }),
        taxAmount: createFieldProvenance('manual', {
          touched: true,
          confirmed: false,
        }),
      }))
      setFieldSuggestions((prev) => {
        if (
          prev.taxAmount &&
          areFieldValuesEquivalent('taxAmount', computedTaxStr, prev.taxAmount.value)
        ) {
          const next = { ...prev }
          delete next.taxAmount
          return next
        }
        return prev
      })
    },
    [previewTotals.subtotal, headerValues.discountAmount],
  )

  const handleManualTaxAmountChange = useCallback(
    (nextTaxValue) => {
      setTaxCalculationMode('manual')
      setHeaderValues((prev) => {
        const nextValues = {
          ...prev,
          taxAmount: nextTaxValue,
        }
        const currentPct = roundTaxPercent(prev.taxRatePercent)
        if (currentPct !== null) {
          const expectedAtPct = calculateTaxFromPercentage(
            previewTotals.subtotal,
            prev.discountAmount,
            currentPct,
          )
          const enteredNum = Number(nextTaxValue)
          const matchesPct =
            String(nextTaxValue ?? '').trim() !== '' &&
            Number.isFinite(enteredNum) &&
            Math.abs(enteredNum - expectedAtPct) <= 0.05
          if (!matchesPct) {
            nextValues.taxRatePercent = ''
          }
        }
        return nextValues
      })
      setFieldMeta((prev) => ({
        ...prev,
        taxAmount: createFieldProvenance('manual', {
          touched: true,
          confirmed: false,
        }),
      }))
      setFieldSuggestions((prev) => {
        if (
          prev.taxAmount &&
          areFieldValuesEquivalent('taxAmount', nextTaxValue, prev.taxAmount.value)
        ) {
          const next = { ...prev }
          delete next.taxAmount
          return next
        }
        return prev
      })
      setFieldErrors((prev) => {
        if (!prev.taxAmount && !prev.taxRatePercent) return prev
        const next = { ...prev }
        delete next.taxAmount
        delete next.taxRatePercent
        return next
      })
    },
    [previewTotals.subtotal],
  )

  const handleUsePrintedTax = useCallback(
    (printedTax) => {
      if (printedTax === null || printedTax === undefined) {
        return
      }
      const nextTaxStr = printedTax > 0 ? String(printedTax) : '0'
      setTaxCalculationMode('manual')
      setHeaderValues((prev) => ({
        ...prev,
        taxAmount: nextTaxStr,
        taxRatePercent:
          detectedOcrTaxRate !== null && detectedOcrTaxRate !== undefined
            ? String(detectedOcrTaxRate)
            : prev.taxRatePercent,
      }))
      setFieldMeta((prev) => ({
        ...prev,
        taxAmount: createFieldProvenance('ocr', {
          touched: false,
          confirmed: true,
        }),
      }))
      setFieldErrors((prev) => {
        if (!prev.taxAmount && !prev.taxRatePercent) return prev
        const next = { ...prev }
        delete next.taxAmount
        delete next.taxRatePercent
        return next
      })
    },
    [detectedOcrTaxRate],
  )

  const handleAcceptHeaderSuggestion = useCallback((fieldKey) => {
    setFieldSuggestions((prev) => {
      const target = prev[fieldKey]
      if (!target) return prev
      if (fieldKey === 'taxAmount') {
        setTaxCalculationMode('manual')
      }
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

      if (headerMerged.autofilledFields.includes('taxAmount')) {
        setTaxCalculationMode('manual')
      }

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
        return 'Autofilled empty fields · your manual entries were preserved.'
      }

      return 'Autofilled readable fields from bill — verify before saving.'
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
        message: 'Reading bill...',
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
              'Could not read clear text from this bill. File stays attached — enter details manually below.',
            warnings: parsed.warnings,
            averageConfidence: extraction.averageConfidence,
          })
          return
        }

        const summaryNote = applyParsedOcrToForm(parsed, { isAdditionalBill })

        setOcrState({
          isRunning: false,
          percent: 100,
          message: '',
          error: '',
          completed: true,
          tableDetected: Boolean(parsed.tableDetected),
          summaryNote,
          rawText: parsed.normalizedText,
          warnings: parsed.warnings,
          detectedSubtotal: parsed.detectedSubtotal,
          detectedGrandTotal: parsed.detectedGrandTotal,
          printedTaxAmount: parsed.printedTaxAmount ?? null,
          detectedTaxRatePercent: parsed.detectedTaxRatePercent ?? null,
          taxBreakdownLabel: parsed.taxBreakdownLabel || '',
          averageConfidence: extraction.averageConfidence,
        })
      } catch (err) {
        setUncertainLineItems([])
        setOcrState({
          ...makeInitialOcrState(),
          error:
            err?.message ||
            'Could not read this file automatically. File stays attached — enter details below.',
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
        setIsPreviewOpen(false)
        setIsPreviewExpanded(false)
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
    const { newRow } = prependEmptyLineItem([])
    setLineItems((prev) => [newRow, ...prev])
    setFieldErrors((prev) => shiftLineItemFieldErrorsOnPrepend(prev))
    setPendingFocusRowKey(newRow.rowKey)
  }

  const clearLineRowErrors = (rowIndex) => {
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next.lineItems
      if (rowIndex >= 0) {
        Object.keys(next).forEach((errKey) => {
          if (errKey.startsWith(`lineItems[${rowIndex}]`)) {
            delete next[errKey]
          }
        })
      }
      return next
    })
  }

  const handleOpenCreateMaterialModal = (rowKey, initialSearchName = '') => {
    let resolvedRowKey = rowKey
    let targetRow

    if (!resolvedRowKey) {
      const { newRow: freshRow } = prependEmptyLineItem([])
      resolvedRowKey = freshRow.rowKey
      targetRow = freshRow
      setLineItems((prev) => [freshRow, ...prev])
      setFieldErrors((prev) => shiftLineItemFieldErrorsOnPrepend(prev))
    } else {
      targetRow = lineItems.find((row) => row.rowKey === resolvedRowKey) || null
    }

    setMaterialModalState({
      modalKey: `create-${resolvedRowKey}-${Date.now()}`,
      mode: 'create',
      targetRowKey: resolvedRowKey,
      editingTempId: '',
      initialDraft: buildNewMaterialDraft({
        searchQuery: initialSearchName,
        row: targetRow,
      }),
      sourceBillDescription: targetRow?.extractedDescription || '',
      sourceBillUnit: targetRow?.detectedUnit || '',
    })
  }

  const handleOpenEditStagedMaterialModal = (rowKey, tempId) => {
    const staged = stagedNewMaterials.find((item) => item.tempId === tempId)
    if (!staged) {
      return
    }
    const targetRow = lineItems.find((row) => row.rowKey === rowKey) || null

    setMaterialModalState({
      modalKey: `edit-${tempId}-${Date.now()}`,
      mode: 'edit',
      targetRowKey: rowKey,
      editingTempId: tempId,
      initialDraft: buildNewMaterialDraft({
        existingStagedMaterial: staged,
      }),
      sourceBillDescription: targetRow?.extractedDescription || '',
      sourceBillUnit: targetRow?.detectedUnit || '',
    })
  }

  const handleConfirmNewMaterial = (validatedSpec, modalSnapshot) => {
    if (!modalSnapshot) {
      return
    }

    if (modalSnapshot.mode === 'edit' && modalSnapshot.editingTempId) {
      setStagedNewMaterials((prev) =>
        prev.map((item) =>
          item.tempId === modalSnapshot.editingTempId
            ? {
                ...item,
                ...validatedSpec,
                isStagedNew: true,
              }
            : item,
        ),
      )
      const rowIdx = lineItems.findIndex(
        (r) => r.rowKey === modalSnapshot.targetRowKey,
      )
      clearLineRowErrors(rowIdx)
      setMaterialModalState(null)
      return
    }

    const tempId = nextStagedMaterialTempId()
    setStagedNewMaterials((prev) => [
      ...prev,
      {
        tempId,
        ...validatedSpec,
        isStagedNew: true,
      },
    ])

    let matchedRowIdx = -1
    setLineItems((prev) =>
      prev.map((row, idx) => {
        if (row.rowKey !== modalSnapshot.targetRowKey) {
          return row
        }
        matchedRowIdx = idx
        const edited = applyManualLineItemEdit(row, 'materialId', tempId)
        return {
          ...edited,
          fieldMeta: {
            ...(edited.fieldMeta || {}),
            materialId: createFieldProvenance('manual', {
              touched: true,
              confirmed: true,
            }),
          },
        }
      }),
    )

    clearLineRowErrors(matchedRowIdx)
    setMaterialModalState(null)
  }

  const handleSelectExistingOrStagedFromModal = (
    selectedMaterialId,
    modalSnapshot,
  ) => {
    if (!selectedMaterialId || !modalSnapshot?.targetRowKey) {
      setMaterialModalState(null)
      return
    }

    let matchedRowIdx = -1
    setLineItems((prev) =>
      prev.map((row, idx) => {
        if (row.rowKey !== modalSnapshot.targetRowKey) {
          return row
        }
        matchedRowIdx = idx
        const edited = applyManualLineItemEdit(
          row,
          'materialId',
          selectedMaterialId,
        )
        return {
          ...edited,
          fieldMeta: {
            ...(edited.fieldMeta || {}),
            materialId: createFieldProvenance('manual', {
              touched: true,
              confirmed: true,
            }),
          },
        }
      }),
    )

    clearLineRowErrors(matchedRowIdx)
    setMaterialModalState(null)
  }

  const handleRemoveLineRow = (rowKey) => {
    const removedIdx = lineItems.findIndex((r) => r.rowKey === rowKey)
    if (removedIdx !== -1) {
      if (lineItems.length <= 1) {
        clearLineRowErrors(0)
      } else {
        setFieldErrors((prev) =>
          shiftLineItemFieldErrorsOnRemove(prev, removedIdx),
        )
      }
    }

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
        stagedNewMaterials.length > 0 ||
        !isLineItemListEffectivelyEmpty(lineItems),
    )
  }, [
    isEditMode,
    headerValues.supplierName,
    headerValues.supplierInvoiceNumber,
    headerValues.notes,
    pendingFiles.length,
    stagedNewMaterials.length,
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
      errors.lineItems = 'Add at least one material.'
    } else {
      lineItems.forEach((row, idx) => {
        const prefix = `lineItems[${idx}]`
        if (!row.materialId) {
          errors[`${prefix}.materialId`] = 'Select a material.'
        }

        const qty = Number(row.quantity)
        if (String(row.quantity).trim() === '' || !Number.isFinite(qty)) {
          errors[`${prefix}.quantity`] = 'Enter quantity.'
        } else if (qty <= 0) {
          errors[`${prefix}.quantity`] = 'Must be > 0.'
        }

        const price = Number(row.unitPrice)
        if (String(row.unitPrice).trim() === '' || !Number.isFinite(price)) {
          errors[`${prefix}.unitPrice`] = 'Enter unit price.'
        } else if (price <= 0) {
          errors[`${prefix}.unitPrice`] = 'Must be > 0.'
        }
      })
    }

    const checkCharge = (val, key, label) => {
      if (String(val).trim() === '') return
      const num = Number(val)
      if (!Number.isFinite(num) || num < 0) {
        errors[key] = `${label} must be 0 or greater.`
      }
    }
    checkCharge(headerValues.discountAmount, 'discountAmount', 'Discount')
    checkCharge(effectiveTaxAmount, 'taxAmount', 'Tax')
    checkCharge(headerValues.otherCharges, 'otherCharges', 'Other charges')

    if (
      String(headerValues.taxRatePercent ?? '').trim() !== '' &&
      roundTaxPercent(headerValues.taxRatePercent) === null
    ) {
      errors.taxRatePercent = 'GST % must be between 0 and 100.'
    }

    if (previewTotals.discountExceedsSubtotal) {
      errors.discountAmount = 'Discount cannot exceed subtotal.'
    }

    return errors
  }

  const executeVoucherSave = async () => {
    if (savingGuardRef.current || isSaving || ocrState.isRunning) {
      return
    }

    savingGuardRef.current = true
    setSubmitError('')
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
      lineItems: lineItems.map((row) =>
        buildVoucherLineItemPayload(row, materialById),
      ),
      discountAmount:
        headerValues.discountAmount === ''
          ? 0
          : Number(headerValues.discountAmount),
      taxAmount:
        effectiveTaxAmount === '' ? 0 : Number(effectiveTaxAmount),
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

      if (!savedVoucher?.id) {
        throw new Error(
          'Server did not confirm the saved purchase voucher. Please retry.',
        )
      }

      setTotalMismatchModal(null)
      savingGuardRef.current = false
      onNavigate?.(`/purchases/${encodeURIComponent(savedVoucher.id)}`)
    } catch (err) {
      setTotalMismatchModal(null)
      if (err?.fieldErrors) {
        setFieldErrors(err.fieldErrors)
      }
      if (err?.status === 409) {
        loadAllCatalogMaterials(adminAccess)
          .then((latestMats) => {
            if (!Array.isArray(latestMats)) return
            setAllCatalogMaterials(latestMats)
            setRawMaterials((prev) => {
              const map = new Map(prev.map((m) => [m.id, m]))
              latestMats
                .filter((m) => m.isActive !== false)
                .forEach((m) => map.set(m.id, m))
              return Array.from(map.values())
            })
          })
          .catch(() => undefined)
      }
      setSubmitError(
        err?.message ||
          'Unable to save purchase voucher. Please review the form.',
      )
      savingGuardRef.current = false
      setIsSaving(false)
      setUploadProgress(0)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (savingGuardRef.current || isSaving || ocrState.isRunning) {
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

    const mismatch = evaluateFinalTotalMismatchModal({
      hasAttachedBill: totalAttachmentCount > 0,
      printedBillTotal: ocrState.detectedGrandTotal,
      calculatedVoucherTotal: previewTotals.finalTotal,
      tolerance: 1.0,
    })

    if (mismatch.shouldConfirm) {
      setTotalMismatchModal(mismatch)
      return
    }

    await executeVoucherSave()
  }

  const handleConfirmSaveAnyway = async () => {
    if (savingGuardRef.current || isSaving || ocrState.isRunning) {
      return
    }

    const validationErrors = validateClientForm()
    setFieldErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      setTotalMismatchModal(null)
      const firstMsg = Object.values(validationErrors)[0]
      setSubmitError(firstMsg)
      return
    }

    await executeVoucherSave()
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

  const showSidePreview = Boolean(isPreviewOpen && activePreviewEntry)

  return (
    <div
      className={`pv-page pv-voucher-page${
        isKeyboardOpen ? ' pv-page--keyboard-open' : ''
      }`}
    >
      <header className="pv-form-topbar">
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
          <span>Purchases</span>
        </button>

        <h1 className="pv-form-topbar__title">
          {isEditMode
            ? `Edit Voucher ${existingVoucher?.voucherNumber || ''}`.trim()
            : 'New Purchase Voucher'}
        </h1>
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
        <form
          ref={formRef}
          className="pv-voucher-form"
          onSubmit={handleSubmit}
          noValidate
        >
          {submitError ? (
            <div className="pv-inline-error" role="alert">
              <span>{submitError}</span>
            </div>
          ) : null}

          <BillUploadOcrPanel
            isSaving={isSaving}
            totalAttachmentCount={totalAttachmentCount}
            fileInputRef={fileInputRef}
            fieldError={fieldErrors.attachments}
            ocrState={ocrState}
            showRawOcrText={showRawOcrText}
            onToggleRawOcrText={() => setShowRawOcrText((prev) => !prev)}
            pendingFiles={pendingFiles}
            activePreviewFileIdx={activePreviewFileIdx}
            isPreviewOpen={isPreviewOpen}
            isPreviewExpanded={isPreviewExpanded}
            onTogglePreviewForFile={handleTogglePreviewForFile}
            onTogglePreviewExpanded={() =>
              setIsPreviewExpanded((prev) => !prev)
            }
            onClosePreview={() => setIsPreviewOpen(false)}
            onFilesSelected={handleFilesSelected}
            onReplacePendingFile={handleReplacePendingFile}
            onRunOcrForFile={runOcrForPendingFile}
            onRemovePendingFile={handleRemovePendingFile}
            retainedExistingAttachments={retainedExistingAttachments}
            onOpenExistingAttachmentPreview={setPreviewModalAttachment}
            onMarkExistingAttachmentRemoved={(attachmentId) =>
              setRemovedAttachmentIds((prev) => [...prev, attachmentId])
            }
          />

          <div
            className={`pv-editor-split${
              showSidePreview ? ' pv-editor-split--with-preview' : ''
            }`}
          >
            <div className="pv-voucher-sheet">
              <section
                className="pv-voucher-section"
                aria-labelledby="pv-details-heading"
              >
                <div className="pv-section-head">
                  <h2 id="pv-details-heading" className="pv-section-title">
                    Purchase Details
                  </h2>
                </div>

                <div className="pv-details-grid">
                  <div className="pv-form-field">
                    <div className="pv-label-row">
                      <label
                        htmlFor="pv-purchase-date"
                        className="pv-form-label"
                      >
                        Purchase date <span className="pv-req">*</span>
                      </label>
                      <FieldSourceBadge
                        meta={fieldMeta.purchaseDate}
                        hasValue={Boolean(headerValues.purchaseDate)}
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
                      <p className="pv-field-error">
                        {fieldErrors.purchaseDate}
                      </p>
                    ) : null}
                    <FieldSuggestionBanner
                      suggestion={fieldSuggestions.purchaseDate}
                      labelPrefix="Bill date"
                      formatValue={(val) => formatPurchaseDate(val)}
                      onAccept={() =>
                        handleAcceptHeaderSuggestion('purchaseDate')
                      }
                      onDismiss={() =>
                        handleDismissHeaderSuggestion('purchaseDate')
                      }
                      disabled={isSaving}
                    />
                  </div>

                  <div className="pv-form-field">
                    <div className="pv-label-row">
                      <label
                        htmlFor="pv-supplier-name"
                        className="pv-form-label"
                      >
                        Supplier name <span className="pv-req">*</span>
                      </label>
                      <FieldSourceBadge
                        meta={fieldMeta.supplierName}
                        hasValue={Boolean(headerValues.supplierName.trim())}
                      />
                    </div>
                    <input
                      id="pv-supplier-name"
                      type="text"
                      className={`pv-input${
                        fieldErrors.supplierName ? ' pv-input--error' : ''
                      }`}
                      placeholder="Supplier or vendor name"
                      value={headerValues.supplierName}
                      onChange={(e) =>
                        handleHeaderFieldChange('supplierName', e.target.value)
                      }
                      maxLength={200}
                      disabled={isSaving}
                    />
                    {fieldErrors.supplierName ? (
                      <p className="pv-field-error">
                        {fieldErrors.supplierName}
                      </p>
                    ) : null}
                    <FieldSuggestionBanner
                      suggestion={fieldSuggestions.supplierName}
                      labelPrefix="Bill supplier"
                      onAccept={() =>
                        handleAcceptHeaderSuggestion('supplierName')
                      }
                      onDismiss={() =>
                        handleDismissHeaderSuggestion('supplierName')
                      }
                      disabled={isSaving}
                    />
                  </div>

                  <div className="pv-form-field">
                    <div className="pv-label-row">
                      <label
                        htmlFor="pv-invoice-number"
                        className="pv-form-label"
                      >
                        Supplier invoice number
                      </label>
                      <FieldSourceBadge
                        meta={fieldMeta.supplierInvoiceNumber}
                        hasValue={Boolean(
                          headerValues.supplierInvoiceNumber.trim(),
                        )}
                      />
                    </div>
                    <input
                      id="pv-invoice-number"
                      type="text"
                      className={`pv-input${
                        fieldErrors.supplierInvoiceNumber
                          ? ' pv-input--error'
                          : ''
                      }`}
                      placeholder="Optional"
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
                      labelPrefix="Bill invoice"
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
                      <label
                        htmlFor="pv-project-select"
                        className="pv-form-label"
                      >
                        Associated project
                      </label>
                      <FieldSourceBadge
                        meta={fieldMeta.projectId}
                        hasValue={Boolean(headerValues.projectId)}
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
                      onChange={(val) =>
                        handleHeaderFieldChange('projectId', val)
                      }
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
                rawMaterials={allCatalogMaterials}
                stagedNewMaterials={stagedNewMaterials}
                materialById={materialById}
                materialOptions={materialOptions}
                fieldErrors={fieldErrors}
                isSaving={isSaving}
                focusRowKey={pendingFocusRowKey}
                onRowFocused={() => setPendingFocusRowKey('')}
                onAddLineRow={handleAddLineRow}
                onUpdateLineItem={updateLineItem}
                onAcceptRowSuggestion={handleAcceptRowSuggestion}
                onDismissRowSuggestion={handleDismissRowSuggestion}
                onRemoveLineRow={handleRemoveLineRow}
                onAddSuggestedLineItem={handleAddSuggestedLineItem}
                onAddAllSuggestedLineItems={handleAddAllSuggestedLineItems}
                onDismissSuggestedLineItem={handleDismissSuggestedLineItem}
                onDismissAllSuggestedLineItems={
                  handleDismissAllSuggestedLineItems
                }
                onPromoteUncertainRow={handlePromoteUncertainRow}
                onDismissUncertainRow={handleDismissUncertainRow}
                onDismissAllUncertainRows={handleDismissAllUncertainRows}
                onOpenCreateMaterialModal={handleOpenCreateMaterialModal}
                onOpenEditStagedMaterialModal={
                  handleOpenEditStagedMaterialModal
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
                taxRatePercent={headerValues.taxRatePercent}
                taxCalculationMode={taxCalculationMode}
                onTaxRateChange={handleTaxRateChange}
                taxAmount={effectiveTaxAmount}
                onTaxChange={handleManualTaxAmountChange}
                onUsePrintedTax={handleUsePrintedTax}
                otherCharges={headerValues.otherCharges}
                onOtherChargesChange={(val) =>
                  handleHeaderFieldChange('otherCharges', val)
                }
                fieldMeta={fieldMeta}
                fieldSuggestions={fieldSuggestions}
                onAcceptFieldSuggestion={handleAcceptHeaderSuggestion}
                onDismissFieldSuggestion={handleDismissHeaderSuggestion}
                fieldErrors={fieldErrors}
                ocrState={ocrState}
                isSaving={isSaving}
              />
            </div>

            {showSidePreview ? (
              <aside className="pv-side-preview" aria-label="Bill preview">
                <BillLocalPreviewPanel
                  entry={activePreviewEntry}
                  isExpanded={isPreviewExpanded}
                  onToggleExpanded={() =>
                    setIsPreviewExpanded((prev) => !prev)
                  }
                  onClose={() => setIsPreviewOpen(false)}
                />
              </aside>
            ) : null}
          </div>

          {isSaving && pendingFiles.length > 0 ? (
            <div className="pv-ocr-running" role="status">
              <div className="pv-ocr-running__row">
                <span>Uploading bill &amp; saving voucher...</span>
                <strong>{uploadProgress}%</strong>
              </div>
              <div className="pv-ocr-running__track">
                <div
                  className="pv-ocr-running__fill"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : null}

          <footer className="pv-sticky-bar">
            <div className="pv-sticky-bar__summary">
              <span>
                {lineItems.length}{' '}
                {lineItems.length === 1 ? 'material' : 'materials'}
              </span>
              <strong>{formatInrCurrency(previewTotals.finalTotal)}</strong>
            </div>

            <div className="pv-sticky-bar__actions">
              <button
                type="button"
                className="admin-btn admin-btn--secondary pv-sticky-bar__cancel"
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
                className="admin-btn admin-btn--primary pv-sticky-bar__save"
                disabled={isSaving || ocrState.isRunning}
              >
                {isSaving
                  ? isEditMode
                    ? 'Saving...'
                    : 'Saving...'
                  : isEditMode
                    ? 'Save Changes'
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
                Your unsaved entries and attached bill preview will be
                discarded.
              </p>
            </div>
            <div className="admin-modal__footer">
              <button
                type="button"
                className="admin-btn admin-btn--secondary"
                onClick={() => setConfirmLeaveTarget('')}
              >
                Keep Editing
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
                Discard
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {materialModalState ? (
        <NewMaterialConfirmModal
          key={materialModalState.modalKey}
          modalState={materialModalState}
          existingMaterials={allCatalogMaterials}
          stagedNewMaterials={stagedNewMaterials}
          onClose={() => setMaterialModalState(null)}
          onConfirm={handleConfirmNewMaterial}
          onSelectExistingOrStaged={handleSelectExistingOrStagedFromModal}
        />
      ) : null}

      <TotalMismatchConfirmModal
        isOpen={Boolean(totalMismatchModal)}
        printedBillTotal={totalMismatchModal?.printedBillTotal}
        calculatedVoucherTotal={totalMismatchModal?.calculatedVoucherTotal}
        difference={totalMismatchModal?.difference}
        isSaving={isSaving}
        onReview={() => {
          if (!isSaving) {
            setTotalMismatchModal(null)
          }
        }}
        onSaveAnyway={handleConfirmSaveAnyway}
      />

      <BillAttachmentModal
        attachment={previewModalAttachment}
        onClose={() => setPreviewModalAttachment(null)}
      />
    </div>
  )
}
