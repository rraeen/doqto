import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from './env';

/** Typed access to the validated environment. Inject this, not `ConfigService`. */
@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }

  get isDemo(): boolean {
    return this.get('PROVIDER_MODE') === 'demo';
  }

  /** Cookies are `Secure` whenever the API is served over https. */
  get secureCookies(): boolean {
    return this.get('API_PUBLIC_URL').startsWith('https://');
  }
}
