import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CloudinaryService } from '../cloudinary.service';
import { getCloudinaryConfigStatus, validateCloudinaryConfig } from '../../config/cloudinary';

describe('CloudinaryService', () => {
  const service = new CloudinaryService();

  it('detects unconfigured environment status gracefully', () => {
    const status = getCloudinaryConfigStatus();
    assert.equal(typeof status.configured, 'boolean');
    assert.ok(Array.isArray(status.missingVariables));
  });

  it('validates config without throwing in non-strict mode', () => {
    const isValid = validateCloudinaryConfig(false);
    assert.equal(typeof isValid, 'boolean');
  });

  it('rejects empty file buffers', () => {
    assert.throws(
      () => service.validateFile(Buffer.alloc(0)),
      /File buffer is empty or missing/,
    );
  });

  it('rejects files larger than 10MB', () => {
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
    assert.throws(
      () => service.validateFile(largeBuffer),
      /File exceeds maximum permitted size/,
    );
  });

  it('detects PDF magic bytes accurately', () => {
    const pdfBuffer = Buffer.from('%PDF-1.4 sample content');
    const result = service.validateFile(pdfBuffer);
    assert.equal(result.mimeType, 'application/pdf');
  });

  it('detects PNG magic bytes accurately', () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const pngBuffer = Buffer.concat([pngHeader, Buffer.alloc(20)]);
    const result = service.validateFile(pngBuffer);
    assert.equal(result.mimeType, 'image/png');
    assert.equal(result.resourceType, 'image');
  });

  it('detects JPEG magic bytes accurately', () => {
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const jpegBuffer = Buffer.concat([jpegHeader, Buffer.alloc(20)]);
    const result = service.validateFile(jpegBuffer);
    assert.equal(result.mimeType, 'image/jpeg');
    assert.equal(result.resourceType, 'image');
  });

  it('rejects unsupported file formats', () => {
    const exeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00');
    assert.throws(
      () => service.validateFile(exeBuffer),
      /Unsupported or invalid file type/,
    );
  });

  it('gracefully handles deleteFile when Cloudinary is unconfigured', async () => {
    const result = await service.deleteFile('some-public-id');
    assert.ok(result.result);
  });
});

