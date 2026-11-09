import { Injectable } from '@nestjs/common';
import { AppConfig } from '../config/app-config.service';
import { ParamSealer } from '../notifications/seal';

/**
 * The visit code is hashed on the appointment for the front desk's check. The patient who booked
 * also needs to read it again in the app, so a sealed (AES-256-GCM) copy is kept next to it. Only
 * the owner's own read route opens it, and it is dropped when the visit is closed.
 */
@Injectable()
export class VisitCodeVault {
  private readonly sealer: ParamSealer;

  constructor(config: AppConfig) {
    this.sealer = new ParamSealer(`visit-code-vault:${config.get('HASH_PEPPER')}`);
  }

  seal(code: string): string {
    return this.sealer.seal({ 0: code });
  }

  open(sealed: string | undefined): string | null {
    if (!sealed) return null;
    try {
      return this.sealer.open(sealed)[0] ?? null;
    } catch {
      return null;
    }
  }
}
