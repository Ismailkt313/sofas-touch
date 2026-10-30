import {
  ADMIN_RESERVED_PERMISSIONS,
  isValidPermissionKey,
  PERMISSION_DEPENDENCIES,
  PermissionKey,
  sanitizeConfigurablePermissions,
} from '../constants/permissions.constants';

export interface ValidationResult<T> {
  isValid: boolean;
  value?: T;
  errors?: Record<string, string>;
}

export interface UpdateRolePermissionsDto {
  permissions: PermissionKey[];
}

export interface UpdateUserPermissionOverridesDto {
  grant: PermissionKey[];
  revoke: PermissionKey[];
  assignedProjectIds: string[] | null;
}

export function validateUpdateRolePermissionsDto(
  input: unknown,
): ValidationResult<UpdateRolePermissionsDto> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      isValid: false,
      errors: { body: 'Request body must be a JSON object.' },
    };
  }

  const raw = input as Record<string, unknown>;
  if (!Array.isArray(raw.permissions)) {
    return {
      isValid: false,
      errors: { permissions: 'permissions must be an array of permission keys.' },
    };
  }

  const errors: Record<string, string> = {};
  const candidateKeys: PermissionKey[] = [];

  for (const item of raw.permissions) {
    if (!isValidPermissionKey(item)) {
      errors.permissions = `Unknown permission key '${String(item)}'.`;
      break;
    }
    if (ADMIN_RESERVED_PERMISSIONS.has(item)) {
      errors.permissions = `Permission '${item}' is reserved strictly for Administrators and cannot be assigned to Data Entry.`;
      break;
    }
    candidateKeys.push(item);
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  const candidateSet = new Set<PermissionKey>(candidateKeys);
  for (const key of candidateSet) {
    const deps = PERMISSION_DEPENDENCIES[key];
    if (deps) {
      for (const reqDep of deps) {
        if (!candidateSet.has(reqDep)) {
          return {
            isValid: false,
            errors: {
              permissions: `Permission '${key}' requires '${reqDep}' to be enabled.`,
            },
          };
        }
      }
    }
  }

  return {
    isValid: true,
    value: {
      permissions: sanitizeConfigurablePermissions(candidateKeys),
    },
  };
}

export function validateUpdateUserPermissionOverridesDto(
  input: unknown,
): ValidationResult<UpdateUserPermissionOverridesDto> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      isValid: false,
      errors: { body: 'Request body must be a JSON object.' },
    };
  }

  const raw = input as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const grantList: PermissionKey[] = [];
  if (raw.grant !== undefined) {
    if (!Array.isArray(raw.grant)) {
      errors.grant = 'grant must be an array of permission keys.';
    } else {
      for (const item of raw.grant) {
        if (!isValidPermissionKey(item)) {
          errors.grant = `Unknown permission key '${String(item)}' in grant.`;
          break;
        }
        if (ADMIN_RESERVED_PERMISSIONS.has(item)) {
          errors.grant = `Administrative permission '${item}' cannot be granted to a Data Entry account.`;
          break;
        }
        grantList.push(item);
      }
    }
  }

  const revokeList: PermissionKey[] = [];
  if (raw.revoke !== undefined) {
    if (!Array.isArray(raw.revoke)) {
      errors.revoke = 'revoke must be an array of permission keys.';
    } else {
      for (const item of raw.revoke) {
        if (!isValidPermissionKey(item)) {
          errors.revoke = `Unknown permission key '${String(item)}' in revoke.`;
          break;
        }
        revokeList.push(item);
      }
    }
  }

  let assignedProjectIds: string[] | null = null;
  if (raw.assignedProjectIds !== undefined && raw.assignedProjectIds !== null) {
    if (!Array.isArray(raw.assignedProjectIds)) {
      errors.assignedProjectIds =
        'assignedProjectIds must be null (all projects) or an array of project codes/IDs.';
    } else {
      const cleaned = Array.from(
        new Set(
          raw.assignedProjectIds
            .filter((v): v is string => typeof v === 'string')
            .map((v) => v.trim())
            .filter(Boolean),
        ),
      ).slice(0, 200);
      assignedProjectIds = cleaned;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  const revokeSet = new Set(revokeList);
  const dedupedGrant = Array.from(new Set(grantList)).filter(
    (k) => !revokeSet.has(k),
  );

  return {
    isValid: true,
    value: {
      grant: dedupedGrant,
      revoke: Array.from(revokeSet),
      assignedProjectIds,
    },
  };
}
