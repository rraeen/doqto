import { validateEnv } from './env';

const base = {
  PROVIDER_MODE: 'demo',
  MONGODB_URI: 'mongodb://localhost:27017',
  MONGODB_DB_NAME: 'doqto_demo_local',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  HASH_PEPPER: 'p'.repeat(16),
};

describe('validateEnv', () => {
  it('applies defaults', () => {
    const env = validateEnv(base);
    expect(env.PORT).toBe(4000);
    expect(env.JWT_ACCESS_TTL).toBe(900);
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(30);
    expect(env.CORS_ORIGINS).toEqual([]);
    expect(env.COOKIE_DOMAIN).toBeUndefined();
  });

  it('parses lists and durations', () => {
    const env = validateEnv({
      ...base,
      CORS_ORIGINS: 'http://a.test, http://b.test',
      JWT_ACCESS_TTL: '1h',
    });
    expect(env.CORS_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
    expect(env.JWT_ACCESS_TTL).toBe(3600);
  });

  it('trims Windows CRLF on durations', () => {
    const env = validateEnv({ ...base, JWT_ACCESS_TTL: '15m\r' });
    expect(env.JWT_ACCESS_TTL).toBe(900);
  });

  it('fails fast listing every missing variable', () => {
    expect(() => validateEnv({})).toThrow(
      /PROVIDER_MODE[\s\S]*MONGODB_URI[\s\S]*JWT_ACCESS_SECRET/,
    );
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: 'short' })).toThrow(/at least 32/);
    expect(() => validateEnv({ ...base, PROVIDER_MODE: 'maybe' })).toThrow(/PROVIDER_MODE/);
  });
});

describe('validateEnv demo safety (TDD 13)', () => {
  it('refuses demo mode on a non-demo database', () => {
    expect(() => validateEnv({ ...base, MONGODB_DB_NAME: 'doqto_prod' })).toThrow(
      /Refusing to start/,
    );
    expect(() => validateEnv({ ...base, MONGODB_URI: 'mongodb://h/doqto_prod' })).toThrow(
      /Refusing to start/,
    );
  });
});
