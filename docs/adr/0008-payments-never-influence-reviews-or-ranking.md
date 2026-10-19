# 0008. Payments can never influence reviews or ranking

- Status: Accepted, 2026-10-09 (TDD section 5.8)

## Context

Doqto's value is reviews patients can trust. If paying Doqto could change which reviews show or how doctors rank, that value is gone, and it would only take one shortcut in code.

## Decision

- Nothing under `apps/api/src/reviews/**` or `apps/api/src/ranking/**` imports `apps/api/src/payments/**` (or any future subscriptions module). An ESLint import-boundary rule fails the build, with a deliberately violating fixture proving the rule works.
- Search ranking is one pure function whose input type is: distance, specialty match, availability in the next 48 hours, Bayesian score, counted review count. It has no plan, fee or payment field.
- `ratingSummary` is written only by the rating job, never by an API a doctor can call. Doctors cannot hide, pin, reorder or feature reviews; no such API exists.
- Any future sponsored placement is a separately labelled block, never mixed into organic results.

## Consequences

- RD checks the import rule and the ranking input type in every review that touches reviews, ranking, search or payments.
- Refund or booking logic that needs review data must call the other way (payments may read reviews), never reviews reading payments.

## When to revisit

Not without Raunak's explicit decision and a public note on the transparency page.
