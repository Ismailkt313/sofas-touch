import crypto from 'crypto';
import https from 'https';
import http from 'http';
import {
  BillStorageProvider,
  IBillAttachmentStorage,
  StoredBillMetadata,
  UploadedBillInputFile,
} from '../types';
import { cloudinaryService } from '../../../services/cloudinary.service';
import {
  LocalProtectedBillStorageService,
  validateAndInspectBillFile,
} from './bill-storage.service';
import { isCloudinaryConfigured } from '../../../config/env';

export class CloudinaryBillAttachmentStorageService
  implements IBillAttachmentStorage
{
  getProviderName(): BillStorageProvider {
    return 'cloudinary';
  }

  isPersistentExternalStorage(): boolean {
    return true;
  }

  async saveBillFile(file: UploadedBillInputFile): Promise<StoredBillMetadata> {
    const inspected = validateAndInspectBillFile(file);
    const attachmentId = `att_${crypto.randomBytes(12).toString('hex')}`;

    const uploadResult = await cloudinaryService.uploadBuffer(
      file.buffer,
      inspected.sanitizedName,
      {
        folder: 'softtouch/purchase-bills',
        tags: ['softtouch', 'purchase-bills'],
      },
    );

    return {
      attachmentId,
      originalName: inspected.sanitizedName,
      mimeType: inspected.detectedMime,
      sizeBytes: uploadResult.sizeBytes,
      storageProvider: 'cloudinary',
      storageKey: uploadResult.publicId,
      checksum: uploadResult.checksum,
      secureUrl: uploadResult.secureUrl,
      publicId: uploadResult.publicId,
      resourceType: uploadResult.resourceType,
      format: uploadResult.format,
    };
  }

  async readBillBuffer(
    storageKey: string,
  ): Promise<{ buffer: Buffer; sizeBytes: number }> {
    return new Promise((resolve, reject) => {
      const secureUrl = cloudinaryService.getSecureUrl(storageKey);
      const client = secureUrl.startsWith('https') ? https : http;

      client
        .get(secureUrl, (res) => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(
              new Error(
                `Failed to fetch file from Cloudinary (HTTP ${res.statusCode})`,
              ),
            );
            return;
          }

          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            resolve({
              buffer,
              sizeBytes: buffer.length,
            });
          });
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }

  async deleteBillFile(storageKey: string): Promise<void> {
    await cloudinaryService.deleteFile(storageKey, 'image');
  }
}

export class AdaptiveBillAttachmentStorageService
  implements IBillAttachmentStorage
{
  private readonly cloudinaryStorage: CloudinaryBillAttachmentStorageService;
  private readonly localStorage: LocalProtectedBillStorageService;

  constructor(
    cloudinaryStorage = new CloudinaryBillAttachmentStorageService(),
    localStorage = new LocalProtectedBillStorageService(),
  ) {
    this.cloudinaryStorage = cloudinaryStorage;
    this.localStorage = localStorage;
  }

  getProviderName(): BillStorageProvider {
    return isCloudinaryConfigured() ? 'cloudinary' : 'local_protected';
  }

  isPersistentExternalStorage(): boolean {
    return isCloudinaryConfigured()
      ? this.cloudinaryStorage.isPersistentExternalStorage()
      : this.localStorage.isPersistentExternalStorage();
  }

  async saveBillFile(file: UploadedBillInputFile): Promise<StoredBillMetadata> {
    if (isCloudinaryConfigured()) {
      return this.cloudinaryStorage.saveBillFile(file);
    }
    return this.localStorage.saveBillFile(file);
  }

  async readBillBuffer(
    storageKey: string,
    provider?: BillStorageProvider,
  ): Promise<{ buffer: Buffer; sizeBytes: number }> {
    if (provider === 'cloudinary' || (!provider && isCloudinaryConfigured())) {
      try {
        return await this.cloudinaryStorage.readBillBuffer(storageKey);
      } catch (err) {
        // Fallback to local if remote read fails
        return this.localStorage.readBillBuffer(storageKey);
      }
    }
    return this.localStorage.readBillBuffer(storageKey);
  }

  async deleteBillFile(
    storageKey: string,
    provider?: BillStorageProvider,
  ): Promise<void> {
    if (provider === 'cloudinary' || (!provider && isCloudinaryConfigured())) {
      try {
        await this.cloudinaryStorage.deleteBillFile(storageKey);
      } catch (err: any) {
        console.warn(
          `[AdaptiveStorage] Could not delete from Cloudinary: ${storageKey}`,
          err.message,
        );
      }
    }
    // Also try local deletion in case it was stored locally
    try {
      await this.localStorage.deleteBillFile(storageKey);
    } catch {
      // Ignore local missing errors
    }
  }
}

export const defaultAdaptiveBillStorage = new AdaptiveBillAttachmentStorageService();

