import { parseProviderMode, type ProviderMode } from './provider-mode';

/** Settings the provider adapters need. Variables are documented in the root .env.example. */
export interface IntegrationsConfig {
  mode: ProviderMode;
  /** NODE_ENV, for the demo safety check (INT-03). */
  nodeEnv: string;
  /** MONGODB_URI and MONGODB_DB_NAME, for the demo safety check (INT-03). */
  mongodbUri: string;
  mongodbDbName: string;
  /** Pepper for OTP hashes and demo signatures (HASH_PEPPER). */
  hashPepper: string;
  apiPublicUrl: string;
  demoStorageDir: string;
  signedUrlTtlSeconds: number;
  /** User-Agent for the free geocoder (Nominatim policy requires a contact). */
  geocoderUserAgent: string;
  whatsapp: {
    bsp?: string;
    apiKey?: string;
    apiBaseUrl?: string;
    webhookSecret?: string;
    /** Meta Cloud API: the string typed in the webhook setup; Meta sends it back to prove the URL is yours. */
    verifyToken?: string;
    /** Meta Cloud API: the id of the sending number (not the phone number itself). */
    phoneNumberId?: string;
    businessAccountId?: string;
    /** Demo mode with a real sender: only these E.164 numbers get real WhatsApp messages. */
    testRecipients: string[];
    /** Send plain text instead of templates (Meta test account only). */
    sendAsText: boolean;
    senderNumber?: string;
  };
  msg91: { authKey?: string; senderId?: string; dltEntityId?: string; otpTemplateId?: string };
  razorpay: { keyId?: string; keySecret?: string; webhookSecret?: string };
  r2: {
    accountId?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    publicBucket?: string;
    publicBaseUrl?: string;
    privateBucket?: string;
  };
}

type Env = Readonly<Record<string, string | undefined>>;

const opt = (env: Env, key: string): string | undefined => {
  const v = env[key]?.trim();
  return v ? v : undefined;
};

export function loadIntegrationsConfig(env: Env = process.env): IntegrationsConfig {
  const hashPepper = opt(env, 'HASH_PEPPER');
  if (!hashPepper || hashPepper.length < 16) {
    throw new Error('HASH_PEPPER must be set to at least 16 characters');
  }
  const ttl = Number(opt(env, 'SIGNED_URL_TTL_SECONDS') ?? 300);
  if (!Number.isInteger(ttl) || ttl <= 0 || ttl > 3600) {
    throw new Error('SIGNED_URL_TTL_SECONDS must be an integer between 1 and 3600');
  }
  return {
    mode: parseProviderMode(opt(env, 'PROVIDER_MODE')),
    nodeEnv: opt(env, 'NODE_ENV') ?? 'development',
    mongodbUri: opt(env, 'MONGODB_URI') ?? '',
    mongodbDbName: opt(env, 'MONGODB_DB_NAME') ?? '',
    hashPepper,
    apiPublicUrl: (opt(env, 'API_PUBLIC_URL') ?? 'http://localhost:4000').replace(/\/+$/, ''),
    demoStorageDir: opt(env, 'DEMO_STORAGE_DIR') ?? '.demo-storage',
    signedUrlTtlSeconds: ttl,
    geocoderUserAgent: opt(env, 'GEOCODER_USER_AGENT') ?? 'Doqto/0.1 (contact@doqto.in)',
    whatsapp: {
      bsp: opt(env, 'WHATSAPP_BSP'),
      apiKey: opt(env, 'WHATSAPP_API_KEY'),
      apiBaseUrl: opt(env, 'WHATSAPP_API_BASE_URL'),
      webhookSecret: opt(env, 'WHATSAPP_WEBHOOK_SECRET'),
      verifyToken: opt(env, 'WHATSAPP_VERIFY_TOKEN'),
      phoneNumberId: opt(env, 'WHATSAPP_PHONE_NUMBER_ID'),
      businessAccountId: opt(env, 'WHATSAPP_BUSINESS_ACCOUNT_ID'),
      sendAsText: opt(env, 'WHATSAPP_SEND_AS_TEXT') === 'true',
      testRecipients: (opt(env, 'WHATSAPP_TEST_RECIPIENTS') ?? '')
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean),
      senderNumber: opt(env, 'WHATSAPP_SENDER_NUMBER'),
    },
    msg91: {
      authKey: opt(env, 'MSG91_AUTH_KEY'),
      senderId: opt(env, 'MSG91_SENDER_ID'),
      dltEntityId: opt(env, 'MSG91_DLT_ENTITY_ID'),
      otpTemplateId: opt(env, 'MSG91_OTP_TEMPLATE_ID'),
    },
    razorpay: {
      keyId: opt(env, 'RAZORPAY_KEY_ID'),
      keySecret: opt(env, 'RAZORPAY_KEY_SECRET'),
      webhookSecret: opt(env, 'RAZORPAY_WEBHOOK_SECRET'),
    },
    r2: {
      accountId: opt(env, 'R2_ACCOUNT_ID'),
      accessKeyId: opt(env, 'R2_ACCESS_KEY_ID'),
      secretAccessKey: opt(env, 'R2_SECRET_ACCESS_KEY'),
      publicBucket: opt(env, 'R2_PUBLIC_BUCKET'),
      publicBaseUrl: opt(env, 'R2_PUBLIC_BASE_URL'),
      privateBucket: opt(env, 'R2_PRIVATE_BUCKET'),
    },
  };
}
