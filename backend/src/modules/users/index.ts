import { Router } from 'express';
import multer from 'multer';
import { requirePermission, verifyToken } from '../../middleware/auth';
import { UserModel } from '../auth/models/user.model';
import { UserRepository, IUserRepository } from './repository/user.repository';
import {
  UserService,
  IUserService,
  UserNotFoundError,
  UserAlreadyExistsError,
  SelfDeactivationError,
  SelfApprovalError,
  InvalidOperationError,
} from './service/user.service';
import { UserController, IUserController } from './controller/user.controller';
import { ListUsersDto, validateListUsersDto } from './dto/list-users.dto';
import {
  ListPendingApprovalsDto,
  validateListPendingApprovalsDto,
} from './dto/list-pending-approvals.dto';
import { RejectUserDto, validateRejectUserDto } from './dto/reject-user.dto';
import { CreateUserDto, validateCreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, validateUpdateUserDto } from './dto/update-user.dto';
import { UpdateStatusDto, validateUpdateStatusDto } from './dto/update-status.dto';

const userRepository: IUserRepository = new UserRepository(UserModel);
const userService: IUserService = new UserService(userRepository);
const userController: IUserController = new UserController(userService);

const uploadAvatarMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('avatar');

const userRouter = Router();

userRouter.use(verifyToken);

userRouter.get(
  '/pending-approvals',
  requirePermission('users.approve'),
  userController.listPendingApprovals,
);
userRouter.get('/', requirePermission('users.view'), userController.list);
userRouter.get('/:id', requirePermission('users.view'), userController.getById);
userRouter.post('/', requirePermission('users.manage'), userController.create);
userRouter.patch(
  '/:id/approve',
  requirePermission('users.approve'),
  userController.approveUser,
);
userRouter.patch(
  '/:id/reject',
  requirePermission('users.approve'),
  userController.rejectUser,
);
userRouter.patch(
  '/:id/status',
  requirePermission('users.manage'),
  userController.updateStatus,
);
userRouter.patch(
  '/:id',
  requirePermission('users.manage'),
  userController.update,
);
userRouter.post(
  '/:id/avatar',
  uploadAvatarMiddleware,
  userController.uploadAvatar,
);

export {
  userRouter,
  userController,
  userService,
  userRepository,
  UserController,
  UserService,
  UserRepository,
  ListUsersDto,
  validateListUsersDto,
  ListPendingApprovalsDto,
  validateListPendingApprovalsDto,
  RejectUserDto,
  validateRejectUserDto,
  CreateUserDto,
  validateCreateUserDto,
  UpdateUserDto,
  validateUpdateUserDto,
  UpdateStatusDto,
  validateUpdateStatusDto,
  UserNotFoundError,
  UserAlreadyExistsError,
  SelfDeactivationError,
  SelfApprovalError,
  InvalidOperationError,
};

export * from './types';

export default userRouter;
