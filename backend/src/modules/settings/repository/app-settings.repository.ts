import mongoose, { Model } from 'mongoose';
import { env } from '../../../config/env';
import { UpdateAppSettingsDto } from '../dto/app-settings.dto';
import {
  AppSettingsModel,
  IAppSettings,
  sharedAppSettingsMemoryStore,
} from '../models/app-settings.model';

function createDefaultSettings(): IAppSettings {
  const now = new Date();
  return {
    _id: 'settings_workspace',
    singletonKey: 'workspace',
    companyName: 'Soft Touch Sofas',
    workshopLocation: 'Kochi Manufacturing & Upholstery Atelier',
    supportEmail: env.DEFAULT_ADMIN.email,
    currencyCode: 'INR',
    defaultCostWarningPercent: env.PROJECT_COST_WARNING_THRESHOLD_PERCENT,
    defaultCostCriticalPercent: env.PROJECT_COST_CRITICAL_THRESHOLD_PERCENT,
    projectInactivityThresholdDays: env.PROJECT_INACTIVITY_THRESHOLD_DAYS,
    operatorGuidanceBanner:
      'Attach supplier invoices on purchase vouchers and link expenses to the active project code whenever applicable.',
    updatedBy: null,
    updatedByName: null,
    createdAt: now,
    updatedAt: now,
  };
}

export class AppSettingsRepository {
  constructor(
    private readonly model: Model<IAppSettings> = AppSettingsModel,
    private readonly memoryStore: Map<
      string,
      IAppSettings
    > = sharedAppSettingsMemoryStore,
  ) {}

  private isDbConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }

  async getSettings(): Promise<IAppSettings> {
    if (this.isDbConnected()) {
      const existing = await this.model
        .findOne({ singletonKey: 'workspace' })
        .lean()
        .exec();

      if (existing) {
        return existing as unknown as IAppSettings;
      }

      const defaults = createDefaultSettings();
      delete defaults._id;
      const created = await this.model.create(defaults);
      return created.toObject() as unknown as IAppSettings;
    }

    const mem = this.memoryStore.get('workspace');
    if (mem) {
      return { ...mem };
    }
    const seeded = createDefaultSettings();
    this.memoryStore.set('workspace', seeded);
    return { ...seeded };
  }

  async updateSettings(
    dto: UpdateAppSettingsDto,
    actor: { id: string; name: string },
  ): Promise<IAppSettings> {
    const current = await this.getSettings();
    const mergedWarning =
      dto.defaultCostWarningPercent ?? current.defaultCostWarningPercent;
    const mergedCritical =
      dto.defaultCostCriticalPercent ?? current.defaultCostCriticalPercent;

    if (mergedWarning >= mergedCritical) {
      throw new Error(
        'Warning threshold must be lower than the critical overrun threshold.',
      );
    }

    const now = new Date();

    if (this.isDbConnected()) {
      const updated = await this.model
        .findOneAndUpdate(
          { singletonKey: 'workspace' },
          {
            $set: {
              ...dto,
              updatedBy: actor.id,
              updatedByName: actor.name,
              updatedAt: now,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        )
        .lean()
        .exec();

      return updated as unknown as IAppSettings;
    }

    const nextSettings: IAppSettings = {
      ...current,
      ...dto,
      updatedBy: actor.id,
      updatedByName: actor.name,
      updatedAt: now,
    };
    this.memoryStore.set('workspace', nextSettings);
    return { ...nextSettings };
  }
}
