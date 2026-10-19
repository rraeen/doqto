import type { MessageLanguage } from '../messaging.types';

/**
 * Every Phase 1 WhatsApp template (TDD 7), in English and Hindi. Submitted to
 * the BSP in one batch; `renderSubmissionPack()` produces the document Raunak
 * pastes into the BSP portal (infra/whatsapp/TEMPLATES-SUBMISSION.md).
 *
 * Meta rules followed (checked in templates.spec.ts): parameters are numbered
 * {{1}}..{{n}} with none skipped, a body never starts or ends with a
 * parameter, two parameters are never adjacent, body <= 1024 characters,
 * footer <= 60. Utility templates only; no marketing (TDD 7).
 */
export type TemplateCategory = 'AUTHENTICATION' | 'UTILITY';

export interface TemplateParam {
  name: string;
  sample: { en: string; hi: string };
}

export interface TemplateDefinition {
  /** Template name registered with the BSP (lower case, underscores). */
  bspName: string;
  category: TemplateCategory;
  /** What sends it, for reviewers and the BSP form. */
  trigger: string;
  params: readonly TemplateParam[];
  body: Readonly<Record<MessageLanguage, string>>;
  footer?: Readonly<Record<MessageLanguage, string>>;
}

const STOP_FOOTER = {
  en: 'Reply STOP to stop updates',
  hi: 'अपडेट बंद करने के लिए STOP लिखें',
} as const;

const p = (name: string, en: string, hi = en): TemplateParam => ({ name, sample: { en, hi } });
const doctor = p('doctorName', 'Anil Sharma', 'अनिल शर्मा');
const clinic = p('clinicName', 'Sharma Clinic, Civil Lines', 'शर्मा क्लिनिक, सिविल लाइन्स');
const statusLink = p('liveStatusLink', 'https://doqto.in/a/7Kp2Qx');

/**
 * Authentication templates use Meta's fixed wording (Meta writes the text,
 * including the Hindi translation); only the code is ours. Login and walk-in
 * OTPs share one approved template.
 */
const OTP: TemplateDefinition = {
  bspName: 'doqto_otp',
  category: 'AUTHENTICATION',
  trigger:
    'Login OTP (POST /auth/otp/request) and walk-in check-in OTP (INT-08). Sent directly, never stored in the outbox.',
  params: [p('code', '482913')],
  body: {
    en: '*{{1}}* is your verification code. For your security, do not share this code.',
    hi: '*{{1}}* आपका वेरिफ़िकेशन कोड है। अपनी सुरक्षा के लिए, इसे किसी के साथ शेयर न करें।',
  },
  footer: { en: 'This code expires in 5 minutes.', hi: 'यह कोड 5 मिनट में समाप्त हो जाएगा।' },
};

