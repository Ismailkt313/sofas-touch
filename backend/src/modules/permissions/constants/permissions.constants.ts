export const PERMISSION_KEYS = [
  'dashboard.view',
  'projects.view',
  'projects.create',
  'projects.edit',
  'projects.delete',
  'purchases.view',
  'purchases.create',
  'purchases.edit',
  'purchases.delete',
  'expenses.view',
  'expenses.create',
  'expenses.edit',
  'expenses.delete',
  'materials.view',
  'materials.create',
  'materials.edit',
  'materials.manageStock',
  'reports.view',
  'reports.viewProfitability',
  'users.view',
  'users.manage',
  'users.approve',
  'activity.viewOwn',
  'activity.viewAll',
  'permissions.manage',
  'settings.manage',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

const VALID_PERMISSION_SET: ReadonlySet<string> = new Set(PERMISSION_KEYS);

export function isValidPermissionKey(value: unknown): value is PermissionKey {
  return typeof value === 'string' && VALID_PERMISSION_SET.has(value);
}

export const ADMIN_IMMUTABLE_PERMISSIONS: readonly PermissionKey[] =
  Object.freeze([...PERMISSION_KEYS]);

export const ADMIN_RESERVED_PERMISSIONS: ReadonlySet<PermissionKey> = new Set([
  'users.view',
  'users.manage',
  'users.approve',
  'permissions.manage',
  'settings.manage',
]);

export const DEFAULT_DATA_ENTRY_PERMISSIONS: readonly PermissionKey[] =
  Object.freeze([
    'dashboard.view',
    'projects.view',
    'purchases.view',
    'purchases.create',
    'purchases.edit',
    'expenses.view',
    'expenses.create',
    'materials.view',
    'activity.viewOwn',
  ]);

export const PERMISSION_DEPENDENCIES: Readonly<
   Partial<Record<PermissionKey, readonly PermissionKey[]>>
> = Object.freeze({
  'projects.create': ['projects.view'],
  'projects.edit': ['projects.view'],
  'projects.delete': ['projects.view'],
  'purchases.create': ['purchases.view'],
  'purchases.edit': ['purchases.view'],
  'purchases.delete': ['purchases.view'],
  'expenses.create': ['expenses.view'],
  'expenses.edit': ['expenses.view'],
  'expenses.delete': ['expenses.view'],
  'materials.create': ['materials.view'],
  'materials.edit': ['materials.view'],
  'materials.manageStock': ['materials.view'],
  'reports.view': ['projects.view'],
  'reports.viewProfitability': ['reports.view', 'projects.view'],
  'users.manage': ['users.view'],
  'users.approve': ['users.view'],
  'activity.viewAll': ['activity.viewOwn'],
});

export interface PermissionDefinitionMeta {
  key: PermissionKey;
  label: string;
  description: string;
  category: 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'special';
  requires?: readonly PermissionKey[];
  adminOnly?: boolean;
}

export interface PermissionModuleGroupMeta {
  moduleId: string;
  moduleLabel: string;
  description: string;
  navPath: string | null;
  permissions: readonly PermissionDefinitionMeta[];
}

export const PERMISSION_MATRIX_MODULES: readonly PermissionModuleGroupMeta[] =
  Object.freeze([
    {
      moduleId: 'dashboard',
      moduleLabel: 'Dashboard',
      description:
        'Operational workspace home, daily task shortcuts, and validation prompts.',
      navPath: '/dashboard',
      permissions: [
        {
          key: 'dashboard.view',
          label: 'View Dashboard',
          description: 'Access the workspace dashboard home screen.',
          category: 'view',
        },
      ],
    },
    {
      moduleId: 'projects',
      moduleLabel: 'Projects',
      description:
        'Client sofa and curtain manufacturing projects and workflow status.',
      navPath: '/projects',
      permissions: [
        {
          key: 'projects.view',
          label: 'View Projects',
          description:
            'Browse permitted projects and link them to vouchers without exposing contract profitability.',
          category: 'view',
        },
        {
          key: 'projects.create',
          label: 'Create Projects',
          description: 'Register new manufacturing projects.',
          category: 'create',
          requires: ['projects.view'],
        },
        {
          key: 'projects.edit',
          label: 'Edit Projects & Status',
          description: 'Modify project details and advance project status.',
          category: 'edit',
          requires: ['projects.view'],
        },
        {
          key: 'projects.delete',
          label: 'Delete Projects',
          description: 'Remove projects that have no linked active vouchers.',
          category: 'delete',
          requires: ['projects.view'],
        },
      ],
    },
    {
      moduleId: 'purchases',
      moduleLabel: 'Purchase Vouchers',
      description: 'Supplier material procurement vouchers and bill uploads.',
      navPath: '/purchases',
      permissions: [
        {
          key: 'purchases.view',
          label: 'View Purchases',
          description: 'View purchase vouchers and attached supplier bills.',
          category: 'view',
        },
        {
          key: 'purchases.create',
          label: 'Create Purchases',
          description: 'Record new supplier purchase vouchers.',
          category: 'create',
          requires: ['purchases.view'],
        },
        {
          key: 'purchases.edit',
          label: 'Edit Purchases',
          description: 'Update saved purchase vouchers and upload bills.',
          category: 'edit',
          requires: ['purchases.view'],
        },
        {
          key: 'purchases.delete',
          label: 'Cancel Purchases',
          description: 'Void purchase vouchers and reverse stock sync.',
          category: 'delete',
          requires: ['purchases.view'],
        },
      ],
    },
    {
      moduleId: 'expenses',
      moduleLabel: 'Expenses',
      description: 'Daily workshop, transport, labour, and project expenses.',
      navPath: '/expenses',
      permissions: [
        {
          key: 'expenses.view',
          label: 'View Expenses',
          description: 'View expense vouchers, categories, and receipts.',
          category: 'view',
        },
        {
          key: 'expenses.create',
          label: 'Create Expenses',
          description: 'Record new operational and project expenses.',
          category: 'create',
          requires: ['expenses.view'],
        },
        {
          key: 'expenses.edit',
          label: 'Edit Expenses & Categories',
          description: 'Modify saved expenses and manage expense categories.',
          category: 'edit',
          requires: ['expenses.view'],
        },
        {
          key: 'expenses.delete',
          label: 'Cancel Expenses',
          description: 'Void recorded expense vouchers.',
          category: 'delete',
          requires: ['expenses.view'],
        },
      ],
    },
    {
      moduleId: 'materials',
      moduleLabel: 'Raw Materials & Stock',
      description: 'Upholstery fabrics, foam, timber catalog, and stock levels.',
      navPath: '/raw-materials',
      permissions: [
        {
          key: 'materials.view',
          label: 'View Materials',
          description: 'Lookup active raw materials and current stock on hand.',
          category: 'view',
        },
        {
          key: 'materials.create',
          label: 'Create Materials',
          description: 'Register new raw materials directly in catalog.',
          category: 'create',
          requires: ['materials.view'],
        },
        {
          key: 'materials.edit',
          label: 'Edit Materials',
          description:
            'Update material details, minimum stock thresholds, and active status.',
          category: 'edit',
          requires: ['materials.view'],
        },
        {
          key: 'materials.manageStock',
          label: 'Manage Stock Adjustments',
          description: 'Perform manual physical inventory adjustments.',
          category: 'special',
          requires: ['materials.view'],
        },
      ],
    },
    {
      moduleId: 'reports',
      moduleLabel: 'Reports & Profitability',
      description:
        'Confidential contract values, profit margins, and financial reports.',
      navPath: '/reports',
      permissions: [
        {
          key: 'reports.view',
          label: 'View Reports Module',
          description:
            'Open the Project Reports page and export CSV/PDF financial statements.',
          category: 'view',
          requires: ['projects.view'],
        },
        {
          key: 'reports.viewProfitability',
          label: 'View Contract & Profitability Figures',
          description:
            'Access confidential contract values, company-wide profit KPIs, and project margins.',
          category: 'special',
          requires: ['reports.view', 'projects.view'],
        },
      ],
    },
    {
      moduleId: 'activity',
      moduleLabel: 'Activity History',
      description: 'Operational activity logs and audit trail visibility.',
      navPath: '/activity',
      permissions: [
        {
          key: 'activity.viewOwn',
          label: 'View Own Activity',
          description:
            'View recent and historical actions performed by the signed-in user.',
          category: 'view',
        },
        {
          key: 'activity.viewAll',
          label: 'View Platform-Wide Audit Log',
          description: 'Inspect operational actions across all workspace users.',
          category: 'special',
        },
      ],
    },
    {
      moduleId: 'users',
      moduleLabel: 'User Management & Approvals',
      description: 'Administrative user directory, roles, and signup approvals.',
      navPath: '/users',
      permissions: [
        {
          key: 'users.view',
          label: 'View Users',
          description: 'View user accounts and access status.',
          category: 'view',
          adminOnly: true,
        },
        {
          key: 'users.manage',
          label: 'Manage Users',
          description: 'Create, update, and activate/deactivate user accounts.',
          category: 'edit',
          requires: ['users.view'],
          adminOnly: true,
        },
        {
          key: 'users.approve',
          label: 'Approve User Requests',
          description: 'Approve or reject pending Data Entry signup requests.',
          category: 'approve',
          adminOnly: true,
        },
      ],
    },
    {
      moduleId: 'administration',
      moduleLabel: 'Permissions & System Settings',
      description:
        'Role permission configuration and global application settings.',
      navPath: '/permissions',
      permissions: [
        {
          key: 'permissions.manage',
          label: 'Manage Role & Permissions',
          description: 'Configure role baselines and per-operator overrides.',
          category: 'special',
          adminOnly: true,
        },
        {
          key: 'settings.manage',
          label: 'Manage Application Settings',
          description: 'Update workspace preferences and alert thresholds.',
          category: 'special',
          adminOnly: true,
        },
      ],
    },
  ]);

export function sanitizeConfigurablePermissions(
  rawPermissions: readonly string[],
): PermissionKey[] {
  const active = new Set<PermissionKey>();

  for (const key of rawPermissions) {
    if (isValidPermissionKey(key) && !ADMIN_RESERVED_PERMISSIONS.has(key)) {
      active.add(key);
    }
  }

  if (active.has('activity.viewAll')) {
    active.add('activity.viewOwn');
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const key of Array.from(active)) {
      const deps = PERMISSION_DEPENDENCIES[key];
      if (deps && deps.some((dep) => !active.has(dep))) {
        active.delete(key);
        changed = true;
      }
    }
  }

  return PERMISSION_KEYS.filter((k) => active.has(k));
}

