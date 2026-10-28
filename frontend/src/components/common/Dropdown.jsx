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

const DROPDOWN_OPEN_EVENT = 'sts:dropdown-open'
const MAX_MENU_HEIGHT = 260
const MENU_OFFSET_GAP = 4
const VIEWPORT_MARGIN = 8
const ESTIMATED_OPTION_HEIGHT = 38
const MENU_VERTICAL_PADDING = 12

function isTriggerClippedByScrollParent(triggerEl, rect) {
  if (!triggerEl || typeof window === 'undefined') {
    return false
  }

  let parent = triggerEl.parentElement
  while (parent && parent !== document.body && parent !== document.documentElement) {
    const style = window.getComputedStyle(parent)
    const overflowY = style.overflowY
    const overflowX = style.overflowX
    const clipsVertically =
      overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'hidden'
    const clipsHorizontally =
      overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'hidden'

    if (clipsVertically || clipsHorizontally) {
      const parentRect = parent.getBoundingClientRect()
      if (parentRect.width === 0 && parentRect.height === 0) {
        parent = parent.parentElement
        continue
      }
      if (
        clipsVertically &&
        (rect.bottom <= parentRect.top + 4 || rect.top >= parentRect.bottom - 4)
      ) {
        return true
      }
      if (
        clipsHorizontally &&
        (rect.right <= parentRect.left + 4 || rect.left >= parentRect.right - 4)
      ) {
        return true
      }
    }

    parent = parent.parentElement
  }

  return false
}

