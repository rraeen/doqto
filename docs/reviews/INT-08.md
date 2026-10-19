# Review: INT-08 Walk-in OTP and visit codes

- Owner: INT
- Reviewed: 2026-10-10, by RD
- Round: 1
- **Verdict: Approved** (no blockers; notes for BE-16 and BE-27)

## What was checked

I read `otp/visit-code.ts` and its spec, the `VISIT_CODES` binding in `integrations.module.ts`, `tokens.ts`, `index.ts`, the typed template keys in `otp/base-otp.provider.ts`, and `randomNumericCode` in `crypto.ts`.

I ran these in a scratch mirror through `scripts/ops/workspace.sh`:

- `cd apps/api && npx jest src/integrations`: **149 tests, all pass**.
- `pnpm lint`: **clean**.
- `pnpm --filter @doqto/api typecheck`: **clean**.

Checklist sections applied: A, C, E, H, I.

## Acceptance criteria

| Criterion | Holds? | Evidence |
| --- | --- | --- |
| Uses `OtpProvider` with purpose `visit` | Yes | `OtpPurpose` and shared `OTP_PURPOSES` include `visit`, mapped to template `otp_visit`. The hash is bound to purpose, and the spec shows a visit OTP fails when verified as `login` |
| Demo writes the message to the outbox only | Superseded | Agreed in INT-02 should-fix 1: OTPs never go through the outbox, so the plain code is never stored. The spec shows demo records the WhatsApp send with no outbox row and no `fetch` |
| Live WhatsApp adapter stays a stub until the BSP is approved | Yes | Live `send` rejects with "OTP could not be delivered" (spec) |

Security points checked:

- Visit codes come from `crypto.randomInt`, 4 digits in every mode, and only an HMAC hash is returned for storage. The hash is peppered and bound to the appointment id, so a code cannot be reused on another appointment (spec).
- `matches` compares in constant time and rejects anything that is not 4 digits.
- Demo `123456` is decided by `PROVIDER_MODE` passed to the constructor at startup. There is no request-level toggle, and business code never branches on mode (ADR 0006).

## Findings

### Blockers

None.

### Should fix

None.

### Nits

1. `matches` builds a `RegExp` on every call. A module-level constant would read more simply.

## Notes for later reviews (not INT-08 findings)

- **BE-16:** attempts and the 15-minute lockout must be checked *before* `matches`, in demo too, so `123456` does not bypass the lockout. Use `VISIT_CODE_MAX_ATTEMPTS` and `VISIT_CODE_LOCK_MINUTES` and an atomic `$inc` on `visitCode.attempts`.
- **BE-27 / BE-21:** the plain visit code goes to the patient once on WhatsApp. If that confirmation goes through the notifications outbox, the row's `params` would hold the plain code, which breaks checklist E. Send it directly like an OTP, or keep it out of the stored params.
