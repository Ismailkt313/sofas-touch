import dotenv from 'dotenv';

dotenv.config();

function parseCorsOrigins(raw: string | undefined): string[] {
  if (!raw || typeof raw !== 'string') {
    return ['http://localhost:5173', 'http://127.0.0.1:5173'];
  }
  return raw
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function parsePositiveNumber(raw: string | undefined, fallback: number): number {
  if (!raw || typeof raw !== 'string') {
    return fallback;
  }
  const parsed = Number(raw.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export const env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGINS: parseCorsOrigins(process.env.CORS_ORIGINS),
  JWT_SECRET:
    process.env.JWT_SECRET || 'softtouch_default_insecure_jwt_secret_dev_only',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',

  DEFAULT_ADMIN: {
    email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@softtouchsofas.com',
    password: process.env.DEFAULT_ADMIN_PASSWORD || 'AdminSecurePassword123!',
    name: process.env.DEFAULT_ADMIN_NAME || 'Admin Manager',
  },

  DEFAULT_DATA_ENTRY: {
    email: process.env.DEFAULT_DATA_ENTRY_EMAIL || 'dataentry@softtouchsofas.com',
    password:
      process.env.DEFAULT_DATA_ENTRY_PASSWORD || 'DataEntrySecurePassword123!',
    name: process.env.DEFAULT_DATA_ENTRY_NAME || 'Data Entry Specialist',
  },

  DATABASE_URL: process.env.DATABASE_URL || '',

  PROJECT_COST_WARNING_THRESHOLD_PERCENT: parsePositiveNumber(
    process.env.PROJECT_COST_WARNING_THRESHOLD_PERCENT,
    80,
  ),
  PROJECT_COST_CRITICAL_THRESHOLD_PERCENT: parsePositiveNumber(
    process.env.PROJECT_COST_CRITICAL_THRESHOLD_PERCENT,
    100,
  ),
  PROJECT_INACTIVITY_THRESHOLD_DAYS: parsePositiveNumber(
    process.env.PROJECT_INACTIVITY_THRESHOLD_DAYS,
    14,
  ),
};

if (env.NODE_ENV === 'production') {
  if (
    !process.env.JWT_SECRET ||
    process.env.JWT_SECRET === 'softtouch_default_insecure_jwt_secret_dev_only'
  ) {
    console.error('CRITICAL SECURITY ERROR: JWT_SECRET must be securely configured in production!');
    process.exit(1);
  }
}
