const exactDateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

const shortTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

const BASE_ENTITY_OPTIONS = [
  { value: 'all', label: 'All Modules' },
  { value: 'project', label: 'Projects' },
  { value: 'purchase', label: 'Purchases' },
  { value: 'expense', label: 'Expenses' },
  { value: 'raw_material', label: 'Raw Materials' },
]

const ADMIN_ENTITY_OPTIONS = [
  { value: 'user', label: 'Users & Access' },
  { value: 'permission', label: 'Roles & Permissions' },
  { value: 'settings', label: 'Settings' },
]

const BASE_ACTION_OPTIONS = [
  { value: 'all', label: 'All Actions' },
  { value: 'project.created', label: 'Project Created' },
  { value: 'project.updated', label: 'Project Updated' },
  { value: 'project.status_changed', label: 'Project Status Changed' },
  { value: 'project.deleted', label: 'Project Deleted' },
  { value: 'purchase.created', label: 'Purchase Recorded' },
  { value: 'purchase.updated', label: 'Purchase Updated' },
  { value: 'purchase.attachment_added', label: 'Purchase Bill Attached' },
  { value: 'purchase.cancelled', label: 'Purchase Cancelled' },
  { value: 'expense.created', label: 'Expense Recorded' },
  { value: 'expense.updated', label: 'Expense Updated' },
  { value: 'expense.cancelled', label: 'Expense Cancelled' },
  { value: 'expense.category_created', label: 'Expense Category Created' },
  { value: 'expense.category_updated', label: 'Expense Category Updated' },
  { value: 'material.created', label: 'Material Created' },
  { value: 'material.updated', label: 'Material Updated' },
  { value: 'material.status_changed', label: 'Material Status Changed' },
  { value: 'material.stock_adjusted', label: 'Material Stock Adjusted' },
]

const ADMIN_ACTION_OPTIONS = [
  { value: 'user.registered', label: 'Account Signup Submitted' },
  { value: 'user.created', label: 'User Created' },
  { value: 'user.updated', label: 'User Updated' },
  { value: 'user.status_changed', label: 'User Status Changed' },
  { value: 'user.approved', label: 'Signup Approved' },
  { value: 'user.rejected', label: 'Signup Rejected' },
  { value: 'permissions.updated', label: 'Role Permissions Updated' },
  { value: 'permissions.reset', label: 'Role Permissions Reset' },
  { value: 'permissions.user_overridden', label: 'User Override Updated' },
  { value: 'settings.updated', label: 'Workspace Settings Updated' },
]

export function getActivityEntityOptions(role = 'data_entry') {
  if (role === 'admin') {
    return [...BASE_ENTITY_OPTIONS, ...ADMIN_ENTITY_OPTIONS]
  }
  return BASE_ENTITY_OPTIONS
}

export function getActivityActionOptions(role = 'data_entry') {
  if (role === 'admin') {
    return [...BASE_ACTION_OPTIONS, ...ADMIN_ACTION_OPTIONS]
  }
  return BASE_ACTION_OPTIONS
}

export function getEntityBadgeLabel(entityType) {
  switch (entityType) {
    case 'project':
      return 'Project'
    case 'purchase':
      return 'Purchase'
    case 'expense':
      return 'Expense'
    case 'material':
    case 'raw_material':
      return 'Material'
    case 'user':
      return 'User'
    case 'permission':
      return 'Permissions'
    case 'settings':
      return 'Settings'
    default:
      return 'System'
  }
}

export function getActivityVisualMeta(actionType = '', entityType = '') {
  const act = String(actionType || '')
  if (
    act.endsWith('.cancelled') ||
    act.endsWith('.deleted') ||
    act.endsWith('.rejected')
  ) {
    return {
      tone: 'danger',
      iconType: 'cancel',
      entityBadge: getEntityBadgeLabel(entityType),
    }
  }

  if (act.endsWith('.created') || act.endsWith('.registered')) {
    return {
      tone: 'success',
      iconType: 'create',
      entityBadge: getEntityBadgeLabel(entityType),
    }
  }

  if (act.endsWith('.approved')) {
    return {
      tone: 'success',
      iconType: 'approve',
      entityBadge: getEntityBadgeLabel(entityType),
    }
  }

  if (act.endsWith('.stock_adjusted') || act.endsWith('.status_changed')) {
    return {
      tone: 'warning',
      iconType: 'status',
      entityBadge: getEntityBadgeLabel(entityType),
    }
  }

  return {
    tone: 'neutral',
    iconType: 'edit',
    entityBadge: getEntityBadgeLabel(entityType),
  }
}

export function formatActivityTimestamp(value, nowMs = Date.now()) {
  if (!value) {
    return { relative: '—', full: '—' }
  }
  const parsed = new Date(value)
  const ts = parsed.getTime()
  if (Number.isNaN(ts)) {
    return { relative: '—', full: '—' }
  }

  const diffSec = Math.max(0, Math.floor((nowMs - ts) / 1000))
  let relative
  if (diffSec < 45) {
    relative = 'Just now'
  } else if (diffSec < 3600) {
    relative = `${Math.floor(diffSec / 60)}m ago`
  } else if (diffSec < 86400) {
    relative = `${Math.floor(diffSec / 3600)}h ago`
  } else if (diffSec < 86400 * 7) {
    relative = `${Math.floor(diffSec / 86400)}d ago`
  } else {
    relative = shortTimeFormatter.format(parsed)
  }

  return {
    relative,
    full: exactDateTimeFormatter.format(parsed),
  }
}

export function resolvePermittedActivityPath(item, userRole = 'data_entry') {
  const rawPath = typeof item?.targetPath === 'string' ? item.targetPath.trim() : ''
  if (!rawPath || !rawPath.startsWith('/')) {
    return null
  }
  if (userRole === 'admin') {
    return rawPath
  }
  if (
    rawPath.startsWith('/users') ||
    rawPath.startsWith('/user-approvals') ||
    rawPath.startsWith('/reports') ||
    /^\/projects\/[^/]+\/report$/.test(rawPath)
  ) {
    return null
  }
  return rawPath
}
