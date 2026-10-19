import type { ClinicPrivate } from '@doqto/shared';
import { describe, expect, it } from 'vitest';
import en from '@/i18n/messages/en';
import { createTranslator } from '@/i18n/translate';
import { clinicFormFrom, toCreateRequest, toUpdateRequest, validateClinic } from './clinic-form';

const t = createTranslator(en);

const clinic: ClinicPrivate = {
  id: '665f1c2b9d3e4a0012ab34cd',
  name: 'Sharma Clinic',
  phone: '+919811100011',
  address: { line1: '1 Station Road', city: 'Bareilly', state: 'Uttar Pradesh', pincode: '243001' },
  location: { type: 'Point', coordinates: [79.43, 28.36] },
  photoUrls: [],
  timezone: 'Asia/Kolkata',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=28.36,79.43',
  ownerUserId: '665f1c2b9d3e4a0012ab34ce',
  doctorIds: [],
  staff: [],
  canManage: true,
  createdAt: '2026-10-10T00:00:00.000Z',
};

describe('clinic form', () => {
  it('flags missing and malformed fields', () => {
    const errors = validateClinic({ ...clinicFormFrom(), pincode: '043001', phoneDigits: '98' }, t);
    expect(Object.keys(errors).sort()).toEqual(['city', 'line1', 'name', 'phone', 'pincode']);
  });

  it('builds a create request without empty optional fields', () => {
    const v = {
      ...clinicFormFrom(),
      name: ' New Clinic ',
      line1: 'Main Road',
      city: 'Lucknow',
      pincode: '226001',
    };
    expect(toCreateRequest(v)).toEqual({
      name: 'New Clinic',
      address: { line1: 'Main Road', city: 'Lucknow', state: 'Uttar Pradesh', pincode: '226001' },
    });
  });

  it('patches only what changed, and clears the pin and phone with null', () => {
    const v = clinicFormFrom(clinic);
    expect(v.pin).toEqual({ lat: 28.36, lng: 79.43 });
    expect(toUpdateRequest(v, clinic)).toBeNull();
    expect(toUpdateRequest({ ...v, pin: null, phone: null, phoneDigits: '' }, clinic)).toEqual({
      phone: null,
      location: null,
    });
    expect(toUpdateRequest({ ...v, area: 'Civil Lines' }, clinic)).toEqual({
      address: { ...clinic.address, area: 'Civil Lines' },
    });
  });
});
