import { IS_PUBLIC_KEY } from '../auth/decorators';
import { PaymentWebhooksController } from './payment/payment-webhooks.controller';
import { DemoStorageController } from './storage/demo-storage.controller';

// Gateways and <img>/download links call these without a session; the global JwtAuthGuard
// would answer 401. Each route does its own check (webhook signature, signed URL).
describe('integration controllers are public', () => {
  it.each([PaymentWebhooksController, DemoStorageController])(
    '%p is marked @Public()',
    (controller) => {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, controller)).toBe(true);
    },
  );
});
