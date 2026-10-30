import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import './datepicker.css'

const DATEPICKER_OPEN_EVENT = 'sts:datepicker-open'
const DROPDOWN_OPEN_EVENT = 'sts:dropdown-open'

const CALENDAR_WIDTH = 290
const CALENDAR_HEIGHT = 345
const POPUP_OFFSET = 4
const VIEWPORT_MARGIN = 8

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const WEEKDAY_NAMES = [
  { short: 'Su', full: 'Sunday' },
  { short: 'Mo', full: 'Monday' },
  { short: 'Tu', full: 'Tuesday' },
  { short: 'We', full: 'Wednesday' },
  { short: 'Th', full: 'Thursday' },
  { short: 'Fr', full: 'Friday' },
  { short: 'Sa', full: 'Saturday' },
]

export function parseISODate(isoStr) {
  if (!isoStr || typeof isoStr !== 'string') {
    return null
  }
  const match = isoStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return null
  }
  const year = parseInt(match[1], 10)
  const month = parseInt(match[2], 10) - 1 // 0-indexed
  const day = parseInt(match[3], 10)

  if (month < 0 || month > 11 || day < 1 || day > 31) {
    return null
  }
  return { year, month, day }
}

export function formatToISO(year, month, day) {
  const y = String(year).padStart(4, '0')
  const m = String(month + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatDisplayDate(isoStr) {
  const parsed = parseISODate(isoStr)
  if (!parsed) {
    return ''
  }
  return `${parsed.day} ${MONTH_SHORT[parsed.month]} ${parsed.year}`
}

export function getTodayParts() {
  const now = new Date()
  return {
    year: now.getFullYear(),
    month: now.getMonth(),
    day: now.getDate(),
  }
}

export function isSameDay(p1, p2) {
  if (!p1 || !p2) return false
  return p1.year === p2.year && p1.month === p2.month && p1.day === p2.day
}

export function isDateDisabled(year, month, day, minDate, maxDate) {
  const targetISO = formatToISO(year, month, day)
  if (minDate && targetISO < minDate) {
    return true
  }
  if (maxDate && targetISO > maxDate) {
    return true
  }
  return false
}

function computePopoverCoords(triggerEl) {
  if (!triggerEl || typeof window === 'undefined') {
    return null
  }

  const rect = triggerEl.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth

  const spaceBelow = viewportHeight - rect.bottom
  const spaceAbove = rect.top

  let openUpward = false
  if (spaceBelow < CALENDAR_HEIGHT && spaceAbove > spaceBelow) {
    openUpward = true
  }

  let top = openUpward
    ? Math.max(VIEWPORT_MARGIN, rect.top - CALENDAR_HEIGHT - POPUP_OFFSET)
    : Math.min(viewportHeight - CALENDAR_HEIGHT - VIEWPORT_MARGIN, rect.bottom + POPUP_OFFSET)

  let left = rect.left
  if (left + CALENDAR_WIDTH > viewportWidth - VIEWPORT_MARGIN) {
    left = Math.max(VIEWPORT_MARGIN, viewportWidth - CALENDAR_WIDTH - VIEWPORT_MARGIN)
  }
  if (left < VIEWPORT_MARGIN) {
    left = VIEWPORT_MARGIN
  }

  return {
    top,
    left,
    width: CALENDAR_WIDTH,
  }
}

export function CalendarView({
  value,
  onChange,
  onClose,
  minDate,
  maxDate,
  allowClear = true,
  inline = false,
}) {
  const selectedParts = useMemo(() => parseISODate(value), [value])
  const todayParts = useMemo(() => getTodayParts(), [])

  // Navigation View State
  const [navYear, setNavYear] = useState(() => selectedParts?.year || todayParts.year)
  const [navMonth, setNavMonth] = useState(() => selectedParts?.month ?? todayParts.month)
  const [viewMode, setViewMode] = useState('days') // 'days' | 'months' | 'years'

  // Sync nav state when value changes externally
  useEffect(() => {
    if (selectedParts) {
      setNavYear(selectedParts.year)
      setNavMonth(selectedParts.month)
    }
  }, [selectedParts])

  // Calendar Grid Builder (6 rows x 7 cols = 42 cells)
  const daysGrid = useMemo(() => {
    const firstDayOfMonth = new Date(navYear, navMonth, 1).getDay() // 0 = Sun
    const daysInCurrentMonth = new Date(navYear, navMonth + 1, 0).getDate()
    const daysInPrevMonth = new Date(navYear, navMonth, 0).getDate()

    const cells = []

    // 1. Previous month padding
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i
      const prevMonth = navMonth === 0 ? 11 : navMonth - 1
      const prevYear = navMonth === 0 ? navYear - 1 : navYear
      cells.push({
        year: prevYear,
        month: prevMonth,
        day,
        isOutside: true,
        disabled: isDateDisabled(prevYear, prevMonth, day, minDate, maxDate),
      })
    }

    // 2. Current month days
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      cells.push({
        year: navYear,
        month: navMonth,
        day,
        isOutside: false,
        disabled: isDateDisabled(navYear, navMonth, day, minDate, maxDate),
      })
    }

    // 3. Next month padding to fill grid
    const remaining = 42 - cells.length
    for (let day = 1; day <= remaining; day++) {
      const nextMonth = navMonth === 11 ? 0 : navMonth + 1
      const nextYear = navMonth === 11 ? navYear + 1 : navYear
      cells.push({
        year: nextYear,
        month: nextMonth,
        day,
        isOutside: true,
        disabled: isDateDisabled(nextYear, nextMonth, day, minDate, maxDate),
      })
    }

    return cells
  }, [navYear, navMonth, minDate, maxDate])

  const handlePrevMonth = () => {
    if (navMonth === 0) {
      setNavMonth(11)
      setNavYear((y) => y - 1)
    } else {
      setNavMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (navMonth === 11) {
      setNavMonth(0)
      setNavYear((y) => y + 1)
    } else {
      setNavMonth((m) => m + 1)
    }
  }

  const handlePrevYear = () => {
    setNavYear((y) => y - 1)
  }

  const handleNextYear = () => {
    setNavYear((y) => y + 1)
  }

  const handleSelectDay = (cell) => {
    if (cell.disabled) return
    const isoString = formatToISO(cell.year, cell.month, cell.day)
    onChange(isoString)
    if (!inline) {
      onClose?.()
    }
  }

  const handleSelectToday = () => {
    const today = getTodayParts()
    if (!isDateDisabled(today.year, today.month, today.day, minDate, maxDate)) {
      const isoString = formatToISO(today.year, today.month, today.day)
      setNavYear(today.year)
      setNavMonth(today.month)
      onChange(isoString)
      if (!inline) {
        onClose?.()
      }
    }
  }

  const handleClear = () => {
    onChange('')
    if (!inline) {
      onClose?.()
    }
  }

  // Quick Year Picker Range (Current Year - 10 to + 5)
  const yearRange = useMemo(() => {
    const current = todayParts.year
    const years = []
    for (let y = current - 12; y <= current + 6; y++) {
      years.push(y)
    }
    return years
  }, [todayParts.year])

  return (
    <div className={`sts-calendar ${inline ? 'sts-calendar-inline' : ''}`} role="dialog" aria-label="Calendar date selector">
      {/* Header */}
      <div className="sts-calendar__header">
        <button
          type="button"
          className="sts-calendar__title-btn"
          onClick={() => setViewMode((prev) => (prev === 'days' ? 'months' : prev === 'months' ? 'years' : 'days'))}
          aria-label={`Current view: ${MONTH_NAMES[navMonth]} ${navYear}. Click to change view mode.`}
        >
          <span>{MONTH_NAMES[navMonth]} {navYear}</span>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="sts-calendar__nav-group">
          {viewMode === 'days' && (
            <>
              <button
                type="button"
                className="sts-calendar__nav-btn"
                onClick={handlePrevYear}
                title="Previous Year"
                aria-label="Previous Year"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M11 12L7 8L11 4M7 12L3 8L7 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                className="sts-calendar__nav-btn"
                onClick={handlePrevMonth}
                title="Previous Month"
                aria-label="Previous Month"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                className="sts-calendar__nav-btn"
                onClick={handleNextMonth}
                title="Next Month"
                aria-label="Next Month"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                className="sts-calendar__nav-btn"
                onClick={handleNextYear}
                title="Next Year"
                aria-label="Next Year"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M5 12L9 8L5 4M9 12L13 8L9 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          )}

          {viewMode !== 'days' && (
            <button
              type="button"
              className="sts-calendar__btn-text"
              onClick={() => setViewMode('days')}
              aria-label="Back to days view"
            >
              Back
            </button>
          )}
        </div>
      </div>

      {/* Main View: Days */}
      {viewMode === 'days' && (
        <>
          <div className="sts-calendar__weekdays" role="row">
            {WEEKDAY_NAMES.map((wd) => (
              <span key={wd.short} className="sts-calendar__weekday" title={wd.full} aria-label={wd.full}>
                {wd.short}
              </span>
            ))}
          </div>

          <div className="sts-calendar__grid" role="grid" aria-label={`${MONTH_NAMES[navMonth]} ${navYear}`}>
            {daysGrid.map((cell, idx) => {
              const cellParts = { year: cell.year, month: cell.month, day: cell.day }
              const isSelected = isSameDay(selectedParts, cellParts)
              const isToday = isSameDay(todayParts, cellParts)

              let dayClassName = 'sts-calendar__day'
              if (cell.isOutside) dayClassName += ' sts-calendar__day--outside'
              if (isToday) dayClassName += ' sts-calendar__day--today'
              if (isSelected) dayClassName += ' sts-calendar__day--selected'
              if (cell.disabled) dayClassName += ' sts-calendar__day--disabled'

              return (
                <button
                  key={`${cell.year}-${cell.month}-${cell.day}-${idx}`}
                  type="button"
                  className={dayClassName}
                  disabled={cell.disabled}
                  onClick={() => handleSelectDay(cell)}
                  aria-label={`${cell.day} ${MONTH_NAMES[cell.month]} ${cell.year}${isSelected ? ' (Selected)' : ''}${isToday ? ' (Today)' : ''}`}
                  aria-selected={isSelected}
                  tabIndex={isSelected || (!selectedParts && isToday) ? 0 : -1}
                >
                  {cell.day}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* View Mode: Month Selector */}
      {viewMode === 'months' && (
        <div className="sts-calendar__picker-grid" role="listbox" aria-label="Select month">
          {MONTH_SHORT.map((name, idx) => (
            <button
              key={name}
              type="button"
              className={`sts-calendar__picker-item${idx === navMonth ? ' sts-calendar__picker-item--active' : ''}`}
              onClick={() => {
                setNavMonth(idx)
                setViewMode('days')
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* View Mode: Year Selector */}
      {viewMode === 'years' && (
        <div className="sts-calendar__picker-grid" role="listbox" aria-label="Select year">
          {yearRange.map((yr) => (
            <button
              key={yr}
              type="button"
              className={`sts-calendar__picker-item${yr === navYear ? ' sts-calendar__picker-item--active' : ''}`}
              onClick={() => {
                setNavYear(yr)
                setViewMode('months')
              }}
            >
              {yr}
            </button>
          ))}
        </div>
      )}

      {/* Footer Quick Actions */}
      <div className="sts-calendar__footer">
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button
            type="button"
            className="sts-calendar__btn-text"
            onClick={handleSelectToday}
          >
            Today
          </button>
          {allowClear && value && (
            <button
              type="button"
              className="sts-calendar__btn-text sts-calendar__btn-text--muted"
              onClick={handleClear}
            >
              Clear
            </button>
          )}
        </div>

        {!inline && (
          <button
            type="button"
            className="sts-calendar__btn-primary"
            onClick={onClose}
          >
            Done
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Reusable Luxury DatePicker / Calendar Component for Soft Touch Sofas
 *
 * @param {Object} props
 * @param {string} props.value - ISO Date string YYYY-MM-DD
 * @param {Function} props.onChange - Receives formatted ISO string (val) and synthetic event
 * @param {string} [props.placeholder='Select date'] - Input placeholder
 * @param {string} [props.prefix] - Label prefix tag e.g. "From" or "To"
 * @param {string} [props.minDate] - Minimum selectable ISO date
 * @param {string} [props.maxDate] - Maximum selectable ISO date
 * @param {boolean} [props.disabled=false]
 * @param {boolean} [props.error=false] - Error border highlight
 * @param {boolean} [props.required=false]
 * @param {boolean} [props.allowClear=true] - Allows clearing date with cross icon
 * @param {'form'|'filter'} [props.variant='form'] - Sizing & styling variant
 * @param {boolean} [props.inline=false] - Directly embed calendar in DOM without popup
 * @param {string} [props.id]
 * @param {string} [props.name]
 * @param {string} [props.ariaLabel]
 * @param {string} [props.className]
 */
export function DatePicker({
  value = '',
  onChange,
  placeholder = 'Select date',
  prefix,
  minDate,
  maxDate,
  disabled = false,
  error = false,
  required = false,
  allowClear = true,
  variant = 'form',
  inline = false,
  id,
  name,
  ariaLabel,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState(null)

  const triggerRef = useRef(null)
  const popoverRef = useRef(null)
  const instanceId = useId()
  const componentId = id || instanceId

  const formattedDisplay = useMemo(() => formatDisplayDate(value), [value])

  const triggerChange = useCallback(
    (newVal) => {
      if (typeof onChange === 'function') {
        const syntheticEvent = {
          target: { name: name || componentId, value: newVal },
          currentTarget: { name: name || componentId, value: newVal },
          preventDefault: () => {},
          stopPropagation: () => {},
        }
        onChange(newVal, syntheticEvent)
      }
    },
    [onChange, name, componentId],
  )

  const updateCoords = useCallback(() => {
    if (!triggerRef.current) return
    const nextCoords = computePopoverCoords(triggerRef.current)
    if (nextCoords) {
      setCoords(nextCoords)
    }
  }, [])

  const handleOpen = () => {
    if (disabled || inline) return
    window.dispatchEvent(new CustomEvent(DATEPICKER_OPEN_EVENT, { detail: { id: componentId } }))
    window.dispatchEvent(new CustomEvent(DROPDOWN_OPEN_EVENT, { detail: { id: componentId } }))
    updateCoords()
    setIsOpen(true)
  }

  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [])

  const handleClearTrigger = (e) => {
    e.stopPropagation()
    triggerChange('')
  }

  // Close when other pickers/dropdowns open
  useEffect(() => {
    const handleOtherOpen = (e) => {
      if (e.detail?.id !== componentId) {
        setIsOpen(false)
      }
    }
    window.addEventListener(DATEPICKER_OPEN_EVENT, handleOtherOpen)
    window.addEventListener(DROPDOWN_OPEN_EVENT, handleOtherOpen)
    return () => {
      window.removeEventListener(DATEPICKER_OPEN_EVENT, handleOtherOpen)
      window.removeEventListener(DROPDOWN_OPEN_EVENT, handleOtherOpen)
    }
  }, [componentId])

  // Window resize & scroll positioning
  useEffect(() => {
    if (!isOpen) return
    const handleReposition = () => updateCoords()
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)
    return () => {
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [isOpen, updateCoords])

  // Outside click & Escape key detection
  useEffect(() => {
    if (!isOpen) return

    const handleMouseDown = (e) => {
      if (
        triggerRef.current?.contains(e.target) ||
        popoverRef.current?.contains(e.target)
      ) {
        return
      }
      setIsOpen(false)
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // If inline mode requested, directly render the calendar in place
  if (inline) {
    return (
      <div className={`sts-datepicker-inline-wrap ${className}`}>
        <CalendarView
          value={value}
          onChange={triggerChange}
          minDate={minDate}
          maxDate={maxDate}
          allowClear={allowClear}
          inline
        />
      </div>
    )
  }

  const triggerClasses = [
    'sts-datepicker__trigger',
    `sts-datepicker__trigger--${variant}`,
    isOpen ? 'sts-datepicker__trigger--open' : '',
    error ? 'sts-datepicker__trigger--error' : '',
    !value ? 'sts-datepicker__trigger--placeholder' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={`sts-datepicker sts-datepicker--${variant} ${className}`}>
      <button
        ref={triggerRef}
        id={componentId}
        type="button"
        className={triggerClasses}
        onClick={isOpen ? handleClose : handleOpen}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={ariaLabel || (prefix ? `${prefix}: ${formattedDisplay || placeholder}` : formattedDisplay || placeholder)}
        aria-required={required}
      >
        <div className="sts-datepicker__content">
          {prefix && <span className="sts-datepicker__prefix">{prefix}</span>}
          <span className="sts-datepicker__value">
            {formattedDisplay || placeholder}
          </span>
        </div>

        <div className="sts-datepicker__actions">
          {allowClear && value && !disabled && (
            <button
              type="button"
              className="sts-datepicker__clear-btn"
              onClick={handleClearTrigger}
              title="Clear date"
              aria-label="Clear date"
            >
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          )}

          <svg className="sts-datepicker__icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M3 8H17" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 2.5V4.5M13 2.5V4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="7" cy="11" r="1" fill="currentColor" />
            <circle cx="10" cy="11" r="1" fill="currentColor" />
            <circle cx="13" cy="11" r="1" fill="currentColor" />
            <circle cx="7" cy="14" r="1" fill="currentColor" />
            <circle cx="10" cy="14" r="1" fill="currentColor" />
          </svg>
        </div>
      </button>

      {/* Portal popover for clean z-index layering */}
      {isOpen &&
        coords &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            className="sts-calendar-popover"
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
            }}
          >
            <CalendarView
              value={value}
              onChange={triggerChange}
              onClose={handleClose}
              minDate={minDate}
              maxDate={maxDate}
              allowClear={allowClear}
              inline={false}
            />
          </div>,
          document.body,
        )}
    </div>
  )
}

// Convenient alias
export const Calendar = DatePicker

export default DatePicker

