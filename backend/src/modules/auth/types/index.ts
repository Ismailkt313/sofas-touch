import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest, UserResponse } from '../../../types/auth';
import { LoginDto } from '../dto/login.dto';
import { SignupDto } from '../dto/signup.dto';
import { IUser } from '../models/user.model';

export interface IAuthController {
  login(req: Request, res: Response, next: NextFunction): Promise<void>;
  signup(req: Request, res: Response, next: NextFunction): Promise<void>;
  me(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  updateProfile?(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void>;
}

export interface IAuthService {
  login(
    dto: LoginDto,
  ): Promise<{ authenticated: boolean; token: string; user: UserResponse }>;
  signup(dto: SignupDto): Promise<{ user: UserResponse }>;
  getCurrentUser(userId: string): Promise<UserResponse>;
  hashPassword(plainPassword: string): string;
}

export interface IAuthRepository {
  findByEmail(email: string, includePassword?: boolean): Promise<IUser | null>;
  findById(id: string): Promise<IUser | null>;
  create(userData: Partial<IUser>): Promise<IUser>;
  count(): Promise<number>;
}
