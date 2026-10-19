import { ProviderInputError } from '../errors';

/** Public objects are photos; private objects are credential scans (TDD 11). */
export type UploadKind = 'photo' | 'credential';

export const UPLOAD_LIMITS: Record<
  UploadKind,
  { maxBytes: number; contentTypes: readonly string[] }
> = {
  // Doctor and clinic photos: resized client-side, so 2 MB is generous.
  photo: { maxBytes: 2 * 1024 * 1024, contentTypes: ['image/jpeg', 'image/png', 'image/webp'] },
  // Registration certificates: phone photo or a scanned PDF.
  credential: {
    maxBytes: 5 * 1024 * 1024,
    contentTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  },
};

export const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

/** Detects the real type from the first bytes, so a renamed file cannot pass as an image. */
export function sniffContentType(body: Buffer): string | undefined {
  if (body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff)
    return 'image/jpeg';
  if (body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'image/png';
  if (
    body.subarray(0, 4).toString('latin1') === 'RIFF' &&
    body.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (body.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  return undefined;
}

/** Throws ProviderInputError unless the upload is within size and type limits and its bytes match its type. */
export function assertUploadAllowed(kind: UploadKind, body: Buffer, contentType: string): void {
  const limits = UPLOAD_LIMITS[kind];
  if (body.length === 0) throw new ProviderInputError('file is empty');
  if (body.length > limits.maxBytes) {
    throw new ProviderInputError(`file is larger than ${limits.maxBytes / (1024 * 1024)} MB`);
  }
  if (!limits.contentTypes.includes(contentType)) {
    throw new ProviderInputError(`file type ${contentType} is not allowed`);
  }
  if (sniffContentType(body) !== contentType) {
    throw new ProviderInputError('file contents do not match its type');
  }
}
