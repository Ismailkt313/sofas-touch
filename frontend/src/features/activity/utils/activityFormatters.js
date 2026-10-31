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
  if (!rawPath || !rawPath.startsWith('/') || rawPath.startsWith('/settings')) {
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


export function getDateGroupLabel(timestamp) {
  if (!timestamp) return 'Earlier'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return 'Earlier'

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const targetDate = new Date(date)
  targetDate.setHours(0, 0, 0, 0)

  if (targetDate.getTime() === today.getTime()) {
    return 'Today'
  }
  if (targetDate.getTime() === yesterday.getTime()) {
    return 'Yesterday'
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function groupActivitiesByDate(items = []) {
  const groups = []
  let currentGroup = null

  for (const item of items) {
    const groupLabel = getDateGroupLabel(item.timestamp)
    if (!currentGroup || currentGroup.label !== groupLabel) {
      currentGroup = {
        label: groupLabel,
        items: [item],
      }
      groups.push(currentGroup)
    } else {
      currentGroup.items.push(item)
    }
  }

  return groups
}

export function formatHumanReadableActivity(item = {}) {
  const actionType = String(item.actionType || '')
  const entityType = String(item.entityType || '')
  const rawDesc = String(item.description || '').trim()
  const label = String(item.entityLabel || '').trim()
  const projectInfo = item.projectName
    ? `${item.projectCode ? item.projectCode + ' • ' : ''}${item.projectName}`
    : item.projectCode || ''

  let title = 'Activity Recorded'
  let description = rawDesc
  let iconCategory = 'general'
  let tone = 'neutral'

  // Determine icon category and base tone
  if (entityType === 'project' || actionType.startsWith('project.')) {
    iconCategory = 'project'
    tone = 'info'
  } else if (entityType === 'purchase' || actionType.startsWith('purchase.')) {
    iconCategory = 'purchase'
    tone = 'success'
  } else if (entityType === 'expense' || actionType.startsWith('expense.')) {
    iconCategory = 'expense'
    tone = 'warning'
  } else if (
    entityType === 'material' ||
    entityType === 'raw_material' ||
    actionType.startsWith('material.')
  ) {
    iconCategory = 'material'
    tone = 'accent'
  } else if (entityType === 'user' || actionType.startsWith('user.')) {
    iconCategory = 'user'
    tone = 'info'
  } else if (entityType === 'permission' || actionType.startsWith('permissions.')) {
    iconCategory = 'permission'
    tone = 'accent'
  } else if (entityType === 'settings' || actionType.startsWith('settings.')) {
    iconCategory = 'settings'
    tone = 'neutral'
  }

  // Adjust tone for destructive or special actions
  if (
    actionType.endsWith('.cancelled') ||
    actionType.endsWith('.deleted') ||
    actionType.endsWith('.rejected')
  ) {
    tone = 'danger'
  } else if (actionType.endsWith('.approved')) {
    tone = 'success'
  }

  // Action Titles and Humanized Descriptions
  switch (actionType) {
    case 'project.created':
      title = 'Project Created'
      description = label ? `Created project: ${label}` : rawDesc
      break
    case 'project.updated':
      title = 'Project Details Updated'
      description = label ? `Updated project details: ${label}` : rawDesc
      break
    case 'project.status_changed':
      title = 'Project Status Changed'
      description = rawDesc
      break
    case 'project.deleted':
      title = 'Project Deleted'
      description = label ? `Deleted project: ${label}` : rawDesc
      break
    case 'purchase.created':
      title = 'Purchase Voucher Added'
      description = label ? `Added purchase voucher ${label}` : rawDesc
      break
    case 'purchase.updated':
      title = 'Purchase Voucher Updated'
      description = label ? `Updated purchase voucher ${label}` : rawDesc
      break
    case 'purchase.attachment_added':
      title = 'Supplier Bill Attached'
      description = label ? `Attached supplier invoice to ${label}` : rawDesc
      break
    case 'purchase.cancelled':
      title = 'Purchase Voucher Cancelled'
      description = label ? `Voided purchase voucher ${label}` : rawDesc
      break
    case 'expense.created':
      title = 'Expense Voucher Added'
      description = label ? `Added expense ${label}` : rawDesc
      break
    case 'expense.updated':
      title = 'Expense Updated'
      description = label ? `Updated expense ${label}` : rawDesc
      break
    case 'expense.cancelled':
      title = 'Expense Cancelled'
      description = label ? `Voided expense ${label}` : rawDesc
      break
    case 'expense.category_created':
      title = 'Expense Category Created'
      description = label ? `Added expense category: ${label}` : rawDesc
      break
    case 'expense.category_updated':
      title = 'Expense Category Updated'
      description = label ? `Updated expense category: ${label}` : rawDesc
      break
    case 'material.created':
      title = 'Material Added'
      description = label ? `Added material: ${label}` : rawDesc
      break
    case 'material.updated':
      title = 'Material Updated'
      description = label ? `Updated material details: ${label}` : rawDesc
      break
    case 'material.status_changed':
      title = 'Material Status Updated'
      description = rawDesc
      break
    case 'material.stock_adjusted':
      title = 'Stock Quantity Adjusted'
      description = label ? `Updated stock quantity: ${label}` : rawDesc
      break
    case 'user.registered':
      title = 'Employee Registration Submitted'
      description = label ? `Submitted registration for ${label}` : rawDesc
      break
    case 'user.created':
      title = 'Employee Account Created'
      description = label ? `Created employee account: ${label}` : rawDesc
      break
    case 'user.updated':
      title = 'Employee Account Updated'
      description = label ? `Updated employee details: ${label}` : rawDesc
      break
    case 'user.status_changed':
      title = 'Employee Status Changed'
      description = rawDesc
      break
    case 'user.approved':
      title = 'Employee Account Approved'
      description = label ? `Approved employee account: ${label}` : rawDesc
      break
    case 'user.rejected':
      title = 'Employee Registration Rejected'
      description = label ? `Rejected employee signup: ${label}` : rawDesc
      break
    case 'permissions.updated':
      title = 'Default Employee Access Updated'
      description = rawDesc.includes('role baseline')
        ? 'Updated default employee access'
        : rawDesc
      break
    case 'permissions.reset':
      title = 'Default Employee Access Restored'
      description = 'Restored default employee access to recommended baseline'
      break
    case 'permissions.user_overridden':
      title = 'Employee Access Customized'
      description = label ? `Updated access for ${label}` : rawDesc
      break
    case 'settings.updated':
      title = 'Workspace Settings Updated'
      description = 'Updated application workspace settings'
      break
    default:
      if (rawDesc.includes('role baseline')) {
        title = 'Default Employee Access Updated'
        description = 'Updated default employee access'
      } else {
        title = label || 'Activity Event'
        description = rawDesc
      }
      break
  }

  // Fallback cleanup if description still contains technical "Data Entry Operator role baseline"
  if (description.includes('Data Entry Operator role baseline')) {
    description = description.replace(
      /Updated Data Entry Operator role baseline/gi,
      'Updated default employee access',
    )
  }

  // Secondary text (related project or entity identifier)
  let secondaryText = ''
  if (projectInfo) {
    secondaryText = projectInfo
  } else if (label && !description.includes(label)) {
    secondaryText = label
  }

  return {
    title,
    description,
    secondaryText,
    moduleBadge: getEntityBadgeLabel(entityType),
    iconCategory,
    tone,
  }
}
