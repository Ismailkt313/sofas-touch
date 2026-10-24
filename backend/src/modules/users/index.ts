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
  InvalidOperationError,
} from './service/user.service';
import { UserController, IUserController } from './controller/user.controller';
import { ListUsersDto, validateListUsersDto } from './dto/list-users.dto';
import { CreateUserDto, validateCreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, validateUpdateUserDto } from './dto/update-user.dto';
import { UpdateStatusDto, validateUpdateStatusDto } from './dto/update-status.dto';

const userRepository: IUserRepository = new UserRepository(UserModel);
const userService: IUserService = new UserService(userRepository);
const userController: IUserController = new UserController(userService);

const userRouter = Router();

// Protect every endpoint with authentication and Admin-only authorization
userRouter.use(verifyToken);
userRouter.use(requireAdmin);

userRouter.get('/', userController.list);
userRouter.get('/:id', userController.getById);
userRouter.post('/', userController.create);
userRouter.patch('/:id', userController.update);
userRouter.patch('/:id/status', userController.updateStatus);

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
  CreateUserDto,
  validateCreateUserDto,
  UpdateUserDto,
  validateUpdateUserDto,
  UpdateStatusDto,
  validateUpdateStatusDto,
  UserNotFoundError,
  UserAlreadyExistsError,
  SelfDeactivationError,
  InvalidOperationError,
};

export default userRouter;
