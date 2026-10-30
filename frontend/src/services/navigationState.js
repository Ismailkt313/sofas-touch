import { useCallback, useEffect, useRef, useState } from 'react'

export const ROUTE_CHANGE_EVENT = 'sts:routechange'

/**
 * Safely parse URL search parameters according to a schema.
 */
export function parseUrlParams(schema, searchString = '') {
  const params = new URLSearchParams(
    typeof searchString === 'string'
      ? searchString
      : typeof window !== 'undefined'
        ? window.location.search
        : '',
  )

  const result = {}

  for (const [key, config] of Object.entries(schema)) {
    const rawVal = params.get(key)

    if (rawVal === null || rawVal === undefined || rawVal === '') {
      result[key] = config.default
      continue
    }

    if (config.type === 'number') {
      const parsed = parseInt(rawVal, 10)
      result[key] =
        Number.isFinite(parsed) && parsed >= (config.min ?? 1)
          ? parsed
          : config.default
    } else if (config.type === 'boolean') {
      result[key] = rawVal === 'true' || rawVal === '1'
    } else {
      result[key] = rawVal
    }
  }

  return result
}

/**
 * Build a query string from state, omitting default values to keep URLs clean.
 */
export function buildQueryString(values, schema) {
  const params = new URLSearchParams()

  for (const [key, config] of Object.entries(schema)) {
    const val = values[key]
    const defaultVal = config.default

    if (val !== undefined && val !== null && val !== '' && val !== defaultVal) {
      params.set(key, String(val))
    }
  }

  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/**
 * Save scroll position for a specific route / query string.
 */
export function saveScrollPosition(pathWithQuery) {
  if (typeof window === 'undefined') return
  try {
    const full = pathWithQuery || `${window.location.pathname}${window.location.search}`
    sessionStorage.setItem(`sts:scroll:${full}`, String(window.scrollY))
    sessionStorage.setItem(`sts:scroll:${window.location.pathname}`, String(window.scrollY))
  } catch {}
}

/**
 * Restore scroll position for a specific route.
 */
export function restoreScrollPosition(pathWithQuery) {
  if (typeof window === 'undefined') return false
  try {
    const full = pathWithQuery || `${window.location.pathname}${window.location.search}`
    const saved =
      sessionStorage.getItem(`sts:scroll:${full}`) ||
      sessionStorage.getItem(`sts:scroll:${window.location.pathname}`)

    if (saved) {
      const top = parseInt(saved, 10)
      if (Number.isFinite(top) && top >= 0) {
        window.scrollTo({ top, behavior: 'instant' })
        return true
      }
    }
  } catch {}
  return false
}

/**
 * Navigates back in browser history if user arrived from within the app,
 * otherwise safely falls back to the specified fallback path.
 */
export function navigateBackOrFallback(onNavigate, fallbackPath = '/') {
  if (typeof window === 'undefined') {
    onNavigate?.(fallbackPath)
    return
  }

  // Check state.from or sessionStorage last origin
  const fromState = window.history.state?.from
  let storedOrigin = null
  try {
    const section = fallbackPath.replace(/^\//, '').split('/')[0]
    storedOrigin = sessionStorage.getItem(`sts:origin:${section}`)
  } catch {}

  const canGoBack =
    window.history.length > 1 &&
    (fromState || storedOrigin || (document.referrer && document.referrer.includes(window.location.host)))

  if (canGoBack) {
    window.history.back()
  } else if (fromState) {
    if (typeof onNavigate === 'function') {
      onNavigate(fromState)
    } else {
      window.history.pushState({}, '', fromState)
      window.dispatchEvent(new Event(ROUTE_CHANGE_EVENT))
    }
  } else if (storedOrigin) {
    if (typeof onNavigate === 'function') {
      onNavigate(storedOrigin)
    } else {
      window.history.pushState({}, '', storedOrigin)
      window.dispatchEvent(new Event(ROUTE_CHANGE_EVENT))
    }
  } else {
    if (typeof onNavigate === 'function') {
      onNavigate(fallbackPath)
    } else {
      window.history.pushState({}, '', fallbackPath)
      window.dispatchEvent(new Event(ROUTE_CHANGE_EVENT))
    }
  }
}

/**
 * Reusable hook to synchronize listing state (page, search, filters, sort) with URL query parameters.
 */
export function useListingState(schema, { routeKey = '' } = {}) {
  // Parse initial state from current window.location.search
  const [state, setState] = useState(() => {
    return parseUrlParams(schema, typeof window !== 'undefined' ? window.location.search : '')
  })

  const stateRef = useRef(state)
  stateRef.current = state
  const schemaRef = useRef(schema)
  schemaRef.current = schema

  // Track the current origin URL in sessionStorage for fallback back-navigation
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const section = routeKey || window.location.pathname.replace(/^\//, '').split('/')[0]
      const fullUrl = `${window.location.pathname}${window.location.search}`
      sessionStorage.setItem(`sts:origin:${section}`, fullUrl)
    } catch {}
  }, [routeKey, state])

  // Sync state to URL
  const updateUrl = useCallback((newValues, { push = false } = {}) => {
    if (typeof window === 'undefined') return
    const qs = buildQueryString(newValues, schemaRef.current)
    const nextUrl = `${window.location.pathname}${qs}`
    const currentUrl = `${window.location.pathname}${window.location.search}`

    if (nextUrl !== currentUrl) {
      if (push) {
        window.history.pushState({ from: currentUrl }, '', nextUrl)
      } else {
        window.history.replaceState(window.history.state || {}, '', nextUrl)
      }
      window.dispatchEvent(new Event(ROUTE_CHANGE_EVENT))
    }
  }, [])

  // Listen to popstate (browser back/forward button clicks)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handlePopState = () => {
      const parsed = parseUrlParams(schemaRef.current, window.location.search)
      setState(parsed)
      // Attempt scroll restoration on popstate
      setTimeout(() => {
        restoreScrollPosition(`${window.location.pathname}${window.location.search}`)
      }, 50)
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  // Update a single field
  const setValue = useCallback(
    (key, val, { resetPage = false, push = false } = {}) => {
      setState((prev) => {
        const next = { ...prev, [key]: val }
        if (resetPage && 'page' in schemaRef.current) {
          next.page = schemaRef.current.page.default ?? 1
        }
        updateUrl(next, { push })
        return next
      })
    },
    [updateUrl],
  )

  // Update multiple fields
  const setValues = useCallback(
    (patch, { resetPage = false, push = false } = {}) => {
      setState((prev) => {
        const next = { ...prev, ...patch }
        if (resetPage && 'page' in schemaRef.current) {
          next.page = schemaRef.current.page.default ?? 1
        }
        updateUrl(next, { push })
        return next
      })
    },
    [updateUrl],
  )

  // Reset all filters to default
  const resetAll = useCallback(() => {
    const defaults = {}
    for (const [key, config] of Object.entries(schemaRef.current)) {
      defaults[key] = config.default
    }
    setState(defaults)
    updateUrl(defaults, { push: false })
  }, [updateUrl])

  // Clamp page if totalPages is known and current page exceeds it
  const clampPage = useCallback(
    (totalPages) => {
      if (!totalPages || totalPages < 1) return
      setState((prev) => {
        if ('page' in prev && prev.page > totalPages) {
          const next = { ...prev, page: totalPages }
          updateUrl(next, { push: false })
          return next
        }
        return prev
      })
    },
    [updateUrl],
  )

  return {
    values: state,
    setValue,
    setValues,
    resetAll,
    clampPage,
  }
}
