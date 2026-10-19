import type { Request } from 'express';
import type { AppConfig } from '../../config/app-config.service';
import { clientIp } from './client-ip';

const config = (header?: string) => ({ get: () => header }) as unknown as AppConfig;
const req = (headers: Record<string, string>, ip = '10.0.0.1') =>
  ({ ip, socket: {}, header: (n: string) => headers[n.toLowerCase()] }) as unknown as Request;

describe('clientIp', () => {
  it('uses req.ip (TRUST_PROXY aware) by default and ignores CF headers', () => {
    expect(clientIp(req({ 'cf-connecting-ip': '1.2.3.4' }), config())).toBe('10.0.0.1');
  });

  it('uses the configured header behind Cloudflare, falling back to req.ip', () => {
    expect(clientIp(req({ 'cf-connecting-ip': '1.2.3.4' }), config('cf-connecting-ip'))).toBe(
      '1.2.3.4',
    );
    expect(clientIp(req({}), config('cf-connecting-ip'))).toBe('10.0.0.1');
  });
});
