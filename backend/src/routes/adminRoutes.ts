import { Router, Response, NextFunction } from 'express';
import { requireAdmin, verifyToken } from '../middleware/auth';
import {
  createUser,
  getAllUsers,
  updateUserStatus,
  updateUser,
} from '../services/userService';
import { AuthenticatedRequest } from '../types/auth';

import { userController, userRepository } from '../modules/users';

const router = Router();

router.use(verifyToken);
router.use(requireAdmin);

router.get('/users', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await userRepository.findUsers({ page: 1, limit: 100 });
    const users = result.items.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      role: (u.role || '').toLowerCase() === 'admin' ? 'Admin' : 'Data Entry',
      isActive: u.isActive,
      approvalStatus: u.approvalStatus || 'approved',
      createdAt: u.createdAt,
      phone: u.phone || '',
      image: u.image || '',
    }));
    res.json({ users });
  } catch {
    const users = getAllUsers();
    res.json({ users });
  }
});

router.post('/users', (req: AuthenticatedRequest, res: Response) => {
  const { email, password, name, role } = req.body;

  if (!email || !password || !name || !role) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'All fields (email, password, name, role) are required.',
    });
    return;
  }

  const normalizedRole = (role || '').toLowerCase().replace(/\s+/g, '_');
  if (normalizedRole !== 'admin' && normalizedRole !== 'data_entry') {
    res.status(400).json({
      error: 'Bad Request',
      message: "Role must be either 'admin' or 'data_entry'.",
    });
    return;
  }

  try {
    const newUser = createUser(email, password, name, role);
    userRepository
      .create({
        name,
        email,
        password,
        role: normalizedRole as 'admin' | 'data_entry',
        isActive: true,
        approvalStatus: 'approved',
      })
      .catch(() => null);
    res.status(201).json({ user: newUser });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create user';
    res.status(409).json({ error: 'Conflict', message });
  }
});

router.patch(
  '/users/:id/status',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (body?.user?.id || id) {
        const targetId = body?.user?.id || id;
        const isActive =
          body?.user?.isActive ??
          req.body?.isActive ??
          (req.body?.status === 'active');
        if (typeof isActive === 'boolean') {
          updateUserStatus(targetId, isActive);
        }
      }
      return originalJson(body);
    };
    return userController.updateStatus(req, res, next);
  },
);

router.patch(
  '/users/:id',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (body?.user) {
        updateUser(body.user.id || id, {
          name: body.user.name,
          email: body.user.email,
          role: body.user.role,
          isActive: body.user.isActive,
        });
      }
      return originalJson(body);
    };

    if (
      req.body &&
      (req.body.isActive !== undefined || req.body.status !== undefined) &&
      req.body.name === undefined &&
      req.body.email === undefined &&
      req.body.role === undefined &&
      req.body.phone === undefined &&
      req.body.password === undefined
    ) {
      return userController.updateStatus(req, res, next);
    }

    return userController.update(req, res, next);
  },
);

router.get('/permissions', (_req: AuthenticatedRequest, res: Response) => {
  res.json({
    roles: {
      Admin: {
        description: 'Full administrative access',
        permissions: [
          'users:read',
          'users:create',
          'users:delete',
          'projects:read',
          'projects:create',
          'projects:update',
          'projects:delete',
          'system:audit',
        ],
      },
      'Data Entry': {
        description: 'Operational data creation and updates',
        permissions: [
          'projects:read',
          'projects:create',
          'projects:update',
        ],
      },
    },
  });
});

export default router;
