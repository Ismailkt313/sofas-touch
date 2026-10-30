import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { AuthenticatedRequest, AuthTokenPayload } from '../types/auth';
import {
  IUser,
  UserModel,
  sharedUserMemoryStore,
} from '../modules/auth/models/user.model';
import {
  PermissionKey,
  permissionService,
} from '../modules/permissions/service/permission.service-bridge';

export function generateToken(
  payload: AuthTokenPayload,
  expiresIn: string = env.JWT_EXPIRES_IN,
): string {
  const options: jwt.SignOptions = {
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
  };
  const slimPayload: AuthTokenPayload = {
    id: payload.id,
    email: payload.email,
    role: payload.role,
    name: payload.name,
    approvalStatus: payload.approvalStatus,
  };
  return jwt.sign(slimPayload, env.JWT_SECRET, options);
}

export async function findLiveUserById(id: string): Promise<IUser | null> {
  if (mongoose.connection.readyState === 1 && mongoose.isValidObjectId(id)) {
    try {
      const doc = await UserModel.findById(id).lean().exec();
      if (doc) {
        return doc as unknown as IUser;
      }
    } catch {
      void 0;
    }
  }

  for (const user of sharedUserMemoryStore.values()) {
    if (String(user._id) === id) {
      return user;
    }
  }

  return null;
}

export async function verifyToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message:
        'Access denied. A valid Bearer authentication token is required.',
    });
    return;
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Access denied. Authentication token is empty.',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;

    const liveUser = await findLiveUserById(decoded.id);
    if (!liveUser) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User account not found or has been removed.',
      });
      return;
    }

    if (liveUser.isActive === false) {
      res.status(403).json({
        error: 'Forbidden',
        message:
          'This account is currently inactive. Please contact an administrator to reactivate your access.',
        code: 'ACCOUNT_INACTIVE',
      });
      return;
    }

    const canonicalRole = liveUser.role
      .toLowerCase()
      .replace(/\s+/g, '_') as 'admin' | 'data_entry';

    const approvalStatus =
      liveUser.approvalStatus ||
      (canonicalRole === 'admin' ? 'approved' : 'pending');

    if (canonicalRole !== 'admin' && approvalStatus !== 'approved') {
      if (approvalStatus === 'rejected') {
        res.status(403).json({
          error: 'Forbidden',
          message:
            'Your account registration request has been declined. Please contact an administrator for assistance.',
          code: 'ACCOUNT_REJECTED',
        });
        return;
      }

      res.status(403).json({
        error: 'Forbidden',
        message:
          'Your account registration is currently pending Administrator approval. You will receive access once an administrator has approved your account.',
        code: 'PENDING_APPROVAL',
      });
      return;
    }

    const effectivePermissions =
      await permissionService.resolveEffectivePermissionsForUser(liveUser);

    req.user = {
      id: String(liveUser._id),
      email: liveUser.email,
      name: liveUser.name,
      role: canonicalRole,
      approvalStatus,
      permissions: effectivePermissions,
      assignedProjectIds:
        canonicalRole === 'admin'
          ? null
          : Array.isArray(liveUser.assignedProjectIds)
            ? liveUser.assignedProjectIds
            : null,
    };

    next();
  } catch (err: unknown) {
    const jwtError = err as { name?: string };
    if (jwtError.name === 'TokenExpiredError') {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Your session has expired. Please sign in again.',
      });
      return;
    }

    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid authentication token.',
    });
  }
}

export function hasCallerPermission(
  req: AuthenticatedRequest,
  permission: PermissionKey,
): boolean {
  if (!req.user) return false;
  if (req.user.role === 'admin') return true;
  return Array.isArray(req.user.permissions)
    ? req.user.permissions.includes(permission)
    : false;
}

export function requirePermission(requiredPermission: PermissionKey) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication is required before checking permissions.',
      });
      return;
    }

    if (!hasCallerPermission(req, requiredPermission)) {
      res.status(403).json({
        error: 'Forbidden',
        code: 'PERMISSION_DENIED',
        requiredPermission,
        message: `Access denied. You do not have the '${requiredPermission}' permission required for this operation.`,
      });
      return;
    }

    next();
  };
}

export function requireAnyPermission(allowedPermissions: PermissionKey[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication is required before checking permissions.',
      });
      return;
    }

    const permitted = allowedPermissions.some((perm) =>
      hasCallerPermission(req, perm),
    );
    if (!permitted) {
      res.status(403).json({
        error: 'Forbidden',
        code: 'PERMISSION_DENIED',
        requiredPermissions: allowedPermissions,
        message:
          'Access denied. Your account does not have permission to perform this operation.',
      });
      return;
    }

    next();
  };
}

export function requireAllPermissions(requiredPermissions: PermissionKey[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication is required before checking permissions.',
      });
      return;
    }

    const missing = requiredPermissions.find(
      (perm) => !hasCallerPermission(req, perm),
    );
    if (missing) {
      res.status(403).json({
        error: 'Forbidden',
        code: 'PERMISSION_DENIED',
        requiredPermission: missing,
        message: `Access denied. You do not have the '${missing}' permission required for this operation.`,
      });
      return;
    }

    next();
  };
}

export function requireRole(allowedRoles: string[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication is required before checking permissions.',
      });
      return;
    }

    const normalizedUserRole = req.user.role
      .toLowerCase()
      .replace(/\s+/g, '_');
    const normalizedAllowed = allowedRoles.map((r) =>
      r.toLowerCase().replace(/\s+/g, '_'),
    );

    if (!normalizedAllowed.includes(normalizedUserRole)) {
      res.status(403).json({
        error: 'Forbidden',
        code: 'PERMISSION_DENIED',
        message: `Access denied. This resource requires ${allowedRoles.join(
          ' or ',
        )} privileges. Your current role is '${req.user.role}'.`,
      });
      return;
    }

    next();
  };
}

export const requireAdmin = requireRole(['admin']);
export const requireDataEntryOrAdmin = requireRole(['admin', 'data_entry']);

export function requireApprovedDataEntry(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication is required to access Data Entry onboarding.',
    });
    return;
  }

  const role = req.user.role.toLowerCase().replace(/\s+/g, '_');
  if (role !== 'data_entry' && role !== 'admin') {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Access restricted to Data Entry and Administrator accounts.',
    });
    return;
  }

  if (role !== 'admin' && req.user.approvalStatus !== 'approved') {
    if (req.user.approvalStatus === 'rejected') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Your account registration request has been declined.',
        code: 'ACCOUNT_REJECTED',
      });
      return;
    }

    res.status(403).json({
      error: 'Forbidden',
      message:
        'Your account is awaiting Administrator approval before access is granted.',
      code: 'PENDING_APPROVAL',
    });
    return;
  }

  next();
}
