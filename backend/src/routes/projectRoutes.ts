import { Router, Response } from 'express';
import { requireAdmin, requireDataEntryOrAdmin, verifyToken } from '../middleware/auth';
import { AuthenticatedRequest } from '../types/auth';

interface Project {
  id: string;
  name: string;
  clientName: string;
  category: 'Modular Sofa' | 'Curtains' | 'Armchair' | 'Bespoke Interior';
  status: 'In Progress' | 'Under Review' | 'Completed';
  createdBy: string;
  createdAt: string;
}

const mockProjects: Project[] = [
  {
    id: 'prj_001',
    name: 'Belgravia Residence Modular Sectional',
    clientName: 'Lord & Lady Harrington',
    category: 'Modular Sofa',
    status: 'In Progress',
    createdBy: 'admin@softtouchsofas.com',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prj_002',
    name: 'Mayfair Penthouse Linen Drapery',
    clientName: 'Julian Sterling',
    category: 'Curtains',
    status: 'Completed',
    createdBy: 'dataentry@softtouchsofas.com',
    createdAt: new Date().toISOString(),
  },
];

const router = Router();

router.use(verifyToken);

router.get('/', requireDataEntryOrAdmin, (_req: AuthenticatedRequest, res: Response) => {
  res.json({ projects: mockProjects });
});

router.post('/', requireDataEntryOrAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { name, clientName, category } = req.body || {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Bad Request', message: 'Project name is required.' });
    return;
  }

  if (!clientName || typeof clientName !== 'string' || !clientName.trim()) {
    res.status(400).json({ error: 'Bad Request', message: 'Client name is required.' });
    return;
  }

  const newProject: Project = {
    id: `prj_${Date.now()}`,
    name: name.trim(),
    clientName: clientName.trim(),
    category: category || 'Modular Sofa',
    status: 'In Progress',
    createdBy: req.user?.email || 'unknown',
    createdAt: new Date().toISOString(),
  };

  mockProjects.push(newProject);
  res.status(201).json({ project: newProject });
});

router.delete('/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const index = mockProjects.findIndex((p) => p.id === id);

  if (index === -1) {
    res.status(404).json({ error: 'Not Found', message: 'Project not found.' });
    return;
  }

  const [deleted] = mockProjects.splice(index, 1);
  res.json({ message: 'Project deleted successfully.', project: deleted });
});

export default router;
