import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildVisiblePages,
  calculatePreservedPage,
  getPluralName,
} from '../paginationUtils.js'

test('buildVisiblePages returns all numbers when totalPages <= 7', () => {
  assert.deepEqual(buildVisiblePages(1, 1), [1])
  assert.deepEqual(buildVisiblePages(1, 3), [1, 2, 3])
  assert.deepEqual(buildVisiblePages(4, 7), [1, 2, 3, 4, 5, 6, 7])
})

test('buildVisiblePages formats start-heavy range with ellipsis when current page <= 4 and totalPages > 7', () => {
  const result1 = buildVisiblePages(1, 20)
  assert.deepEqual(result1, [1, 2, 3, 4, 5, 'ellipsis-end', 20])

  const result4 = buildVisiblePages(4, 20)
  assert.deepEqual(result4, [1, 2, 3, 4, 5, 'ellipsis-end', 20])
})

test('buildVisiblePages formats end-heavy range with ellipsis when current page >= totalPages - 3', () => {
  const result17 = buildVisiblePages(17, 20)
  assert.deepEqual(result17, [1, 'ellipsis-start', 16, 17, 18, 19, 20])

  const result20 = buildVisiblePages(20, 20)
  assert.deepEqual(result20, [1, 'ellipsis-start', 16, 17, 18, 19, 20])
})

test('buildVisiblePages formats middle range with both ellipses', () => {
  const result7 = buildVisiblePages(7, 20)
  assert.deepEqual(result7, [1, 'ellipsis-start', 6, 7, 8, 'ellipsis-end', 20])

  const result10 = buildVisiblePages(10, 20)
  assert.deepEqual(result10, [1, 'ellipsis-start', 9, 10, 11, 'ellipsis-end', 20])
})

test('calculatePreservedPage preserves approximate list position', () => {
  // Requirement example:
  // User on page 13 with limit 5 (records 61-65). When switching to limit 10, should land on page 7 (records 61-70).
  assert.equal(calculatePreservedPage(13, 5, 10), 7)
  assert.equal(calculatePreservedPage(1, 10, 20), 1)
  assert.equal(calculatePreservedPage(5, 10, 20), 3) // record 41 lands on page 3 of 20
  assert.equal(calculatePreservedPage(10, 10, 50), 2) // record 91 lands on page 2 of 50
})

test('calculatePreservedPage clamps to max total pages if totalItems provided', () => {
  // 45 items total. Next limit is 50 -> max page is 1
  assert.equal(calculatePreservedPage(5, 10, 50, 45), 1)
  // 85 items total. Next limit is 20 -> max page is 5
  assert.equal(calculatePreservedPage(10, 10, 20, 85), 5)
})

test('getPluralName correctly inflects common entity nouns', () => {
  assert.equal(getPluralName('user'), 'users')
  assert.equal(getPluralName('project'), 'projects')
  assert.equal(getPluralName('purchase'), 'purchases')
  assert.equal(getPluralName('expense'), 'expenses')
  assert.equal(getPluralName('activity'), 'activities')
  assert.equal(getPluralName('record'), 'records')
  assert.equal(getPluralName('batch', 'batches'), 'batches')
})
