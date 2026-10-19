import type { Request } from 'express';
import type { AppConfig } from '../../config/app-config.service';

/**
 * The patient's IP for per-IP limits. Behind Cloudflare set CLIENT_IP_HEADER=cf-connecting-ip
 * (only safe when the origin accepts traffic from Cloudflare alone); otherwise `req.ip`, which
 * honours TRUST_PROXY.
 */
export function clientIp(req: Request, config: AppConfig): string {
  const header = config.get('CLIENT_IP_HEADER');
  if (header) {
    const value = req.header(header)?.split(',')[0]?.trim();
    if (value) return value;
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}
