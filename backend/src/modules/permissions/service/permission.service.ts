import mongoose from 'mongoose';
import {
  IUser,
  seedSharedUserMemoryStore,
  sharedUserMemoryStore,
  UserModel,
} from '../../auth/models/user.model';
import {
  ADMIN_IMMUTABLE_PERMISSIONS,
  ADMIN_RESERVED_PERMISSIONS,
  computeEffectivePermissions,
  DEFAULT_DATA_ENTRY_PERMISSIONS,
  PERMISSION_DEPENDENCIES,
  PERMISSION_MATRIX_MODULES,
  PermissionKey,
} from '../constants/permissions.constants';
import { UpdateUserPermissionOverridesDto } from '../dto/permission.dto';
import { IRolePermissionConfig } from '../models/role-permission.model';
import { PermissionRepository } from '../repository/permission.repository';

export class PermissionTargetNotFoundError extends Error {
  constructor(message = 'Target user account was not found.') {
    super(message);
    this.name = 'PermissionTargetNotFoundError';
  }
}

export class InvalidPermissionTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPermissionTargetError';
  }
}

const CACHE_TTL_MS = 5000;

export class PermissionService {
  private cachedDataEntryConfig: {
    config: IRolePermissionConfig;
    expiresAt: number;
  } | null = null;

  constructor(
    private readonly repository: PermissionRepository = new PermissionRepository(),
  ) {}

  invalidateCache(): void {
    this.cachedDataEntryConfig = null;
  }

  async getDataEntryBaseline(): Promise<IRolePermissionConfig> {
    const now = Date.now();
    if (
      this.cachedDataEntryConfig &&
      this.cachedDataEntryConfig.expiresAt > now
    ) {
      return this.cachedDataEntryConfig.config;
    }

    const config = await this.repository.getDataEntryRoleConfig();
    this.cachedDataEntryConfig = {
      config,
      expiresAt: now + CACHE_TTL_MS,
    };
    return config;
  }

  async resolveEffectivePermissionsForUser(
    user: Pick<IUser, 'role' | 'permissionOverrides'>,
  ): Promise<PermissionKey[]> {
    const canonicalRole = (user.role || '')
      .toLowerCase()
      .replace(/\s+/g, '_') as 'admin' | 'data_entry';

    if (canonicalRole === 'admin') {
      return [...ADMIN_IMMUTABLE_PERMISSIONS];
    }

    const baseline = await this.getDataEntryBaseline();
    return computeEffectivePermissions({
      role: 'data_entry',
      rolePermissions: baseline.permissions,
      overrides: user.permissionOverrides || null,
    });
  }

  async getManagementOverview() {
    const baseline = await this.getDataEntryBaseline();

    let dataEntryUsers: IUser[] = [];
    if (mongoose.connection.readyState === 1) {
      const docs = await UserModel.find({ role: 'data_entry' })
        .sort({ createdAt: -1 })
        .lean()
        .exec();
      dataEntryUsers = docs as unknown as IUser[];
    } else {
      seedSharedUserMemoryStore();
      dataEntryUsers = Array.from(sharedUserMemoryStore.values()).filter(
        (u) => (u.role || '').toLowerCase().replace(/\s+/g, '_') === 'data_entry',
      );
    }

    const operatorSummaries = dataEntryUsers.map((u) => {
      const grant = Array.isArray(u.permissionOverrides?.grant)
        ? u.permissionOverrides!.grant
        : [];
      const revoke = Array.isArray(u.permissionOverrides?.revoke)
        ? u.permissionOverrides!.revoke
        : [];
      const assignedProjectIds = Array.isArray(u.assignedProjectIds)
        ? u.assignedProjectIds
        : null;
      const effectivePermissions = computeEffectivePermissions({
        role: 'data_entry',
        rolePermissions: baseline.permissions,
        overrides: { grant, revoke },
      });

      return {
        id: String(u._id),
        name: u.name,
        email: u.email,
        isActive: u.isActive,
        approvalStatus: u.approvalStatus || 'pending',
        permissionOverrides: { grant, revoke },
        assignedProjectIds,
        effectivePermissions,
        hasCustomOverrides:
          grant.length > 0 || revoke.length > 0 || assignedProjectIds !== null,
      };
    });

    return {
      modules: PERMISSION_MATRIX_MODULES,
      dependencies: PERMISSION_DEPENDENCIES,
      adminReservedPermissions: Array.from(ADMIN_RESERVED_PERMISSIONS),
      roles: {
        admin: {
          role: 'admin',
          immutable: true,
          permissions: [...ADMIN_IMMUTABLE_PERMISSIONS],
        },
        data_entry: {
          role: 'data_entry',
          immutable: false,
          permissions: baseline.permissions,
          defaultPermissions: [...DEFAULT_DATA_ENTRY_PERMISSIONS],
          version: baseline.version,
          updatedBy: baseline.updatedBy || null,
          updatedByName: baseline.updatedByName || null,
          updatedAt: baseline.updatedAt || null,
        },
      },
      operators: operatorSummaries,
    };
  }

