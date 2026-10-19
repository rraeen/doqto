/** Indian mobile numbers: 10 digits starting 6 to 9. */
const IN_MOBILE = /^[6-9]\d{9}$/;

/** Strips everything but digits and a leading +91 or 0 that people often type. */
export function normaliseIndianDigits(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

export function isValidIndianMobile(digits: string): boolean {
  return IN_MOBILE.test(digits);
}

/** Returns the E.164 form (`+919876543210`) or null when invalid. */
export function toE164(raw: string): string | null {
  const digits = normaliseIndianDigits(raw);
  return isValidIndianMobile(digits) ? `+91${digits}` : null;
}

/** `+919876543210` -> `+91 98765 43210`. */
export function formatE164ForDisplay(e164: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}
