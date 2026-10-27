import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import './dropdown.css'

/**
 * Computes viewport-aware coordinates for the floating dropdown menu.
 */
function computeDropdownCoords(triggerEl) {
  if (!triggerEl || typeof window === 'undefined') {
    return null
  }

  const rect = triggerEl.getBoundingClientRect()
  if (
    rect.bottom < 0 ||
    rect.top > window.innerHeight ||
    rect.right < 0 ||
    rect.left > window.innerWidth
  ) {
    return null
  }

  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth
  const spaceBelow = viewportHeight - rect.bottom
  const spaceAbove = rect.top
  const estimatedHeight = 220
  const margin = 8

  const openUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow

  const top = openUpward
    ? Math.max(margin, rect.top - Math.min(estimatedHeight, spaceAbove - margin) - 4)
    : rect.bottom + 4

  const width = Math.max(rect.width, 160)
  let left = rect.left

  if (left + width > viewportWidth - margin) {
    left = viewportWidth - width - margin
  }
  if (left < margin) {
    left = margin
  }

  return {
    top: Math.round(top),
    left: Math.round(left),
    width: Math.round(width),
    openUpward,
  }
}

/**
 * Reusable, accessible, luxury-styled Dropdown component for Soft Touch Sofas.
 *
 * @param {Object} props
 * @param {string} [props.id] - Element ID for label association
 * @param {string} [props.name] - Field name for forms
 * @param {any} props.value - Currently selected value
 * @param {Array<string|{value: any, label: string, description?: string, disabled?: boolean}>} props.options
 * @param {Function} props.onChange - Callback: (value, syntheticEvent) => void
 * @param {string} [props.placeholder='Select an option']
 * @param {boolean} [props.disabled=false]
 * @param {boolean|string} [props.error=false] - Error state
 * @param {string} [props.variant='default'] - 'default' | 'filter' | 'form'
 * @param {string} [props.size] - 'sm' | 'md' | 'lg'
 * @param {string} [props.className] - Extra class name on wrapper
 * @param {boolean} [props.portal=true] - Render menu via portal to body
 * @param {string} [props.ariaLabel]
 */
