import { AdminNotificationsQuerySchema, MyNotificationsQuerySchema } from '@doqto/shared';
import { expectParity } from '../../common/testing/dto-parity';
import { AdminNotificationsQueryDto, MyNotificationsQueryDto } from './notifications.dto';

describe('notifications DTOs match the shared contract', () => {
  expectParity([
    [
      'MyNotificationsQuery',
      MyNotificationsQueryDto,
      MyNotificationsQuerySchema,
      [{}, { limit: 10 }, { cursor: 'abc' }, { limit: 0 }, { limit: 51 }, { cursor: '' }, { x: 1 }],
    ],
    [
      'AdminNotificationsQuery',
      AdminNotificationsQueryDto,
      AdminNotificationsQuerySchema,
      [{}, { status: 'failed' }, { status: 'skipped', limit: 5 }, { status: 'bounced' }, { x: 1 }],
    ],
  ]);
});
