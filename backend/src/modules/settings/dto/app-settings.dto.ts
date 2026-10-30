export interface UpdateAppSettingsDto {
  companyName?: string;
  workshopLocation?: string;
  supportEmail?: string;
  defaultCostWarningPercent?: number;
  defaultCostCriticalPercent?: number;
  projectInactivityThresholdDays?: number;
  operatorGuidanceBanner?: string;
}

export interface SettingsValidationResult {
  isValid: boolean;
  value?: UpdateAppSettingsDto;
  errors?: Record<string, string>;
}

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateUpdateAppSettingsDto(
  input: unknown,
): SettingsValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      isValid: false,
      errors: { body: 'Request body must be a JSON object.' },
    };
  }

  const raw = input as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const clean: UpdateAppSettingsDto = {};

  if (raw.companyName !== undefined) {
    if (typeof raw.companyName !== 'string' || !raw.companyName.trim()) {
      errors.companyName = 'Company name is required.';
    } else if (raw.companyName.trim().length > 120) {
      errors.companyName = 'Company name must be 120 characters or fewer.';
    } else {
      clean.companyName = raw.companyName.trim();
    }
  }

  if (raw.workshopLocation !== undefined) {
    if (typeof raw.workshopLocation !== 'string') {
      errors.workshopLocation = 'Workshop location must be text.';
    } else if (raw.workshopLocation.trim().length > 180) {
      errors.workshopLocation =
        'Workshop location must be 180 characters or fewer.';
    } else {
      clean.workshopLocation = raw.workshopLocation.trim();
    }
  }

  if (raw.supportEmail !== undefined) {
    if (
      typeof raw.supportEmail !== 'string' ||
      !SIMPLE_EMAIL_RE.test(raw.supportEmail.trim())
    ) {
      errors.supportEmail = 'Please enter a valid administrator contact email.';
    } else {
      clean.supportEmail = raw.supportEmail.trim().toLowerCase();
    }
  }

  if (raw.defaultCostWarningPercent !== undefined) {
    const num = Number(raw.defaultCostWarningPercent);
    if (!Number.isFinite(num) || num < 10 || num > 100) {
      errors.defaultCostWarningPercent =
        'Cost warning threshold must be between 10% and 100%.';
    } else {
      clean.defaultCostWarningPercent = Math.round(num * 100) / 100;
    }
  }

  if (raw.defaultCostCriticalPercent !== undefined) {
    const num = Number(raw.defaultCostCriticalPercent);
    if (!Number.isFinite(num) || num < 50 || num > 200) {
      errors.defaultCostCriticalPercent =
        'Cost critical threshold must be between 50% and 200%.';
    } else {
      clean.defaultCostCriticalPercent = Math.round(num * 100) / 100;
    }
  }

  if (
    clean.defaultCostWarningPercent !== undefined &&
    clean.defaultCostCriticalPercent !== undefined &&
    clean.defaultCostWarningPercent >= clean.defaultCostCriticalPercent
  ) {
    errors.defaultCostWarningPercent =
      'Warning threshold must be lower than the critical overrun threshold.';
  }

  if (raw.projectInactivityThresholdDays !== undefined) {
    const num = Number(raw.projectInactivityThresholdDays);
    if (!Number.isInteger(num) || num < 1 || num > 365) {
      errors.projectInactivityThresholdDays =
        'Inactivity threshold must be a whole number between 1 and 365 days.';
    } else {
      clean.projectInactivityThresholdDays = num;
    }
  }

  if (raw.operatorGuidanceBanner !== undefined) {
    if (typeof raw.operatorGuidanceBanner !== 'string') {
      errors.operatorGuidanceBanner = 'Operator guidance note must be text.';
    } else if (raw.operatorGuidanceBanner.trim().length > 300) {
      errors.operatorGuidanceBanner =
        'Operator guidance note must be 300 characters or fewer.';
    } else {
      clean.operatorGuidanceBanner = raw.operatorGuidanceBanner.trim();
    }
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  return { isValid: true, value: clean };
}
