import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { API_PREFIX } from '@doqto/shared';
import { hmacSha256Hex, safeEqualHex } from '../crypto';
import { ProviderInputError } from '../errors';
import type { IntegrationsConfig } from '../integrations.config';
import {
  assertObjectKey,
  type PublicObject,
  type PutObjectRequest,
  type StorageProvider,
  type StoredObject,
} from './storage.provider';
import { stripImageMetadata } from './strip-metadata';
import { assertUploadAllowed, EXTENSION_BY_TYPE } from './upload-limits';

type Visibility = 'public' | 'private';

/**
 * Demo mode: files go to a local folder (DEMO_STORAGE_DIR) instead of R2.
 * Private objects get HMAC-signed, expiring URLs just like live, served by
 * the API under /api/v1/demo-storage (DemoStorageController).
 */
export class DemoStorageProvider implements StorageProvider {
  readonly providerName = 'demo-storage';
  readonly mode = 'demo' as const;
  private readonly root: string;
  private readonly baseUrl: string;
  private readonly defaultTtl: number;
  private readonly signingKey: string;

  constructor(
    config: Pick<
      IntegrationsConfig,
      'hashPepper' | 'demoStorageDir' | 'apiPublicUrl' | 'signedUrlTtlSeconds'
    >,
  ) {
    this.root = path.resolve(config.demoStorageDir);
    this.baseUrl = `${config.apiPublicUrl}${API_PREFIX}/demo-storage`;
    this.defaultTtl = config.signedUrlTtlSeconds;
    this.signingKey = hmacSha256Hex(config.hashPepper, 'demo-storage-url');
  }

  async putPrivate(request: PutObjectRequest): Promise<StoredObject> {
    assertUploadAllowed('credential', request.body, request.contentType);
    return this.write('private', request);
  }

  async putPublic(request: PutObjectRequest): Promise<PublicObject> {
    assertUploadAllowed('photo', request.body, request.contentType);
    const body = stripImageMetadata(request.body, request.contentType);
    const stored = await this.write('public', { ...request, body });
    return { ...stored, url: `${this.baseUrl}/public/${encodeKey(request.key)}` };
  }

  async deletePrivate(key: string): Promise<void> {
    await rm(this.pathFor('private', key), { force: true });
  }

  async signedUrl(key: string, ttlSeconds = this.defaultTtl, now = new Date()): Promise<string> {
    assertObjectKey(key);
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > 3600) {
      throw new ProviderInputError('ttlSeconds must be between 1 and 3600');
    }
    const expires = Math.floor(now.getTime() / 1000) + ttlSeconds;
    return `${this.baseUrl}/private/${encodeKey(key)}?expires=${expires}&sig=${this.sign(key, expires)}`;
  }

  /** For the /demo-storage/private route: true only for an unexpired, untampered URL. */
  verifySignedUrl(key: string, expires: number, sig: string, now = new Date()): boolean {
    if (!Number.isInteger(expires) || expires * 1000 <= now.getTime()) return false;
    try {
      assertObjectKey(key);
    } catch {
      return false;
    }
    return safeEqualHex(sig, this.sign(key, expires));
  }

  async read(visibility: Visibility, key: string): Promise<{ body: Buffer; contentType: string }> {
    const body = await readFile(this.pathFor(visibility, key));
    const ext = key.split('.').pop()?.toLowerCase();
    const contentType =
      Object.entries(EXTENSION_BY_TYPE).find(
        ([, e]) => e === ext || (ext === 'jpeg' && e === 'jpg'),
      )?.[0] ?? 'application/octet-stream';
    return { body, contentType };
  }

  private sign(key: string, expires: number): string {
    return hmacSha256Hex(this.signingKey, `${key}\n${expires}`);
  }

  private pathFor(visibility: Visibility, key: string): string {
    assertObjectKey(key);
    const base = path.join(this.root, visibility);
    const full = path.resolve(base, key);
    if (!full.startsWith(base + path.sep)) throw new ProviderInputError('invalid storage key');
    return full;
  }

  private async write(visibility: Visibility, request: PutObjectRequest): Promise<StoredObject> {
    const file = this.pathFor(visibility, request.key);
    if (!request.contentType) throw new ProviderInputError('contentType is required');
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, request.body);
    return { key: request.key, size: request.body.length, contentType: request.contentType };
  }
}

function encodeKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}
