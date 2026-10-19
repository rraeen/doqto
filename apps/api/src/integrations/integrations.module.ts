import { Global, Module, type DynamicModule, type Provider } from '@nestjs/common';
import { loadIntegrationsConfig, type IntegrationsConfig } from './integrations.config';
import { DemoGeocoderProvider } from './maps/demo-geocoder.provider';
import type { GeocoderProvider } from './maps/geocoder.provider';
import { NominatimGeocoderProvider } from './maps/nominatim-geocoder.provider';
import { DemoOtpProvider } from './otp/demo-otp.provider';
import { LiveOtpProvider } from './otp/live-otp.provider';
import type { OtpProvider } from './otp/otp.provider';
import { VisitCodes } from './otp/visit-code';
import { createDemoPay, type DemoPay } from './payment/demo-pay';
import { DemoPaymentProvider } from './payment/demo-payment.provider';
import { PaymentWebhooksController } from './payment/payment-webhooks.controller';
import { PaymentWebhooks } from './payment/payment-webhooks.service';
import { RazorpayPaymentProvider } from './payment/live-payment.provider';
import type { PaymentProvider } from './payment/payment.provider';
import type { ProviderInfo } from './provider-mode';
import { assertProviderSafety } from './provider-safety';
import { DemoSmsProvider } from './sms/demo-sms.provider';
import { LiveSmsProvider } from './sms/live-sms.provider';
import type { SmsProvider } from './sms/sms.provider';
import { DemoStorageController } from './storage/demo-storage.controller';
import { DemoStorageProvider } from './storage/demo-storage.provider';
import { R2StorageProvider } from './storage/live-storage.provider';
import type { StorageProvider } from './storage/storage.provider';
import {
  BOUND_PROVIDERS,
  GEOCODER_PROVIDER,
  INTEGRATIONS_CONFIG,
  OTP_PROVIDER,
  PAYMENT_PROVIDER,
  SMS_PROVIDER,
  STORAGE_PROVIDER,
  WHATSAPP_PROVIDER,
  VISIT_CODES,
  PAYMENT_WEBHOOKS,
  DEMO_PAY,
} from './tokens';
import { DemoWhatsAppProvider } from './whatsapp/demo-whatsapp.provider';
import { LiveWhatsAppProvider } from './whatsapp/live-whatsapp.provider';
import type { WhatsAppProvider } from './whatsapp/whatsapp.provider';

export interface ProviderSet {
  otp: OtpProvider;
  whatsapp: WhatsAppProvider;
  sms: SmsProvider;
  payment: PaymentProvider;
  storage: StorageProvider;
  geocoder: GeocoderProvider;
}

/** The only place that chooses implementations. Business code never does. */
export function createProviderSet(config: IntegrationsConfig): ProviderSet {
  if (config.mode === 'demo') {
    const whatsapp = new DemoWhatsAppProvider(config);
    const sms = new DemoSmsProvider();
    return {
      whatsapp,
      sms,
      otp: new DemoOtpProvider(config.hashPepper, whatsapp, sms),
      payment: new DemoPaymentProvider(config),
      storage: new DemoStorageProvider(config),
      geocoder: new DemoGeocoderProvider(),
    };
  }
  const whatsapp = new LiveWhatsAppProvider();
  const sms = new LiveSmsProvider();
  return {
    whatsapp,
    sms,
    otp: new LiveOtpProvider(config.hashPepper, whatsapp, sms),
    payment: new RazorpayPaymentProvider(config.razorpay),
    storage: new R2StorageProvider(config.r2, config.signedUrlTtlSeconds),
    geocoder: new NominatimGeocoderProvider(config.geocoderUserAgent),
  };
}

const PROVIDER_SET = Symbol('PROVIDER_SET');

export interface IntegrationsModuleOptions {
  /** Tests pass a config; the app leaves it out and the env is read when Nest instantiates providers. */
  config?: IntegrationsConfig;
}

/**
 * Global module binding OTP_PROVIDER, WHATSAPP_PROVIDER, SMS_PROVIDER,
 * PAYMENT_PROVIDER and STORAGE_PROVIDER from PROVIDER_MODE. Import once in
 * AppModule: `IntegrationsModule.forRoot()`.
 */
@Global()
@Module({})
export class IntegrationsModule {
  static forRoot(options: IntegrationsModuleOptions = {}): DynamicModule {
    const providers: Provider[] = [
      {
        provide: INTEGRATIONS_CONFIG,
        useFactory: () => options.config ?? loadIntegrationsConfig(),
      },
      { provide: PROVIDER_SET, useFactory: createProviderSet, inject: [INTEGRATIONS_CONFIG] },
      { provide: OTP_PROVIDER, useFactory: (s: ProviderSet) => s.otp, inject: [PROVIDER_SET] },
      {
        provide: WHATSAPP_PROVIDER,
        useFactory: (s: ProviderSet) => s.whatsapp,
        inject: [PROVIDER_SET],
      },
      { provide: SMS_PROVIDER, useFactory: (s: ProviderSet) => s.sms, inject: [PROVIDER_SET] },
      {
        provide: PAYMENT_PROVIDER,
        useFactory: (s: ProviderSet) => s.payment,
        inject: [PROVIDER_SET],
      },
      {
        provide: STORAGE_PROVIDER,
        useFactory: (s: ProviderSet) => s.storage,
        inject: [PROVIDER_SET],
      },
      {
        provide: PAYMENT_WEBHOOKS,
        useFactory: (payment: PaymentProvider) => new PaymentWebhooks(payment),
        inject: [PAYMENT_PROVIDER],
      },
      {
        provide: DEMO_PAY,
        useFactory: (payment: PaymentProvider, webhooks: PaymentWebhooks): DemoPay | null =>
          payment instanceof DemoPaymentProvider ? createDemoPay(payment, webhooks) : null,
        inject: [PAYMENT_PROVIDER, PAYMENT_WEBHOOKS],
      },
      {
        provide: VISIT_CODES,
        useFactory: (c: IntegrationsConfig) => new VisitCodes(c.hashPepper, c.mode),
        inject: [INTEGRATIONS_CONFIG],
      },
      {
        provide: GEOCODER_PROVIDER,
        useFactory: (s: ProviderSet) => s.geocoder,
        inject: [PROVIDER_SET],
      },
      {
        // INT-03: runs while Nest builds the module graph, so an unsafe config stops startup.
        provide: BOUND_PROVIDERS,
        // Injects the tokens themselves, so an override of any one is checked too.
        useFactory: (config: IntegrationsConfig, ...bound: ProviderInfo[]): ProviderInfo[] => {
          assertProviderSafety(config, bound);
          return bound;
        },
        inject: [
          INTEGRATIONS_CONFIG,
          OTP_PROVIDER,
          WHATSAPP_PROVIDER,
          SMS_PROVIDER,
          PAYMENT_PROVIDER,
          STORAGE_PROVIDER,
          GEOCODER_PROVIDER,
        ],
      },
    ];
    return {
      module: IntegrationsModule,
      global: true,
      // 404s unless demo storage is bound (see the controller).
      controllers: [DemoStorageController, PaymentWebhooksController],
      providers,
      exports: [
        INTEGRATIONS_CONFIG,
        OTP_PROVIDER,
        WHATSAPP_PROVIDER,
        SMS_PROVIDER,
        PAYMENT_PROVIDER,
        STORAGE_PROVIDER,
        GEOCODER_PROVIDER,
        VISIT_CODES,
        PAYMENT_WEBHOOKS,
        DEMO_PAY,
        BOUND_PROVIDERS,
      ],
    };
  }
}
