import { ProviderInputError, ProviderNotConfiguredError } from '../errors';
import type { IntegrationsConfig } from '../integrations.config';
import {
  presignUrl,
  sha256Hex,
  signRequestHeaders,
  uriEncode,
  type SigV4Credentials,
} from './sigv4';
import {
  assertObjectKey,
  type PublicObject,
  type PutObjectRequest,
  type StorageProvider,
  type StoredObject,
} from './storage.provider';
import { stripImageMetadata } from './strip-metadata';
import { assertUploadAllowed } from './upload-limits';

type R2Config = IntegrationsConfig['r2'];
type Fetch = typeof fetch;

/**
 * Cloudflare R2 through its S3 API (TDD 10). Two buckets: public for doctor
 * and clinic photos (served from R2_PUBLIC_BASE_URL), private for credential
 * scans (only through presigned GET URLs, 5 minutes by default). Requests are
 * signed with SigV4 in-house, so no AWS SDK is needed. Credentials and
 * signatures are never logged.
 */
export class R2StorageProvider implements StorageProvider {
  readonly providerName = 'r2';
  readonly mode = 'live' as const;

  constructor(
    private readonly r2: R2Config,
    private readonly defaultTtlSeconds: number,
    private readonly fetchImpl: Fetch = (...args) => fetch(...args),
  ) {}

  async putPrivate(request: PutObjectRequest): Promise<StoredObject> {
    assertUploadAllowed('credential', request.body, request.contentType);
    return this.put(this.required('privateBucket'), request);
  }

  async putPublic(request: PutObjectRequest): Promise<PublicObject> {
    assertUploadAllowed('photo', request.body, request.contentType);
    const baseUrl = this.required('publicBaseUrl').replace(/\/+$/, '');
    const body = stripImageMetadata(request.body, request.contentType);
    const stored = await this.put(this.required('publicBucket'), { ...request, body });
    return { ...stored, url: `${baseUrl}/${uriEncode(request.key, true)}` };
  }

  async signedUrl(
    key: string,
    ttlSeconds = this.defaultTtlSeconds,
    now = new Date(),
  ): Promise<string> {
    assertObjectKey(key);
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > 3600) {
      throw new ProviderInputError('ttlSeconds must be between 1 and 3600');
    }
    const bucket = this.required('privateBucket');
    return presignUrl(
      this.credentials(),
      { host: this.host(), path: `/${bucket}/${uriEncode(key, true)}`, expiresSeconds: ttlSeconds },
      now,
    );
  }

  private async put(bucket: string, request: PutObjectRequest): Promise<StoredObject> {
    assertObjectKey(request.key);
    const path = `/${bucket}/${uriEncode(request.key, true)}`;
    const headers = signRequestHeaders(this.credentials(), {
      method: 'PUT',
      host: this.host(),
      path,
      headers: { 'content-type': request.contentType },
      payloadHash: sha256Hex(request.body),
    });
    const res = await this.fetchImpl(`https://${this.host()}${path}`, {
      method: 'PUT',
      headers,
      body: new Uint8Array(request.body),
    });
    if (!res.ok) {
      // Only the status; R2 error bodies can echo request details.
      throw new Error(`R2 upload failed with HTTP ${res.status}`);
    }
    return { key: request.key, size: request.body.length, contentType: request.contentType };
  }

  private host(): string {
    return `${this.required('accountId')}.r2.cloudflarestorage.com`;
  }

  private credentials(): SigV4Credentials {
    return {
      accessKeyId: this.required('accessKeyId'),
      secretAccessKey: this.required('secretAccessKey'),
      region: 'auto',
    };
  }

  private required<K extends keyof R2Config>(key: K): string {
    const value = this.r2[key];
    if (!value) throw new ProviderNotConfiguredError(`Cloudflare R2 (${String(key)} missing)`);
    return value;
  }
}
