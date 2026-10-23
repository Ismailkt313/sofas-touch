import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthenticatedRequest, AuthTokenPayload } from '../types/auth';

export function generateToken(
  payload: AuthTokenPayload,
  expiresIn: string = env.JWT_EXPIRES_IN,
): string {
  // @ts-expect-error jsonwebtoken types signature
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn });
}

export function verifyToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Access denied. A valid Bearer authentication token is required.',
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
    if (decoded && decoded.role) {
      decoded.role = (decoded.role.toLowerCase().replace(/\s+/g, '_') as 'admin' | 'data_entry');
    }
    req.user = decoded;
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

export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication is required before checking permissions.',
      });
      return;
    }

    const normalizedUserRole = req.user.role.toLowerCase().replace(/\s+/g, '_');
    const normalizedAllowed = allowedRoles.map((r) =>
      r.toLowerCase().replace(/\s+/g, '_'),
    );

    if (!normalizedAllowed.includes(normalizedUserRole)) {
      res.status(403).json({
        error: 'Forbidden',
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
