import { Router } from 'express';
import {
  requireDataEntryOrAdmin,
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
  requireDataEntryOrAdmin,
  activityController.listRecent,
);
activityRouter.get(
  '/',
  requireDataEntryOrAdmin,
  activityController.listPaginated,
);

export { ActivityController, ActivityRepository, ActivityService };
export * from './models/activity.model';
export * from './dto/activity.dto';
export * from './types';

export default activityRouter;
