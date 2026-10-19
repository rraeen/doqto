# 0007. No clinical data in Phase 1

- Status: Accepted, 2026-10-09 (TDD section 11, DB doc section 1)

## Context

QR-linked medical records are part of the long-term idea, but health data under India's Digital Personal Data Protection Act, 2023 and its rules needs legal review first. Even without it, a phone number, a name and the fact that someone visited a specific doctor are personal data.

## Decision

- Doqto stores no diagnosis, prescription, report, treatment, symptom or medical-history data anywhere: no fields, no free-text boxes meant for them, no uploads of them.
- `medicalRecords` is a reserved collection name only. No schema, endpoints or UI until the legal review is done.
- The review "visit reason" is a short fixed non-clinical list (for example general check-up, follow-up, child's visit).
- Doctor replies are blocked if they contain phone numbers, the patient's name, or diagnosis or treatment keywords.
- DPDP basics still apply: consent text at signup, privacy policy, grievance contact, account deletion that anonymises reviews, data stored in India, retention per DB doc section 6.

## Consequences

- Review rejects any new clinical-looking field, including generic ones like `notes` on appointments that would invite clinical text.
- The privacy policy must say the API runs outside India (Render Singapore) while data is stored in Mumbai.

## When to revisit

After a lawyer completes the DPDP review of the records module. That needs a new ADR.
