import {
  Controller,
  Get,
  Headers,
  Inject,
  type INestApplication,
  Module,
  Query,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { IntegrationsModule } from './integrations.module';
import type { OtpProvider } from './otp/otp.provider';
import { DemoPaymentProvider } from './payment/demo-payment.provider';
import type { ProviderInfo } from './provider-mode';
import {
  assertProviderSafety,
  databaseNameFromUri,
  providerSafetyProblems,
  UnsafeProviderConfigError,
  type SafetyInput,
} from './provider-safety';
import { testIntegrationsConfig } from './test-config';
import { BOUND_PROVIDERS, OTP_PROVIDER, PAYMENT_PROVIDER } from './tokens';

const demo = (over: Partial<SafetyInput> = {}): SafetyInput => ({
  mode: 'demo',
  nodeEnv: 'production',
  mongodbUri: 'mongodb+srv://user:pw@cluster0.abc.mongodb.net/?retryWrites=true',
  mongodbDbName: 'doqto_demo',
  ...over,
});
const live = (over: Partial<SafetyInput> = {}): SafetyInput =>
  demo({ mode: 'live', mongodbDbName: 'doqto_prod', ...over });
const liveSet: ProviderInfo[] = [
  { providerName: 'live-otp', mode: 'live' },
  { providerName: 'razorpay', mode: 'live' },
];

describe('providerSafetyProblems (TDD 13 rule 2)', () => {
  it('allows the demo deployment on doqto_demo', () => {
    expect(providerSafetyProblems(demo(), [])).toEqual([]);
    expect(
      providerSafetyProblems(
        demo({ nodeEnv: 'development', mongodbDbName: 'doqto_demo_local' }),
        [],
      ),
    ).toEqual([]);
  });

  it.each(['doqto', 'doqto_prod', 'production', 'demo_doqto', 'Doqto_demo', ''])(
    'refuses demo mode on database %p',
    (mongodbDbName) => {
      expect(providerSafetyProblems(demo({ mongodbDbName }), [])).not.toEqual([]);
    },
  );

  it('refuses demo mode with NODE_ENV=production and a production database name', () => {
    const problems = providerSafetyProblems(demo({ mongodbDbName: 'doqto_demo_prod' }), []);
    expect(problems.join()).toMatch(/NODE_ENV=production/);
  });

  it('refuses demo mode when the URI path names another database', () => {
    const problems = providerSafetyProblems(
      demo({
        mongodbUri: 'mongodb+srv://u:p@cluster0.abc.mongodb.net/doqto_prod?retryWrites=true',
      }),
      [],
    );
    expect(problems.join()).toMatch(/MONGODB_URI points at database "doqto_prod"/);
  });

  it('refuses live mode when any Demo* provider is bound', () => {
    const bound = [...liveSet, { providerName: 'demo-payment', mode: 'demo' as const }];
    expect(providerSafetyProblems(live(), bound)).toEqual([
      'PROVIDER_MODE=live but demo providers are bound: demo-payment',
    ]);
    expect(providerSafetyProblems(live(), liveSet)).toEqual([]);
  });

  it('throws one error listing every problem', () => {
    expect(() =>
      assertProviderSafety(
        demo({ mongodbDbName: 'doqto_prod', mongodbUri: 'mongodb://h/prod' }),
        [],
      ),
    ).toThrow(UnsafeProviderConfigError);
  });

  it('reads the database name from a URI', () => {
    expect(databaseNameFromUri('mongodb://localhost:27017/?replicaSet=rs0')).toBeUndefined();
    expect(databaseNameFromUri('mongodb://localhost:27017')).toBeUndefined();
    expect(databaseNameFromUri('mongodb+srv://u:p@c.net/doqto_demo?x=1')).toBe('doqto_demo');
  });
});

describe('IntegrationsModule refuses to start on unsafe config', () => {
  it('demo mode on a production database name', async () => {
    const config = testIntegrationsConfig({
      mode: 'demo',
      nodeEnv: 'production',
      mongodbDbName: 'doqto_prod',
    });
    await expect(
      Test.createTestingModule({ imports: [IntegrationsModule.forRoot({ config })] }).compile(),
    ).rejects.toThrow(UnsafeProviderConfigError);
  });

  it('live mode with a Demo* provider bound', async () => {
    const config = testIntegrationsConfig({ mode: 'live', mongodbDbName: 'doqto_prod' });
    await expect(
      Test.createTestingModule({ imports: [IntegrationsModule.forRoot({ config })] })
        .overrideProvider(PAYMENT_PROVIDER)
        .useValue(new DemoPaymentProvider(config))
        .compile(),
    ).rejects.toThrow('demo providers are bound: demo-payment');
  });

  it('starts when safe', async () => {
    const config = testIntegrationsConfig({ mode: 'live', mongodbDbName: 'doqto_prod' });
    const ref = await Test.createTestingModule({
      imports: [IntegrationsModule.forRoot({ config })],
    }).compile();
    expect(ref.get<ProviderInfo[]>(BOUND_PROVIDERS)).toHaveLength(6);
  });
});

/** Minimal app exposing what demo mode changes, to prove requests cannot toggle it (TDD 13 rule 4). */
@Controller('probe')
class ProbeController {
  constructor(
    @Inject(OTP_PROVIDER) private readonly otp: OtpProvider,
    @Inject(BOUND_PROVIDERS) private readonly bound: ProviderInfo[],
  ) {}

  @Get()
  async probe(@Headers() _headers: unknown, @Query() _query: unknown) {
    const phone = '+919812345678';
    const fixedOtpAccepted = await this.otp
      .send({ phone, purpose: 'login', language: 'en' })
      .then((c) =>
        this.otp.verify({ phone, purpose: 'login', code: '123456', stored: { ...c, attempts: 0 } }),
      )
      .then((r) => r.ok)
      .catch(() => false);
    return { modes: [...new Set(this.bound.map((p) => p.mode))], fixedOtpAccepted };
  }
}

const TOGGLE_HEADERS = {
  'x-provider-mode': 'demo',
  'x-demo-mode': 'true',
  'x-demo': '1',
  'provider-mode': 'demo',
  cookie: 'PROVIDER_MODE=demo; demo=1',
};
const TOGGLE_QUERY = '?PROVIDER_MODE=demo&providerMode=demo&demo=true';

async function probeApp(mode: 'demo' | 'live'): Promise<INestApplication> {
  const config = testIntegrationsConfig({
    mode,
    mongodbDbName: mode === 'demo' ? 'doqto_demo_test' : 'doqto_prod',
  });
  @Module({ imports: [IntegrationsModule.forRoot({ config })], controllers: [ProbeController] })
  class ProbeModule {}
  const ref = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
  const app = ref.createNestApplication({ logger: false });
  await app.init();
  return app;
}

describe('no request can toggle demo behaviour (TDD 13 rule 4)', () => {
  it('a live app stays live whatever headers, cookies or query flags say', async () => {
    const app = await probeApp('live');
    const plain = await request(app.getHttpServer()).get('/probe');
    const toggled = await request(app.getHttpServer())
      .get(`/probe${TOGGLE_QUERY}`)
      .set(TOGGLE_HEADERS);
    expect(plain.body).toEqual({ modes: ['live'], fixedOtpAccepted: false });
    expect(toggled.body).toEqual(plain.body);
    await app.close();
  });

  it('a demo app stays demo whatever headers say', async () => {
    const app = await probeApp('demo');
    const toggled = await request(app.getHttpServer())
      .get('/probe?PROVIDER_MODE=live')
      .set({ 'x-provider-mode': 'live', 'x-demo-mode': 'false' });
    expect(toggled.body).toEqual({ modes: ['demo'], fixedOtpAccepted: true });
    await app.close();
  });

  it('no API source reads a demo or provider-mode flag from a request', () => {
    const srcRoot = path.resolve(__dirname, '..');
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
          const text = readFileSync(full, 'utf8');
          // req.headers['x-demo'], req.query.demo, @Headers('x-provider-mode'), @Query('demo'), ...
          const readsFlag =
            /\b(headers|query|cookies|params|body)\s*(\??\.\s*|\[\s*['"`])[\w-]*(demo|provider[-_]?mode)/i.test(
              text,
            ) ||
            /@(Headers|Query|Param|Body|Req)\(\s*['"`][^'"`]*(demo|provider[-_]?mode)/i.test(
              text,
            ) ||
            /\b(req|request)\.(get|header)\(\s*['"`][^'"`]*(demo|provider[-_]?mode)/i.test(text);
          if (readsFlag) {
            offenders.push(path.relative(srcRoot, full));
          }
          const rel = path.relative(srcRoot, full);
          if (
            /process\.env\.PROVIDER_MODE|process\.env\[['"]PROVIDER_MODE/.test(text) &&
            !rel.startsWith('config')
          ) {
            offenders.push(`${rel} (reads PROVIDER_MODE outside config)`);
          }
        }
      }
    };
    walk(srcRoot);
    expect(offenders).toEqual([]);
  });
});
