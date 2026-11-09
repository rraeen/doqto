import { ProviderInputError } from '../errors';
import type { ProviderInfo } from '../provider-mode';

export interface PutObjectRequest {
  /** Object key such as `doctors/<id>/photo.jpg`. Letters, digits, `/ _ . -` only; no `..`. */
  key: string;
  body: Buffer;
  contentType: string;
}

export interface StoredObject {
  key: string;
  size: number;
  contentType: string;
}

export interface PublicObject extends StoredObject {
  url: string;
}

/**
 * Files (TDD 10, 11): public bucket for doctor and clinic photos, private
 * bucket for credential scans served only through short-lived signed URLs.
 * Every implementation enforces UPLOAD_LIMITS: putPublic takes photos only
 * (JPEG, PNG, WebP, 2 MB), putPrivate takes credentials (those or PDF, 5 MB),
 * and the bytes must match the declared type.
 */
export interface StorageProvider extends ProviderInfo {
  putPrivate(request: PutObjectRequest): Promise<StoredObject>;
  putPublic(request: PutObjectRequest): Promise<PublicObject>;
  /** Removes a private object (account deletion, a record the patient deleted). Missing is fine. */
  deletePrivate(key: string): Promise<void>;
  /** Signed URL for a private object; default lifetime SIGNED_URL_TTL_SECONDS (5 minutes). */
  signedUrl(key: string, ttlSeconds?: number): Promise<string>;
}

const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/_.-]{0,254}$/;

export function assertObjectKey(key: string): void {
  if (
    !KEY_PATTERN.test(key) ||
    key.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    throw new ProviderInputError('invalid storage key');
  }
}
