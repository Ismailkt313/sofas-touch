import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../../../types/auth';
import {
  ExpenseHeadConflictError,
  ExpenseHeadForbiddenError,
  ExpenseHeadNotFoundError,
  ExpenseHeadsService,
  ExpenseHeadValidationError,
} from '../service/expense-heads.service';
import { ExpenseHeadCallerRole } from '../types';

function resolveCallerRole(req: AuthenticatedRequest): ExpenseHeadCallerRole {
  const rawRole = String(req.user?.role || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  return rawRole === 'admin' ? 'admin' : 'data_entry';
}

export class ExpenseHeadsController {
  constructor(private readonly service: ExpenseHeadsService) {}

  private handleError(err: unknown, res: Response, next: NextFunction): void {
    if (err instanceof ExpenseHeadValidationError) {
      res.status(400).json({
        error: 'Validation Error',
        message: err.message,
        errors: err.errors,
      });
      return;
    }

    if (err instanceof ExpenseHeadForbiddenError) {
      res.status(403).json({
        error: 'Forbidden',
        message: err.message,
      });
      return;
    }

    if (err instanceof ExpenseHeadNotFoundError) {
      res.status(404).json({
        error: 'Not Found',
        message: err.message,
      });
      return;
    }

    if (err instanceof ExpenseHeadConflictError) {
      res.status(409).json({
        error: 'Conflict',
        message: err.message,
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
      const result = await this.service.listExpenseHeads(
        req.query as Record<string, unknown>,
        resolveCallerRole(req),
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
      const expenseHead = await this.service.getExpenseHeadById(
        String(req.params.id || ''),
        resolveCallerRole(req),
      );
      res.status(200).json({ expenseHead });
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
      const callerId = String(req.user?.id || '');
      const expenseHead = await this.service.createExpenseHead(
        req.body,
        callerId,
      );
      res.status(201).json({
        message: 'Expense head created successfully.',
        expenseHead,
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
      const expenseHead = await this.service.updateExpenseHead(
        String(req.params.id || ''),
        req.body,
      );
      res.status(200).json({
        message: 'Expense head updated successfully.',
        expenseHead,
      });
    } catch (err) {
      this.handleError(err, res, next);
    }
  };

  updateStatus = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const expenseHead = await this.service.updateExpenseHeadStatus(
        String(req.params.id || ''),
        req.body,
      );
      res.status(200).json({
        message: expenseHead.isActive
          ? 'Expense head activated.'
          : 'Expense head deactivated.',
        expenseHead,
      });
    } catch (err) {
      this.handleError(err, res, next);
    }
  };
}
