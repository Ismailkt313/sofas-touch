import { Router } from 'express';
import {
  requireAnyPermission,
  verifyToken,
} from '../../middleware/auth';
import { ActivityController } from './controller/activity.controller';
import { ActivityRepository } from './repository/activity.repository';
import { ActivityService } from './service/activity.service';

export const activityRepository = new ActivityRepository();
export const activityService = new ActivityService(activityRepository);
export const activityController = new ActivityController(activityService);

const activityRouter = Router();

activityRouter.use(verifyToken);
activityRouter.get(
  '/recent',
  requireAnyPermission(['activity.viewAll', 'activity.viewOwn']),
  activityController.listRecent,
);
activityRouter.get(
  '/',
  requireAnyPermission(['activity.viewAll', 'activity.viewOwn']),
  activityController.listPaginated,
);

export { ActivityController, ActivityRepository, ActivityService };
export * from './models/activity.model';
export * from './dto/activity.dto';
export * from './types';

export default activityRouter;
