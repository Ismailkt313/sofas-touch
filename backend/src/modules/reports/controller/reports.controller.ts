import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../../../types/auth';
import {
  ReportForbiddenError,
  ReportNotFoundError,
  ReportsService,
  ReportValidationError,
} from '../service/reports.service';
import { ReportCallerIdentity } from '../types';

function extractCaller(req: AuthenticatedRequest): ReportCallerIdentity {
  return {
    id: String(req.user?.id || ''),
    email: String(req.user?.email || ''),
    name: String(req.user?.name || req.user?.email || ''),
    role: req.user?.role === 'admin' ? 'admin' : 'data_entry',
    permissions: Array.isArray(req.user?.permissions)
      ? req.user!.permissions!
      : [],
    assignedProjectIds: req.user?.assignedProjectIds ?? null,
  };
}

function extractParam(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) {
    return (raw[0] || '').trim();
  }
  return typeof raw === 'string' ? raw.trim() : '';
}

export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  private handleError(err: unknown, res: Response, next: NextFunction): void {
    if (err instanceof ReportValidationError) {
      res.status(400).json({
        error: 'Bad Request',
        message: err.message,
        errors: err.errors,
      });
      return;
    }

    if (err instanceof ReportForbiddenError) {
      res.status(403).json({
        error: 'Forbidden',
        message: err.message,
      });
      return;
    }

    if (err instanceof ReportNotFoundError) {
      res.status(404).json({
        error: 'Not Found',
        message: err.message,
      });
      return;
    }

    next(err);
  }

  listProjectReports = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const caller = extractCaller(req);
      const result = await this.service.listProjectReports(
        req.query as Record<string, unknown>,
        caller,
      );
      res.status(200).json(result);
    } catch (err) {
      this.handleError(err, res, next);
    }
  };

  exportProjectReportsCsv = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const caller = extractCaller(req);
      const { csv, fileName } = await this.service.exportProjectReportsCsv(
        req.query as Record<string, unknown>,
        caller,
      );

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${fileName}"`,
      );
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).send(csv);
    } catch (err) {
      this.handleError(err, res, next);
    }
  };

  getIndividualProjectReport = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const caller = extractCaller(req);
      const id = extractParam(req.params.id);
      const result = await this.service.getIndividualProjectReport(
        id,
        req.query as Record<string, unknown>,
        caller,
      );
      res.status(200).json(result);
    } catch (err) {
      this.handleError(err, res, next);
    }
  };

  exportIndividualProjectReportPdf = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const caller = extractCaller(req);
      const id = extractParam(req.params.id);
      const { buffer, fileName } =
        await this.service.exportIndividualProjectReportPdf(
          id,
          req.query as Record<string, unknown>,
          caller,
        );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', String(buffer.length));
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${fileName}"`,
      );
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).send(buffer);
    } catch (err) {
      this.handleError(err, res, next);
    }
  };
}