export const WHATSAPP_TEMPLATES = {
  otp_login: OTP,
  otp_visit: OTP,

  booking_confirmed: {
    bspName: 'doqto_booking_confirmed',
    category: 'UTILITY',
    trigger: 'Payment webhook confirms a booking (BE-27); also manual bookings with a visit code.',
    params: [
      doctor,
      clinic,
      p('date', 'Mon, 12 Oct', 'सोम, 12 अक्टूबर'),
      p('time', '10:30 AM', 'सुबह 10:30'),
      p('visitCode', '4821'),
      statusLink,
    ],
    body: {
      en: 'Your appointment with Dr {{1}} at {{2}} is confirmed for {{3}} at {{4}}.\n\nYour visit code is *{{5}}*. Tell it to the front desk when you arrive.\n\nSee live status and your place in the queue: {{6}}\n\nDoqto',
      hi: 'आपकी अपॉइंटमेंट डॉ. {{1}} के साथ {{2}} में {{3}} को {{4}} बजे पक्की हो गई है।\n\nआपका विज़िट कोड *{{5}}* है। क्लिनिक पहुँचकर रिसेप्शन पर यह कोड बताएँ।\n\nलाइव स्टेटस और कतार में अपनी जगह देखें: {{6}}\n\nDoqto',
    },
    footer: STOP_FOOTER,
  },

  reminder_day_before: {
    bspName: 'doqto_reminder_day_before',
    category: 'UTILITY',
    trigger: 'Evening-before reminder job (BE-30).',
    params: [doctor, clinic, p('time', '10:30 AM', 'सुबह 10:30'), statusLink],
    body: {
      en: 'Reminder: your appointment with Dr {{1}} at {{2}} is tomorrow at {{3}}.\n\nCheck whether the doctor is running late before you leave: {{4}}\n\nReply CANCEL if you can no longer come.',
      hi: 'याद दिलाना: डॉ. {{1}} के साथ {{2}} में आपकी अपॉइंटमेंट कल {{3}} बजे है।\n\nनिकलने से पहले देख लें कि डॉक्टर देर से तो नहीं चल रहे: {{4}}\n\nअगर आप नहीं आ पाएँगे तो CANCEL लिखें।',
    },
    footer: STOP_FOOTER,
  },

  reminder_two_hours: {
    bspName: 'doqto_reminder_two_hours',
    category: 'UTILITY',
    trigger: '2-hours-before reminder job (BE-30).',
    params: [doctor, clinic, p('time', '10:30 AM', 'सुबह 10:30'), statusLink],
    body: {
      en: 'Your appointment with Dr {{1}} at {{2}} is today at {{3}}.\n\nLive status: {{4}}\n\nReply STATUS for an update or CANCEL to cancel.',
      hi: 'डॉ. {{1}} के साथ {{2}} में आपकी अपॉइंटमेंट आज {{3}} बजे है।\n\nलाइव स्टेटस: {{4}}\n\nताज़ा जानकारी के लिए STATUS लिखें, रद्द करने के लिए CANCEL लिखें।',
    },
    footer: STOP_FOOTER,
  },

  doctor_running_late: {
    bspName: 'doqto_doctor_running_late',
    category: 'UTILITY',
    trigger: 'Status alert: running late by 20+ minutes, or the delay grows by 15+ more (BE-22).',
    params: [doctor, p('delayMinutes', '30'), statusLink],
    body: {
      en: 'Dr {{1}} is running about {{2}} minutes late today. Your appointment is still on.\n\nSee the latest status before you leave: {{3}}\n\nReply CANCEL if you can no longer come.',
      hi: 'डॉ. {{1}} आज लगभग {{2}} मिनट देर से चल रहे हैं। आपकी अपॉइंटमेंट रद्द नहीं हुई है।\n\nनिकलने से पहले ताज़ा स्टेटस देखें: {{3}}\n\nअगर आप नहीं आ पाएँगे तो CANCEL लिखें।',
    },
    footer: STOP_FOOTER,
  },

  appointment_cancelled_by_clinic: {
    bspName: 'doqto_appointment_cancelled_by_clinic',
    category: 'UTILITY',
    trigger:
      'Doctor on leave or done early with bookings left; clinic-side cancel (BE-22, BE-29). Full automatic refund.',
    params: [
      doctor,
      p('date', 'Mon, 12 Oct', 'सोम, 12 अक्टूबर'),
      p('feeRupees', '15'),
      p('rebookLink', 'https://doqto.in/d/dr-anil-sharma-bareilly'),
    ],
    body: {
      en: 'Sorry, Dr {{1}} is not available on {{2}}, so your appointment has been cancelled.\n\nYour booking fee of Rs {{3}} will be refunded to your original payment method, usually within 5 to 7 working days.\n\nBook another time: {{4}}\n\nDoqto',
      hi: 'माफ़ कीजिए, {{2}} को डॉ. {{1}} उपलब्ध नहीं हैं, इसलिए आपकी अपॉइंटमेंट रद्द कर दी गई है।\n\nआपकी बुकिंग फ़ीस ₹{{3}} उसी तरीके से वापस की जाएगी जिससे आपने भुगतान किया था, आमतौर पर 5 से 7 कामकाजी दिनों में।\n\nदूसरा समय बुक करें: {{4}}\n\nDoqto',
    },
    footer: STOP_FOOTER,
  },

  turn_near: {
    bspName: 'doqto_turn_near',
    category: 'UTILITY',
    trigger: 'Queue advance: the patient is 3 tokens away and has no Web Push (BE-22).',
    params: [doctor, p('tokensAhead', '3'), statusLink],
    body: {
      en: 'Your turn with Dr {{1}} is coming up: {{2}} patients are ahead of you.\n\nPlease reach the clinic now. Live queue: {{3}}\n\nDoqto',
      hi: 'डॉ. {{1}} के पास आपकी बारी आने वाली है: आपसे पहले {{2}} मरीज़ हैं।\n\nकृपया अभी क्लिनिक पहुँचें। लाइव कतार: {{3}}\n\nDoqto',
    },
    footer: STOP_FOOTER,
  },

  refund_processed: {
    bspName: 'doqto_refund_processed',
    category: 'UTILITY',
    trigger: 'Refund webhook `refund.processed` (INT-14, BE-29).',
    params: [p('feeRupees', '15'), p('date', 'Mon, 12 Oct', 'सोम, 12 अक्टूबर')],
    body: {
      en: 'Your refund of Rs {{1}} for the appointment on {{2}} has been processed. It usually reaches your account within 5 to 7 working days.\n\nDoqto',
      hi: 'आपकी {{2}} की अपॉइंटमेंट के लिए ₹{{1}} का रिफ़ंड प्रोसेस हो गया है। यह आमतौर पर 5 से 7 कामकाजी दिनों में आपके खाते में आ जाता है।\n\nDoqto',
    },
  },

  late_payment_refunded: {
    bspName: 'doqto_late_payment_refunded',
    category: 'UTILITY',
    trigger: 'Payment arrived after the 10-minute hold expired and the slot was taken (BE-28).',
    params: [
      p('feeRupees', '15'),
      doctor,
      p('slotsLink', 'https://doqto.in/d/dr-anil-sharma-bareilly'),
    ],
    body: {
      en: 'Your payment reached us after your slot hold ended and the slot was booked by someone else, so we have refunded Rs {{1}}.\n\nSee available slots with Dr {{2}}: {{3}}\n\nDoqto',
      hi: 'आपका भुगतान स्लॉट होल्ड खत्म होने के बाद मिला और वह स्लॉट किसी और ने बुक कर लिया, इसलिए हमने ₹{{1}} वापस कर दिए हैं।\n\nडॉ. {{2}} के खाली स्लॉट देखें: {{3}}\n\nDoqto',
    },
  },

  review_open: {
    bspName: 'doqto_review_open',
    category: 'UTILITY',
    trigger: 'Review unlocks 24 hours after a verified visit (BE-38).',
    params: [doctor, p('reviewLink', 'https://doqto.in/r/7Kp2Qx')],
    body: {
      en: 'How was your visit to Dr {{1}}? You can now review it. Only patients with a verified visit can.\n\nWrite your review: {{2}}\n\nDoqto',
      hi: 'डॉ. {{1}} के पास आपका अनुभव कैसा रहा? अब आप रिव्यू लिख सकते हैं। केवल वेरिफ़ाइड विज़िट वाले मरीज़ ही रिव्यू लिख सकते हैं।\n\nरिव्यू लिखें: {{2}}\n\nDoqto',
    },
    footer: STOP_FOOTER,
  },

  review_reminder: {
    bspName: 'doqto_review_reminder',
    category: 'UTILITY',
    trigger: 'Day 5 after unlock, sent once, never again (BE-38).',
    params: [
      doctor,
      p('lastDate', '11 Nov', '11 नवंबर'),
      p('reviewLink', 'https://doqto.in/r/7Kp2Qx'),
    ],
    body: {
      en: 'You can review your visit to Dr {{1}} until {{2}}.\n\nWrite your review: {{3}}\n\nDoqto',
      hi: 'आप डॉ. {{1}} के पास अपनी विज़िट का रिव्यू {{2}} तक लिख सकते हैं।\n\nरिव्यू लिखें: {{3}}\n\nDoqto',
    },
    footer: STOP_FOOTER,
  },

  review_replied: {
    bspName: 'doqto_review_replied',
    category: 'UTILITY',
    trigger: 'Doctor posts a reply to the patient review (BE-36).',
    params: [doctor, p('reviewLink', 'https://doqto.in/r/7Kp2Qx')],
    body: {
      en: 'Dr {{1}} has replied to your review.\n\nRead the reply: {{2}}\n\nDoqto',
      hi: 'डॉ. {{1}} ने आपके रिव्यू का जवाब दिया है।\n\nजवाब पढ़ें: {{2}}\n\nDoqto',
    },
    footer: STOP_FOOTER,
  },
} as const satisfies Record<string, TemplateDefinition>;

