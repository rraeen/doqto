/** Nest injection tokens. Business code injects these, never a concrete class. */
export const INTEGRATIONS_CONFIG = Symbol('INTEGRATIONS_CONFIG');
export const OTP_PROVIDER = Symbol('OTP_PROVIDER');
export const WHATSAPP_PROVIDER = Symbol('WHATSAPP_PROVIDER');
export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
/** `VisitCodes`: issue and check 4-digit visit codes (INT-08). */
export const VISIT_CODES = Symbol('VISIT_CODES');
/** `PaymentWebhooks`: verify a gateway webhook and hand events to BE's handler. */
export const PAYMENT_WEBHOOKS = Symbol('PAYMENT_WEBHOOKS');
/** `DemoPay | null`: the demo pay button; null in live mode. */
export const DEMO_PAY = Symbol('DEMO_PAY');
export const GEOCODER_PROVIDER = Symbol('GEOCODER_PROVIDER');
/** `ProviderInfo[]` of every bound provider, for startup safety checks (INT-03). */
export const BOUND_PROVIDERS = Symbol('BOUND_PROVIDERS');
