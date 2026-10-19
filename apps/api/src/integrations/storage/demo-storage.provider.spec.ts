import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { IntegrationsModule } from '../integrations.module';
import { testIntegrationsConfig } from '../test-config';
import { STORAGE_PROVIDER } from '../tokens';
import { DemoStorageProvider } from './demo-storage.provider';
import type { StorageProvider } from './storage.provider';
import { JPEG, PDF } from './test-files';

describe('DemoStorageProvider', () => {
  let dir: string;
  let storage: DemoStorageProvider;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'doqto-storage-'));
    storage = new DemoStorageProvider(testIntegrationsConfig({ demoStorageDir: dir }));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes public photos locally and returns an API URL', async () => {
    const r = await storage.putPublic({
      key: 'doctors/d1/photo.jpg',
      body: JPEG,
      contentType: 'image/jpeg',
    });
    expect(r).toEqual({
      key: 'doctors/d1/photo.jpg',
      size: JPEG.length,
      contentType: 'image/jpeg',
      url: 'http://localhost:4000/api/v1/demo-storage/public/doctors/d1/photo.jpg',
    });
    await expect(storage.read('public', 'doctors/d1/photo.jpg')).resolves.toEqual({
      body: JPEG,
      contentType: 'image/jpeg',
    });
  });

  it('keeps private files apart and serves them only by signed URL', async () => {
    await storage.putPrivate({
      key: 'credentials/d1/reg.pdf',
      body: PDF,
      contentType: 'application/pdf',
    });
    await expect(storage.read('public', 'credentials/d1/reg.pdf')).rejects.toThrow();
    const now = new Date('2026-10-10T00:00:00Z');
    const url = new URL(await storage.signedUrl('credentials/d1/reg.pdf', undefined, now));
    expect(url.pathname).toBe('/api/v1/demo-storage/private/credentials/d1/reg.pdf');
    const expires = Number(url.searchParams.get('expires'));
    const sig = url.searchParams.get('sig') ?? '';
    expect(expires - now.getTime() / 1000).toBe(300);
    expect(storage.verifySignedUrl('credentials/d1/reg.pdf', expires, sig, now)).toBe(true);
    expect(
      storage.verifySignedUrl(
        'credentials/d1/reg.pdf',
        expires,
        sig,
        new Date((expires + 1) * 1000),
      ),
    ).toBe(false);
    expect(storage.verifySignedUrl('credentials/d2/reg.pdf', expires, sig, now)).toBe(false);
    expect(storage.verifySignedUrl('credentials/d1/reg.pdf', expires + 3600, sig, now)).toBe(false);
  });

  it('applies upload limits: photos only on the public side', async () => {
    await expect(
      storage.putPublic({ key: 'a.pdf', body: PDF, contentType: 'application/pdf' }),
    ).rejects.toThrow('not allowed');
    await expect(
      storage.putPublic({ key: 'a.jpg', body: PDF, contentType: 'image/jpeg' }),
    ).rejects.toThrow('do not match');
  });

  it.each(['../escape.txt', 'a/../../b', '/abs', 'a//b', 'a/./b', '', 'a\\b', 'a b'])(
    'rejects key %p',
    async (key) => {
      await expect(
        storage.putPrivate({ key, body: PDF, contentType: 'application/pdf' }),
      ).rejects.toThrow('invalid storage key');
    },
  );

  it('rejects out-of-range signed URL lifetimes', async () => {
    await expect(storage.signedUrl('a.pdf', 0)).rejects.toThrow();
    await expect(storage.signedUrl('a.pdf', 3601)).rejects.toThrow();
  });
});

describe('DemoStorageController (/api/v1/demo-storage)', () => {
  let dir: string;
  let app: INestApplication;
  let storage: StorageProvider;

  async function boot(mode: 'demo' | 'live') {
    const config = testIntegrationsConfig({
      mode,
      demoStorageDir: dir,
      mongodbDbName: mode === 'demo' ? 'doqto_demo_test' : 'doqto_prod',
    });
    const ref = await Test.createTestingModule({
      imports: [IntegrationsModule.forRoot({ config })],
    }).compile();
    app = ref.createNestApplication({ logger: false });
    app.setGlobalPrefix('api/v1');
    await app.init();
    storage = ref.get<StorageProvider>(STORAGE_PROVIDER);
  }

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'doqto-storage-'));
  });
  afterEach(async () => {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  });

  it('serves public photos with their type', async () => {
    await boot('demo');
    await storage.putPublic({ key: 'clinics/c1/front.jpg', body: JPEG, contentType: 'image/jpeg' });
    const res = await request(app.getHttpServer()).get(
      '/api/v1/demo-storage/public/clinics/c1/front.jpg',
    );
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/jpeg');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.from(res.body as Buffer)).toEqual(JPEG);
  });

  it('serves private files only with a valid signed URL', async () => {
    await boot('demo');
    await storage.putPrivate({
      key: 'credentials/d1/reg.pdf',
      body: PDF,
      contentType: 'application/pdf',
    });
    const signed = new URL(await storage.signedUrl('credentials/d1/reg.pdf'));
    const ok = await request(app.getHttpServer()).get(signed.pathname + signed.search);
    expect(ok.status).toBe(200);
    expect(ok.headers['cache-control']).toBe('private, no-store');
    expect(ok.headers['content-disposition']).toBe('attachment');
    const bare = await request(app.getHttpServer()).get(signed.pathname);
    expect(bare.status).toBe(403);
    const sig = signed.searchParams.get('sig') ?? '';
    const flipped = `${sig[0] === '0' ? '1' : '0'}${sig.slice(1)}`;
    const tampered = await request(app.getHttpServer()).get(
      `${signed.pathname}?expires=${signed.searchParams.get('expires')}&sig=${flipped}`,
    );
    expect(tampered.status).toBe(403);
    const publicPath = await request(app.getHttpServer()).get(
      '/api/v1/demo-storage/public/credentials/d1/reg.pdf',
    );
    expect(publicPath.status).toBe(404);
  });

  it('returns 404 for traversal attempts', async () => {
    await boot('demo');
    const res = await request(app.getHttpServer()).get(
      '/api/v1/demo-storage/public/..%2F..%2Fetc%2Fpasswd',
    );
    expect(res.status).toBe(404);
  });

  it('does not exist in live mode', async () => {
    await boot('live');
    const res = await request(app.getHttpServer()).get('/api/v1/demo-storage/public/a.jpg');
    expect(res.status).toBe(404);
  });
});
