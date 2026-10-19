import { HealthResponseSchema, ApiErrorSchema } from '@doqto/shared';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './app';

describe('GET /api/v1/health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('returns status, version and provider mode', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(HealthResponseSchema.parse(res.body)).toEqual({
      status: 'ok',
      version: 'test',
      providerMode: 'demo',
    });
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('serves Swagger at /api/docs', async () => {
    await request(app.getHttpServer()).get('/api/docs').expect(200);
    const json = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    expect(Object.keys(json.body.paths)).toContain('/api/v1/health');
  });

  it('renders unknown routes in the error envelope', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/nope').expect(404);
    expect(ApiErrorSchema.parse(res.body).error.code).toBe('NOT_FOUND');
  });

  it('allows CORS only for allowlisted origins', async () => {
    const ok = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:3000');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    const bad = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'https://evil.example');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
});
