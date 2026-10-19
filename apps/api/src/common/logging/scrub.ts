/**
 * Removes phone numbers and OTP-like codes from free text before it is logged. Pino redaction
 * works on keys only; error messages (Mongo duplicate-key, Mongoose CastError) can embed values.
 */
export function scrubPersonalData(text: string): string {
  return text
    .replace(/\+?\d[\d -]{8,14}\d/g, '[redacted-number]')
    .replace(/(^|[^\w.:/-])\d{4,6}(?=$|[^\w:])/g, '$1[redacted-code]');
}
