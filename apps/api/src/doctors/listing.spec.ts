import { Types } from 'mongoose';
import { computeIsListed, missingRequirements } from './listing';

const complete = {
  registration: { council: 'NMC', number: '1', year: 2010, docKey: 'private/x.pdf' },
  clinicIds: [new Types.ObjectId()],
  specialties: ['dentistry' as const],
  qualifications: [{ degree: 'BDS' }],
  bookingFee: 1500,
  verification: { status: 'verified' as const },
};

describe('listing rules', () => {
  it('lists only verified, complete profiles', () => {
    expect(computeIsListed(complete)).toBe(true);
    expect(computeIsListed({ ...complete, verification: { status: 'pending' } })).toBe(false);
    expect(computeIsListed({ ...complete, clinicIds: [] })).toBe(false);
  });

  it('reports what is missing', () => {
    expect(
      missingRequirements({
        ...complete,
        registration: { council: 'NMC', number: '1', year: 2010 },
        bookingFee: undefined,
      }),
    ).toEqual(['registration_document', 'booking_fee']);
  });
});
