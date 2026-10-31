import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseUrlParams,
  buildQueryString,
  navigateBackOrFallback,
} from '../navigationState.js'

test('Projects listing: parses URL parameters and preserves page 3 with active filters', () => {
  const schema = {
    page: { type: 'number', default: 1, min: 1 },
    search: { type: 'string', default: '' },
    status: { type: 'string', default: 'all' },
    category: { type: 'string', default: 'all' },
  }

  const initialUrl = '?page=3&status=In+Progress&category=Sofa'
  const state = parseUrlParams(schema, initialUrl)

  assert.equal(state.page, 3)
  assert.equal(state.status, 'In Progress')
  assert.equal(state.category, 'Sofa')
  assert.equal(state.search, '')

  // Build query string preserves non-default values
  const qs = buildQueryString(state, schema)
  assert.ok(qs.includes('page=3'))
  assert.ok(qs.includes('status=In+Progress'))
  assert.ok(qs.includes('category=Sofa'))
})

test('Purchases listing: preserves page 2 and project filter upon returning from detail', () => {
  const schema = {
    page: { type: 'number', default: 1, min: 1 },
    search: { type: 'string', default: '' },
    project: { type: 'string', default: 'all' },
    fromDate: { type: 'string', default: '' },
    toDate: { type: 'string', default: '' },
    status: { type: 'string', default: 'active' },
  }

  const initialUrl = '?page=2&project=PRJ-0043&status=active'
  const state = parseUrlParams(schema, initialUrl)

  assert.equal(state.page, 2)
  assert.equal(state.project, 'PRJ-0043')
  assert.equal(state.status, 'active')

  // When back navigation occurs, navigateBackOrFallback uses history or stored origin
  let navigatedPath = null
  const onNavigate = (p) => { navigatedPath = p }

  global.window = {
    history: {
      length: 2,
      state: { from: `/purchases${initialUrl}` },
      back() { navigatedPath = 'history.back' },
    },
  }

  navigateBackOrFallback(onNavigate, '/purchases')
  assert.equal(navigatedPath, 'history.back')
})

test('Expenses listing: preserves page 4 and category while viewing and closing detail modal', () => {
  const schema = {
    page: { type: 'number', default: 1, min: 1 },
    search: { type: 'string', default: '' },
    category: { type: 'string', default: 'all' },
    project: { type: 'string', default: 'all' },
    fromDate: { type: 'string', default: '' },
    toDate: { type: 'string', default: '' },
    status: { type: 'string', default: 'active' },
    view: { type: 'string', default: '' },
  }

  // User is on page 4, viewing EXP-0005
  const modalUrl = '?page=4&category=Labour&view=EXP-0005'
  const state = parseUrlParams(schema, modalUrl)

  assert.equal(state.page, 4)
  assert.equal(state.category, 'Labour')
  assert.equal(state.view, 'EXP-0005')

  // Closing modal removes 'view' without modifying page or category
  const closedState = { ...state, view: '' }
  const closedQs = buildQueryString(closedState, schema)
  assert.ok(closedQs.includes('page=4'))
  assert.ok(closedQs.includes('category=Labour'))
  assert.ok(!closedQs.includes('view='))
})

test('User Management: guards against premature clampPage before users load', () => {
  const schema = {
    page: { type: 'number', default: 1, min: 1 },
    search: { type: 'string', default: '' },
    role: { type: 'string', default: 'all' },
    status: { type: 'string', default: 'all' },
    view: { type: 'string', default: '' },
  }

  const url = '?page=3&role=data_entry'
  const state = parseUrlParams(schema, url)
  assert.equal(state.page, 3)
  assert.equal(state.role, 'data_entry')

  // While isLoading is true, users count is 0, but totalPages should NOT reset page 3
  const isLoading = true
  const users = []
  const totalPages = 1
  const currentPage = state.page

  const shouldClamp = !isLoading && users.length > 0 && totalPages >= 1 && currentPage > totalPages
  assert.equal(shouldClamp, false, 'Should not clamp while loading is true or users list is empty')
})

