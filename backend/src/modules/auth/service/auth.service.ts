import bcrypt from 'bcryptjs';
import { generateToken } from '../../../middleware/auth';
import { env } from '../../../config/env';
import { UserResponse } from '../../../types/auth';
import { LoginDto } from '../dto/login.dto';
import { IAuthRepository } from '../repository/auth.repository';

export class InvalidCredentialsError extends Error {
  constructor(message = 'Invalid email address or password.') {
    super(message);
    this.name = 'InvalidCredentialsError';
  }
}

export class InactiveAccountError extends Error {
  constructor(message = 'Your account has been deactivated. Please contact an administrator.') {
    super(message);
    this.name = 'InactiveAccountError';
  }
}

export interface IAuthService {
  login(dto: LoginDto): Promise<{ authenticated: boolean; token: string; user: UserResponse }>;
  getCurrentUser(userId: string): Promise<UserResponse>;
  hashPassword(plainPassword: string): string;
}

export class AuthService implements IAuthService {
  constructor(private authRepository: IAuthRepository) {}

  hashPassword(plainPassword: string): string {
    const salt = bcrypt.genSaltSync(10);
    return bcrypt.hashSync(plainPassword, salt);
  }

  async login(
    dto: LoginDto,
  ): Promise<{ authenticated: boolean; token: string; user: UserResponse }> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const user = await this.authRepository.findByEmail(normalizedEmail, true);

    if (!user || !user.password) {
      // Mitigate timing-based user enumeration
      bcrypt.compareSync(
        dto.password,
        '$2a$10$abcdefghijklmnopqrstuuNOPQRSTUVWXYZ1234567890abcdefghi',
      );
      throw new InvalidCredentialsError(
        'Invalid email address or password. Please verify your credentials and try again.',
      );
    }

    if (user.isActive === false) {
      throw new InactiveAccountError(
        'This account is currently inactive. Please contact an administrator to reactivate your access.',
      );
    }

    const isPasswordValid = bcrypt.compareSync(dto.password, user.password);
    if (!isPasswordValid) {
      throw new InvalidCredentialsError(
        'Invalid email address or password. Please verify your credentials and try again.',
      );
    }

    const canonicalRole = (
      user.role.toLowerCase().replace(/\s+/g, '_') as 'admin' | 'data_entry'
    );

    const expiresIn = dto.rememberMe ? '30d' : env.JWT_EXPIRES_IN;
    const token = generateToken(
      {
        id: String(user._id),
        email: user.email,
        role: canonicalRole,
        name: user.name,
      },
      expiresIn,
    );

    const publicUser: UserResponse = {
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

    return {
      authenticated: true,
      token,
      user: publicUser,
    };
  }

  async getCurrentUser(userId: string): Promise<UserResponse> {
    const user = await this.authRepository.findById(userId);
    if (!user) {
      throw new InvalidCredentialsError('User account not found.');
    }

    if (user.isActive === false) {
      throw new InactiveAccountError('This account is currently inactive.');
    }

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
}
