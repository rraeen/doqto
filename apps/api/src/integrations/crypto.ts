import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export function hmacSha256Hex(secret: string, data: string | Buffer): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Peppered hash for short secrets (OTPs, visit codes, tokens). `scope` keeps
 * hashes of the same value in different contexts from matching.
 */
export function hashSecret(pepper: string, scope: string, value: string): string {
  return hmacSha256Hex(pepper, `${scope}\u0000${value}`);
}

/** Constant-time comparison of two hex strings. */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ab.length !== bb.length || ab.length * 2 !== a.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Cryptographically random numeric code with leading zeros kept. */
export function randomNumericCode(length: number): string {
  let code = '';
  for (let i = 0; i < length; i++) code += String(randomInt(0, 10));
  return code;
}

export function randomId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${randomInt(0, 2 ** 40).toString(36)}`;
}

export const E164 = /^\+[1-9]\d{7,14}$/;
