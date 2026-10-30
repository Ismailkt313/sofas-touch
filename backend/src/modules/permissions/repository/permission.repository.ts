import mongoose, { Model } from 'mongoose';
import {
  DEFAULT_DATA_ENTRY_PERMISSIONS,
  PermissionKey,
  sanitizeConfigurablePermissions,
} from '../constants/permissions.constants';
import {
  IRolePermissionConfig,
  RolePermissionModel,
  sharedRolePermissionMemoryStore,
} from '../models/role-permission.model';

export class PermissionRepository {
  constructor(
    private readonly model: Model<IRolePermissionConfig> = RolePermissionModel,
    private readonly memoryStore: Map<
      string,
      IRolePermissionConfig
    > = sharedRolePermissionMemoryStore,
  ) {}

  private isDbConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }

  async getDataEntryRoleConfig(): Promise<IRolePermissionConfig> {
    if (this.isDbConnected()) {
      const existing = await this.model
        .findOne({ role: 'data_entry' })
        .lean()
        .exec();

      if (existing) {
        return {
          ...existing,
          permissions: sanitizeConfigurablePermissions(
            existing.permissions || [],
          ),
        };
      }

      const created = await this.model.create({
        role: 'data_entry',
        permissions: [...DEFAULT_DATA_ENTRY_PERMISSIONS],
        version: 1,
        updatedBy: null,
        updatedByName: null,
      });

      return created.toObject() as unknown as IRolePermissionConfig;
    }

    const mem = this.memoryStore.get('data_entry');
    if (mem) {
      return {
        ...mem,
        permissions: sanitizeConfigurablePermissions(mem.permissions || []),
      };
    }

    const now = new Date();
    const initial: IRolePermissionConfig = {
      _id: 'role_perm_data_entry',
      role: 'data_entry',
      permissions: [...DEFAULT_DATA_ENTRY_PERMISSIONS],
      version: 1,
      updatedBy: null,
      updatedByName: null,
      createdAt: now,
      updatedAt: now,
    };
    this.memoryStore.set('data_entry', initial);
    return { ...initial, permissions: [...initial.permissions] };
  }

  async saveDataEntryRoleConfig(params: {
    permissions: PermissionKey[];
    updatedBy: string;
    updatedByName: string;
  }): Promise<IRolePermissionConfig> {
    const cleanPermissions = sanitizeConfigurablePermissions(params.permissions);
    const now = new Date();

    if (this.isDbConnected()) {
      const updated = await this.model
        .findOneAndUpdate(
          { role: 'data_entry' },
          {
            $set: {
              permissions: cleanPermissions,
              updatedBy: params.updatedBy,
              updatedByName: params.updatedByName,
              updatedAt: now,
            },
            $inc: { version: 1 },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        )
        .lean()
        .exec();

      return updated as unknown as IRolePermissionConfig;
    }

    const prev = await this.getDataEntryRoleConfig();
    const nextRecord: IRolePermissionConfig = {
      ...prev,
      role: 'data_entry',
      permissions: cleanPermissions,
      version: (prev.version || 0) + 1,
      updatedBy: params.updatedBy,
      updatedByName: params.updatedByName,
      updatedAt: now,
    };
    this.memoryStore.set('data_entry', nextRecord);
    return { ...nextRecord, permissions: [...nextRecord.permissions] };
  }
}
