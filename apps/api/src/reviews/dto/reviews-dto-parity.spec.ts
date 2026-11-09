import {
  CreateReviewRequestSchema,
  DoctorReviewsQuerySchema,
  ReportReviewRequestSchema,
  UpdateReviewRequestSchema,
} from '@doqto/shared';
import { expectParity } from '../../common/testing/dto-parity';
import {
  CreateReviewDto,
  DoctorReviewsQueryDto,
  ReportReviewDto,
  UpdateReviewDto,
} from './reviews.dto';

const id = 'a'.repeat(24);
const ratings = { waitTime: 4, explanation: 5, behaviour: 4, facilities: 3, valueForMoney: 4 };
const body = { ratings, wouldRecommend: 'yes', reason: 'checkup' };
const text = 'The doctor explained everything clearly.';

describe('review DTOs match the shared contract', () => {
  expectParity([
    [
      'CreateReview',
      CreateReviewDto,
      CreateReviewRequestSchema,
      [
        { appointmentId: id, ...body },
        { appointmentId: id, ...body, text },
        { appointmentId: id, ...body, text: 'too short' },
        { appointmentId: id, ...body, text: 'x'.repeat(1001) },
        { appointmentId: id, ...body, waitedMinutes: 30 },
        { appointmentId: id, ...body, waitedMinutes: 601 },
        { appointmentId: id, ...body, wouldRecommend: 'maybe' },
        { appointmentId: id, ...body, reason: 'astrology' },
        { appointmentId: id, ...body, ratings: { ...ratings, waitTime: 6 } },
        { appointmentId: id, ...body, ratings: { ...ratings, waitTime: 0 } },
        { appointmentId: id, ...body, ratings: { ...ratings, extra: 1 } },
        { appointmentId: id, ...body, ratings: { waitTime: 4 } },
        { ...body },
        { appointmentId: 'nope', ...body },
        { appointmentId: id, ...body, extra: 1 },
      ],
    ],
    [
      'UpdateReview',
      UpdateReviewDto,
      UpdateReviewRequestSchema,
      [body, { ...body, text }, { ...body, appointmentId: id }, { wouldRecommend: 'yes' }],
    ],
    [
      'ReportReview',
      ReportReviewDto,
      ReportReviewRequestSchema,
      [{ reason: 'spam' }, { reason: 'rude' }, {}, { reason: 'spam', x: 1 }],
    ],
    [
      'DoctorReviewsQuery',
      DoctorReviewsQueryDto,
      DoctorReviewsQuerySchema,
      [{}, { limit: 10 }, { sort: 'recent' }, { sort: 'best' }, { limit: 51 }, { x: 1 }],
    ],
  ]);
});
