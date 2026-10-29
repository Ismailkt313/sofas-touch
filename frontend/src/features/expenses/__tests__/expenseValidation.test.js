import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_EXPENSE_CATEGORY_NAMES,
  findDuplicateExpenseCategory,
  formatExpenseCurrency,
  roundExpenseAmount,
  validateCategoryFormValues,
  validateExpenseFormValues,
  validateReceiptFile,
} from '../utils/expenseValidation.js'

test('includes required default Soft Touch Sofas expense categories', () => {
  assert.deepEqual(DEFAULT_EXPENSE_CATEGORY_NAMES, [
    'Transportation',
    'Labour',
    'Installation',
    'Repairs',
    'Miscellaneous',
  ])
})

test('prevents duplicate category names case-insensitively and ignores extra whitespace', () => {
  const categories = [
    { id: 'c1', name: 'Transportation' },
    { id: 'c2', name: 'Labour' },
  ]

  assert.equal(findDuplicateExpenseCategory(categories, '  transportation ')?.id, 'c1')
  assert.equal(findDuplicateExpenseCategory(categories, 'LABOUR')?.id, 'c2')
  assert.equal(findDuplicateExpenseCategory(categories, 'Transportation', 'c1'), null)
  assert.equal(findDuplicateExpenseCategory(categories, 'Polishing'), null)

  const dupErrors = validateCategoryFormValues({ name: '  labour  ' }, categories)
  assert.ok(dupErrors.name)

  const selfRenameOk = validateCategoryFormValues({ name: 'Labour' }, categories, 'c2')
  assert.equal(Object.keys(selfRenameOk).length, 0)
})

test('validates required expense fields, positive monetary values, and role-gated inline categories', () => {
  const categories = [{ id: 'c1', name: 'Transportation' }]

  const missingAll = validateExpenseFormValues(
    { expenseDate: '', categoryId: '', amount: '', description: '' },
    { categories },
  )
  assert.ok(missingAll.expenseDate)
  assert.ok(missingAll.categoryId)
  assert.ok(missingAll.amount)
  assert.ok(missingAll.description)

  const nonPositive = validateExpenseFormValues(
    {
      expenseDate: '2026-10-29',
      categoryId: 'c1',
      amount: '-50',
      description: 'Invalid negative expense',
    },
    { categories },
  )
  assert.ok(nonPositive.amount)

  const blockedDataEntryCat = validateExpenseFormValues(
    {
      expenseDate: '2026-10-29',
      newCategoryName: 'Site Crane',
      amount: '1500',
      description: 'Hoisting sofa to 6th floor',
    },
    { categories, isCreatingCategory: true, canCreateCategory: false },
  )
  assert.ok(blockedDataEntryCat.newCategoryName)

  const adminInlineDuplicate = validateExpenseFormValues(
    {
      expenseDate: '2026-10-29',
      newCategoryName: ' transportation ',
      amount: '1500',
      description: 'Tempo charge',
    },
    { categories, isCreatingCategory: true, canCreateCategory: true },
  )
  assert.ok(adminInlineDuplicate.newCategoryName)

  const validAdminInline = validateExpenseFormValues(
    {
      expenseDate: '2026-10-29',
      newCategoryName: 'Site Crane',
      amount: '1500.50',
      description: 'Hoisting sofa to 6th floor',
    },
    { categories, isCreatingCategory: true, canCreateCategory: true },
  )
  assert.equal(Object.keys(validAdminInline).length, 0)
  assert.equal(roundExpenseAmount('1500.556'), 1500.56)
  assert.match(formatExpenseCurrency(1500.5), /1,500\.50/)
})

test('validates optional receipt upload MIME types and file size limits', () => {
  assert.equal(validateReceiptFile(null), '')

  assert.equal(
    validateReceiptFile({
      name: 'receipt.pdf',
      type: 'application/pdf',
      size: 245_000,
    }),
    '',
  )

  assert.equal(
    validateReceiptFile({
      name: 'slip.jpg',
      type: 'image/jpeg',
      size: 512_000,
    }),
    '',
  )

  assert.match(
    validateReceiptFile({
      name: 'malware.exe',
      type: 'application/x-msdownload',
      size: 1024,
    }),
    /Unsupported file type/i,
  )

  assert.match(
    validateReceiptFile({
      name: 'huge.png',
      type: 'image/png',
      size: 12 * 1024 * 1024,
    }),
    /10 MB/i,
  )
})
