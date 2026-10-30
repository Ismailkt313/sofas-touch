import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseUrlParams,
  buildQueryString,
  navigateBackOrFallback,
  saveScrollPosition,
  restoreScrollPosition,
} from '../navigationState.js';

test('parseUrlParams extracts values matching schema and falls back to defaults', () => {
  const schema = {
    page: { type: 'number', default: 1, min: 1 },
    search: { type: 'string', default: '' },
    status: { type: 'string', default: 'all' },
    activeOnly: { type: 'boolean', default: false },
  };

  const parsed1 = parseUrlParams(schema, '?page=3&search=modern%20sofa&status=in_progress&activeOnly=true');
  assert.equal(parsed1.page, 3);
  assert.equal(parsed1.search, 'modern sofa');
  assert.equal(parsed1.status, 'in_progress');
  assert.equal(parsed1.activeOnly, true);

  // Malformed or missing values fallback to schema defaults
  const parsed2 = parseUrlParams(schema, '?page=-5&search=&activeOnly=not_a_bool');
  assert.equal(parsed2.page, 1); // clamped to min: 1
  assert.equal(parsed2.search, '');
  assert.equal(parsed2.status, 'all');
  assert.equal(parsed2.activeOnly, false);
});

test('buildQueryString builds minimal URL search params and omits schema defaults', () => {
  const schema = {
    page: { type: 'number', default: 1, min: 1 },
    search: { type: 'string', default: '' },
    status: { type: 'string', default: 'all' },
  };

  // When all equal defaults, returns empty string
  const qs1 = buildQueryString({ page: 1, search: '', status: 'all' }, schema);
  assert.equal(qs1, '');

  // When page is 4 and search is "leather", returns formatted query string
  const qs2 = buildQueryString({ page: 4, search: 'leather', status: 'all' }, schema);
  assert.equal(qs2, '?page=4&search=leather');
});

test('saveScrollPosition and restoreScrollPosition store and retrieve scroll coordinates', () => {
  // Mock sessionStorage and window for node test environment
  const store = {};
  global.sessionStorage = {
    setItem(key, val) { store[key] = String(val); },
    getItem(key) { return store[key] || null; },
    removeItem(key) { delete store[key]; },
  };

  global.window = {
    scrollX: 0,
    scrollY: 350,
    scrollTo(options) {
      this.scrollX = options.left ?? this.scrollX;
      this.scrollY = options.top ?? this.scrollY;
    },
  };

  saveScrollPosition('/projects');
  assert.ok(store['sts:scroll:/projects']);

  // Change window scroll
  global.window.scrollY = 0;

  // Restore scroll
  const restored = restoreScrollPosition('/projects');
  assert.equal(restored, true);
  assert.equal(global.window.scrollY, 350);
});

test('navigateBackOrFallback navigates back if history has an app origin, or falls back to path', () => {
  let backCalled = false;
  let navigatedTo = null;

  global.window = {
    history: {
      length: 3,
      state: { from: '/users?page=3' },
      back() { backCalled = true; },
    },
  };

  const onNavigate = (path) => { navigatedTo = path; };

  // Case 1: user arrived from app history
  navigateBackOrFallback(onNavigate, '/users');
  assert.equal(backCalled, true);
  assert.equal(navigatedTo, null);

  // Case 2: direct access with no state/history
  backCalled = false;
  global.window.history = { length: 1, state: null, back() { backCalled = true; } };
  navigateBackOrFallback(onNavigate, '/users');
  assert.equal(backCalled, false);
  assert.equal(navigatedTo, '/users');
});

