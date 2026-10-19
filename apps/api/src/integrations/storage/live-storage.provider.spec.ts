import { ProviderNotConfiguredError } from '../errors';
import { R2StorageProvider } from './live-storage.provider';
import { JPEG, PDF, PNG, WEBP } from './test-files';
import { assertUploadAllowed, sniffContentType } from './upload-limits';

const r2 = {
  accountId: 'acc123',
  accessKeyId: 'AKIDEXAMPLE',
  secretAccessKey: 'secret-example',
  publicBucket: 'doqto-public',
  publicBaseUrl: 'https://media.doqto.in/',
  privateBucket: 'doqto-private',
};

function fakeFetch(status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(null, { status });
  }) as typeof fetch;
  return { calls, impl };
}

describe('R2StorageProvider', () => {
  it('PUTs photos to the public bucket with a SigV4 header and returns the public URL', async () => {
    const f = fakeFetch();
    const p = new R2StorageProvider(r2, 300, f.impl);
    const out = await p.putPublic({
      key: 'doctors/d_1/photo.v2.jpg',
      body: JPEG,
      contentType: 'image/jpeg',
    });
    expect(out.url).toBe('https://media.doqto.in/doctors/d_1/photo.v2.jpg');
    expect(f.calls).toHaveLength(1);
    const call = f.calls[0]!;
    expect(call.url).toBe(
      'https://acc123.r2.cloudflarestorage.com/doqto-public/doctors/d_1/photo.v2.jpg',
    );
    expect(call.init.method).toBe('PUT');
    const headers = call.init.headers as Record<string, string>;
    expect(headers.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/auto\/s3\/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/,
    );
    expect(headers['x-amz-content-sha256']).toMatch(/^[0-9a-f]{64}$/);
  });

  it('PUTs credentials to the private bucket', async () => {
    const f = fakeFetch();
    await new R2StorageProvider(r2, 300, f.impl).putPrivate({
      key: 'credentials/d1/reg.pdf',
      body: PDF,
      contentType: 'application/pdf',
    });
    expect(f.calls[0]?.url).toBe(
      'https://acc123.r2.cloudflarestorage.com/doqto-private/credentials/d1/reg.pdf',
    );
  });

  it('presigns private GETs that expire in 5 minutes by default', async () => {
    const p = new R2StorageProvider(r2, 300, fakeFetch().impl);
    const url = new URL(
      await p.signedUrl('credentials/d1/reg.pdf', undefined, new Date('2026-10-10T00:00:00Z')),
    );
    expect(url.host).toBe('acc123.r2.cloudflarestorage.com');
    expect(url.pathname).toBe('/doqto-private/credentials/d1/reg.pdf');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-Date')).toBe('20261010T000000Z');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    await expect(p.signedUrl('a.pdf', 3601)).rejects.toThrow();
  });

  it('surfaces upload failures without the response body', async () => {
    const p = new R2StorageProvider(r2, 300, fakeFetch(403).impl);
    await expect(
      p.putPrivate({ key: 'a.pdf', body: PDF, contentType: 'application/pdf' }),
    ).rejects.toThrow('R2 upload failed with HTTP 403');
  });

  it('enforces limits before any network call', async () => {
    const f = fakeFetch();
    const p = new R2StorageProvider(r2, 300, f.impl);
    await expect(
      p.putPublic({ key: 'a.pdf', body: PDF, contentType: 'application/pdf' }),
    ).rejects.toThrow();
    await expect(
      p.putPublic({ key: '../a.jpg', body: JPEG, contentType: 'image/jpeg' }),
    ).rejects.toThrow();
    expect(f.calls).toHaveLength(0);
  });

  it('throws not configured when keys are missing', async () => {
    const p = new R2StorageProvider({}, 300, fakeFetch().impl);
    await expect(
      p.putPrivate({ key: 'a.pdf', body: PDF, contentType: 'application/pdf' }),
    ).rejects.toThrow(ProviderNotConfiguredError);
  });
});

describe('upload limits', () => {
  it('sniffs real types', () => {
    expect(sniffContentType(JPEG)).toBe('image/jpeg');
    expect(sniffContentType(PNG)).toBe('image/png');
    expect(sniffContentType(WEBP)).toBe('image/webp');
    expect(sniffContentType(PDF)).toBe('application/pdf');
    expect(sniffContentType(Buffer.from('<svg/>'))).toBeUndefined();
  });

  it('rejects empty, oversized, disallowed and mislabelled files', () => {
    expect(() => assertUploadAllowed('photo', Buffer.alloc(0), 'image/jpeg')).toThrow('empty');
    const big = Buffer.concat([JPEG, Buffer.alloc(2 * 1024 * 1024)]);
    expect(() => assertUploadAllowed('photo', big, 'image/jpeg')).toThrow('larger than 2 MB');
    expect(() => assertUploadAllowed('credential', big, 'image/jpeg')).not.toThrow();
    expect(() => assertUploadAllowed('photo', Buffer.from('<svg/>'), 'image/svg+xml')).toThrow(
      'not allowed',
    );
    expect(() => assertUploadAllowed('photo', PNG, 'image/jpeg')).toThrow('do not match');
  });
});
