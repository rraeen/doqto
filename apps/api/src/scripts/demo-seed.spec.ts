import { assertSeedTarget, SEED } from './demo-seed';

describe('demo seed', () => {
  const ok = { mode: 'demo', dbName: 'doqto_demo' };

  it('refuses anything but a demo database in demo mode', () => {
    expect(() => assertSeedTarget({ ...ok, dbName: 'doqto_prod' })).toThrow('Refusing to seed');
    expect(() => assertSeedTarget({ ...ok, dbName: 'doqto' })).toThrow('Refusing to seed');
    expect(() => assertSeedTarget({ ...ok, dbName: undefined })).toThrow('Refusing to seed');
    expect(() => assertSeedTarget({ ...ok, mode: 'live' })).toThrow('PROVIDER_MODE must be demo');
    expect(() =>
      assertSeedTarget({
        ...ok,
        uri: 'mongodb+srv://u:p@c.example.net/doqto_prod?retryWrites=true',
      }),
    ).toThrow('MONGODB_URI points at database "doqto_prod"');
    expect(() => assertSeedTarget(ok)).not.toThrow();
    expect(() =>
      assertSeedTarget({ ...ok, dbName: 'doqto_demo_pr12', uri: 'mongodb://localhost:27017' }),
    ).not.toThrow();
  });

  it('has 3 clinics and 5 doctors, each doctor on a known clinic, and no admin phone in source', () => {
    expect(SEED.clinics).toHaveLength(3);
    expect(SEED.doctors).toHaveLength(5);
    const keys = new Set<string>(SEED.clinics.map((c) => c.key));
    expect(SEED.doctors.every((d) => keys.has(d.clinic))).toBe(true);
    expect(JSON.stringify(SEED)).not.toContain('admin":{');
    expect(SEED.weekly).toHaveLength(12);
  });
});
