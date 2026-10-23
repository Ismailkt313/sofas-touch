import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyToken } from '../../middleware/auth';
import { UserModel } from './models/user.model';
import { AuthController, IAuthController } from './controller/auth.controller';
import { LoginDto, validateLoginDto } from './dto/login.dto';
import { AuthRepository, IAuthRepository } from './repository/auth.repository';
import {
  AuthService,
  IAuthService,
  InactiveAccountError,
  InvalidCredentialsError,
} from './service/auth.service';

const authRepository: IAuthRepository = new AuthRepository(UserModel);
const authService: IAuthService = new AuthService(authRepository);
const authController: IAuthController = new AuthController(authService);

const authRouter = Router();

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Too many sign-in attempts. Please wait 15 minutes before trying again.',
  },
});

authRouter.post('/login', loginRateLimiter, authController.login);
authRouter.get('/me', verifyToken, authController.me);

export {
  authRouter,
  authController,
  authService,
  authRepository,
  AuthController,
  AuthService,
  AuthRepository,
  LoginDto,
  validateLoginDto,
  InvalidCredentialsError,
  InactiveAccountError,
};

export default authRouter;
