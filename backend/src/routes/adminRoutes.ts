import { Router, Response } from 'express';
import { requireAdmin, verifyToken } from '../middleware/auth';
import { createUser, getAllUsers } from '../services/userService';
import { AuthenticatedRequest } from '../types/auth';

import { userRepository } from '../modules/users';

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