function computeDropdownCoords(triggerEl, optionCount, measuredMenuHeight = 0) {
  if (!triggerEl || typeof window === 'undefined') {
    return null
  }

  const rect = triggerEl.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth

  if (
    rect.width === 0 &&
    rect.height === 0 &&
    rect.top === 0 &&
    rect.left === 0
  ) {
    return {
      top: MENU_OFFSET_GAP,
      bottom: null,
      left: VIEWPORT_MARGIN,
      width: 200,
      maxHeight: MAX_MENU_HEIGHT,
      openUpward: false,
    }
  }

  if (
    rect.bottom <= 0 ||
    rect.top >= viewportHeight ||
    rect.right <= 0 ||
    rect.left >= viewportWidth ||
    isTriggerClippedByScrollParent(triggerEl, rect)
  ) {
    return null
  }

  const spaceBelow = viewportHeight - rect.bottom - MENU_OFFSET_GAP - VIEWPORT_MARGIN
  const spaceAbove = rect.top - MENU_OFFSET_GAP - VIEWPORT_MARGIN

  const estimatedContentHeight = Math.max(
    46,
    Math.max(1, optionCount) * ESTIMATED_OPTION_HEIGHT + MENU_VERTICAL_PADDING,
  )
  const desiredHeight = Math.min(
    MAX_MENU_HEIGHT,
    measuredMenuHeight > 0 ? measuredMenuHeight : estimatedContentHeight,
  )

  const openUpward = spaceBelow < desiredHeight && spaceAbove > spaceBelow

  const availableVerticalSpace = openUpward ? spaceAbove : spaceBelow
  const maxHeight = Math.max(
    72,
    Math.min(MAX_MENU_HEIGHT, Math.floor(availableVerticalSpace)),
  )

  const maxAllowedWidth = Math.max(120, viewportWidth - VIEWPORT_MARGIN * 2)
  const width = Math.min(Math.max(rect.width, 160), maxAllowedWidth)

  let left = rect.left
  if (left + width > viewportWidth - VIEWPORT_MARGIN) {
    left = viewportWidth - width - VIEWPORT_MARGIN
  }
  if (left < VIEWPORT_MARGIN) {
    left = VIEWPORT_MARGIN
  }

  if (openUpward) {
    return {
      top: null,
      bottom: Math.max(
        VIEWPORT_MARGIN,
        Math.round(viewportHeight - rect.top + MENU_OFFSET_GAP),
      ),
      left: Math.round(left),
      width: Math.round(width),
      maxHeight,
      openUpward: true,
    }
  }

  return {
    top: Math.max(VIEWPORT_MARGIN, Math.round(rect.bottom + MENU_OFFSET_GAP)),
    bottom: null,
    left: Math.round(left),
    width: Math.round(width),
    maxHeight,
    openUpward: false,
  }
}

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

  const updateCoords = useCallback(() => {
    if (!portal) {
      setCoords({
        top: null,
        bottom: null,
        left: 0,
        width: 0,
        maxHeight: MAX_MENU_HEIGHT,
        openUpward: false,
      })
      return true
    }

    if (!triggerRef.current) return false

    const measuredHeight = menuRef.current ? menuRef.current.scrollHeight : 0
    const next = computeDropdownCoords(
      triggerRef.current,
      normalizedOptions.length,
      measuredHeight,
    )

    if (next) {
      setCoords((prev) => {
        if (
          prev &&
          prev.top === next.top &&
          prev.bottom === next.bottom &&
          prev.left === next.left &&
          prev.width === next.width &&
          prev.maxHeight === next.maxHeight &&
          prev.openUpward === next.openUpward
        ) {
          return prev
        }
        return next
      })
      return true
    }

    setIsOpen(false)
    return false
  }, [portal, normalizedOptions.length])

  const handleMenuRef = useCallback(
    (node) => {
      menuRef.current = node
      if (node && portal) {
        updateCoords()
      }
    },
    [portal, updateCoords],
  )

  useEffect(() => {
    if (!isOpen) return undefined

    const handleOtherDropdownOpen = (event) => {
      if (event?.detail?.id && event.detail.id !== dropdownId) {
        closeDropdown(false)
      }
    }

    const handleScroll = (event) => {
      if (event?.target && menuRef.current?.contains(event.target)) {
        return
      }
      updateCoords()
    }

    const handleResize = () => {
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
        event.stopPropagation()
        closeDropdown(true)
      } else if (event.key === 'Tab') {
        closeDropdown(false)
      }
    }

    window.addEventListener(DROPDOWN_OPEN_EVENT, handleOtherDropdownOpen)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleResize)
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown, {
      passive: true,
    })
    document.addEventListener('keydown', handleWindowKeyDown, true)

    return () => {
      window.removeEventListener(DROPDOWN_OPEN_EVENT, handleOtherDropdownOpen)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleWindowKeyDown, true)
    }
  }, [isOpen, dropdownId, updateCoords, closeDropdown])

  const openDropdown = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(DROPDOWN_OPEN_EVENT, { detail: { id: dropdownId } }),
      )
    }
    const positioned = updateCoords()
    if (!positioned) return
    setIsOpen(true)
    const selectedIdx = normalizedOptions.findIndex(
      (opt) => String(opt.value) === String(value),
    )
    setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0)
  }

  const handleToggle = () => {
    if (disabled) return
    if (isOpen) {
      closeDropdown(false)
      return
    }
    openDropdown()
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
        openDropdown()
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

  const menuStyle = portal
    ? {
        top: coords?.top !== null && coords?.top !== undefined ? `${coords.top}px` : 'auto',
        bottom:
          coords?.bottom !== null && coords?.bottom !== undefined
            ? `${coords.bottom}px`
            : 'auto',
        left: `${coords?.left ?? 0}px`,
        width: `${coords?.width ?? 160}px`,
        maxHeight: `${coords?.maxHeight ?? MAX_MENU_HEIGHT}px`,
      }
    : undefined

  const menuContent = isOpen && (portal ? Boolean(coords) : true) ? (
    <div
      ref={handleMenuRef}
      id={listboxId}
      role="listbox"
      aria-label={ariaLabel || placeholder}
      className={`sts-dropdown__menu${
        !portal ? ' sts-dropdown__menu--inline' : ''
      }${coords?.openUpward ? ' sts-dropdown__menu--upward' : ''}`}
      style={menuStyle}
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
        aria-controls={isOpen ? listboxId : undefined}
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
