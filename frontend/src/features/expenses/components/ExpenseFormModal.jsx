import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Dropdown, DatePicker } from '../../../components/common'
import {
  findDuplicateExpenseCategory,
  formatExpenseCurrency,
  formatExpenseDate,
  formatReceiptByteSize,
  normalizeExpenseWhitespace,
  toExpenseDateInputValue,
  validateExpenseFormValues,
  validateReceiptFile,
} from '../utils/expenseValidation'

const MAX_ATTACHMENTS = 5

export function ExpenseFormModal({
  mode = 'create',
  expense = null,
  categories = [],
  projects = [],
  isAdmin = false,
  isSubmitting = false,
  serverError = '',
  onSave,
  onSwitchToEdit,
  onRequestCancelExpense,
  onPreviewSavedReceipt,
  onPreviewLocalReceipt,
  onClose,
}) {
  const isViewMode = mode === 'view'
  const isEditMode = mode === 'edit'
  const formId = useId()
  const fileInputRef = useRef(null)
  const pendingLocalUrlsRef = useRef([])

  const [expenseDate, setExpenseDate] = useState(() =>
    toExpenseDateInputValue(expense?.expenseDate),
  )
  const [categoryId, setCategoryId] = useState(() => expense?.categoryId || '')
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [amount, setAmount] = useState(() =>
    expense?.amount !== undefined && expense?.amount !== null
      ? String(expense.amount)
      : '',
  )
  const [projectId, setProjectId] = useState(
    () => expense?.projectRecordId || '',
  )
  const [description, setDescription] = useState(
    () => expense?.description || '',
  )
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState([])
  const [pendingReceipts, setPendingReceipts] = useState([])
  const [fieldErrors, setFieldErrors] = useState({})
  const [fileError, setFileError] = useState('')

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, isSubmitting])

  useEffect(() => {
    const urlsRef = pendingLocalUrlsRef
    return () => {
      urlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url)
      })
      urlsRef.current = []
    }
  }, [])

  const categoryOptions = useMemo(() => {
    const selectable = categories.filter(
      (cat) =>
        cat.isActive !== false || String(cat.id) === String(expense?.categoryId),
    )
    return selectable.map((cat) => ({
      value: cat.id,
      label: cat.isActive === false ? `${cat.name} (Inactive)` : cat.name,
      description: cat.description || null,
    }))
  }, [categories, expense?.categoryId])

  const projectOptions = useMemo(() => {
    const base = [
      {
        value: '',
        label: 'General Workshop Expense (No Project)',
        description: 'Workshop overhead not billed to a specific client project',
      },
    ]

    const selectableProjects = projects.filter(
      (proj) =>
        proj.status !== 'Completed' ||
        String(proj.id) === String(expense?.projectRecordId),
    )

    const mapped = selectableProjects.map((proj) => ({
      value: proj.id,
      label: `${proj.projectId} — ${proj.name}`,
      description: proj.clientName ? `Client: ${proj.clientName}` : null,
    }))

    return [...base, ...mapped]
  }, [projects, expense?.projectRecordId])

  const savedAttachments = expense?.attachments

  const retainedSavedAttachments = useMemo(() => {
    if (!Array.isArray(savedAttachments)) {
      return []
    }
    const removedSet = new Set(removedAttachmentIds)
    return savedAttachments.filter(
      (att) => !removedSet.has(att.attachmentId),
    )
  }, [savedAttachments, removedAttachmentIds])

  const totalAttachmentCount =
    retainedSavedAttachments.length + pendingReceipts.length

  const buildDropdownCreateOption = useMemo(() => {
    if (!isAdmin) {
      return null
    }
    return (query) => {
      const cleaned = normalizeExpenseWhitespace(query)
      if (!cleaned || cleaned.length < 2) {
        return null
      }
      const existing = findDuplicateExpenseCategory(categories, cleaned)
      if (existing) {
        return null
      }
      return {
        value: '__create_expense_category__',
        label: `+ Create category "${cleaned}"`,
        description: 'Save and assign this new expense category',
        createName: cleaned,
      }
    }
  }, [isAdmin, categories])

  const handleFileInputChange = (event) => {
    const selectedFiles = Array.from(event.target.files || [])
    event.target.value = ''
    if (!selectedFiles.length) {
      return
    }

    if (totalAttachmentCount + selectedFiles.length > MAX_ATTACHMENTS) {
      setFileError(`You can attach at most ${MAX_ATTACHMENTS} receipt files.`)
      return
    }

    const nextItems = []
    for (const file of selectedFiles) {
      const validationMsg = validateReceiptFile(file)
      if (validationMsg) {
        setFileError(validationMsg)
        return
      }
      const blobUrl = URL.createObjectURL(file)
      pendingLocalUrlsRef.current.push(blobUrl)
      nextItems.push({
        localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        name: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        blobUrl,
      })
    }

    setFileError('')
    setPendingReceipts((prev) => [...prev, ...nextItems])
  }

  const handleRemovePendingReceipt = (localId) => {
    setPendingReceipts((prev) => {
      const target = prev.find((item) => item.localId === localId)
      if (target?.blobUrl) {
        URL.revokeObjectURL(target.blobUrl)
        pendingLocalUrlsRef.current = pendingLocalUrlsRef.current.filter(
          (u) => u !== target.blobUrl,
        )
      }
      return prev.filter((item) => item.localId !== localId)
    })
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (isViewMode || isSubmitting) {
      return
    }

    const errors = validateExpenseFormValues(
      {
        expenseDate,
        categoryId,
        newCategoryName,
        amount,
        description,
      },
      {
        categories,
        isCreatingCategory,
        canCreateCategory: isAdmin,
      },
    )

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    const payload = {
      expenseDate: expenseDate.trim(),
      amount: Number(amount),
      description: normalizeExpenseWhitespace(description),
      projectId: projectId ? projectId.trim() : null,
    }

    if (isCreatingCategory) {
      payload.newCategoryName = normalizeExpenseWhitespace(newCategoryName)
    } else {
      payload.categoryId = categoryId
    }

    if (isEditMode && removedAttachmentIds.length > 0) {
      payload.removeAttachmentIds = removedAttachmentIds
    }

    onSave?.(
      payload,
      pendingReceipts.map((item) => item.file),
    )
  }

  const modalTitle = isViewMode
    ? `Expense ${expense?.voucherNumber || ''}`
    : isEditMode
      ? `Edit ${expense?.voucherNumber || 'Expense'}`
      : 'Record Expense'

  const modalSubtitle = isViewMode
    ? 'Recorded operational or project expense voucher'
    : 'Record workshop, transport, labour, installation, or project expenses'

  return createPortal(
    <div
      className="exp-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${formId}-title`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose?.()
        }
      }}
    >
      <div className="exp-modal">
        <div className="exp-modal__header">
          <div>
            <h2 id={`${formId}-title`} className="exp-modal__title">
              {modalTitle}
            </h2>
            <p className="exp-modal__subtitle">{modalSubtitle}</p>
          </div>
          <button
            type="button"
            className="exp-modal__close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {isViewMode && expense ? (
          <>
            <div className="exp-modal__body">
              <div className="exp-detail-grid">
                <div>
                  <div className="exp-detail-item__label">Voucher No</div>
                  <div className="exp-detail-item__value">
                    {expense.voucherNumber}
                  </div>
                </div>
                <div>
                  <div className="exp-detail-item__label">Status</div>
                  <div className="exp-detail-item__value">
                    <span
                      className={`exp-status-badge ${
                        expense.status === 'cancelled'
                          ? 'exp-status-badge--cancelled'
                          : 'exp-status-badge--active'
                      }`}
                    >
                      {expense.status === 'cancelled' ? 'Cancelled' : 'Active'}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="exp-detail-item__label">Expense Date</div>
                  <div className="exp-detail-item__value">
                    {formatExpenseDate(expense.expenseDate)}
                  </div>
                </div>
                <div>
                  <div className="exp-detail-item__label">Amount</div>
                  <div className="exp-detail-item__value">
                    {formatExpenseCurrency(expense.amount)}
                  </div>
                </div>
                <div>
                  <div className="exp-detail-item__label">Category</div>
                  <div className="exp-detail-item__value">
                    <span className="exp-category-pill">
                      {expense.categoryName}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="exp-detail-item__label">Project Cost Link</div>
                  <div className="exp-detail-item__value">
                    {expense.projectRecordId
                      ? `${expense.projectCode || ''} ${expense.projectName || ''}`.trim()
                      : 'General Workshop Expense'}
                  </div>
                </div>
              </div>

              <div className="exp-field">
                <span className="exp-field__label">Description</span>
                <div
                  style={{
                    padding: '0.65rem 0.8rem',
                    borderRadius: '9px',
                    backgroundColor: 'var(--sts-ivory-input)',
                    border: '1px solid var(--sts-sand-light)',
                    fontSize: '0.88rem',
                    lineHeight: 1.45,
                  }}
                >
                  {expense.description}
                </div>
              </div>

              <div className="exp-field">
                <span className="exp-field__label">
                  Receipt Attachments ({expense.attachments?.length || 0})
                </span>
                {expense.attachments?.length ? (
                  <div className="exp-receipt-list">
                    {expense.attachments.map((att, idx) => (
                      <div key={att.attachmentId} className="exp-receipt-item">
                        <div className="exp-receipt-item__meta">
                          <span className="exp-receipt-item__name">
                            {att.originalName}
                          </span>
                          <span className="exp-receipt-item__size">
                            {formatReceiptByteSize(att.sizeBytes)}
                          </span>
                        </div>
                        <div className="exp-receipt-item__actions">
                          <button
                            type="button"
                            className="exp-btn exp-btn--secondary exp-btn--sm"
                            onClick={() => onPreviewSavedReceipt?.(expense, idx)}
                          >
                            Preview
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="exp-field__hint">
                    No receipt uploaded for this expense.
                  </span>
                )}
              </div>

              {expense.status === 'cancelled' && expense.cancelReason ? (
                <div className="exp-banner exp-banner--error">
                  <span>
                    Cancelled by {expense.cancelledBy || 'Admin'}:{' '}
                    {expense.cancelReason}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="exp-modal__footer">
              {isAdmin && expense.status !== 'cancelled' ? (
                <>
                  <button
                    type="button"
                    className="exp-btn exp-btn--ghost"
                    style={{ color: '#9e3324', marginRight: 'auto' }}
                    onClick={() => onRequestCancelExpense?.(expense)}
                  >
                    Void Expense
                  </button>
                  <button
                    type="button"
                    className="exp-btn exp-btn--secondary"
                    onClick={onSwitchToEdit}
                  >
                    Edit Expense
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="exp-btn exp-btn--primary"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="exp-modal__body">
              {serverError ? (
                <div className="exp-banner exp-banner--error" role="alert">
                  <span>{serverError}</span>
                </div>
              ) : null}

              <div className="exp-form-row-2">
                <div className="exp-field">
                  <span className="exp-field__label">
                    Expense Date<span className="exp-field__req">*</span>
                  </span>
                  <DatePicker
                    value={expenseDate}
                    onChange={(val) => {
                      setExpenseDate(val)
                      if (fieldErrors.expenseDate) {
                        setFieldErrors((prev) => ({ ...prev, expenseDate: '' }))
                      }
                    }}
                    error={Boolean(fieldErrors.expenseDate)}
                    variant="form"
                    placeholder="Select expense date"
                    required
                  />
                  {fieldErrors.expenseDate ? (
                    <span className="exp-field__error">
                      {fieldErrors.expenseDate}
                    </span>
                  ) : null}
                </div>

                <label className="exp-field">
                  <span className="exp-field__label">
                    Amount (₹)<span className="exp-field__req">*</span>
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    className={`exp-input ${
                      fieldErrors.amount ? 'exp-input--error' : ''
                    }`}
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value)
                      if (fieldErrors.amount) {
                        setFieldErrors((prev) => ({ ...prev, amount: '' }))
                      }
                    }}
                    required
                  />
                  {fieldErrors.amount ? (
                    <span className="exp-field__error">
                      {fieldErrors.amount}
                    </span>
                  ) : null}
                </label>
              </div>

              <div className="exp-field">
                <div className="exp-field__label-row">
                  <span className="exp-field__label">
                    Category<span className="exp-field__req">*</span>
                  </span>
                  {isAdmin ? (
                    <button
                      type="button"
                      className="exp-field__inline-btn"
                      onClick={() => {
                        setIsCreatingCategory((prev) => !prev)
                        setFieldErrors((prev) => ({
                          ...prev,
                          categoryId: '',
                          newCategoryName: '',
                        }))
                      }}
                    >
                      {isCreatingCategory
                        ? 'Select existing category'
                        : '+ New category'}
                    </button>
                  ) : null}
                </div>

                {isCreatingCategory && isAdmin ? (
                  <div className="exp-inline-cat-box">
                    <input
                      type="text"
                      className={`exp-input ${
                        fieldErrors.newCategoryName ? 'exp-input--error' : ''
                      }`}
                      placeholder="e.g. Site Crane, Polishing, Courier..."
                      maxLength={80}
                      value={newCategoryName}
                      onChange={(e) => {
                        setNewCategoryName(e.target.value)
                        if (fieldErrors.newCategoryName) {
                          setFieldErrors((prev) => ({
                            ...prev,
                            newCategoryName: '',
                          }))
                        }
                      }}
                      autoFocus
                    />
                    <span className="exp-field__hint">
                      Creates and assigns this category immediately when saved.
                    </span>
                    {fieldErrors.newCategoryName ? (
                      <span className="exp-field__error">
                        {fieldErrors.newCategoryName}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <Dropdown
                      variant="form"
                      value={categoryId}
                      options={categoryOptions}
                      searchable
                      searchPlaceholder={
                        isAdmin
                          ? 'Search or type a new category name...'
                          : 'Search expense categories...'
                      }
                      placeholder="Select expense category"
                      hasError={Boolean(fieldErrors.categoryId)}
                      createOption={buildDropdownCreateOption}
                      onCreateOption={(nameFromSearch) => {
                        setIsCreatingCategory(true)
                        setNewCategoryName(nameFromSearch || '')
                        setFieldErrors((prev) => ({
                          ...prev,
                          categoryId: '',
                          newCategoryName: '',
                        }))
                      }}
                      onChange={(val) => {
                        setCategoryId(val)
                        if (fieldErrors.categoryId) {
                          setFieldErrors((prev) => ({
                            ...prev,
                            categoryId: '',
                          }))
                        }
                      }}
                      ariaLabel="Expense category"
                    />
                    {fieldErrors.categoryId ? (
                      <span className="exp-field__error">
                        {fieldErrors.categoryId}
                      </span>
                    ) : null}
                  </>
                )}
              </div>

              <div className="exp-field">
                <span className="exp-field__label">
                  Associated Project (Optional)
                </span>
                <Dropdown
                  variant="form"
                  value={projectId}
                  options={projectOptions}
                  searchable
                  searchPlaceholder="Search project code or name..."
                  placeholder="General Workshop Expense (No Project)"
                  onChange={(val) => setProjectId(val)}
                  ariaLabel="Associated project"
                />
                <span className="exp-field__hint">
                  {projectId
                    ? 'Included in this project’s Total Other Expenses & profitability report.'
                    : 'Recorded as a General Workshop overhead expense.'}
                </span>
              </div>

              <label className="exp-field">
                <span className="exp-field__label">
                  Description<span className="exp-field__req">*</span>
                </span>
                <textarea
                  className={`exp-textarea ${
                    fieldErrors.description ? 'exp-textarea--error' : ''
                  }`}
                  placeholder="Brief details (e.g., Tempo delivery to Kakkanad site, daily upholstery helper wages)..."
                  maxLength={500}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value)
                    if (fieldErrors.description) {
                      setFieldErrors((prev) => ({ ...prev, description: '' }))
                    }
                  }}
                  required
                />
                {fieldErrors.description ? (
                  <span className="exp-field__error">
                    {fieldErrors.description}
                  </span>
                ) : null}
              </label>

              <div className="exp-field">
                <span className="exp-field__label">
                  Receipt Image / PDF (Optional)
                </span>

                <div className="exp-upload-zone">
                  <div className="exp-upload-zone__info">
                    <span className="exp-upload-zone__title">
                      Attach payment slip, bill photo, or PDF
                    </span>
                    <span className="exp-upload-zone__sub">
                      JPG, PNG, WEBP, or PDF up to 10 MB · Optional
                    </span>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleFileInputChange}
                  />
                  <button
                    type="button"
                    className="exp-btn exp-btn--secondary exp-btn--sm"
                    disabled={totalAttachmentCount >= MAX_ATTACHMENTS}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose File
                  </button>
                </div>

                {fileError ? (
                  <span className="exp-field__error">{fileError}</span>
                ) : null}

                {retainedSavedAttachments.length > 0 ||
                pendingReceipts.length > 0 ? (
                  <div className="exp-receipt-list">
                    {retainedSavedAttachments.map((att, idx) => (
                      <div key={att.attachmentId} className="exp-receipt-item">
                        <div className="exp-receipt-item__meta">
                          <span className="exp-receipt-item__name">
                            {att.originalName}
                          </span>
                          <span className="exp-receipt-item__size">
                            {formatReceiptByteSize(att.sizeBytes)} · Saved
                          </span>
                        </div>
                        <div className="exp-receipt-item__actions">
                          <button
                            type="button"
                            className="exp-btn exp-btn--ghost exp-btn--sm"
                            onClick={() => onPreviewSavedReceipt?.(expense, idx)}
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            className="exp-btn exp-btn--ghost exp-btn--sm"
                            style={{ color: '#9e3324' }}
                            onClick={() =>
                              setRemovedAttachmentIds((prev) => [
                                ...prev,
                                att.attachmentId,
                              ])
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}

                    {pendingReceipts.map((item) => (
                      <div key={item.localId} className="exp-receipt-item">
                        <div className="exp-receipt-item__meta">
                          <span className="exp-receipt-item__name">
                            {item.name}
                          </span>
                          <span className="exp-receipt-item__size">
                            {formatReceiptByteSize(item.sizeBytes)} · Ready to
                            upload
                          </span>
                        </div>
                        <div className="exp-receipt-item__actions">
                          <button
                            type="button"
                            className="exp-btn exp-btn--ghost exp-btn--sm"
                            onClick={() =>
                              onPreviewLocalReceipt?.({
                                originalName: item.name,
                                mimeType: item.mimeType,
                                sizeBytes: item.sizeBytes,
                                blobUrl: item.blobUrl,
                              })
                            }
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            className="exp-btn exp-btn--ghost exp-btn--sm"
                            style={{ color: '#9e3324' }}
                            onClick={() =>
                              handleRemovePendingReceipt(item.localId)
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="exp-modal__footer">
              <button
                type="button"
                className="exp-btn exp-btn--secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="exp-btn exp-btn--primary"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? 'Saving…'
                  : isEditMode
                    ? 'Save Changes'
                    : 'Record Expense'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  )
}
