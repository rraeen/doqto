import { createHash, createHmac } from 'node:crypto';

/**
 * Minimal AWS Signature Version 4 for S3-compatible storage (Cloudflare R2).
 * Kept in-house so the API needs no AWS SDK dependency; verified against the
 * AWS documentation test vectors in sigv4.spec.ts.
 */
export interface SigV4Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service?: string;
}

export const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
export const UNSIGNED_PAYLOAD = 'UNSIGNED-PAYLOAD';

export const sha256Hex = (data: string | Buffer): string =>
  createHash('sha256').update(data).digest('hex');
const hmac = (key: string | Buffer, data: string): Buffer =>
  createHmac('sha256', key).update(data).digest();

/** RFC 3986 encoding as SigV4 requires; `/` kept in paths. */
export function uriEncode(value: string, keepSlash = false): string {
  return Array.from(Buffer.from(value, 'utf8'))
    .map((b) => {
      const c = String.fromCharCode(b);
      if (/[A-Za-z0-9\-._~]/.test(c) || (keepSlash && c === '/')) return c;
      return `%${b.toString(16).toUpperCase().padStart(2, '0')}`;
    })
    .join('');
}

export function amzDate(date: Date): { amzDate: string; dateStamp: string } {
  const iso = date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

function canonicalQuery(query: Record<string, string>): string {
  return Object.keys(query)
    .sort()
    .map((k) => `${uriEncode(k)}=${uriEncode(query[k] ?? '')}`)
    .join('&');
}

function signingKey(creds: SigV4Credentials, dateStamp: string): Buffer {
  const service = creds.service ?? 's3';
  const kDate = hmac(`AWS4${creds.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, creds.region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

function scope(creds: SigV4Credentials, dateStamp: string): string {
  return `${dateStamp}/${creds.region}/${creds.service ?? 's3'}/aws4_request`;
}

interface CanonicalInput {
  method: string;
  /** Already-encoded absolute path, e.g. `/bucket/key%20name`. */
  path: string;
  query: Record<string, string>;
  /** Lower-case header names. */
  headers: Record<string, string>;
  payloadHash: string;
}

function signature(creds: SigV4Credentials, date: Date, input: CanonicalInput) {
  const { amzDate: stamp, dateStamp } = amzDate(date);
  const names = Object.keys(input.headers)
    .map((h) => h.toLowerCase())
    .sort();
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.headers))
    lower[k.toLowerCase()] = v.trim().replace(/\s+/g, ' ');
  const canonicalRequest = [
    input.method,
    input.path,
    canonicalQuery(input.query),
    names.map((h) => `${h}:${lower[h]}\n`).join(''),
    names.join(';'),
    input.payloadHash,
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    stamp,
    scope(creds, dateStamp),
    sha256Hex(canonicalRequest),
  ].join('\n');
  return {
    signedHeaders: names.join(';'),
    signature: createHmac('sha256', signingKey(creds, dateStamp))
      .update(stringToSign)
      .digest('hex'),
  };
}

/** Headers to send for a signed request (Authorization, x-amz-date, x-amz-content-sha256). */
export function signRequestHeaders(
  creds: SigV4Credentials,
  req: {
    method: string;
    host: string;
    path: string;
    query?: Record<string, string>;
    headers?: Record<string, string>;
    payloadHash: string;
  },
  date = new Date(),
): Record<string, string> {
  const { amzDate: stamp, dateStamp } = amzDate(date);
  const headers: Record<string, string> = {
    ...(req.headers ?? {}),
    host: req.host,
    'x-amz-content-sha256': req.payloadHash,
    'x-amz-date': stamp,
  };
  const { signedHeaders, signature: sig } = signature(creds, date, {
    method: req.method,
    path: req.path,
    query: req.query ?? {},
    headers,
    payloadHash: req.payloadHash,
  });
  const { host: _host, ...rest } = headers;
  return {
    ...rest,
    authorization: `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${scope(creds, dateStamp)}, SignedHeaders=${signedHeaders}, Signature=${sig}`,
  };
}

/** Query-string presigned URL (GET by default), valid for `expiresSeconds`. */
export function presignUrl(
  creds: SigV4Credentials,
  req: { method?: string; protocol?: string; host: string; path: string; expiresSeconds: number },
  date = new Date(),
): string {
  const { amzDate: stamp, dateStamp } = amzDate(date);
  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${creds.accessKeyId}/${scope(creds, dateStamp)}`,
    'X-Amz-Date': stamp,
    'X-Amz-Expires': String(req.expiresSeconds),
    'X-Amz-SignedHeaders': 'host',
  };
  const { signature: sig } = signature(creds, date, {
    method: req.method ?? 'GET',
    path: req.path,
    query,
    headers: { host: req.host },
    payloadHash: UNSIGNED_PAYLOAD,
  });
  return `${req.protocol ?? 'https'}://${req.host}${req.path}?${canonicalQuery(query)}&X-Amz-Signature=${sig}`;
}
