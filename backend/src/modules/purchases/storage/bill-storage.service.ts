import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { env } from '../../../config/env';
import {
  BillStorageProvider,
  IBillAttachmentStorage,
  StoredBillMetadata,
  SupportedBillMimeType,
  UploadedBillInputFile,
} from '../types';

export class InvalidBillAttachmentError extends Error {
  public readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'InvalidBillAttachmentError';
  }
}

export class BillAttachmentNotFoundError extends Error {
  public readonly statusCode = 404;

  constructor(message = 'Requested bill attachment file could not be found.') {
    super(message);
    this.name = 'BillAttachmentNotFoundError';
  }
}

const EXTENSION_BY_MIME: Record<SupportedBillMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

function detectBillMimeFromMagicBytes(
  buffer: Buffer,
): SupportedBillMimeType | null {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) {
    return null;
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    return 'application/pdf';
  }

  return null;
}

export function sanitizeAttachmentFileName(rawName: string): string {
  const baseName = path.basename(String(rawName || '').trim());
  const cleaned = baseName
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned === '.' || cleaned === '..') {
    return 'supplier-bill';
  }

  return cleaned.length > 180 ? cleaned.slice(0, 180) : cleaned;
}

export function validateAndInspectBillFile(
  file: UploadedBillInputFile,
  maxBytes: number = env.MAX_BILL_FILE_SIZE_BYTES,
): {
  detectedMime: SupportedBillMimeType;
  sanitizedName: string;
  sizeBytes: number;
} {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new InvalidBillAttachmentError(
      'Uploaded bill file is empty or unreadable.',
    );
  }

  if (file.buffer.length > maxBytes) {
    const maxMb = Math.round((maxBytes / (1024 * 1024)) * 10) / 10;
    throw new InvalidBillAttachmentError(
      `Bill attachment '${sanitizeAttachmentFileName(
        file.originalname,
      )}' exceeds the ${maxMb} MB file size limit.`,
    );
  }

  const detectedMime = detectBillMimeFromMagicBytes(file.buffer);
  if (!detectedMime) {
    throw new InvalidBillAttachmentError(
      'Unsupported bill file format. Please upload a valid JPG, PNG, WEBP image, or PDF document.',
    );
  }

  const declaredMime = String(file.mimetype || '')
    .trim()
    .toLowerCase();
  const normalizedDeclared =
    declaredMime === 'image/jpg' ? 'image/jpeg' : declaredMime;

  if (
    normalizedDeclared &&
    normalizedDeclared !== 'application/octet-stream' &&
    normalizedDeclared !== detectedMime
  ) {
    throw new InvalidBillAttachmentError(
      `File content signature (${detectedMime}) does not match declared file type (${declaredMime}).`,
    );
  }

  const sanitizedBase = sanitizeAttachmentFileName(file.originalname);
  const expectedExt = EXTENSION_BY_MIME[detectedMime];
  const hasMatchingExt = new RegExp(
    `\\.(${expectedExt === 'jpg' ? 'jpg|jpeg' : expectedExt})$`,
    'i',
  ).test(sanitizedBase);

  const sanitizedName = hasMatchingExt
    ? sanitizedBase
    : `${sanitizedBase}.${expectedExt}`;

  return {
    detectedMime,
    sanitizedName,
    sizeBytes: file.buffer.length,
  };
}

export class LocalProtectedBillStorageService implements IBillAttachmentStorage {
  private readonly baseDirectory: string;
  private readonly maxBytes: number;

  constructor(
    baseDirectory: string = env.BILL_STORAGE_DIR,
    maxBytes: number = env.MAX_BILL_FILE_SIZE_BYTES,
  ) {
    this.baseDirectory = path.resolve(baseDirectory);
    this.maxBytes = maxBytes;
  }

  getProviderName(): BillStorageProvider {
    return 'local_protected';
  }

  isPersistentExternalStorage(): boolean {
    return Boolean(process.env.BILL_STORAGE_DIR);
  }

  private resolveSafePath(storageKey: string): string {
    const cleanKey = String(storageKey || '')
      .trim()
      .replace(/^[/\\]+/, '');
    if (!cleanKey || cleanKey.includes('..') || cleanKey.includes('\0')) {
      throw new InvalidBillAttachmentError('Invalid bill storage key.');
    }

    const fullPath = path.resolve(this.baseDirectory, cleanKey);
    const relative = path.relative(this.baseDirectory, fullPath);
    if (
      !relative ||
      relative.startsWith('..') ||
      path.isAbsolute(relative)
    ) {
      throw new InvalidBillAttachmentError('Invalid bill storage path.');
    }

    return fullPath;
  }

  async saveBillFile(file: UploadedBillInputFile): Promise<StoredBillMetadata> {
    const inspected = validateAndInspectBillFile(file, this.maxBytes);
    const now = new Date();
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const attachmentId = `att_${crypto.randomBytes(12).toString('hex')}`;
    const ext = EXTENSION_BY_MIME[inspected.detectedMime];
    const fileToken = `${crypto.randomUUID()}.${ext}`;
    const storageKey = `${year}/${month}/${fileToken}`;
    const destinationPath = this.resolveSafePath(storageKey);

    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.writeFile(destinationPath, file.buffer, { mode: 0o600 });

    const checksum = crypto
      .createHash('sha256')
      .update(file.buffer)
      .digest('hex');

    return {
      attachmentId,
      originalName: inspected.sanitizedName,
      mimeType: inspected.detectedMime,
      sizeBytes: inspected.sizeBytes,
      storageProvider: 'local_protected',
      storageKey,
      checksum,
    };
  }

  async readBillBuffer(
    storageKey: string,
  ): Promise<{ buffer: Buffer; sizeBytes: number }> {
    const fullPath = this.resolveSafePath(storageKey);
    try {
      const buffer = await fs.readFile(fullPath);
      return {
        buffer,
        sizeBytes: buffer.length,
      };
    } catch (err: unknown) {
      const fsError = err as { code?: string };
      if (fsError?.code === 'ENOENT') {
        throw new BillAttachmentNotFoundError();
      }
      throw new Error('Unable to read stored bill attachment.');
    }
  }

  async deleteBillFile(storageKey: string): Promise<void> {
    const fullPath = this.resolveSafePath(storageKey);
    try {
      await fs.unlink(fullPath);
    } catch (err: unknown) {
      const fsError = err as { code?: string };
      if (fsError?.code === 'ENOENT') {
        return;
      }
      throw new Error('Unable to remove bill attachment file.');
    }
  }
}