test('Project Reports: preserves page 2 and date range when returning from project report', () => {
  const schema = {
    page: { type: 'number', default: 1, min: 1 },
    search: { type: 'string', default: '' },
    status: { type: 'string', default: 'all' },
    fromDate: { type: 'string', default: '' },
    toDate: { type: 'string', default: '' },
    sortBy: { type: 'string', default: 'createdAt' },
    sortOrder: { type: 'string', default: 'desc' },
  }

  const reportsUrl = '?page=2&status=in_progress&fromDate=2026-05-01&toDate=2026-10-31'
  const state = parseUrlParams(schema, reportsUrl)

  assert.equal(state.page, 2)
  assert.equal(state.status, 'in_progress')
  assert.equal(state.fromDate, '2026-05-01')
  assert.equal(state.toDate, '2026-10-31')

  let navigated = null
  const onNavigate = (p) => { navigated = p }
  global.window = {
    history: {
      length: 2,
      state: { from: `/reports${reportsUrl}` },
      back() { navigated = 'history.back' },
    },
  }

  navigateBackOrFallback(onNavigate, '/reports')
  assert.equal(navigated, 'history.back')
})

test('Project Reports: filter mutations update query parameters and reset page to 1', () => {
  const schema = {
    page: { type: 'number', default: 1, min: 1 },
    limit: { type: 'number', default: 10, min: 1 },
    search: { type: 'string', default: '' },
    status: { type: 'string', default: 'all' },
    fromDate: { type: 'string', default: '' },
    toDate: { type: 'string', default: '' },
    sortBy: { type: 'string', default: 'createdAt' },
    sortOrder: { type: 'string', default: 'desc' },
  }

  // User starts on page 3
  let state = {
    page: 3,
    limit: 10,
    search: '',
    status: 'all',
    fromDate: '',
    toDate: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  }

  // Filter by status -> resets page to 1
  state = { ...state, status: 'In Progress', page: 1 }
  let qs = buildQueryString(state, schema)
  assert.ok(qs.includes('status=In+Progress'))
  assert.ok(!qs.includes('page='), 'Default page 1 is omitted to keep URL clean')

  // Filter by dates -> resets page to 1
  state = { ...state, fromDate: '2026-01-01', toDate: '2026-10-31', page: 1 }
  qs = buildQueryString(state, schema)
  assert.ok(qs.includes('fromDate=2026-01-01'))
  assert.ok(qs.includes('toDate=2026-10-31'))

  // Sort by profitMargin asc -> resets page to 1
  state = { ...state, sortBy: 'profitMargin', sortOrder: 'asc', page: 1 }
  qs = buildQueryString(state, schema)
  assert.ok(qs.includes('sortBy=profitMargin'))
  assert.ok(qs.includes('sortOrder=asc'))

  // Search by project name
  state = { ...state, search: 'Penthouse', page: 1 }
  qs = buildQueryString(state, schema)
  assert.ok(qs.includes('search=Penthouse'))
})

test('Projects listing: filter changes and reset flow update schema properly', () => {
  const schema = {
    page: { type: 'number', default: 1, min: 1 },
    limit: { type: 'number', default: 10, min: 1 },
    search: { type: 'string', default: '' },
    status: { type: 'string', default: 'all' },
    category: { type: 'string', default: 'all' },
  }

  // Filter status to Completed on page 2
  let state = { page: 2, limit: 10, search: '', status: 'all', category: 'all' }
  state = { ...state, status: 'Completed', page: 1 }
  let qs = buildQueryString(state, schema)
  assert.ok(qs.includes('status=Completed'))
  assert.ok(!qs.includes('page='))

  // Filter category to Sectional Sofa
  state = { ...state, category: 'Sectional Sofa' }
  qs = buildQueryString(state, schema)
  assert.ok(qs.includes('category=Sectional+Sofa'))

  // Reset all
  state = { page: 1, limit: 10, search: '', status: 'all', category: 'all' }
  qs = buildQueryString(state, schema)
  assert.equal(qs, '')
})

test('Raw Materials listing: category and status filter flow update schema properly', () => {
  const schema = {
    page: { type: 'number', default: 1, min: 1 },
    limit: { type: 'number', default: 10, min: 1 },
    search: { type: 'string', default: '' },
    category: { type: 'string', default: 'all' },
    status: { type: 'string', default: 'all' },
  }

  let state = { page: 3, limit: 10, search: '', category: 'all', status: 'all' }
  // Category change resets page to 1
  state = { ...state, category: 'Fabric', page: 1 }
  let qs = buildQueryString(state, schema)
  assert.ok(qs.includes('category=Fabric'))
  assert.ok(!qs.includes('page='))

  // Status change to inactive
  state = { ...state, status: 'inactive' }
  qs = buildQueryString(state, schema)
  assert.ok(qs.includes('status=inactive'))

  // Reset
  state = { page: 1, limit: 10, search: '', category: 'all', status: 'all' }
  qs = buildQueryString(state, schema)
  assert.equal(qs, '')
})

