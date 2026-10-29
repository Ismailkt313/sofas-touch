import { Router } from 'express';
import {
  requireAdmin,
  requireDataEntryOrAdmin,
  verifyToken,
} from '../../middleware/auth';
import { ExpenseHeadsController } from './controller/expense-heads.controller';
import { ExpenseHeadsRepository } from './repository/expense-heads.repository';
import { ExpenseHeadsService } from './service/expense-heads.service';

export const expenseHeadsRepository = new ExpenseHeadsRepository();
export const expenseHeadsService = new ExpenseHeadsService(
  expenseHeadsRepository,
);
export const expenseHeadsController = new ExpenseHeadsController(
  expenseHeadsService,
);

const router = Router();

router.use(verifyToken);

router.get('/', requireDataEntryOrAdmin, expenseHeadsController.list);
router.get('/:id', requireDataEntryOrAdmin, expenseHeadsController.getById);
router.post('/', requireAdmin, expenseHeadsController.create);
router.patch(
  '/:id/status',
  requireAdmin,
  expenseHeadsController.updateStatus,
);
router.patch('/:id', requireAdmin, expenseHeadsController.update);

export {
  DuplicateExpenseHeadKeyError,
  ExpenseHeadsRepository,
} from './repository/expense-heads.repository';
export {
  ExpenseHeadConflictError,
  ExpenseHeadForbiddenError,
  ExpenseHeadNotFoundError,
  ExpenseHeadsService,
  ExpenseHeadValidationError,
  mapExpenseHeadToResponse,
} from './service/expense-heads.service';
export { ExpenseHeadsController };
export * from './models/expense-head.model';
export * from './dto/expense-head.dto';
export * from './types';

export default router;
