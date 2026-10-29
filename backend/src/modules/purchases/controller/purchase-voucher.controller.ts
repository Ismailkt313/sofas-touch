import { NextFunction, RequestHandler, Response } from 'express';
import multer from 'multer';
import { env } from '../../../config/env';
import { AuthenticatedRequest } from '../../../types/auth';
import { activityService } from '../../activity';
import {
  DuplicateSupplierInvoiceError,
  PurchaseConflictError,
  PurchaseNotFoundError,
  PurchaseValidationError,
  PurchaseVoucherService,
} from '../service/purchase-voucher.service';
import {
  BillAttachmentNotFoundError,
  InvalidBillAttachmentError,
} from '../storage/bill-storage.service';
import { PurchaseCallerIdentity, UploadedBillInputFile } from '../types';

const uploadInstance = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_BILL_FILE_SIZE_BYTES,
    files: 5,
    fieldSize: 512 * 1024,
  },
});

const multerFieldsHandler = uploadInstance.fields([
  { name: 'attachments', maxCount: 5 },
  { name: 'bill', maxCount: 5 },
]);

export const parseBillAttachmentsMiddleware: RequestHandler = (
  req,
  res,
  next,
) => {
  multerFieldsHandler(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const maxMb = Math.round(env.MAX_BILL_FILE_SIZE_BYTES / (1024 * 1024));
        res.status(400).json({
          error: 'Bad Request',
          message: `Bill attachment exceeds the maximum allowed size of ${maxMb} MB.`,
          errors: {
            attachments: `Each bill attachment must be ${maxMb} MB or smaller.`,
          },
        });
        return;
      }

      if (
        err.code === 'LIMIT_FILE_COUNT' ||
        err.code === 'LIMIT_UNEXPECTED_FILE'
      ) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'You can attach up to 5 bill files per purchase voucher.',
          errors: {
            attachments:
              'You can attach up to 5 bill files per purchase voucher.',
          },
        });
        return;
      }

      res.status(400).json({
        error: 'Bad Request',
        message: err.message || 'Invalid multipart upload payload.',
      });
      return;
    }

    next(err);
  });
};

function extractUploadedFiles(
  req: AuthenticatedRequest,
): UploadedBillInputFile[] {
  const filesContainer = req.files;
  if (!filesContainer) {
    return [];
  }

  const rawFiles: Express.Multer.File[] = [];
  if (Array.isArray(filesContainer)) {
    rawFiles.push(...filesContainer);
  } else {
    const byField = filesContainer as Record<string, Express.Multer.File[]>;
    if (Array.isArray(byField.attachments)) {
      rawFiles.push(...byField.attachments);
    }
    if (Array.isArray(byField.bill)) {
      rawFiles.push(...byField.bill);
    }
  }

  return rawFiles.map((f) => ({
    originalname: f.originalname,
    mimetype: f.mimetype,
    size: f.size,
    buffer: f.buffer,
  }));
}

function extractCaller(req: AuthenticatedRequest): PurchaseCallerIdentity {
  return {
    id: String(req.user?.id || ''),
    email: String(req.user?.email || ''),
    name: String(req.user?.name || req.user?.email || ''),
    role: req.user?.role === 'admin' ? 'admin' : 'data_entry',
  };
}

