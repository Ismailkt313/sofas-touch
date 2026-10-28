import { Router } from 'express';
import {
  requireAdmin,
  requireDataEntryOrAdmin,
  verifyToken,
} from '../../middleware/auth';
import { projectRepository, projectService } from '../projects';
import {
  rawMaterialsRepository,
  rawMaterialsService,
} from '../raw-materials';
import {
  parseBillAttachmentsMiddleware,
  PurchaseVoucherController,
} from './controller/purchase-voucher.controller';
import { PurchaseVoucherRepository } from './repository/purchase-voucher.repository';
import {
  PurchaseVoucherService,
  PurchaseVoucherTotalsProvider,
} from './service/purchase-voucher.service';
import { LocalProtectedBillStorageService } from './storage/bill-storage.service';

export const purchaseVoucherRepository = new PurchaseVoucherRepository();
export const billAttachmentStorage = new LocalProtectedBillStorageService();
export const purchaseVoucherTotalsProvider = new PurchaseVoucherTotalsProvider(
  purchaseVoucherRepository,
);

export function registerPurchaseProjectFinancialIntegration(): void {
  projectService.setVoucherTotalsProvider(purchaseVoucherTotalsProvider);
}

registerPurchaseProjectFinancialIntegration();

export const purchaseVoucherService = new PurchaseVoucherService(
  purchaseVoucherRepository,
  rawMaterialsRepository,
  rawMaterialsService,
  projectRepository,
  projectService,
  billAttachmentStorage,
);

export const purchaseVoucherController = new PurchaseVoucherController(
  purchaseVoucherService,
);

const purchaseRouter = Router();

purchaseRouter.use(verifyToken);

purchaseRouter.get('/', requireDataEntryOrAdmin, purchaseVoucherController.list);
purchaseRouter.post(
  '/',
  requireDataEntryOrAdmin,
  parseBillAttachmentsMiddleware,
  purchaseVoucherController.create,
);
purchaseRouter.post(
  '/:id/attachments',
  requireDataEntryOrAdmin,
  parseBillAttachmentsMiddleware,
  purchaseVoucherController.uploadAttachments,
);
purchaseRouter.get(
  '/:id/attachments/:attachmentId',
  requireDataEntryOrAdmin,
  purchaseVoucherController.streamAttachment,
);
purchaseRouter.get(
  '/:id',
  requireDataEntryOrAdmin,
  purchaseVoucherController.getById,
);
purchaseRouter.patch(
  '/:id',
  requireDataEntryOrAdmin,
  parseBillAttachmentsMiddleware,
  purchaseVoucherController.update,
);
purchaseRouter.put(
  '/:id',
  requireDataEntryOrAdmin,
  parseBillAttachmentsMiddleware,
  purchaseVoucherController.update,
);
purchaseRouter.post(
  '/:id/cancel',
  requireAdmin,
  purchaseVoucherController.cancel,
);
purchaseRouter.delete(
  '/:id',
  requireAdmin,
  purchaseVoucherController.cancel,
);

export {
  PurchaseVoucherController,
  parseBillAttachmentsMiddleware,
} from './controller/purchase-voucher.controller';
export {
  DuplicatePurchaseVoucherError,
  PurchaseVoucherRepository,
} from './repository/purchase-voucher.repository';
export {
  DuplicateSupplierInvoiceError,
  PurchaseConflictError,
  PurchaseNotFoundError,
  PurchaseValidationError,
  PurchaseVoucherService,
  PurchaseVoucherTotalsProvider,
} from './service/purchase-voucher.service';
export {
  BillAttachmentNotFoundError,
  InvalidBillAttachmentError,
  LocalProtectedBillStorageService,
  sanitizeAttachmentFileName,
  validateAndInspectBillFile,
} from './storage/bill-storage.service';
export * from './models/purchase-counter.model';
export * from './models/purchase-voucher.model';
export * from './models/purchase-stock-movement.model';
export * from './dto/create-purchase-voucher.dto';
export * from './dto/update-purchase-voucher.dto';
export * from './dto/list-purchase-vouchers.dto';
export * from './types';

export default purchaseRouter;
