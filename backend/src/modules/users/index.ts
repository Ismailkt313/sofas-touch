import { Router } from 'express';
import { requireAdmin, verifyToken } from '../../middleware/auth';
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

const userRouter = Router();

userRouter.use(verifyToken);
userRouter.use(requireAdmin);

userRouter.get('/pending-approvals', userController.listPendingApprovals);
userRouter.get('/', userController.list);
userRouter.get('/:id', userController.getById);
userRouter.post('/', userController.create);
userRouter.patch('/:id/approve', userController.approveUser);
userRouter.patch('/:id/reject', userController.rejectUser);
userRouter.patch('/:id/status', userController.updateStatus);
userRouter.patch('/:id', userController.update);

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
