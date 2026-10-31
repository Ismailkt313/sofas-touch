import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseUrlParams,
  buildQueryString,
  saveScrollPosition,
  restoreScrollPosition,
  navigateBackOrFallback,
} from '../navigationState.js'

test('parseUrlParams extracts values matching schema and falls back to defaults', () => {
  const schema = {
    page: { type: 'number', default: 1, min: 1 },
    search: { type: 'string', default: '' },
    status: { type: 'string', default: 'all' },
    activeOnly: { type: 'boolean', default: false },
  }

  // Case 1: valid query string
  const r1 = parseUrlParams(schema, '?page=3&search=Ismail&status=in_progress&activeOnly=true')
  assert.equal(r1.page, 3)
  assert.equal(r1.search, 'Ismail')
  assert.equal(r1.status, 'in_progress')
  assert.equal(r1.activeOnly, true)

  // Case 2: invalid page falls back to default
  const r2 = parseUrlParams(schema, '?page=-5&status=')
  assert.equal(r2.page, 1)
  assert.equal(r2.status, 'all')
  assert.equal(r2.search, '')

  // Case 3: completely empty
  const r3 = parseUrlParams(schema, '')
  assert.equal(r3.page, 1)
  assert.equal(r3.search, '')
  assert.equal(r3.status, 'all')
  assert.equal(r3.activeOnly, false)
})

test('buildQueryString builds minimal URL search params and omits schema defaults', () => {
  const schema = {
    page: { type: 'number', default: 1, min: 1 },
    search: { type: 'string', default: '' },
    status: { type: 'string', default: 'all' },
  }

  // All defaults -> empty string
  assert.equal(buildQueryString({ page: 1, search: '', status: 'all' }, schema), '')

  // Custom page
  assert.equal(buildQueryString({ page: 4, search: '', status: 'all' }, schema), '?page=4')

  // Search and status
  assert.equal(
    buildQueryString({ page: 2, search: 'sofa', status: 'completed' }, schema),
    '?page=2&search=sofa&status=completed',
  )
})

test('saveScrollPosition and restoreScrollPosition store and retrieve scroll coordinates', () => {
  const storage = {}
  global.sessionStorage = {
    setItem(k, v) { storage[k] = String(v) },
    getItem(k) { return storage[k] || null },
  }
  global.window = {
    location: { pathname: '/projects', search: '?page=2' },
    scrollY: 350,
    scrollTo({ top }) { global.window.scrollY = top },
  }

  // Save scroll
  saveScrollPosition('/projects?page=2')
  assert.equal(storage['sts:scroll:/projects?page=2'], '350')

  // Change window scroll
  global.window.scrollY = 0

  // Restore scroll
  const restored = restoreScrollPosition('/projects?page=2')
  assert.equal(restored, true)
  assert.equal(global.window.scrollY, 350)
})

test('navigateBackOrFallback navigates back if history has an app origin, or falls back to path', () => {
  let backCalled = false
  let navigatedTo = null

  const storage = {}
  global.sessionStorage = {
    setItem(k, v) { storage[k] = String(v) },
    getItem(k) { return storage[k] || null },
  }

  global.window = {
    history: {
      length: 3,
      state: { from: '/users?page=3' },
      back() { backCalled = true },
    },
  }

  const onNavigate = (path) => { navigatedTo = path }

  // Case 1: user arrived from matching app history
  navigateBackOrFallback(onNavigate, '/users')
  assert.equal(backCalled, true)
  assert.equal(navigatedTo, null)

  // Case 2: direct access with no state/history falls back to default path
  backCalled = false
  global.window.history = { length: 1, state: null, back() { backCalled = true } }
  navigateBackOrFallback(onNavigate, '/users')
  assert.equal(backCalled, false)
  assert.equal(navigatedTo, '/users')

  // Case 3: direct access but stored origin exists in sessionStorage
  backCalled = false
  navigatedTo = null
  storage['sts:origin:users'] = '/users?page=3&status=active'
  navigateBackOrFallback(onNavigate, '/users')
  assert.equal(backCalled, false)
  assert.equal(navigatedTo, '/users?page=3&status=active')

  // Case 4: history from another section falls back to section origin, avoiding wrong back
  backCalled = false
  navigatedTo = null
  global.window.history = {
    length: 3,
    state: { from: '/reports/PRJ-0001' },
    back() { backCalled = true },
  }
  storage['sts:origin:projects'] = '/projects?page=4'
  navigateBackOrFallback(onNavigate, '/projects')
  assert.equal(backCalled, false)
  assert.equal(navigatedTo, '/projects?page=4')
})
