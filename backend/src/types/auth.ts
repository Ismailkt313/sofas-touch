import { Request } from 'express';

export type UserRole = 'admin' | 'data_entry' | 'Admin' | 'Data Entry';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface UserPermissionOverridesShape {
  grant: string[];
  revoke: string[];
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'data_entry';
  phone?: string;
  image?: string;
  isActive: boolean;
  approvalStatus: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: string | Date;
  rejectionReason?: string;
  permissions?: string[];
  permissionOverrides?: UserPermissionOverridesShape;
  assignedProjectIds?: string[] | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  isActive?: boolean;
  approvalStatus?: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: string | Date;
  rejectionReason?: string;
  createdAt: string;
}

export type UserPublic = Omit<User, 'passwordHash'>;

export interface AuthTokenPayload {
  id: string;
  email: string;
  role: 'admin' | 'data_entry';
  name: string;
  approvalStatus?: ApprovalStatus;
  permissions?: string[];
  assignedProjectIds?: string[] | null;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}
