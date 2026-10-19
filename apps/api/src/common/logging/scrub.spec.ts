import { scrubPersonalData } from './scrub';

describe('scrubPersonalData', () => {
  it('removes phones and codes from error text but keeps stack positions', () => {
    const msg =
      'E11000 duplicate key error collection: users index: phone_1 dup key: { phone: "+919876543210" } code 123456 visit 4321\n    at Foo (/app/dist/x.js:1234:56)';
    const out = scrubPersonalData(msg);
    expect(out).not.toContain('9876543210');
    expect(out).not.toContain('123456');
    expect(out).not.toContain('4321');
    expect(out).toContain('E11000');
    expect(out).toContain('x.js:1234:56');
  });
});