export type TemplateKey = keyof typeof WHATSAPP_TEMPLATES;

export function isTemplateKey(key: string): key is TemplateKey {
  return Object.prototype.hasOwnProperty.call(WHATSAPP_TEMPLATES, key);
}

/**
 * The text the patient sees, for the Demo inbox and logs-free previews.
 * Throws if the parameter count does not match the template.
 */
export function renderTemplate(
  key: TemplateKey,
  language: MessageLanguage,
  params: readonly string[],
): string {
  const t: TemplateDefinition = WHATSAPP_TEMPLATES[key];
  if (params.length !== t.params.length) {
    throw new Error(`template ${key} takes ${t.params.length} parameters, got ${params.length}`);
  }
  const fill = (text: string) =>
    text.replace(/\{\{(\d+)\}\}/g, (_, n: string) => params[Number(n) - 1] ?? '');
  const footer = t.footer ? `\n\n${t.footer[language]}` : '';
  return fill(t.body[language]) + footer;
}

/** Markdown pack for the BSP portal: one section per BSP template, both languages, with samples. */
export function renderSubmissionPack(): string {
  const seen = new Set<string>();
  const lines: string[] = [
    '# Doqto WhatsApp templates: BSP submission pack',
    '',
    'Generated from `apps/api/src/integrations/whatsapp/templates.ts` (INT-09). Do not edit by hand; change the code and regenerate with',
    '`WRITE_PACK=1 npx jest src/integrations/whatsapp/templates` in `apps/api`.',
    '',
    'How to submit: create each template below in the BSP portal (AiSensy or Interakt) under the WhatsApp Business account, once in **English (en)** and once in **Hindi (hi)**, with the same template name. Category exactly as listed; no marketing templates. Paste the body and footer as shown (keep the line breaks and the `*bold*` markers), and enter the sample values in parameter order. Submit all of them in one batch; approval can take a day or more, and a rejected template can be edited and resubmitted.',
    '',
    'Authentication templates: Meta supplies the wording (including the Hindi text) and only the code varies. Choose "Copy code" as the button type, turn on the security disclaimer and set the expiry to 5 minutes.',
    '',
  ];
  for (const [key, t] of Object.entries(WHATSAPP_TEMPLATES) as [
    TemplateKey,
    TemplateDefinition,
  ][]) {
    if (seen.has(t.bspName)) continue;
    seen.add(t.bspName);
    const keys = (Object.entries(WHATSAPP_TEMPLATES) as [TemplateKey, TemplateDefinition][])
      .filter(([, d]) => d.bspName === t.bspName)
      .map(([k]) => `\`${k}\``)
      .join(', ');
    lines.push(
      `## ${t.bspName}`,
      '',
      `- Category: **${t.category}**`,
      `- Code keys: ${keys}`,
      `- Sent when: ${t.trigger}`,
      '',
    );
    for (const lang of ['en', 'hi'] as const) {
      lines.push(
        `### ${lang === 'en' ? 'English (en)' : 'Hindi (hi)'}`,
        '',
        'Body:',
        '',
        '```',
        t.body[lang],
        '```',
        '',
      );
      if (t.footer) lines.push(`Footer: \`${t.footer[lang]}\``, '');
      lines.push('Samples:', '');
      t.params.forEach((param, i) => lines.push(`${i + 1}. ${param.name}: ${param.sample[lang]}`));
      lines.push(
        '',
        'Preview:',
        '',
        '```',
        renderTemplate(
          key,
          lang,
          t.params.map((x) => x.sample[lang]),
        ),
        '```',
        '',
      );
    }
  }
  lines.push(
    '## Keywords the webhook handles (INT-10)',
    '',
    "Patients can reply **STATUS** (today's doctor status), **CANCEL** (starts a cancel confirmation) and **STOP** (turns off non-OTP WhatsApp updates; sets `whatsappOptIn: false`). Replies within 24 hours of the patient writing in are session messages and need no template.",
    '',
  );
  return lines.join('\n');
}