  async updateDataEntryPermissions(params: {
    permissions: PermissionKey[];
    actorId: string;
    actorName: string;
  }) {
    const saved = await this.repository.saveDataEntryRoleConfig({
      permissions: params.permissions,
      updatedBy: params.actorId,
      updatedByName: params.actorName,
    });
    this.invalidateCache();
    return {
      saved,
      overview: await this.getManagementOverview(),
    };
  }

  async resetDataEntryPermissions(params: {
    actorId: string;
    actorName: string;
  }) {
    const saved = await this.repository.saveDataEntryRoleConfig({
      permissions: [...DEFAULT_DATA_ENTRY_PERMISSIONS],
      updatedBy: params.actorId,
      updatedByName: params.actorName,
    });
    this.invalidateCache();
    return {
      saved,
      overview: await this.getManagementOverview(),
    };
  }

  async updateUserOverrides(params: {
    targetUserId: string;
    dto: UpdateUserPermissionOverridesDto;
  }) {
    const cleanId = String(params.targetUserId || '').trim();
    if (!cleanId) {
      throw new PermissionTargetNotFoundError();
    }

    if (mongoose.connection.readyState === 1) {
      if (!mongoose.isValidObjectId(cleanId)) {
        throw new PermissionTargetNotFoundError();
      }
      const existing = await UserModel.findById(cleanId).lean().exec();
      if (!existing) {
        throw new PermissionTargetNotFoundError();
      }
      const role = (existing.role || '').toLowerCase().replace(/\s+/g, '_');
      if (role === 'admin') {
        throw new InvalidPermissionTargetError(
          'Administrator accounts hold full system access and cannot be restricted via operator overrides.',
        );
      }

      const updated = await UserModel.findByIdAndUpdate(
        cleanId,
        {
          $set: {
            permissionOverrides: {
              grant: params.dto.grant,
              revoke: params.dto.revoke,
            },
            assignedProjectIds: params.dto.assignedProjectIds,
            updatedAt: new Date(),
          },
        },
        { new: true },
      )
        .lean()
        .exec();

      this.invalidateCache();
      const baseline = await this.getDataEntryBaseline();
      return {
        user: updated as unknown as IUser,
        effectivePermissions: computeEffectivePermissions({
          role: 'data_entry',
          rolePermissions: baseline.permissions,
          overrides: params.dto,
        }),
      };
    }

    seedSharedUserMemoryStore();
    let foundEntryKey: string | null = null;
    let foundUser: IUser | null = null;
    for (const [k, u] of sharedUserMemoryStore.entries()) {
      if (String(u._id) === cleanId) {
        foundEntryKey = k;
        foundUser = u;
        break;
      }
    }

    if (!foundUser || !foundEntryKey) {
      throw new PermissionTargetNotFoundError();
    }

    const role = (foundUser.role || '').toLowerCase().replace(/\s+/g, '_');
    if (role === 'admin') {
      throw new InvalidPermissionTargetError(
        'Administrator accounts hold full system access and cannot be restricted via operator overrides.',
      );
    }

    const updatedUser: IUser = {
      ...foundUser,
      permissionOverrides: {
        grant: params.dto.grant,
        revoke: params.dto.revoke,
      },
      assignedProjectIds: params.dto.assignedProjectIds,
      updatedAt: new Date(),
    };
    sharedUserMemoryStore.set(foundEntryKey, updatedUser);
    this.invalidateCache();
    const baseline = await this.getDataEntryBaseline();

    return {
      user: updatedUser,
      effectivePermissions: computeEffectivePermissions({
        role: 'data_entry',
        rolePermissions: baseline.permissions,
        overrides: params.dto,
      }),
    };
  }
}

export const permissionRepository = new PermissionRepository();
export const permissionService = new PermissionService(permissionRepository);
