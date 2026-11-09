import type { RatingDimension, ReportReason, VisitReason, WouldRecommend } from '@doqto/shared';
import type { MessageKey } from '@/i18n/translate';

export const DIMENSION_KEY: Record<RatingDimension, MessageKey> = {
  waitTime: 'reviews.dimWaitTime',
  explanation: 'reviews.dimExplanation',
  behaviour: 'reviews.dimBehaviour',
  facilities: 'reviews.dimFacilities',
  valueForMoney: 'reviews.dimValue',
};

/** The visit reasons are the same short list used when booking. */
export const REASON_KEY: Record<VisitReason, MessageKey> = {
  checkup: 'bookingConfirm.reasonCheckup',
  follow_up: 'bookingConfirm.reasonFollowUp',
  child: 'bookingConfirm.reasonChild',
  women: 'bookingConfirm.reasonWomen',
  other: 'bookingConfirm.reasonOther',
};

export const RECOMMEND_KEY: Record<WouldRecommend, MessageKey> = {
  yes: 'reviews.recYes',
  no: 'reviews.recNo',
  unsure: 'reviews.recUnsure',
};

export const REPORT_KEY: Record<ReportReason, MessageKey> = {
  abusive: 'reviews.reportAbusive',
  fake: 'reviews.reportFake',
  personal_info: 'reviews.reportPersonal',
  spam: 'reviews.reportSpam',
  other: 'reviews.reportOther',
};
