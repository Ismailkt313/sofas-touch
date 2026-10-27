import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../types/auth';
import { validateCreateProjectDto } from '../dto/create-project.dto';
import {
  validateEvaluateActivityWarningsDto,
  validateListActivityWarningsDto,
  validateListProjectAlertsDto,
  validateListProjectsDto,
} from '../dto/list-projects.dto';
import { validateUpdateProjectDto } from '../dto/update-project.dto';
import { IProjectController, IProjectService } from '../types';
import {
  InvalidProjectOperationError,
  ProjectNotFoundError,
} from '../service/project.service';

export { IProjectController };

function extractParam(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) {
    return (raw[0] || '').trim();
  }
  return typeof raw === 'string' ? raw.trim() : '';
}

export class ProjectController implements IProjectController {
  constructor(private projectService: IProjectService) {}

  list = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const validation = validateListProjectsDto(
        req.query as Record<string, unknown>,
      );

      if (!validation.isValid || !validation.value) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid query parameters.',
          errors: validation.errors,
        });
        return;
      }

      const result = await this.projectService.listProjects(validation.value);
      res.status(200).json({
        projects: result.items,
        items: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      });
    } catch (error: unknown) {
      next(error);
    }
  };

  getById = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = extractParam(req.params.id);
      if (!id) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'A valid project ID or code is required.',
        });
        return;
      }

      const project = await this.projectService.getProjectByIdOrCode(id);
      res.status(200).json({ project });
    } catch (error: unknown) {
      if (error instanceof ProjectNotFoundError) {
        res.status(404).json({
          error: 'Not Found',
          message: error.message,
        });
        return;
      }
      next(error);
    }
  };

  create = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const validation = validateCreateProjectDto(req.body);
      if (!validation.isValid || !validation.value) {
        const firstError = validation.errors
          ? Object.values(validation.errors)[0]
          : 'Validation failed for project details.';
        res.status(400).json({
          error: 'Bad Request',
          message: firstError,
          errors: validation.errors,
        });
        return;
      }

      const createdBy = req.user?.email || req.user?.id || 'unknown';
      const project = await this.projectService.createProject(
        validation.value,
        createdBy,
      );

      res.status(201).json({
        message: 'Project created successfully.',
        project,
      });
    } catch (error: unknown) {
      if (error instanceof InvalidProjectOperationError) {
        res.status(400).json({
          error: 'Bad Request',
          message: error.message,
        });
        return;
      }
      next(error);
    }
  };

  update = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = extractParam(req.params.id);
      if (!id) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'A valid project ID or code is required.',
        });
        return;
      }

      const validation = validateUpdateProjectDto(req.body);
      if (!validation.isValid || !validation.value) {
        const firstError = validation.errors
          ? Object.values(validation.errors)[0]
          : 'Validation failed for project update.';
        res.status(400).json({
          error: 'Bad Request',
          message: firstError,
          errors: validation.errors,
        });
        return;
      }

      const project = await this.projectService.updateProject(
        id,
        validation.value,
      );

      res.status(200).json({
        message: 'Project updated successfully.',
        project,
      });
    } catch (error: unknown) {
      if (error instanceof ProjectNotFoundError) {
        res.status(404).json({
          error: 'Not Found',
          message: error.message,
        });
        return;
      }
      if (error instanceof InvalidProjectOperationError) {
        res.status(400).json({
          error: 'Bad Request',
          message: error.message,
        });
        return;
      }
      next(error);
    }
  };

  remove = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = extractParam(req.params.id);
      if (!id) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'A valid project ID or code is required.',
        });
        return;
      }

      const deleted = await this.projectService.deleteProject(id);
      res.status(200).json({
        message: 'Project deleted successfully.',
        project: deleted,
      });
    } catch (error: unknown) {
      if (error instanceof ProjectNotFoundError) {
        res.status(404).json({
          error: 'Not Found',
          message: error.message,
        });
        return;
      }
      next(error);
    }
  };

  getFinancialSummary = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = extractParam(req.params.id);
      if (!id) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'A valid project ID or code is required.',
        });
        return;
      }

      const summary = await this.projectService.getProjectFinancialSummary(id);
      res.status(200).json({
        summary,
        integrations: this.projectService.getVoucherIntegrationStatus(),
      });
    } catch (error: unknown) {
      if (error instanceof ProjectNotFoundError) {
        res.status(404).json({
          error: 'Not Found',
          message: error.message,
        });
        return;
      }
      next(error);
    }
  };

  listFinancialSummaries = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const validation = validateListProjectsDto(
        req.query as Record<string, unknown>,
      );

      if (!validation.isValid || !validation.value) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid query parameters.',
          errors: validation.errors,
        });
        return;
      }

      const result = await this.projectService.listProjectFinancialSummaries(
        validation.value,
      );

      res.status(200).json({
        summaries: result.items,
        items: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        integrations: this.projectService.getVoucherIntegrationStatus(),
      });
    } catch (error: unknown) {
      next(error);
    }
  };

  recalculateFinancials = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = extractParam(req.params.id);
      if (!id) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'A valid project ID or code is required.',
        });
        return;
      }

      const summary =
        await this.projectService.recalculateProjectFinancials(id);

      res.status(200).json({
        message: 'Project financial summary recalculated successfully.',
        summary,
        integrations: this.projectService.getVoucherIntegrationStatus(),
      });
    } catch (error: unknown) {
      if (error instanceof ProjectNotFoundError) {
        res.status(404).json({
          error: 'Not Found',
          message: error.message,
        });
        return;
      }
      next(error);
    }
  };

  listCostAlerts = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const validation = validateListProjectAlertsDto(
        req.query as Record<string, unknown>,
      );

      if (!validation.isValid || !validation.value) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid query parameters for project alerts.',
          errors: validation.errors,
        });
        return;
      }

      const result = await this.projectService.listCostAlerts(validation.value);
      res.status(200).json({
        alerts: result.items,
        items: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      });
    } catch (error: unknown) {
      next(error);
    }
  };

  getProjectCostAlerts = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = extractParam(req.params.id);
      if (!id) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'A valid project ID or code is required.',
        });
        return;
      }

      const result = await this.projectService.getProjectCostAlerts(id);
      res.status(200).json(result);
    } catch (error: unknown) {
      if (error instanceof ProjectNotFoundError) {
        res.status(404).json({
          error: 'Not Found',
          message: error.message,
        });
        return;
      }
      next(error);
    }
  };

  listActivityWarnings = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const validation = validateListActivityWarningsDto(
        req.query as Record<string, unknown>,
      );

      if (!validation.isValid || !validation.value) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid query parameters for activity warnings.',
          errors: validation.errors,
        });
        return;
      }

      const result = await this.projectService.listActivityWarnings(
        validation.value,
      );

      res.status(200).json({
        warnings: result.items,
        items: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        inactivityThresholdDays: result.inactivityThresholdDays,
        schedulerConfigured: result.schedulerConfigured,
      });
    } catch (error: unknown) {
      next(error);
    }
  };

  evaluateActivityWarnings = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const validation = validateEvaluateActivityWarningsDto(req.body);
      if (!validation.isValid || !validation.value) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid parameters for inactivity evaluation.',
          errors: validation.errors,
        });
        return;
      }

      const evaluation = await this.projectService.evaluateProjectInactivity({
        inactivityDays: validation.value.inactivityDays,
      });

      res.status(200).json({
        message: 'Project inactivity evaluation completed.',
        ...evaluation,
      });
    } catch (error: unknown) {
      next(error);
    }
  };
}
