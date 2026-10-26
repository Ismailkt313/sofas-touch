import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyToken } from '../../middleware/auth';
import { UserModel } from './models/user.model';
import { AuthController, IAuthController } from './controller/auth.controller';
import { LoginDto, validateLoginDto } from './dto/login.dto';
import { SignupDto, validateSignupDto } from './dto/signup.dto';
import { AuthRepository, IAuthRepository } from './repository/auth.repository';
import {
  AuthService,
  IAuthService,
  InactiveAccountError,
  InvalidCredentialsError,
  PendingApprovalError,
  RejectedAccountError,
  UserAlreadyExistsError,
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

const signupRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Too many account registration attempts. Please wait 15 minutes before trying again.',
  },
});

authRouter.post('/login', loginRateLimiter, authController.login);
authRouter.post('/signup', signupRateLimiter, authController.signup);
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
  SignupDto,
  validateSignupDto,
  InvalidCredentialsError,
  InactiveAccountError,
  PendingApprovalError,
  RejectedAccountError,
  UserAlreadyExistsError,
};

export default authRouter;
