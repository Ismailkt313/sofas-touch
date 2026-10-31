import { Readable } from 'stream';
import crypto from 'crypto';
import path from 'path';
import { UploadApiResponse, UploadApiOptions } from 'cloudinary';
import { cloudinary, getCloudinaryConfigStatus } from '../config/cloudinary';
import { isCloudinaryConfigured } from '../config/env';

export interface CloudinaryUploadResult {
  publicId: string;
  secureUrl: string;
  resourceType: 'image' | 'raw' | 'video' | 'auto';
  format: string;
  sizeBytes: number;
  originalName: string;
  checksum: string;
}

export interface CloudinaryUploadOptions {
  folder?: string;
  resourceType?: 'image' | 'raw' | 'auto';
  tags?: string[];
  transformation?: UploadApiOptions['transformation'];
  publicId?: string;
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'application/pdf',
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function detectMimeFromMagicBytes(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;

  // PDF magic bytes: %PDF
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return 'application/pdf';
  }

  // PNG magic bytes: \x89PNG\r\n\x1a\n
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }

  // JPEG magic bytes: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // WEBP magic bytes: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

function sanitizeFilename(originalName: string): string {
  const parsed = path.parse(originalName || 'upload');
  const base = parsed.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50) || 'file';
  return base;
}

export class CloudinaryService {
  public isConfigured(): boolean {
    return isCloudinaryConfigured();
  }

  public validateFile(
    buffer: Buffer,
    declaredMimeType?: string,
  ): { mimeType: string; resourceType: 'image' | 'raw' } {
    if (!buffer || buffer.length === 0) {
      throw new Error('File buffer is empty or missing.');
    }

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new Error(
        `File exceeds maximum permitted size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
      );
    }

    const detectedMime = detectMimeFromMagicBytes(buffer);
    const resolvedMime = detectedMime || declaredMimeType;

    if (!resolvedMime || !ALLOWED_MIME_TYPES.has(resolvedMime.toLowerCase())) {
      throw new Error(
        `Unsupported or invalid file type: ${resolvedMime || 'unknown'}. Allowed types: JPEG, PNG, WEBP, PDF.`,
      );
    }

    const resourceType: 'image' | 'raw' =
      resolvedMime.toLowerCase() === 'application/pdf' ? 'image' : 'image';

    return { mimeType: resolvedMime.toLowerCase(), resourceType };
  }

  public async uploadBuffer(
    buffer: Buffer,
    originalFilename: string,
    options: CloudinaryUploadOptions = {},
  ): Promise<CloudinaryUploadResult> {
    if (!this.isConfigured()) {
      const status = getCloudinaryConfigStatus();
      throw new Error(
        `Cloudinary is not configured. Missing: ${status.missingVariables.join(', ')}.`,
      );
    }

    const { resourceType } = this.validateFile(buffer);
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    const safeBaseName = sanitizeFilename(originalFilename);
    const timestamp = Date.now();
    const folder = options.folder || 'softtouch/attachments';

    const uploadOptions: UploadApiOptions = {
      folder,
      resource_type: options.resourceType || resourceType,
      use_filename: true,
      unique_filename: true,
      filename_override: `${safeBaseName}-${timestamp}`,
      tags: options.tags || ['softtouch'],
      transformation: options.transformation,
    };

    if (options.publicId) {
      uploadOptions.public_id = options.publicId;
    }

    return new Promise<CloudinaryUploadResult>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result: UploadApiResponse | undefined) => {
          if (error || !result) {
            reject(
              new Error(
                `Cloudinary upload failed: ${error?.message || 'Unknown error'}`,
              ),
            );
            return;
          }

          resolve({
            publicId: result.public_id,
            secureUrl: result.secure_url,
            resourceType: (result.resource_type as 'image' | 'raw') || resourceType,
            format: result.format || path.extname(originalFilename).replace('.', ''),
            sizeBytes: result.bytes || buffer.length,
            originalName: originalFilename,
            checksum,
          });
        },
      );

      Readable.from(buffer).pipe(uploadStream);
    });
  }

  public async uploadImage(
    buffer: Buffer,
    originalFilename: string,
    options: CloudinaryUploadOptions = {},
  ): Promise<CloudinaryUploadResult> {
    return this.uploadBuffer(buffer, originalFilename, {
      ...options,
      resourceType: 'image',
    });
  }

  public async uploadPdf(
    buffer: Buffer,
    originalFilename: string,
    options: CloudinaryUploadOptions = {},
  ): Promise<CloudinaryUploadResult> {
    return this.uploadBuffer(buffer, originalFilename, {
      ...options,
      resourceType: 'image', // Cloudinary supports PDF under 'image' resource type with preview generation
    });
  }

  public async deleteFile(
    publicId: string,
    resourceType: 'image' | 'raw' | 'video' = 'image',
  ): Promise<{ result: string }> {
    if (!this.isConfigured()) {
      return { result: 'skipped_not_configured' };
    }

    if (!publicId) {
      return { result: 'skipped_no_public_id' };
    }

    try {
      const response = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true,
      });
      return response;
    } catch (err: any) {
      console.warn(`[Cloudinary Warning] Failed to delete file with publicId ${publicId}:`, err.message);
      return { result: 'error' };
    }
  }

  public async replaceFile(
    oldPublicId: string,
    newBuffer: Buffer,
    newOriginalFilename: string,
    options: CloudinaryUploadOptions = {},
  ): Promise<CloudinaryUploadResult> {
    // 1. Upload new file successfully
    const newFile = await this.uploadBuffer(newBuffer, newOriginalFilename, options);

    // 2. Safely delete old file after successful new upload
    if (oldPublicId && oldPublicId !== newFile.publicId) {
      try {
        const deleteType = options.resourceType === 'raw' ? 'raw' : 'image';
        await this.deleteFile(oldPublicId, deleteType);
      } catch (err: any) {
        console.warn(`[Cloudinary] Old file cleanup skipped/failed: ${oldPublicId}`, err.message);
      }
    }

    return newFile;
  }

  public getSecureUrl(publicId: string, options: UploadApiOptions = {}): string {
    return cloudinary.url(publicId, {
      secure: true,
      ...options,
    });
  }
}

export const cloudinaryService = new CloudinaryService();
