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
const MAX_SEARCHABLE_MENU_HEIGHT = 308
const MENU_OFFSET_GAP = 4
const VIEWPORT_MARGIN = 8
const ESTIMATED_OPTION_HEIGHT = 38
const SEARCH_BAR_HEIGHT = 48
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

function computeDropdownCoords(
  triggerEl,
  optionCount,
  measuredMenuHeight = 0,
  searchable = false,
) {
  if (!triggerEl || typeof window === 'undefined') {
    return null
  }

  const maxAllowedHeight = searchable
    ? MAX_SEARCHABLE_MENU_HEIGHT
    : MAX_MENU_HEIGHT
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
      width: 220,
      maxHeight: maxAllowedHeight,
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

  const extraSearchHeight = searchable ? SEARCH_BAR_HEIGHT : 0
  const estimatedContentHeight = Math.max(
    46 + extraSearchHeight,
    Math.max(1, optionCount) * ESTIMATED_OPTION_HEIGHT +
      MENU_VERTICAL_PADDING +
      extraSearchHeight,
  )
  const desiredHeight = Math.min(
    maxAllowedHeight,
    measuredMenuHeight > 0 ? measuredMenuHeight : estimatedContentHeight,
  )

  const openUpward = spaceBelow < desiredHeight && spaceAbove > spaceBelow

  const availableVerticalSpace = openUpward ? spaceAbove : spaceBelow
  const maxHeight = Math.max(
    searchable ? 120 : 72,
    Math.min(maxAllowedHeight, Math.floor(availableVerticalSpace)),
  )

  const maxAllowedWidth = Math.max(120, viewportWidth - VIEWPORT_MARGIN * 2)
  const minWidth = searchable ? 230 : 160
  const width = Math.min(Math.max(rect.width, minWidth), maxAllowedWidth)

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
  searchable = false,
  searchPlaceholder = 'Search...',
  createOption = null,
  onCreateOption = null,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [searchQuery, setSearchQuery] = useState('')

  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const searchInputRef = useRef(null)
  const optionsListRef = useRef(null)
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
          searchText: opt.searchText ? String(opt.searchText) : '',
          badge: opt.badge || null,
          disabled: Boolean(opt.disabled),
          isCreateAction: Boolean(opt.isCreateAction),
        }
      }
      return {
        value: opt,
        label: String(opt),
        description: null,
        searchText: '',
        badge: null,
        disabled: false,
        isCreateAction: false,
      }
    })
  }, [options])

  const selectedOption = useMemo(() => {
    return (
      normalizedOptions.find((opt) => String(opt.value) === String(value)) ||
      null
    )
  }, [normalizedOptions, value])

  const effectiveOptions = useMemo(() => {
    let baseList = normalizedOptions

    if (searchable && searchQuery.trim()) {
      const tokens = searchQuery
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
      baseList = normalizedOptions.filter((opt) => {
        const haystack = `${opt.label} ${opt.searchText || ''} ${opt.description || ''}`.toLowerCase()
        return tokens.every((tok) => haystack.includes(tok))
      })
    }

    if (typeof createOption === 'function') {
      const dynamicCreate = createOption(searchQuery, baseList)
      if (dynamicCreate && dynamicCreate.label) {
        const actionItem = {
          value: dynamicCreate.value || '__create__',
          label: String(dynamicCreate.label),
          description: dynamicCreate.description || null,
          disabled: Boolean(dynamicCreate.disabled),
          isCreateAction: true,
          createName: dynamicCreate.createName ?? searchQuery.trim(),
          rawAction: dynamicCreate,
        }
        if (dynamicCreate.position === 'top') {
          return [actionItem, ...baseList]
        }
        return [...baseList, actionItem]
      }
    }

    return baseList
  }, [normalizedOptions, searchable, searchQuery, createOption])

  const closeDropdown = useCallback((restoreFocus = false) => {
    setIsOpen(false)
    setHighlightedIndex(-1)
    setSearchQuery('')
    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        triggerRef.current?.focus()
      })
    }
  }, [])

  const updateCoords = useCallback(() => {
    const fallbackMax = searchable
      ? MAX_SEARCHABLE_MENU_HEIGHT
      : MAX_MENU_HEIGHT

    if (!portal) {
      setCoords({
        top: null,
        bottom: null,
        left: 0,
        width: 0,
        maxHeight: fallbackMax,
        openUpward: false,
      })
      return true
    }

    if (!triggerRef.current) return false

    const measuredHeight = menuRef.current ? menuRef.current.scrollHeight : 0
    const next = computeDropdownCoords(
      triggerRef.current,
      effectiveOptions.length,
      measuredHeight,
      searchable,
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
  }, [portal, effectiveOptions.length, searchable])

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
    if (!isOpen || !searchable) {
      return undefined
    }
    const raf = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(raf)
  }, [isOpen, searchable])

  useEffect(() => {
    if (!isOpen || highlightedIndex < 0 || !optionsListRef.current) {
      return
    }
    const activeItem = optionsListRef.current.children[highlightedIndex]
    if (activeItem && typeof activeItem.scrollIntoView === 'function') {
      activeItem.scrollIntoView({ block: 'nearest' })
    }
  }, [isOpen, highlightedIndex])

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
    setSearchQuery('')
    const positioned = updateCoords()
    if (!positioned) return
    setIsOpen(true)
    const selectedIdx = effectiveOptions.findIndex(
      (opt) => !opt.isCreateAction && String(opt.value) === String(value),
    )
    if (selectedIdx >= 0) {
      setHighlightedIndex(selectedIdx)
    } else {
      const firstEnabled = effectiveOptions.findIndex((opt) => !opt.disabled)
      setHighlightedIndex(firstEnabled >= 0 ? firstEnabled : 0)
    }
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

    if (opt.isCreateAction) {
      const currentQuery = searchQuery
      closeDropdown(false)
      onCreateOption?.(opt.rawAction || opt, currentQuery)
      return
    }

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

  const moveHighlight = (direction) => {
    setHighlightedIndex((prev) => {
      if (effectiveOptions.length === 0) return -1
      let next = prev + direction
      while (
        next >= 0 &&
        next < effectiveOptions.length &&
        effectiveOptions[next]?.disabled
      ) {
        next += direction
      }
      return next >= 0 && next < effectiveOptions.length ? next : prev
    })
  }

  const handleTriggerKeyDown = (event) => {
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
        moveHighlight(1)
        break
      }
      case 'ArrowUp': {
        event.preventDefault()
        moveHighlight(-1)
        break
      }
      case 'Home': {
        event.preventDefault()
        const first = effectiveOptions.findIndex((o) => !o.disabled)
        if (first >= 0) setHighlightedIndex(first)
        break
      }
      case 'End': {
        event.preventDefault()
        for (let i = effectiveOptions.length - 1; i >= 0; i--) {
          if (!effectiveOptions[i]?.disabled) {
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
          highlightedIndex < effectiveOptions.length
        ) {
          const targetOpt = effectiveOptions[highlightedIndex]
          if (targetOpt && !targetOpt.disabled) {
            handleSelect(targetOpt)
          }
        }
        break
      }
      default: {
        if (
          !searchable &&
          event.key.length === 1 &&
          !event.ctrlKey &&
          !event.metaKey
        ) {
          const char = event.key.toLowerCase()
          const matchIdx = effectiveOptions.findIndex(
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

  const handleSearchInputKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveHighlight(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveHighlight(-1)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (
        highlightedIndex >= 0 &&
        highlightedIndex < effectiveOptions.length
      ) {
        const targetOpt = effectiveOptions[highlightedIndex]
        if (targetOpt && !targetOpt.disabled) {
          handleSelect(targetOpt)
        }
      }
    }
  }

  const handleSearchChange = (event) => {
    const nextVal = event.target.value
    setSearchQuery(nextVal)
    setHighlightedIndex(0)
  }

  const menuStyle = portal
    ? {
        top:
          coords?.top !== null && coords?.top !== undefined
            ? `${coords.top}px`
            : 'auto',
        bottom:
          coords?.bottom !== null && coords?.bottom !== undefined
            ? `${coords.bottom}px`
            : 'auto',
        left: `${coords?.left ?? 0}px`,
        width: `${coords?.width ?? 160}px`,
        maxHeight: `${coords?.maxHeight ?? MAX_MENU_HEIGHT}px`,
      }
    : undefined

  const menuContent =
    isOpen && (portal ? Boolean(coords) : true) ? (
      <div
        ref={handleMenuRef}
        id={listboxId}
        role="listbox"
        aria-label={ariaLabel || placeholder}
        className={`sts-dropdown__menu${
          searchable ? ' sts-dropdown__menu--searchable' : ''
        }${!portal ? ' sts-dropdown__menu--inline' : ''}${
          coords?.openUpward ? ' sts-dropdown__menu--upward' : ''
        }`}
        style={menuStyle}
      >
        {searchable ? (
          <div className="sts-dropdown__search-wrap">
            <svg
              className="sts-dropdown__search-icon"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="7"
                cy="7"
                r="4.75"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M10.6 10.6L13.75 13.75"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              className="sts-dropdown__search-input"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleSearchInputKeyDown}
              aria-label={searchPlaceholder}
              autoComplete="off"
            />
            {searchQuery ? (
              <button
                type="button"
                className="sts-dropdown__search-clear"
                onClick={() => {
                  setSearchQuery('')
                  setHighlightedIndex(0)
                  searchInputRef.current?.focus({ preventScroll: true })
                }}
                aria-label="Clear search"
              >
                ×
              </button>
            ) : null}
          </div>
        ) : null}

        {effectiveOptions.length === 0 ? (
          <div className="sts-dropdown__empty">
            {searchable && searchQuery.trim()
              ? 'No matching materials'
              : 'No options available'}
          </div>
        ) : (
          <ul
            ref={optionsListRef}
            className="sts-dropdown__options-list"
            role="presentation"
          >
            {effectiveOptions.map((opt, idx) => {
              const isSelected =
                !opt.isCreateAction && String(opt.value) === String(value)
              const isHighlighted = idx === highlightedIndex

              return (
                <li
                  key={`${opt.value}-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={opt.disabled}
                  className={`sts-dropdown__option${
                    opt.isCreateAction ? ' sts-dropdown__option--create' : ''
                  }${isSelected ? ' sts-dropdown__option--selected' : ''}${
                    isHighlighted ? ' sts-dropdown__option--highlighted' : ''
                  }${opt.disabled ? ' sts-dropdown__option--disabled' : ''}`}
                  onClick={() => handleSelect(opt)}
                  onMouseEnter={() => {
                    if (!opt.disabled) setHighlightedIndex(idx)
                  }}
                >
                  <div className="sts-dropdown__option-content">
                    <span className="sts-dropdown__option-label">
                      {opt.label}
                      {opt.badge ? (
                        <span className="sts-dropdown__option-badge">
                          {opt.badge}
                        </span>
                      ) : null}
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
        onKeyDown={handleTriggerKeyDown}
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
          {selectedOption?.badge ? (
            <span className="sts-dropdown__trigger-badge">
              {selectedOption.badge}
            </span>
          ) : null}
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
