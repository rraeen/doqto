import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// OWASP lists scrypt (N=2^17, r=8, p=1) as an acceptable password hash. N=2^15 keeps a login near
// 100 ms. The parameters are stored inside each hash, so they can be raised later and old hashes
// still verify; moving to argon2id means adding a new prefix here, not a data migration.
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAX_MEM = 128 * 1024 * 1024;

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  const options: ScryptOptions = { N: n, r, p, maxmem: MAX_MEM };
  return new Promise((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, options, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

/** Password hashing for provider accounts. */
@Injectable()
export class PasswordService {
  /** A real hash of a random password, checked against when the account does not exist, so a miss costs the same time as a hit. */
  private dummy?: Promise<string>;

  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await derive(password, salt, N, R, P);
    return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const [scheme, n, r, p, salt, key] = stored.split('$');
    if (scheme !== 'scrypt' || !n || !r || !p || !salt || !key) return false;
    const expected = Buffer.from(key, 'base64');
    const actual = await derive(password, Buffer.from(salt, 'base64'), +n, +r, +p);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  /** Spend the time of a check for an unknown account. */
  async verifyAgainstNothing(password: string): Promise<false> {
    this.dummy ??= this.hash(randomBytes(12).toString('hex'));
    await this.verify(password, await this.dummy);
    return false;
  }
}
