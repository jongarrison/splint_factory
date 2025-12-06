/**
 * Blob Storage Abstraction Layer
 * 
 * Provides unified interface for file storage with two implementations:
 * - Production: Vercel Blob (managed cloud storage)
 * - Development: Local filesystem (stored alongside SQLite database)
 */

import { put as vercelPut } from '@vercel/blob';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export interface BlobUploadResult {
  url: string;           // Permanent blob reference (not for direct access)
  pathname: string;      // Blob path/key for generating signed URLs
  contentType: string;
  size: number;
}

export interface BlobStorage {
  /**
   * Upload a file to blob storage
   * @param file Buffer containing file data
   * @param filename Original filename (used for content-type detection)
   * @returns Reference to stored blob
   */
  upload(file: Buffer, filename: string): Promise<BlobUploadResult>;

  /**
   * Generate a time-limited signed URL for secure access
   * @param pathname Blob pathname from upload result
   * @param expiresIn Expiration time in seconds (default: 3600 = 1 hour)
   * @returns Signed URL with access token
   */
  getSignedUrl(pathname: string, expiresIn?: number): Promise<string>;

  /**
   * Delete a blob from storage
   * @param pathname Blob pathname to delete
   */
  delete(pathname: string): Promise<void>;
}

/**
 * Vercel Blob Storage Implementation
 * Uses @vercel/blob SDK for production deployments
 */
class VercelBlobStorage implements BlobStorage {
  async upload(file: Buffer, filename: string): Promise<BlobUploadResult> {
    const blob = await vercelPut(filename, file, {
      access: 'public', // We'll control access via signed URLs from our API
      addRandomSuffix: true, // Prevent filename collisions
    });

    return {
      url: blob.url,
      pathname: blob.pathname,
      contentType: blob.contentType,
      size: file.length,
    };
  }

  async getSignedUrl(pathname: string, expiresIn: number = 3600): Promise<string> {
    // Vercel Blob URLs are public but we control access at the API level
    // The pathname is relative, so we need to construct the full URL
    // Format: https://{accountId}.public.blob.vercel-storage.com/{pathname}
    const blobUrl = `${process.env.BLOB_STORAGE_URL || 'https://dafvmdqp55nmfbxz.public.blob.vercel-storage.com'}/${pathname}`;
    return blobUrl;
  }

  async delete(pathname: string): Promise<void> {
    // Import dynamically to avoid issues in dev
    const { del } = await import('@vercel/blob');
    await del(pathname);
  }
}

/**
 * Local Filesystem Storage Implementation
 * Stores files in .blob-storage/ directory for development
 */
class FilesystemBlobStorage implements BlobStorage {
  private storageDir: string;

  constructor() {
    // Store blobs alongside the dev database
    this.storageDir = path.join(process.cwd(), '.blob-storage');
  }

  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.access(this.storageDir);
    } catch {
      await fs.mkdir(this.storageDir, { recursive: true });
    }
  }

  private generatePathname(filename: string): string {
    // Generate unique pathname similar to Vercel's approach
    const randomSuffix = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(filename);
    const basename = path.basename(filename, ext);
    return `${basename}-${randomSuffix}${ext}`;
  }

  async upload(file: Buffer, filename: string): Promise<BlobUploadResult> {
    await this.ensureStorageDir();

    const pathname = this.generatePathname(filename);
    const fullPath = path.join(this.storageDir, pathname);

    await fs.writeFile(fullPath, file);

    // Return localhost URL for local development
    const url = `/api/local-blob/${pathname}`;

    return {
      url,
      pathname,
      contentType: this.getContentType(filename),
      size: file.length,
    };
  }

  async getSignedUrl(pathname: string, _expiresIn?: number): Promise<string> {
    // For local development, no signing needed - just return the API route
    // Access control happens at API level via session check
    return `/api/local-blob/${pathname}`;
  }

  async delete(pathname: string): Promise<void> {
    const fullPath = path.join(this.storageDir, pathname);
    try {
      await fs.unlink(fullPath);
    } catch (error) {
      // Ignore errors if file doesn't exist
      console.warn(`Failed to delete blob ${pathname}:`, error);
    }
  }

  private getContentType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
      case '.stl':
        return 'model/stl';
      case '.3mf':
        return 'model/3mf';
      case '.obj':
        return 'text/plain';
      case '.gcode':
        return 'text/plain';
      default:
        return 'application/octet-stream';
    }
  }
}

/**
 * Get the appropriate blob storage implementation based on environment
 */
export function getBlobStorage(): BlobStorage {
  const useVercelBlob = process.env.BLOB_STORAGE_TYPE === 'vercel' || 
                        process.env.VERCEL === '1' ||
                        process.env.NODE_ENV === 'production';

  if (useVercelBlob) {
    return new VercelBlobStorage();
  } else {
    return new FilesystemBlobStorage();
  }
}

/**
 * Singleton instance
 */
let blobStorageInstance: BlobStorage | null = null;

export function getBlobStorageInstance(): BlobStorage {
  if (!blobStorageInstance) {
    blobStorageInstance = getBlobStorage();
  }
  return blobStorageInstance;
}
