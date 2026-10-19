import type { Language } from '@doqto/shared';

/** INT-09 note: templates already say "Dr", so the parameter is the bare name. */
export function doctorNameParam(name: string): string {
  return name.replace(/^dr\.?\s+/i, '').trim();
}

/** `Mon, 12 Oct` / `सोम, 12 अक्टूबर` for an IST date. */
export function dateParam(date: string, language: Language): string {
  const at = new Date(`${date}T12:00:00+05:30`);
  return new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(at);
}

/** `10:30 AM` / `10:30 am` for an instant, in IST. */
export function timeParam(at: Date, language: Language): string {
  return new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
    numberingSystem: 'latn',
  }).format(at);
}

/** INT-09 note: amounts as whole rupees. */
export function rupeesParam(paise: number): string {
  return String(Math.round(paise / 100));
}

/** `••••5678`. */
export function maskPhone(phone: string): string {
  return `••••${phone.slice(-4)}`;
}
