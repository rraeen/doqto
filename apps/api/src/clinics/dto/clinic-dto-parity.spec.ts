import {
  AddStaffRequestSchema,
  CreateClinicRequestSchema,
  UpdateClinicRequestSchema,
} from '@doqto/shared';
import { expectParity } from '../../common/testing/dto-parity';
import { AddStaffDto, CreateClinicDto, UpdateClinicDto } from './clinic.dto';

const address = {
  line1: '12 Station Road',
  city: 'Bareilly',
  state: 'Uttar Pradesh',
  pincode: '243001',
};

describe('clinic DTOs match the shared contract', () => {
  expectParity([
    [
      'POST /clinics',
      CreateClinicDto,
      CreateClinicRequestSchema,
      [
        { name: 'Sharma Clinic', address },
        { name: 'Sharma Clinic', address, location: { lat: 28.36, lng: 79.42 } },
        { name: 'Sharma Clinic', address, location: { lat: 79.42, lng: 28.36 } },
        { name: 'Sharma Clinic', address: { ...address, pincode: '043001' } },
        { name: 'Sharma Clinic', address, location: null },
        { name: null, address },
        { name: 'Sharma Clinic', address, ownerUserId: 'x' },
      ],
    ],
    [
      'PATCH /clinics/:id',
      UpdateClinicDto,
      UpdateClinicRequestSchema,
      [
        { name: 'New name' },
        { location: null },
        { phone: null },
        { name: null },
        { address: null },
        { address: { ...address, city: '' } },
        { doctorIds: [] },
      ],
    ],
    [
      'POST /clinics/:id/staff',
      AddStaffDto,
      AddStaffRequestSchema,
      [
        { phone: '+919876543210' },
        { phone: '+919876543210', name: 'Front desk' },
        { phone: '98765' },
        { phone: '+919876543210', name: null },
      ],
    ],
  ]);
});
