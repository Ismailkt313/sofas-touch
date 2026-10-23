import { Request } from 'express';

export type UserRole = 'admin' | 'data_entry' | 'Admin' | 'Data Entry';

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'data_entry';
  phone?: string;
  image?: string;
  isActive: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  createdAt: string;
}

export type UserPublic = Omit<User, 'passwordHash'>;

export interface AuthTokenPayload {
  id: string;
  email: string;
  role: 'admin' | 'data_entry';
  name: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}