function sanitizeAsciiDispositionName(name: string): string {
  const cleaned = String(name || 'bill-attachment')
    .replace(/[\r\n"]/g, '_')
    .replace(/[^\x20-\x7E]/g, '_');
  return cleaned || 'bill-attachment';
}

export class PurchaseVoucherController {
  constructor(private readonly service: PurchaseVoucherService) {}

  private handleError(err: unknown, res: Response, next: NextFunction): void {
    if (err instanceof PurchaseValidationError) {
      res.status(400).json({
        error: 'Bad Request',
        message: err.message,
        errors: err.errors,
      });
      return;
    }

    if (err instanceof InvalidBillAttachmentError) {
      res.status(400).json({
        error: 'Bad Request',
        message: err.message,
        errors: {
          attachments: err.message,
        },
      });
      return;
    }

    if (
      err instanceof PurchaseNotFoundError ||
      err instanceof BillAttachmentNotFoundError
    ) {
      res.status(404).json({
        error: 'Not Found',
        message: err.message,
      });
      return;
    }

    if (
      err instanceof DuplicateSupplierInvoiceError ||
      err instanceof PurchaseConflictError
    ) {
      res.status(409).json({
        error: 'Conflict',
        message: err.message,
        ...(err instanceof PurchaseConflictError && err.errors
          ? { errors: err.errors }
          : {}),
      });
      return;
    }

    next(err);
  }

  list = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.service.listPurchaseVouchers(
        (req.query || {}) as Record<string, unknown>,
      );
      res.status(200).json(result);
    } catch (err) {
      this.handleError(err, res, next);
    }
  };

  getById = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = String(req.params.id || '');
      const result = await this.service.getPurchaseVoucherById(id);
      res.status(200).json(result);
    } catch (err) {
      this.handleError(err, res, next);
    }
  };

  create = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const caller = extractCaller(req);
      const files = extractUploadedFiles(req);
      const idempotencyHeader = req.header('Idempotency-Key') || undefined;
      const result = await this.service.createPurchaseVoucher(
        req.body || {},
        files,
        caller,
        idempotencyHeader,
      );

      if (result.created) {
        const v = result.voucher;
        const projText = v.projectCode ? ` for ${v.projectCode}` : '';
        await activityService.recordSafe({
          actionType: 'purchase.created',
          entityType: 'purchase',
          entityId: v.voucherNumber,
          entityLabel: `${v.voucherNumber} (${v.supplierName})`,
          description: `Recorded purchase voucher ${v.voucherNumber} from ${v.supplierName}${projText}.`,
          actorId: caller.id || caller.email || 'user',
          actorName: caller.name || caller.email || 'Workspace User',
          actorRole: caller.role,
          projectRecordId: v.projectRecordId || null,
          projectCode: v.projectCode || null,
          projectName: v.projectName || null,
          targetPath: `/purchases/${encodeURIComponent(v.voucherNumber)}`,
        });
      }

      res.status(result.created ? 201 : 200).json({
        message: result.created
          ? 'Purchase voucher recorded successfully.'
          : 'Purchase voucher was already recorded for this submission.',
        idempotentReplay: !result.created,
        voucher: result.voucher,
      });
    } catch (err) {
      this.handleError(err, res, next);
    }
  };

  update = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = String(req.params.id || '');
      const caller = extractCaller(req);
      const files = extractUploadedFiles(req);
      const voucher = await this.service.updatePurchaseVoucher(
        id,
        req.body || {},
        files,
        caller,
      );

      await activityService.recordSafe({
        actionType: 'purchase.updated',
        entityType: 'purchase',
        entityId: voucher.voucherNumber,
        entityLabel: `${voucher.voucherNumber} (${voucher.supplierName})`,
        description: `Updated purchase voucher ${voucher.voucherNumber} (${voucher.supplierName}).`,
        actorId: caller.id || caller.email || 'user',
        actorName: caller.name || caller.email || 'Workspace User',
        actorRole: caller.role,
        projectRecordId: voucher.projectRecordId || null,
        projectCode: voucher.projectCode || null,
        projectName: voucher.projectName || null,
        targetPath: `/purchases/${encodeURIComponent(voucher.voucherNumber)}`,
      });

      res.status(200).json({
        message: 'Purchase voucher updated successfully.',
        voucher,
      });
    } catch (err) {
      this.handleError(err, res, next);
    }
  };

  uploadAttachments = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = String(req.params.id || '');
      const caller = extractCaller(req);
      const files = extractUploadedFiles(req);
      if (files.length === 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Please attach at least one bill image or PDF file.',
          errors: {
            attachments: 'Please attach at least one bill image or PDF file.',
          },
        });
        return;
      }

      const voucher = await this.service.updatePurchaseVoucher(
        id,
        {},
        files,
        caller,
      );

      await activityService.recordSafe({
        actionType: 'purchase.attachment_added',
        entityType: 'purchase',
        entityId: voucher.voucherNumber,
        entityLabel: `${voucher.voucherNumber} (${voucher.supplierName})`,
        description: `Attached supplier bill to purchase voucher ${voucher.voucherNumber}.`,
        actorId: caller.id || caller.email || 'user',
        actorName: caller.name || caller.email || 'Workspace User',
        actorRole: caller.role,
        projectRecordId: voucher.projectRecordId || null,
        projectCode: voucher.projectCode || null,
        projectName: voucher.projectName || null,
        targetPath: `/purchases/${encodeURIComponent(voucher.voucherNumber)}`,
      });

      res.status(200).json({
        message: 'Bill attachment added to purchase voucher successfully.',
        voucher,
      });
    } catch (err) {
      this.handleError(err, res, next);
    }
  };

  cancel = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = String(req.params.id || '');
      const caller = extractCaller(req);
      const reason =
        req.body && typeof req.body === 'object'
          ? (req.body as Record<string, unknown>).reason
          : undefined;
      const voucher = await this.service.cancelPurchaseVoucher(
        id,
        reason,
        caller,
      );

      await activityService.recordSafe({
        actionType: 'purchase.cancelled',
        entityType: 'purchase',
        entityId: voucher.voucherNumber,
        entityLabel: `${voucher.voucherNumber} (${voucher.supplierName})`,
        description: `Cancelled purchase voucher ${voucher.voucherNumber} and reversed stock impact.`,
        actorId: caller.id || caller.email || 'admin',
        actorName: caller.name || caller.email || 'Administrator',
        actorRole: caller.role,
        projectRecordId: voucher.projectRecordId || null,
        projectCode: voucher.projectCode || null,
        projectName: voucher.projectName || null,
        targetPath: `/purchases/${encodeURIComponent(voucher.voucherNumber)}`,
      });

      res.status(200).json({
        message: 'Purchase voucher cancelled and stock impact reversed.',
        voucher,
      });
    } catch (err) {
      this.handleError(err, res, next);
    }
  };

  streamAttachment = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = String(req.params.id || '');
      const attachmentId = String(req.params.attachmentId || '');
      const { attachment, buffer } = await this.service.openVoucherAttachment(
        id,
        attachmentId,
      );

      const isDownload =
        req.query.download === '1' || req.query.download === 'true';
      const asciiName = sanitizeAsciiDispositionName(attachment.originalName);
      const utf8Name = encodeURIComponent(attachment.originalName);

      res.setHeader('Content-Type', attachment.mimeType);
      res.setHeader('Content-Length', String(buffer.length));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, no-store, max-age=0');
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; img-src 'self' data: blob:; media-src 'none'; object-src 'self'; style-src 'unsafe-inline'; sandbox",
      );
      res.setHeader(
        'Content-Disposition',
        `${isDownload ? 'attachment' : 'inline'}; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
      );

      res.status(200).send(buffer);
    } catch (err) {
      this.handleError(err, res, next);
    }
  };
}