export function Dropdown({
  id,
  name,
  value,
  options = [],
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  error = false,
  variant = 'default',
  size,
  className = '',
  portal = true,
  ariaLabel,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const autoId = useId()
  const dropdownId = id || `sts-dropdown-${autoId}`
  const listboxId = `sts-listbox-${autoId}`

  // Normalize options into uniform { value, label, description, disabled }
  const normalizedOptions = useMemo(() => {
    if (!Array.isArray(options)) return []
    return options.map((opt) => {
      if (opt && typeof opt === 'object' && 'value' in opt) {
        return {
          value: opt.value,
          label: opt.label !== undefined ? String(opt.label) : String(opt.value),
          description: opt.description || null,
          disabled: Boolean(opt.disabled),
        }
      }
      return {
        value: opt,
        label: String(opt),
        description: null,
        disabled: false,
      }
    })
  }, [options])

  // Find currently selected option
  const selectedOption = useMemo(() => {
    return (
      normalizedOptions.find((opt) => String(opt.value) === String(value)) ||
      null
    )
  }, [normalizedOptions, value])

  const closeDropdown = useCallback((restoreFocus = false) => {
    setIsOpen(false)
    setHighlightedIndex(-1)
    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        triggerRef.current?.focus()
      })
    }
  }, [])

  // Update coords on open, scroll, resize
  const updateCoords = useCallback(() => {
    if (!triggerRef.current) return
    const next = computeDropdownCoords(triggerRef.current)
    if (next) {
      setCoords(next)
    } else {
      setIsOpen(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return undefined

    updateCoords()

    const handleScrollOrResize = () => {
      updateCoords()
    }

    const handlePointerDown = (event) => {
      if (
        menuRef.current?.contains(event.target) ||
        triggerRef.current?.contains(event.target)
      ) {
        return
      }
      closeDropdown(false)
    }

    const handleWindowKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeDropdown(true)
      } else if (event.key === 'Tab') {
        closeDropdown(false)
      }
    }

    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown, {
      passive: true,
    })
    document.addEventListener('keydown', handleWindowKeyDown)

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleWindowKeyDown)
    }
  }, [isOpen, updateCoords, closeDropdown])

  const handleToggle = () => {
    if (disabled) return
    if (isOpen) {
      closeDropdown(false)
      return
    }
    updateCoords()
    setIsOpen(true)
    const selectedIdx = normalizedOptions.findIndex(
      (opt) => String(opt.value) === String(value),
    )
    setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0)
  }

  const handleSelect = (opt) => {
    if (disabled || opt.disabled) return
    closeDropdown(true)

    if (typeof onChange === 'function') {
      const syntheticEvent = {
        target: { name: name || dropdownId, value: opt.value, id: dropdownId },
        currentTarget: {
          name: name || dropdownId,
          value: opt.value,
          id: dropdownId,
        },
        name: name || dropdownId,
        value: opt.value,
        preventDefault: () => {},
        stopPropagation: () => {},
        toString: () => String(opt.value),
        valueOf: () => opt.value,
      }
      onChange(opt.value, syntheticEvent)
    }
  }

  const handleKeyDown = (event) => {
    if (disabled) return

    if (!isOpen) {
      if (
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'Enter' ||
        event.key === ' '
      ) {
        event.preventDefault()
        handleToggle()
      }
      return
    }

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault()
        setHighlightedIndex((prev) => {
          let next = prev + 1
          while (
            next < normalizedOptions.length &&
            normalizedOptions[next]?.disabled
          ) {
            next += 1
          }
          return next < normalizedOptions.length ? next : prev
        })
        break
      }
      case 'ArrowUp': {
        event.preventDefault()
        setHighlightedIndex((prev) => {
          let next = prev - 1
          while (next >= 0 && normalizedOptions[next]?.disabled) {
            next -= 1
          }
          return next >= 0 ? next : prev
        })
        break
      }
      case 'Home': {
        event.preventDefault()
        const first = normalizedOptions.findIndex((o) => !o.disabled)
        if (first >= 0) setHighlightedIndex(first)
        break
      }
      case 'End': {
        event.preventDefault()
        for (let i = normalizedOptions.length - 1; i >= 0; i--) {
          if (!normalizedOptions[i]?.disabled) {
            setHighlightedIndex(i)
            break
          }
        }
        break
      }
      case 'Enter':
      case ' ': {
        event.preventDefault()
        if (
          highlightedIndex >= 0 &&
          highlightedIndex < normalizedOptions.length
        ) {
          const targetOpt = normalizedOptions[highlightedIndex]
          if (targetOpt && !targetOpt.disabled) {
            handleSelect(targetOpt)
          }
        }
        break
      }
      default: {
        // Alphanumeric type-ahead jump
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          const char = event.key.toLowerCase()
          const matchIdx = normalizedOptions.findIndex(
            (o) => !o.disabled && o.label.toLowerCase().startsWith(char),
          )
          if (matchIdx >= 0) {
            setHighlightedIndex(matchIdx)
          }
        }
        break
      }
    }
  }

  const menuContent = isOpen && coords ? (
    <div
      ref={menuRef}
      id={listboxId}
      role="listbox"
      aria-label={ariaLabel || placeholder}
      className="sts-dropdown__menu"
      style={{
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: `${coords.width}px`,
      }}
    >
      {normalizedOptions.length === 0 ? (
        <div className="sts-dropdown__empty">No options available</div>
      ) : (
        <ul className="sts-dropdown__options-list" role="presentation">
          {normalizedOptions.map((opt, idx) => {
            const isSelected = String(opt.value) === String(value)
            const isHighlighted = idx === highlightedIndex

            return (
              <li
                key={`${opt.value}-${idx}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled}
                className={`sts-dropdown__option ${
                  isSelected ? 'sts-dropdown__option--selected' : ''
                } ${
                  isHighlighted ? 'sts-dropdown__option--highlighted' : ''
                } ${opt.disabled ? 'sts-dropdown__option--disabled' : ''}`}
                onClick={() => handleSelect(opt)}
                onMouseEnter={() => {
                  if (!opt.disabled) setHighlightedIndex(idx)
                }}
              >
                <div className="sts-dropdown__option-content">
                  <span className="sts-dropdown__option-label">
                    {opt.label}
                  </span>
                  {opt.description ? (
                    <span className="sts-dropdown__option-desc">
                      {opt.description}
                    </span>
                  ) : null}
                </div>
                {isSelected ? (
                  <svg
                    className="sts-dropdown__option-check"
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 10.5L8.5 14L15 6.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  ) : null

  return (
    <div
      className={`sts-dropdown sts-dropdown--${variant} ${className}`.trim()}
    >
      <button
        ref={triggerRef}
        id={dropdownId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={`sts-dropdown__trigger sts-dropdown__trigger--${variant} ${
          size ? `sts-dropdown__trigger--${size}` : ''
        } ${error ? 'sts-dropdown__trigger--error' : ''} ${
          isOpen ? 'sts-dropdown__trigger--open' : ''
        } ${
          !selectedOption ? 'sts-dropdown__trigger--placeholder' : ''
        }`.trim()}
      >
        <span className="sts-dropdown__value-wrap">
          <span className="sts-dropdown__value-text">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <svg
          className="sts-dropdown__chevron"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Hidden native select for form serialization and test runner compatibility */}
      <select
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        value={value ?? ''}
        onChange={() => {}}
        style={{
          position: 'absolute',
          opacity: 0,
          pointerEvents: 'none',
          width: 0,
          height: 0,
          margin: 0,
          border: 0,
          clip: 'rect(0 0 0 0)',
        }}
      >
        {normalizedOptions.map((opt, i) => (
          <option key={`${opt.value}-${i}`} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {portal && typeof document !== 'undefined'
        ? createPortal(menuContent, document.body)
        : menuContent}
    </div>
  )
}
