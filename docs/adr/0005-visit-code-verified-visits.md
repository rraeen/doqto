# 0005. A code from the patient's phone proves a visit

- Status: Accepted, 2026-10-09 (TDD section 5.1)

## Context

Reviews are only trustworthy if they come from real visits. The clinic controls staff accounts, so anything staff can do alone (such as marking a patient "visited") can be faked by the clinic.

## Decision

- On booking confirmation the API generates a 4-digit **visit code**, stores only its hash on the appointment, and sends it to the patient (WhatsApp and app).
- At check-in staff type the code the patient reads out. A correct code sets `visitVerifiedAt` and assigns a queue token. Five wrong attempts lock the code for 15 minutes.
- Walk-ins: staff enter the patient's phone; the API sends a fresh OTP to that phone; the patient reads it out. Same proof.
- A visit becomes reviewable 24 hours after the consult ends, or after the clinic day ends if staff never pressed complete, so a clinic cannot block reviews by never completing visits.
- In demo mode the fixed code `123456` is accepted (ADR 0006).

## Consequences

- No API lets staff set `visitVerifiedAt` without a valid code or OTP. Review checks this on every clinic story.
- Visit codes and OTPs are hashed, compared in constant time, and never logged.
- Remaining hole: a clinic registering phones it controls as walk-ins. Covered by fraud signals (TDD 5.5), not by this mechanism.

## When to revisit

If check-in friction stops pilot clinics from using it, look at QR scan of a code on the patient's phone, keeping the same proof.
