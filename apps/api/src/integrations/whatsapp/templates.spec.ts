import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  isTemplateKey,
  renderSubmissionPack,
  renderTemplate,
  WHATSAPP_TEMPLATES,
  type TemplateDefinition,
  type TemplateKey,
} from './templates';

const entries = Object.entries(WHATSAPP_TEMPLATES) as [TemplateKey, TemplateDefinition][];
const PACK = path.resolve(__dirname, '../../../../../infra/whatsapp/TEMPLATES-SUBMISSION.md');

describe('WhatsApp templates (INT-09)', () => {
  it('covers every TDD 7 use', () => {
    for (const key of [
      'otp_login',
      'otp_visit',
      'booking_confirmed',
      'reminder_day_before',
      'reminder_two_hours',
      'doctor_running_late',
      'appointment_cancelled_by_clinic',
      'turn_near',
      'review_open',
      'review_reminder',
      'review_replied',
    ]) {
      expect(isTemplateKey(key)).toBe(true);
    }
    expect(isTemplateKey('marketing_offer')).toBe(false);
  });

  describe.each(entries)('%s', (_key, t) => {
    it.each(['en', 'hi'] as const)('follows Meta body rules in %s', (lang) => {
      const body = t.body[lang];
      const used = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
      expect(new Set(used)).toEqual(new Set(t.params.map((_, i) => i + 1)));
      expect(body.trimStart()).not.toMatch(/^\{\{/);
      expect(body.trimEnd()).not.toMatch(/\}\}$/);
      expect(body).not.toMatch(/\}\}\s*\{\{/);
      expect(body.length).toBeLessThanOrEqual(1024);
      if (t.footer) expect(t.footer[lang].length).toBeLessThanOrEqual(60);
      expect(body).not.toMatch(/\b(offer|discount|sale|cashback|free)\b/i);
    });

    it('has a valid BSP name, category and samples', () => {
      expect(t.bspName).toMatch(/^[a-z0-9_]{1,512}$/);
      expect(['AUTHENTICATION', 'UTILITY']).toContain(t.category);
      for (const p of t.params) {
        expect(p.sample.en).not.toBe('');
        expect(p.sample.hi).not.toBe('');
      }
    });
  });

  it('only authentication templates carry codes, and they share one BSP template', () => {
    expect(WHATSAPP_TEMPLATES.otp_login.bspName).toBe(WHATSAPP_TEMPLATES.otp_visit.bspName);
    expect(WHATSAPP_TEMPLATES.otp_login.category).toBe('AUTHENTICATION');
    expect(entries.filter(([, t]) => t.category === 'AUTHENTICATION').map(([k]) => k)).toEqual([
      'otp_login',
      'otp_visit',
    ]);
  });

  it('every utility template that alerts repeatedly offers STOP', () => {
    for (const key of [
      'booking_confirmed',
      'doctor_running_late',
      'turn_near',
      'review_open',
    ] as const) {
      expect(WHATSAPP_TEMPLATES[key].footer?.en).toMatch(/STOP/);
      expect(WHATSAPP_TEMPLATES[key].footer?.hi).toMatch(/STOP/);
    }
  });

  it('renders with parameters and footer', () => {
    expect(renderTemplate('review_replied', 'en', ['Anil Sharma', 'https://doqto.in/r/x'])).toBe(
      'Dr Anil Sharma has replied to your review.\n\nRead the reply: https://doqto.in/r/x\n\nDoqto\n\nReply STOP to stop updates',
    );
    expect(() => renderTemplate('review_replied', 'en', ['only one'])).toThrow(
      'takes 2 parameters',
    );
  });

  it('the submission pack in infra/whatsapp is up to date', () => {
    const pack = renderSubmissionPack();
    if (process.env.WRITE_PACK === '1') {
      mkdirSync(path.dirname(PACK), { recursive: true });
      writeFileSync(PACK, pack);
    }
    expect(readFileSync(PACK, 'utf8')).toBe(pack);
  });
});
