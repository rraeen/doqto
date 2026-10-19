import {
  OtpRequestSchema,
  OtpVerifyRequestSchema,
  RefreshRequestSchema,
  UpdateMeRequestSchema,
} from '@doqto/shared';
import { expectParity, type ParityCase } from '../../common/testing/dto-parity';
import { UpdateMeDto } from '../../users/dto/me.dto';
import { OtpRequestDto, OtpVerifyDto, RefreshDto } from './auth.dto';

const cases: ParityCase[] = [
  [
    'otp/request',
    OtpRequestDto,
    OtpRequestSchema,
    [
      { phone: '+919876543210' },
      { phone: '+919876543210', purpose: 'login' },
      { phone: '919876543210' },
      { phone: '+919876543210', purpose: 'visit' },
      { phone: '+919876543210', x: 1 },
      {},
    ],
  ],
  [
    'otp/verify',
    OtpVerifyDto,
    OtpVerifyRequestSchema,
    [
      { phone: '+919876543210', code: '123456' },
      { phone: '+919876543210', code: '123456', deviceId: 'abc', whatsappOptIn: true },
      { phone: '+919876543210', code: '12345' },
      { phone: '+919876543210', code: '123456', whatsappOptIn: 'yes' },
      { phone: '+919876543210', code: '123456', deviceId: '' },
      { phone: '+919876543210', code: '123456', role: 'admin' },
    ],
  ],
  [
    'refresh',
    RefreshDto,
    RefreshRequestSchema,
    [{}, { refreshToken: 'abc' }, { refreshToken: '' }, { token: 'abc' }],
  ],
  [
    'PATCH /me (field rules; the non-empty rule is enforced in UsersService)',
    UpdateMeDto,
    UpdateMeRequestSchema,
    [
      { name: 'Asha' },
      { language: 'hi' },
      { whatsappOptIn: false },
      { name: '' },
      { language: 'fr' },
      { name: 'x'.repeat(81) },
      { roles: ['admin'] },
    ],
  ],
];

describe('DTOs match the shared contract', () => {
  expectParity(cases);
});
