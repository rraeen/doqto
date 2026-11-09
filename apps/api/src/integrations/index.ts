// Public surface of the integrations layer (TDD 13). Business modules import
// from here and inject by token, e.g.
//   constructor(@Inject(OTP_PROVIDER) private readonly otp: OtpProvider) {}
export * from './crypto';
export * from './errors';
export * from './integrations.config';
export * from './integrations.module';
export * from './messaging.types';
export * from './provider-mode';
export * from './provider-safety';
export * from './tokens';
export * from './otp/otp.provider';
export { DEMO_FIXED_OTP } from './otp/demo-otp.provider';
export * from './otp/visit-code';
export * from './whatsapp/whatsapp.provider';
export * from './sms/sms.provider';
export * from './email/email.provider';
export { DemoEmailProvider } from './email/demo-email.provider';
export * from './payment/payment.provider';
export type { PaymentEventHandler, PaymentWebhooks } from './payment/payment-webhooks.service';
export type { DemoPay } from './payment/demo-pay';
export * from './storage/storage.provider';
export * from './storage/upload-limits';
export * from './maps/maps';
export * from './maps/geocoder.provider';