export interface UserPermissionOverrides {
  grant: PermissionKey[];
  revoke: PermissionKey[];
}

export function computeEffectivePermissions(params: {
  role: 'admin' | 'data_entry';
  rolePermissions?: readonly string[];
  overrides?: {
    grant?: readonly string[];
    revoke?: readonly string[];
  } | null;
}): PermissionKey[] {
  if (params.role === 'admin') {
    return [...ADMIN_IMMUTABLE_PERMISSIONS];
  }

  const baseList = params.rolePermissions ?? DEFAULT_DATA_ENTRY_PERMISSIONS;
  const working = new Set<string>(baseList);

  if (params.overrides?.grant) {
    for (const g of params.overrides.grant) {
      if (isValidPermissionKey(g) && !ADMIN_RESERVED_PERMISSIONS.has(g)) {
        working.add(g);
      }
    }
  }

  const revokedSet = new Set<PermissionKey>();
  if (params.overrides?.revoke) {
    for (const r of params.overrides.revoke) {
      if (isValidPermissionKey(r)) {
        revokedSet.add(r);
        working.delete(r);
      }
    }
  }

  if (working.has('activity.viewAll') && !revokedSet.has('activity.viewOwn')) {
    working.add('activity.viewOwn');
  }

  return sanitizeConfigurablePermissions(Array.from(working));
}

export function isProjectAccessibleToCaller(
  assignedProjectIds: readonly string[] | null | undefined,
  projectRecordId?: string | null,
  projectCode?: string | null,
): boolean {
  if (!Array.isArray(assignedProjectIds)) {
    return true;
  }

  if (assignedProjectIds.length === 0) {
    return false;
  }

  const normalizedAllowed = new Set(
    assignedProjectIds.map((v) => String(v || '').trim().toUpperCase()).filter(Boolean),
  );

  if (
    projectRecordId &&
    normalizedAllowed.has(String(projectRecordId).trim().toUpperCase())
  ) {
    return true;
  }

  if (
    projectCode &&
    normalizedAllowed.has(String(projectCode).trim().toUpperCase())
  ) {
    return true;
  }

  return false;
}
