import { Router } from 'express';
import { requirePermission, verifyToken } from '../../middleware/auth';
import { AppSettingsController } from './controller/app-settings.controller';
import { AppSettingsRepository } from './repository/app-settings.repository';

export const appSettingsRepository = new AppSettingsRepository();
export const appSettingsController = new AppSettingsController(
  appSettingsRepository,
);

const settingsRouter = Router();

settingsRouter.use(verifyToken);
settingsRouter.use(requirePermission('settings.manage'));

settingsRouter.get('/', appSettingsController.getSettings);
settingsRouter.put('/', appSettingsController.updateSettings);
settingsRouter.patch('/', appSettingsController.updateSettings);

export * from './dto/app-settings.dto';
export * from './models/app-settings.model';
export * from './repository/app-settings.repository';
export { AppSettingsController };

export default settingsRouter;
