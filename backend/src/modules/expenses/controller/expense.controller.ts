import { NextFunction, RequestHandler, Response } from 'express';
import multer from 'multer';
import { env } from '../../../config/env';
import { AuthenticatedRequest } from '../../../types/auth';
import {
  BillAttachmentNotFoundError,
  InvalidBillAttachmentError,
} from '../../purchases';
import {
  ExpenseConflictError,
  ExpenseForbiddenError,
  ExpenseNotFoundError,
  ExpenseService,
  ExpenseValidationError,
} from '../service/expense.service';
import { ExpenseCallerIdentity, UploadedReceiptInputFile } from '../types';

const uploadInstance = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_BILL_FILE_SIZE_BYTES,
    files: 5,
    fieldSize: 512 * 1024,
  },
});

const multerFieldsHandler = uploadInstance.fields([
  { name: 'receipt', maxCount: 5 },
  { name: 'attachments', maxCount: 5 },
  { name: 'bill', maxCount: 5 },
]);

export const parseExpenseReceiptsMiddleware: RequestHandler = (
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
          message: `Receipt attachment exceeds the maximum allowed size of ${maxMb} MB.`,
          errors: {
            attachments: `Each receipt file must be ${maxMb} MB or smaller.`,
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
          message: 'You can attach up to 5 receipt files per expense voucher.',
          errors: {
            attachments:
              'You can attach up to 5 receipt files per expense voucher.',
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
): UploadedReceiptInputFile[] {
  const filesContainer = req.files;
  if (!filesContainer) {
    return [];
  }

  const rawFiles: Express.Multer.File[] = [];
  if (Array.isArray(filesContainer)) {
    rawFiles.push(...filesContainer);
  } else {
    const byField = filesContainer as Record<string, Express.Multer.File[]>;
    if (Array.isArray(byField.receipt)) {
      rawFiles.push(...byField.receipt);
    }
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

function extractCaller(req: AuthenticatedRequest): ExpenseCallerIdentity {
  return {
    id: String(req.user?.id || ''),
    email: String(req.user?.email || ''),
    name: String(req.user?.name || req.user?.email || ''),
    role: req.user?.role === 'admin' ? 'admin' : 'data_entry',
  };
}

function extractParam(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) {
    return (raw[0] || '').trim();
  }
  return typeof raw === 'string' ? raw.trim() : '';
}

function sanitizeAsciiDispositionName(name: string): string {
  const cleaned = String(name || 'expense-receipt')
    .replace(/[\r\n"]/g, '_')
    .replace(/[^\x20-\x7E]/g, '_');
  return cleaned || 'expense-receipt';
}

export class ExpenseController {
  constructor(private readonly service: ExpenseService) {}

  private handleError(err: unknown, res: Response, next: NextFunction): void {
    if (err instanceof ExpenseValidationError) {
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
        errors: { attachments: err.message },
      });
      return;
    }

    if (err instanceof ExpenseForbiddenError) {
      res.status(403).json({
        error: 'Forbidden',
        message: err.message,
      });
      return;
    }

    if (
      err instanceof ExpenseNotFoundError ||
      err instanceof BillAttachmentNotFoundError
    ) {
      res.status(404).json({
        error: 'Not Found',
        message: err.message,
      });
      return;
    }

    if (err instanceof ExpenseConflictError) {
      res.status(409).json({
        error: 'Conflict',
        message: err.message,
        ...(err.errors ? { errors: err.errors } : {}),
      });
      return;
    }

    next(err);
  }

  listCategories = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const caller = extractCaller(req);
      const includeInactiveRaw = String(req.query.includeInactive || '')
        .trim()
        .toLowerCase();
      const includeInactive =
        includeInactiveRaw === 'true' ||
        includeInactiveRaw === '1' ||
        caller.role === 'admin';
      const categories = await this.service.listCategories(caller, {
        includeInactive,
      });
      res.status(200).json({ categories });
    } catch (err) {
      this.handleError(err, res, next);
    }
  };

  createCategory = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const caller = extractCaller(req);
      const category = await this.service.createCategory(req.body, caller);
      res.status(201).json({
        message: 'Expense category created successfully.',
        category,
      });
    } catch (err) {
      this.handleError(err, res, next);
    }
  };

  updateCategory = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const caller = extractCaller(req);
      const categoryId = extractParam(req.params.categoryId);
      const category = await this.service.updateCategory(
        categoryId,
        req.body,
        caller,
      );
      res.status(200).json({
        message: 'Expense category updated successfully.',
        category,
      });
    } catch (err) {
      this.handleError(err, res, next);
    }
  };

  list = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.service.listExpenseVouchers(
        req.query as Record<string, unknown>,
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
      const id = extractParam(req.params.id);
      const voucher = await this.service.getExpenseVoucherById(id);
      res.status(200).json({ voucher });
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
      const uploadedFiles = extractUploadedFiles(req);
      const headerIdempKey =
        typeof req.headers['idempotency-key'] === 'string'
          ? req.headers['idempotency-key']
          : undefined;
      const result = await this.service.createExpenseVoucher(
        req.body,
        uploadedFiles,
        caller,
        headerIdempKey,
      );

      res.status(result.created ? 201 : 200).json({
        message: result.created
          ? 'Expense voucher recorded successfully.'
          : 'Expense voucher was already recorded.',
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
      const caller = extractCaller(req);
      const id = extractParam(req.params.id);
      const uploadedFiles = extractUploadedFiles(req);
      const voucher = await this.service.updateExpenseVoucher(
        id,
        req.body,
        uploadedFiles,
        caller,
      );
      res.status(200).json({
        message: 'Expense voucher updated successfully.',
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
      const caller = extractCaller(req);
      const id = extractParam(req.params.id);
      const reason =
        req.body && typeof req.body === 'object'
          ? (req.body as Record<string, unknown>).reason
          : undefined;
      const voucher = await this.service.cancelExpenseVoucher(
        id,
        reason,
        caller,
      );
      res.status(200).json({
        message: 'Expense voucher cancelled and project cost updated.',
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
      const id = extractParam(req.params.id);
      const attachmentId = extractParam(req.params.attachmentId);
      const { attachment, buffer } = await this.service.openExpenseAttachment(
        id,
        attachmentId,
      );

      const forceDownload =
        req.query.download === '1' || req.query.download === 'true';
      const safeAscii = sanitizeAsciiDispositionName(attachment.originalName);
      const encodedName = encodeURIComponent(attachment.originalName);
      const dispositionType = forceDownload ? 'attachment' : 'inline';

      res.setHeader('Content-Type', attachment.mimeType);
      res.setHeader('Content-Length', String(buffer.length));
      res.setHeader(
        'Content-Disposition',
        `${dispositionType}; filename="${safeAscii}"; filename*=UTF-8''${encodedName}`,
      );
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.status(200).send(buffer);
    } catch (err) {
      this.handleError(err, res, next);
    }
  };
}
