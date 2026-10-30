import { Router } from 'express';
import {
  requirePermission,
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
  requirePermission('expenses.view'),
  expenseController.listCategories,
);
expenseRouter.post(
  '/categories',
  requirePermission('expenses.edit'),
  expenseController.createCategory,
);
expenseRouter.patch(
  '/categories/:categoryId',
  requirePermission('expenses.edit'),
  expenseController.updateCategory,
);

expenseRouter.get(
  '/',
  requirePermission('expenses.view'),
  expenseController.list,
);
expenseRouter.post(
  '/',
  requirePermission('expenses.create'),
  parseExpenseReceiptsMiddleware,
  expenseController.create,
);
expenseRouter.get(
  '/:id/attachments/:attachmentId',
  requirePermission('expenses.view'),
  expenseController.streamAttachment,
);
expenseRouter.get(
  '/:id',
  requirePermission('expenses.view'),
  expenseController.getById,
);
expenseRouter.patch(
  '/:id',
  requirePermission('expenses.edit'),
  parseExpenseReceiptsMiddleware,
  expenseController.update,
);
expenseRouter.put(
  '/:id',
  requirePermission('expenses.edit'),
  parseExpenseReceiptsMiddleware,
  expenseController.update,
);
expenseRouter.post(
  '/:id/cancel',
  requirePermission('expenses.delete'),
  expenseController.cancel,
);
expenseRouter.delete(
  '/:id',
  requirePermission('expenses.delete'),
  expenseController.cancel,
);

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
