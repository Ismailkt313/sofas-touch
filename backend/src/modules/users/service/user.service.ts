import bcrypt from 'bcryptjs';
import { UserResponse } from '../../../types/auth';
import { IUser } from '../../auth/models/user.model';
import { ListUsersDto } from '../dto/list-users.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { IUserRepository, PaginatedResult } from '../repository/user.repository';

export class UserNotFoundError extends Error {
  constructor(message = 'User not found.') {
    super(message);
    this.name = 'UserNotFoundError';
  }
}

export class UserAlreadyExistsError extends Error {
  constructor(message = 'A user with this email address already exists.') {
    super(message);
    this.name = 'UserAlreadyExistsError';
  }
}

export class SelfDeactivationError extends Error {
  constructor(
    message = 'You cannot deactivate your own administrative account.',
  ) {
    super(message);
    this.name = 'SelfDeactivationError';
  }
}

export class InvalidOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOperationError';
  }
}

export function toUserResponse(user: IUser): UserResponse {
  const canonicalRole = (
    user.role.toLowerCase().replace(/\s+/g, '_') as 'admin' | 'data_entry'
  );

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: canonicalRole,
    phone: user.phone || '',
    image: user.image || '',
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
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
  getUserById(id: string): Promise<UserResponse>;
  createUser(dto: CreateUserDto): Promise<UserResponse>;
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
  hashPassword(plainPassword: string): string;
}

export class UserService implements IUserService {
  constructor(private userRepository: IUserRepository) {}

  hashPassword(plainPassword: string): string {
    const salt = bcrypt.genSaltSync(10);
    return bcrypt.hashSync(plainPassword, salt);
  }

  async listUsers(
    filters: ListUsersDto,
  ): Promise<{
    users: UserResponse[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const result: PaginatedResult<IUser> =
      await this.userRepository.findUsers(filters);

    return {
      users: result.items.map(toUserResponse),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  async getUserById(id: string): Promise<UserResponse> {
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new UserNotFoundError();
    }

    const user = await this.userRepository.findById(id.trim());
    if (!user) {
      throw new UserNotFoundError();
    }

    return toUserResponse(user);
  }

  async createUser(dto: CreateUserDto): Promise<UserResponse> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const existingUser = await this.userRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new UserAlreadyExistsError(
        'A user with this email address already exists.',
      );
    }

    const hashedPassword = this.hashPassword(dto.password);

    try {
      const created = await this.userRepository.create({
        name: dto.name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        phone: dto.phone ? dto.phone.trim() : '',
        role: 'data_entry',
        image: '',
        isActive: true,
      });

      return toUserResponse(created);
    } catch (error: unknown) {
      const err = error as { code?: number | string; name?: string };
      if (
        err &&
        (err.code === 11000 ||
          err.code === '11000' ||
          (err.name === 'MongoServerError' && err.code === 11000))
      ) {
        throw new UserAlreadyExistsError(
          'A user with this email address already exists.',
        );
      }
      throw error;
    }
  }

  async updateUser(
    id: string,
    dto: UpdateUserDto,
    currentAdminId: string,
  ): Promise<UserResponse> {
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new UserNotFoundError();
    }

    const existing = await this.userRepository.findById(id.trim());
    if (!existing) {
      throw new UserNotFoundError();
    }

    const updatePayload: Partial<IUser> = {};

    if (dto.name !== undefined) {
      updatePayload.name = dto.name.trim();
    }

    if (dto.phone !== undefined) {
      updatePayload.phone = dto.phone ? dto.phone.trim() : '';
    }

    if (dto.image !== undefined) {
      updatePayload.image = dto.image.trim();
    }

    if (dto.email !== undefined) {
      const normalizedEmail = dto.email.toLowerCase().trim();
      if (normalizedEmail !== existing.email.toLowerCase()) {
        const emailOccupied =
          await this.userRepository.findByEmail(normalizedEmail);
        if (emailOccupied) {
          throw new UserAlreadyExistsError(
            'A user with this email address already exists.',
          );
        }
        updatePayload.email = normalizedEmail;
      }
    }

    if (dto.role !== undefined) {
      // Prevent an admin from self-demoting their account
      if (
        (String(existing._id) === currentAdminId ||
          existing.email.toLowerCase() === currentAdminId.toLowerCase()) &&
        dto.role !== 'admin'
      ) {
        throw new InvalidOperationError(
          'Administrators cannot demote their own account role.',
        );
      }
      updatePayload.role = dto.role;
    }

    if (dto.password !== undefined) {
      updatePayload.password = this.hashPassword(dto.password);
    }

    try {
      const updated = await this.userRepository.update(
        id.trim(),
        updatePayload,
      );
      if (!updated) {
        throw new UserNotFoundError();
      }

      return toUserResponse(updated);
    } catch (error: unknown) {
      const err = error as { code?: number | string; name?: string };
      if (
        err &&
        (err.code === 11000 ||
          err.code === '11000' ||
          (err.name === 'MongoServerError' && err.code === 11000))
      ) {
        throw new UserAlreadyExistsError(
          'A user with this email address already exists.',
        );
      }
      throw error;
    }
  }

  async updateUserStatus(
    id: string,
    isActive: boolean,
    currentAdminId: string,
  ): Promise<UserResponse> {
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new UserNotFoundError();
    }

    const existing = await this.userRepository.findById(id.trim());
    if (!existing) {
      throw new UserNotFoundError();
    }

    // Prevent Admin from accidentally deactivating their own account
    if (
      (String(existing._id) === currentAdminId ||
        existing.email.toLowerCase() === currentAdminId.toLowerCase()) &&
      !isActive
    ) {
      throw new SelfDeactivationError(
        'You cannot deactivate your own administrative account.',
      );
    }

    const updated = await this.userRepository.updateStatus(id.trim(), isActive);
    if (!updated) {
      throw new UserNotFoundError();
    }

    return toUserResponse(updated);
  }
}
