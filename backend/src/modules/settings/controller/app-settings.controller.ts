import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../../../types/auth';
import { activityService } from '../../activity';
import { validateUpdateAppSettingsDto } from '../dto/app-settings.dto';
import { AppSettingsRepository } from '../repository/app-settings.repository';

export class AppSettingsController {
  constructor(private readonly repository: AppSettingsRepository) {}

  getSettings = async (
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const settings = await this.repository.getSettings();
      res.status(200).json({ settings });
    } catch (err) {
      next(err);
    }
  };

  updateSettings = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const validation = validateUpdateAppSettingsDto(req.body);
      if (!validation.isValid || !validation.value) {
        const firstMsg = validation.errors
          ? Object.values(validation.errors)[0]
          : 'Invalid application settings payload.';
        res.status(400).json({
          error: 'Bad Request',
          message: firstMsg,
          errors: validation.errors,
        });
        return;
      }

      const actorId = req.user?.id || 'admin';
      const actorName = req.user?.name || req.user?.email || 'Administrator';

      let settings;
      try {
        settings = await this.repository.updateSettings(validation.value, {
          id: actorId,
          name: actorName,
        });
      } catch (err) {
        if (err instanceof Error && err.message.includes('threshold')) {
          res.status(400).json({
            error: 'Bad Request',
            message: err.message,
          });
          return;
        }
        throw err;
      }

      await activityService.recordSafe({
        actionType: 'settings.updated',
        entityType: 'settings',
        entityId: 'workspace',
        entityLabel: settings.companyName,
        description: `Updated application settings for ${settings.companyName}.`,
        actorId,
        actorName,
        actorRole: 'admin',
        visibility: 'admin_only',
        targetPath: '/settings',
      });

      res.status(200).json({
        message: 'Application settings saved successfully.',
        settings,
      });
    } catch (err) {
      next(err);
    }
  };
}
