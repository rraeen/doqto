import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM for secret template parameters (the visit code in `booking_confirmed`). The plain
 * code must not sit in the outbox (RD on INT-08), but the sender needs it once. The row keeps
 * only this ciphertext until it is sent, then drops it.
 */
export class ParamSealer {
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = createHash('sha256').update(`notification-seal:${secret}`).digest();
  }

  seal(values: Record<number, string>): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ct = Buffer.concat([cipher.update(JSON.stringify(values), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64url');
  }

  open(sealed: string): Record<number, string> {
    const buf = Buffer.from(sealed, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', this.key, buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    const text = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString();
    return JSON.parse(text) as Record<number, string>;
  }
}
