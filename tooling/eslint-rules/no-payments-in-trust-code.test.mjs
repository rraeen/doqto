// Proves the TDD 5.8 boundary through the real root ESLint config.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const eslint = new ESLint({ cwd: root });
const RULE = 'doqto/no-payments-in-trust-code';

async function boundaryErrors(code, relPath) {
  const [result] = await eslint.lintText(code, { filePath: path.join(root, relPath) });
  return result.messages.filter((m) => m.ruleId === RULE);
}

const fixture = (name) =>
  fs.readFileSync(path.join(root, 'tooling/eslint-rules/__fixtures__', name), 'utf8');

test('violating fixture: reviews importing payments fails lint', async () => {
  const errors = await boundaryErrors(
    fixture('reviews-imports-payments.ts'),
    'apps/api/src/reviews/reviews.service.ts',
  );
  assert.equal(errors.length, 1);
  assert.equal(errors[0].severity, 2);
});

test('allowed fixture: ranking without payments passes', async () => {
  const errors = await boundaryErrors(
    fixture('ranking-allowed.ts'),
    'apps/api/src/doctors/ranking.ts',
  );
  assert.equal(errors.length, 0);
});

const forbidden = [
  ['apps/api/src/reviews/x.ts', "import { a } from '../payments';"],
  ['apps/api/src/reviews/sub/x.ts', "import { a } from '../../payments/dto/a.dto';"],
  ['apps/api/src/reviews/x.ts', "import type { P } from '../payments/payment.schema';"],
  ['apps/api/src/reviews/x.ts', "export * from '../payments/payments.module';"],
  ['apps/api/src/reviews/x.ts', "export { a } from '../payments/a';"],
  ['apps/api/src/reviews/x.ts', "const m = await import('../payments/a'); export { m };"],
  ['apps/api/src/reviews/x.ts', "const m = require('../payments/a'); export { m };"],
  ['apps/api/src/reviews/x.ts', "import { a } from 'src/payments/a';"],
  ['apps/api/src/reviews/x.ts', "import { a } from '@/payments/a';"],
  ['apps/api/src/reviews/x.ts', "import Razorpay from 'razorpay'; export { Razorpay };"],
  ['apps/api/src/ranking/score.ts', "import { a } from '../payments/a';"],
  ['apps/api/src/doctors/doctor-ranking.service.ts', "import { a } from '../payments/a';"],
  ['apps/api/src/doctors/ranking/rank.ts', "import { a } from '../../payments/a';"],
  ['apps/api/src/reviews/x.ts', "import { a } from '../subscriptions/a';"],
  ['apps/api/src/reviews/x.ts', "import { a } from '@doqto/api/subscriptions';"],
  ['apps/api/src/reviews/x.ts', "import { a } from '@payments/a';"],
  ['apps/api/src/search/search.service.ts', "import { a } from '../payments/a';"],
  ['apps/api/src/search/search.service.ts', "import { a } from '../subscriptions/plans';"],
];

for (const [file, code] of forbidden) {
  test(`forbidden in ${file}: ${code}`, async () => {
    const errors = await boundaryErrors(code, file);
    assert.equal(errors.length, 1, JSON.stringify(errors));
  });
}

const allowed = [
  ['apps/api/src/reviews/x.ts', "import { a } from '../users/users.service';"],
  ['apps/api/src/reviews/x.ts', "import { a } from './payment-reason.enum';"],
  ['apps/api/src/reviews/x.ts', "import { a } from '@doqto/shared';"],
  ['apps/api/src/search/search.service.ts', "import { a } from '../doctors/doctors.service';"],
  // Payments may be imported by other modules, e.g. appointments.
  ['apps/api/src/appointments/x.ts', "import { a } from '../payments/a';"],
];

for (const [file, code] of allowed) {
  test(`allowed in ${file}: ${code}`, async () => {
    const errors = await boundaryErrors(code, file);
    assert.equal(errors.length, 0, JSON.stringify(errors));
  });
}
