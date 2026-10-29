import { Router } from 'express';
import {
  requireAdmin,
  requireDataEntryOrAdmin,
  verifyToken,
} from '../../middleware/auth';
import { projectRepository, projectService } from '../projects';
import {
  billAttachmentStorage,
  purchaseVoucherRepository,
  PurchaseVoucherTotalsProvider,
} from '../purchases';
import {
  ExpenseController,
  parseExpenseReceiptsMiddleware,
} from './controller/expense.controller';
import { ExpenseRepository } from './repository/expense.repository';
import {
  ExpenseService,
  ExpenseVoucherTotalsProvider,
} from './service/expense.service';

export const expenseRepository = new ExpenseRepository();
export const expenseVoucherTotalsProvider = new ExpenseVoucherTotalsProvider(
  expenseRepository,
);
export const combinedVoucherTotalsProvider = new PurchaseVoucherTotalsProvider(
  purchaseVoucherRepository,
  expenseVoucherTotalsProvider,
);

export function registerExpenseProjectFinancialIntegration(): void {
  projectService.setVoucherTotalsProvider(combinedVoucherTotalsProvider);
}

registerExpenseProjectFinancialIntegration();

export const expenseService = new ExpenseService(
  expenseRepository,
  projectRepository,
  projectService,
  billAttachmentStorage,
);

export const expenseController = new ExpenseController(expenseService);

const expenseRouter = Router();

expenseRouter.use(verifyToken);

expenseRouter.get(
  '/categories',
  requireDataEntryOrAdmin,
  expenseController.listCategories,
);
expenseRouter.post('/categories', requireAdmin, expenseController.createCategory);
expenseRouter.patch(
  '/categories/:categoryId',
  requireAdmin,
  expenseController.updateCategory,
);

expenseRouter.get('/', requireDataEntryOrAdmin, expenseController.list);
expenseRouter.post(
  '/',
  requireDataEntryOrAdmin,
  parseExpenseReceiptsMiddleware,
  expenseController.create,
);
expenseRouter.get(
  '/:id/attachments/:attachmentId',
  requireDataEntryOrAdmin,
  expenseController.streamAttachment,
);
expenseRouter.get('/:id', requireDataEntryOrAdmin, expenseController.getById);
expenseRouter.patch(
  '/:id',
  requireAdmin,
  parseExpenseReceiptsMiddleware,
  expenseController.update,
);
expenseRouter.put(
  '/:id',
  requireAdmin,
  parseExpenseReceiptsMiddleware,
  expenseController.update,
);
expenseRouter.post('/:id/cancel', requireAdmin, expenseController.cancel);
expenseRouter.delete('/:id', requireAdmin, expenseController.cancel);

export {
  ExpenseController,
  parseExpenseReceiptsMiddleware,
} from './controller/expense.controller';
export {
  DuplicateExpenseCategoryError,
  DuplicateExpenseVoucherError,
  ExpenseRepository,
} from './repository/expense.repository';
export {
  ExpenseConflictError,
  ExpenseForbiddenError,
  ExpenseNotFoundError,
  ExpenseService,
  ExpenseVoucherTotalsProvider,
} from './service/expense.service';
export * from './models/expense-counter.model';
export * from './models/expense-category.model';
export * from './models/expense-voucher.model';
export * from './dto/expense.dto';
export * from './types';

export default expenseRouter;
