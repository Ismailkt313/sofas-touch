import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  normalizeExpenseWhitespace,
  validateCategoryFormValues,
} from '../utils/expenseValidation'

export function ExpenseCategoriesModal({
  categories = [],
  onCreateCategory,
  onUpdateCategory,
  onClose,
}) {
  const [newName, setNewName] = useState('')
  const [createError, setCreateError] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const [editingId, setEditingId] = useState('')
  const [editingName, setEditingName] = useState('')
  const [editError, setEditError] = useState('')
  const [busyCategoryId, setBusyCategoryId] = useState('')

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleAddCategory = async (event) => {
    event.preventDefault()
    const errors = validateCategoryFormValues({ name: newName }, categories)
    if (errors.name) {
      setCreateError(errors.name)
      return
    }

    setCreateError('')
    setIsCreating(true)
    try {
      await onCreateCategory({
        name: normalizeExpenseWhitespace(newName),
        description: '',
      })
      setNewName('')
    } catch (err) {
      setCreateError(err?.message || 'Failed to add category.')
    } finally {
      setIsCreating(false)
    }
  }

  const startRename = (cat) => {
    setEditingId(cat.id)
    setEditingName(cat.name)
    setEditError('')
  }

  const handleSaveRename = async (catId) => {
    const errors = validateCategoryFormValues(
      { name: editingName },
      categories,
      catId,
    )
    if (errors.name) {
      setEditError(errors.name)
      return
    }

    setBusyCategoryId(catId)
    setEditError('')
    try {
      await onUpdateCategory(catId, {
        name: normalizeExpenseWhitespace(editingName),
      })
      setEditingId('')
      setEditingName('')
    } catch (err) {
      setEditError(err?.message || 'Failed to update category.')
    } finally {
      setBusyCategoryId('')
    }
  }

  const handleToggleActive = async (cat) => {
    setBusyCategoryId(cat.id)
    setEditError('')
    try {
      await onUpdateCategory(cat.id, { isActive: !cat.isActive })
    } catch (err) {
      setEditError(err?.message || 'Failed to update category status.')
    } finally {
      setBusyCategoryId('')
    }
  }

  return createPortal(
    <div
      className="exp-modal-backdrop admin-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Manage Expense Categories"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div className="exp-modal exp-modal--compact admin-modal admin-modal--compact">
        <div className="exp-modal__header">
          <div>
            <h2 className="exp-modal__title">Expense Categories</h2>
            <p className="exp-modal__subtitle">
              Add, rename, or toggle categories right from Expenses
            </p>
          </div>
          <button
            type="button"
            className="exp-modal__close"
            onClick={onClose}
            aria-label="Close categories modal"
          >
            ×
          </button>
        </div>

        <div className="exp-modal__body">
          <form className="exp-cat-manager-form" onSubmit={handleAddCategory}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                type="text"
                className={`exp-input ${createError ? 'exp-input--error' : ''}`}
                placeholder="New category name (e.g. Polishing, Courier)..."
                maxLength={80}
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value)
                  if (createError) setCreateError('')
                }}
                aria-label="New expense category name"
              />
              {createError ? (
                <div className="exp-field__error" style={{ marginTop: '0.25rem' }}>
                  {createError}
                </div>
              ) : null}
            </div>
            <button
              type="submit"
              className="exp-btn exp-btn--primary"
              disabled={isCreating}
            >
              {isCreating ? 'Adding…' : 'Add'}
            </button>
          </form>

          {editError ? (
            <div className="exp-banner exp-banner--error" role="alert">
              <span>{editError}</span>
            </div>
          ) : null}

          <div className="exp-cat-manager-list">
            {categories.map((cat) => {
              const isEditingThis = editingId === cat.id
              const isBusy = busyCategoryId === cat.id

              return (
                <div
                  key={cat.id}
                  className={`exp-cat-row ${
                    !cat.isActive ? 'exp-cat-row--inactive' : ''
                  }`}
                >
                  {isEditingThis ? (
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.4rem',
                        flex: 1,
                        alignItems: 'center',
                      }}
                    >
                      <input
                        type="text"
                        className="exp-input"
                        value={editingName}
                        maxLength={80}
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="exp-btn exp-btn--primary exp-btn--sm"
                        disabled={isBusy}
                        onClick={() => handleSaveRename(cat.id)}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="exp-btn exp-btn--ghost exp-btn--sm"
                        disabled={isBusy}
                        onClick={() => {
                          setEditingId('')
                          setEditError('')
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="exp-cat-row__info">
                        <span className="exp-cat-row__name">{cat.name}</span>
                        {cat.isDefault ? (
                          <span className="exp-cat-row__tag">Default</span>
                        ) : null}
                        {!cat.isActive ? (
                          <span className="exp-cat-row__tag">Inactive</span>
                        ) : null}
                      </div>

                      <div style={{ display: 'inline-flex', gap: '0.3rem' }}>
                        <button
                          type="button"
                          className="exp-btn exp-btn--ghost exp-btn--sm"
                          disabled={isBusy}
                          onClick={() => startRename(cat)}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="exp-btn exp-btn--secondary exp-btn--sm"
                          disabled={isBusy}
                          onClick={() => handleToggleActive(cat)}
                        >
                          {cat.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="exp-modal__footer">
          <button
            type="button"
            className="exp-btn exp-btn--primary"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
