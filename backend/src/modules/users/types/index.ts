import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, UserResponse } from '../../../types/auth';
import { IUser } from '../../auth/models/user.model';
import { CreateUserDto } from '../dto/create-user.dto';
import { ListPendingApprovalsDto } from '../dto/list-pending-approvals.dto';
import { ListUsersDto } from '../dto/list-users.dto';
import { UpdateUserDto } from '../dto/update-user.dto';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IUserController {
  list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  listPendingApprovals(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void>;
  getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  approveUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  rejectUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  uploadAvatar(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}

export interface IUserService {
  listUsers(
    filters: ListUsersDto,
  ): Promise<{
    users: UserResponse[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>;
  listPendingApprovals(
    filters: ListPendingApprovalsDto,
  ): Promise<{
    users: UserResponse[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>;
  getUserById(id: string): Promise<UserResponse>;
  createUser(dto: CreateUserDto, currentAdminId?: string): Promise<UserResponse>;
  updateUser(
    id: string,
    dto: UpdateUserDto,
    currentAdminId: string,
  ): Promise<UserResponse>;
  updateUserStatus(
    id: string,
    isActive: boolean,
    currentAdminId: string,
  ): Promise<UserResponse>;
  approveUser(id: string, currentAdminId: string): Promise<UserResponse>;
  rejectUser(
    id: string,
    currentAdminId: string,
    reason?: string,
  ): Promise<UserResponse>;
  hashPassword(plainPassword: string): string;
}

export interface IUserRepository {
  findUsers(filters: ListUsersDto): Promise<PaginatedResult<IUser>>;
  findPendingApprovals(
    filters: ListPendingApprovalsDto,
  ): Promise<PaginatedResult<IUser>>;
  findById(id: string): Promise<IUser | null>;
  findByEmail(email: string, includePassword?: boolean): Promise<IUser | null>;
  create(userData: Partial<IUser>): Promise<IUser>;
  update(id: string, updateData: Partial<IUser>): Promise<IUser | null>;
  updateStatus(id: string, isActive: boolean): Promise<IUser | null>;
  approveUser(id: string, adminId: string): Promise<IUser | null>;
  rejectUser(id: string, adminId: string, reason?: string): Promise<IUser | null>;
  count(): Promise<number>;
}
