import { Reflector } from '@nestjs/core';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { AppConfig } from '../../config/app-config.service';
import { ClientIpThrottlerGuard } from './client-ip-throttler.guard';

class Probe extends ClientIpThrottlerGuard {
  tracker(req: Record<string, unknown>) {
    return this.getTracker(req);
  }
}

const req = (headers: Record<string, string>, ip = '10.0.0.1') => ({
  ip,
  socket: {},
  header: (name: string) => headers[name.toLowerCase()],
});

describe('ClientIpThrottlerGuard', () => {
  const make = (header?: string) =>
    new Probe({ throttlers: [] }, {} as ThrottlerStorage, new Reflector(), {
      get: () => header,
    } as unknown as AppConfig);

  it('keys on CLIENT_IP_HEADER when set, like the OTP limits', async () => {
    const guard = make('cf-connecting-ip');
    await expect(guard.tracker(req({ 'cf-connecting-ip': '203.0.113.7' }))).resolves.toBe(
      '203.0.113.7',
    );
    await expect(guard.tracker(req({}))).resolves.toBe('10.0.0.1');
  });

  it('falls back to req.ip without the header setting', async () => {
    await expect(make().tracker(req({ 'cf-connecting-ip': '203.0.113.7' }))).resolves.toBe(
      '10.0.0.1',
    );
  });
});
