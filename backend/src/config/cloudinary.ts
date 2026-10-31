import { v2 as cloudinary } from 'cloudinary';
import { env, isCloudinaryConfigured } from './env';

export interface CloudinaryConfigStatus {
  configured: boolean;
  cloudName: string;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  missingVariables: string[];
}

let isInitialized = false;

export function configureCloudinary(): void {
  if (isCloudinaryConfigured()) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY.CLOUD_NAME,
      api_key: env.CLOUDINARY.API_KEY,
      api_secret: env.CLOUDINARY.API_SECRET,
      secure: true,
    });
    isInitialized = true;
  }
}

export function getCloudinaryConfigStatus(): CloudinaryConfigStatus {
  const missing: string[] = [];
  if (!env.CLOUDINARY.CLOUD_NAME) missing.push('CLOUDINARY_CLOUD_NAME');
  if (!env.CLOUDINARY.API_KEY) missing.push('CLOUDINARY_API_KEY');
  if (!env.CLOUDINARY.API_SECRET) missing.push('CLOUDINARY_API_SECRET');

  return {
    configured: missing.length === 0,
    cloudName: env.CLOUDINARY.CLOUD_NAME || '',
    hasApiKey: Boolean(env.CLOUDINARY.API_KEY),
    hasApiSecret: Boolean(env.CLOUDINARY.API_SECRET),
    missingVariables: missing,
  };
}

export function validateCloudinaryConfig(strict = false): boolean {
  const status = getCloudinaryConfigStatus();
  if (!status.configured) {
    const errorMsg = `Cloudinary is not fully configured. Missing environment variables: ${status.missingVariables.join(', ')}.`;
    if (strict) {
      throw new Error(errorMsg);
    } else {
      console.warn(`[Cloudinary Warning] ${errorMsg} File uploads requiring Cloudinary will use local fallback or return an error until configured.`);
      return false;
    }
  }

  configureCloudinary();
  console.log(`[Cloudinary] Successfully initialized with cloud name: "${status.cloudName}".`);
  return true;
}

export { cloudinary };

