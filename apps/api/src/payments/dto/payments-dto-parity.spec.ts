import { DemoPayRequestSchema, VerifyPaymentRequestSchema } from '@doqto/shared';
import { expectParity } from '../../common/testing/dto-parity';
import { DemoPayDto, VerifyPaymentDto } from './payments.dto';

const id = 'a'.repeat(24);

describe('payments DTOs match the shared contract', () => {
  expectParity([
    [
      'DemoPayRequest',
      DemoPayDto,
      DemoPayRequestSchema,
      [{ appointmentId: id }, {}, { appointmentId: 'nope' }, { appointmentId: id, x: 1 }],
    ],
    [
      'VerifyPaymentRequest',
      VerifyPaymentDto,
      VerifyPaymentRequestSchema,
      [
        { appointmentId: id, razorpayOrderId: 'o', razorpayPaymentId: 'p', razorpaySignature: 's' },
        { appointmentId: id, razorpayOrderId: '', razorpayPaymentId: 'p', razorpaySignature: 's' },
        { appointmentId: id, razorpayOrderId: 'o', razorpayPaymentId: 'p' },
        {
          appointmentId: id,
          razorpayOrderId: 'o',
          razorpayPaymentId: 'p',
          razorpaySignature: 's',
          x: 1,
        },
      ],
    ],
  ]);
});
