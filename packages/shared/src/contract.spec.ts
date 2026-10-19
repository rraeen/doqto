import {
  ApiErrorSchema,
  CursorQuerySchema,
  IstDateSchema,
  MeSchema,
  OtpRequestSchema,
  OtpVerifyRequestSchema,
  PaiseSchema,
  PhoneSchema,
  UpdateMeRequestSchema,
  pageSchema,
} from './index';

describe('contract v0', () => {
  it('accepts Indian E.164 mobiles only', () => {
    expect(PhoneSchema.safeParse('+919876543210').success).toBe(true);
    expect(PhoneSchema.safeParse('9876543210').success).toBe(false);
    expect(PhoneSchema.safeParse('+915876543210').success).toBe(false);
    expect(PhoneSchema.safeParse('+14155550100').success).toBe(false);
  });

  it('defaults otp purpose to login and rejects unknown fields', () => {
    expect(OtpRequestSchema.parse({ phone: '+919876543210' })).toEqual({
      phone: '+919876543210',
      purpose: 'login',
    });
    expect(OtpRequestSchema.safeParse({ phone: '+919876543210', purpose: 'visit' }).success).toBe(
      false,
    );
    expect(OtpRequestSchema.safeParse({ phone: '+919876543210', demo: true }).success).toBe(false);
  });

  it('requires a 6-digit code', () => {
    expect(
      OtpVerifyRequestSchema.safeParse({ phone: '+919876543210', code: '123456' }).success,
    ).toBe(true);
    expect(
      OtpVerifyRequestSchema.safeParse({ phone: '+919876543210', code: '12345' }).success,
    ).toBe(false);
  });

  it('money is integer paise and days are IST date strings', () => {
    expect(PaiseSchema.safeParse(1500).success).toBe(true);
    expect(PaiseSchema.safeParse(15.5).success).toBe(false);
    expect(IstDateSchema.safeParse('2026-10-10').success).toBe(true);
    expect(IstDateSchema.safeParse('2026-13-01').success).toBe(false);
  });

  it('PATCH /me needs at least one known field', () => {
    expect(UpdateMeRequestSchema.safeParse({}).success).toBe(false);
    expect(UpdateMeRequestSchema.safeParse({ name: 'Asha' }).success).toBe(true);
    expect(UpdateMeRequestSchema.safeParse({ roles: ['admin'] }).success).toBe(false);
  });

  it('pagination defaults and page shape', () => {
    expect(CursorQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(CursorQuerySchema.safeParse({ limit: '51' }).success).toBe(false);
    const page = pageSchema(MeSchema.pick({ id: true }));
    expect(page.safeParse({ items: [{ id: 'a'.repeat(24) }], nextCursor: null }).success).toBe(
      true,
    );
  });

  it('error envelope', () => {
    expect(
      ApiErrorSchema.safeParse({
        error: { code: 'OTP_INVALID', message: 'Wrong code', details: { attemptsLeft: 4 } },
      }).success,
    ).toBe(true);
    expect(ApiErrorSchema.safeParse({ error: { code: 'NOPE', message: 'x' } }).success).toBe(false);
  });
});
