import { describe, expect, it } from 'vitest';
import { enablePush, pushSupported } from './push';

describe('push in a browser without Web Push', () => {
  it('reports it is unsupported rather than failing (jsdom has no PushManager)', async () => {
    expect(pushSupported()).toBe(false);
    await expect(enablePush()).resolves.toBe('unsupported');
  });
});
