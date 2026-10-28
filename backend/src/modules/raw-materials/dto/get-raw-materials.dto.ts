import {
  RAW_MATERIAL_CATEGORIES,
  RawMaterialCategory,
  normalizeMaterialDisplayName,
  normalizeRawMaterialCategory,
} from '../models/raw-material.model';
import { ValidationResult } from '../types';

export type RawMaterialStatusFilter = 'active' | 'inactive' | 'all';

export interface GetRawMaterialsDto {
  page: number;
  limit: number;
  search?: string;
  category?: RawMaterialCategory;
  requestedStatusFilter?: RawMaterialStatusFilter;
}

export const DEFAULT_RAW_MATERIALS_PAGE = 1;
export const DEFAULT_RAW_MATERIALS_LIMIT = 20;
export const MAX_RAW_MATERIALS_LIMIT = 100;

function extractFirstQueryString(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : String(value[0] ?? '');
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}

export function validateGetRawMaterialsDto(
  query: Record<string, unknown>,
): ValidationResult<GetRawMaterialsDto> {
  const errors: Record<string, string> = {};

  let page = DEFAULT_RAW_MATERIALS_PAGE;
  const rawPage = extractFirstQueryString(query.page);
  if (rawPage !== undefined && rawPage.trim() !== '') {
    const parsedPage = Number(rawPage.trim());
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      errors.page = 'Page must be a positive integer.';
    } else {
      page = parsedPage;
    }
  }

  let limit = DEFAULT_RAW_MATERIALS_LIMIT;
  const rawLimit = extractFirstQueryString(query.limit);
  if (rawLimit !== undefined && rawLimit.trim() !== '') {
    const parsedLimit = Number(rawLimit.trim());
    if (
      !Number.isInteger(parsedLimit) ||
      parsedLimit < 1 ||
      parsedLimit > MAX_RAW_MATERIALS_LIMIT
    ) {
      errors.limit = `Limit must be an integer between 1 and ${MAX_RAW_MATERIALS_LIMIT}.`;
    } else {
      limit = parsedLimit;
    }
  }

  let search: string | undefined;
  const rawSearch = extractFirstQueryString(query.search);
  if (rawSearch !== undefined && rawSearch.trim() !== '') {
    const normalizedSearch = normalizeMaterialDisplayName(rawSearch);
    if (normalizedSearch.length > 100) {
      errors.search = 'Search query cannot exceed 100 characters.';
    } else if (normalizedSearch) {
      search = normalizedSearch;
    }
  }

  let category: RawMaterialCategory | undefined;
  const rawCategory = extractFirstQueryString(query.category);
  if (rawCategory !== undefined && rawCategory.trim() !== '') {
    const trimmedCategory = rawCategory.trim();
    if (trimmedCategory.toLowerCase() !== 'all') {
      const normalizedCategory = normalizeRawMaterialCategory(trimmedCategory);
      if (!normalizedCategory) {
        errors.category = `Category filter must be 'all' or one of: ${RAW_MATERIAL_CATEGORIES.join(', ')}.`;
      } else {
        category = normalizedCategory;
      }
    }
  }

  let statusFromIsActive: RawMaterialStatusFilter | undefined;
  const rawIsActive = extractFirstQueryString(query.isActive);
  if (rawIsActive !== undefined && rawIsActive.trim() !== '') {
    const normalizedIsActive = rawIsActive.trim().toLowerCase();
    if (normalizedIsActive === 'true') {
      statusFromIsActive = 'active';
    } else if (normalizedIsActive === 'false') {
      statusFromIsActive = 'inactive';
    } else if (normalizedIsActive === 'all') {
      statusFromIsActive = 'all';
    } else {
      errors.isActive = "Query parameter 'isActive' must be 'true', 'false', or 'all'.";
    }
  }

  let statusFromStatus: RawMaterialStatusFilter | undefined;
  const rawStatus = extractFirstQueryString(query.status);
  if (rawStatus !== undefined && rawStatus.trim() !== '') {
    const normalizedStatus = rawStatus.trim().toLowerCase();
    if (
      normalizedStatus === 'active' ||
      normalizedStatus === 'inactive' ||
      normalizedStatus === 'all'
    ) {
      statusFromStatus = normalizedStatus;
    } else {
      errors.status =
        "Query parameter 'status' must be 'active', 'inactive', or 'all'.";
    }
  }

  if (
    statusFromIsActive !== undefined &&
    statusFromStatus !== undefined &&
    statusFromIsActive !== statusFromStatus
  ) {
    errors.status =
      "Query parameters 'isActive' and 'status' specify conflicting filters.";
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  const requestedStatusFilter =
    statusFromIsActive !== undefined ? statusFromIsActive : statusFromStatus;

  return {
    isValid: true,
    value: {
      page,
      limit,
      search,
      category,
      requestedStatusFilter,
    },
  };
}
