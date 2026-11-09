import {
  CONTRACT_VERSION,
  DELETE_CONFIRM_WORD,
  DeleteAccountRequestSchema,
  ENDPOINTS,
  PUSH_SUBSCRIPTIONS_MAX,
  PushSubscriptionRequestSchema,
  TransparencyResponseSchema,
} from './index';

const sub = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
  keys: { p256dh: 'BNc...', auth: 'xyz' },
};

describe('contract v5 (account, push, transparency)', () => {
  it('is version 5 or later', () => expect(CONTRACT_VERSION).toMatch(/^[5-9]\./));

  it('exposes the endpoints', () => {
    expect(ENDPOINTS.myData).toBe('/me/export');
    expect(ENDPOINTS.myPushSubscriptions).toBe('/me/push-subscriptions');
    expect(ENDPOINTS.myPushSubscription('abc')).toBe('/me/push-subscriptions/abc');
    expect(ENDPOINTS.transparency).toBe('/transparency');
  });

  it('a push subscription is the browser object: an https-style endpoint and two keys', () => {
    expect(PushSubscriptionRequestSchema.safeParse(sub).success).toBe(true);
    expect(PushSubscriptionRequestSchema.safeParse({ ...sub, endpoint: 'not a url' }).success).toBe(
      false,
    );
    expect(PushSubscriptionRequestSchema.safeParse({ endpoint: sub.endpoint }).success).toBe(false);
    expect(PushSubscriptionRequestSchema.safeParse({ ...sub, extra: 1 }).success).toBe(false);
    expect(PUSH_SUBSCRIPTIONS_MAX).toBe(5);
  });

  it('deleting an account needs the exact confirmation word', () => {
    expect(DeleteAccountRequestSchema.safeParse({ confirm: DELETE_CONFIRM_WORD }).success).toBe(
      true,
    );
    expect(DeleteAccountRequestSchema.safeParse({ confirm: 'delete' }).success).toBe(false);
    expect(DeleteAccountRequestSchema.safeParse({}).success).toBe(false);
  });

  it('a transparency month counts removals by reason and appeals by party', () => {
    const ok = TransparencyResponseSchema.safeParse({
      updatedAt: '2026-10-20T00:00:00.000Z',
      months: [
        {
          month: '2026-09',
          reviewsSubmitted: 40,
          reviewsPublished: 35,
          reviewsHeld: 3,
          reviewsRemoved: { abusive: 1, fake: 1 },
          appealsFiled: { doctor: 2, patient: 0 },
          appealsUpheld: { doctor: 1, patient: 0 },
        },
      ],
    });
    expect(ok.success).toBe(true);
    expect(
      TransparencyResponseSchema.safeParse({
        updatedAt: '2026-10-20T00:00:00.000Z',
        months: [{ month: 'September' }],
      }).success,
    ).toBe(false);
  });
});
