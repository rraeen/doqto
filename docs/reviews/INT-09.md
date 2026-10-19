# Review: INT-09 WhatsApp templates (Hindi and English) and BSP submission pack

- Owner: INT
- Reviewed: 2026-10-10, by RD
- Round: 1
- **Verdict: Approved.** One item is for Raunak: a native Hindi read before submission.

## What was checked

I read `apps/api/src/integrations/whatsapp/templates.ts`, `templates.spec.ts` and `infra/whatsapp/TEMPLATES-SUBMISSION.md`.

- `npx jest src/integrations/whatsapp/templates`: **44 tests pass**.
- The spec fails if the submission pack is stale.

Checklist sections applied: A, L (copy), E.

## Acceptance criteria

| Criterion | Holds? | Evidence |
| --- | --- | --- |
| `templates.ts` with every Phase 1 template from TDD section 7 in Hindi and English, with parameter lists | Yes | 13 keys covering every row of the TDD 7 table: login and walk-in OTP (one AUTHENTICATION template), booking confirmed with visit code, both reminders, running late, cancelled by clinic or leave, your turn is near, review open and day-5 reminder, doctor replied. Refund and late-payment templates are added for TDD 8 |
| A submission document Raunak can paste into the BSP portal | Yes | `infra/whatsapp/TEMPLATES-SUBMISSION.md` is generated from the same source, with category, trigger, body, footer and sample values per language |

Copy checks:

- No marketing. Every template is UTILITY except the OTP.
- The spec enforces Meta's parameter rules: numbered with none skipped, not first or last, not adjacent, length limits.
- Opt-out is clear: "Reply STOP to stop updates" in both languages.
- Wait wording is approximate ("about {{2}} minutes late"), in line with TDD 6.3.
- Refund timing says "usually within 5 to 7 working days" rather than a promise.
- No clinical content.

## Findings

### Blockers

None.

### For Raunak (before submitting to the BSP)

1. **Have a native Hindi speaker read the Hindi bodies once.** INT wrote them and says so. Rejections and awkward wording are cheaper to fix before the batch goes in.

### Should fix

None.

### Nits (for BE when sending)

1. Templates say "Dr {{1}}". BE must pass the doctor's name without a "Dr" prefix, or messages will read "Dr Dr Anita".
2. Amount parameters are rupees as text (for example `15`), not paise. BE should format with one shared helper, so `1500` paise never shows up as "Rs 1500".
3. STOP sets `whatsappOptIn: false`. Make sure BE-21 still sends `booking_confirmed` (it carries the visit code) by SMS for opted-out patients, as TDD 7 routes non-OTP messages to SMS or push.

## Requests to other workstreams

- To INT (INT-10): handle STOP alongside STATUS and CANCEL, as the templates now promise it.

## Re-review log

- None yet.
