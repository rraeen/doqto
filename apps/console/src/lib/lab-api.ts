import {
  ENDPOINTS,
  LabCatalogueSchema,
  LabCategorySchema,
  LabCollectorsSchema,
  LabConsoleBookingListSchema,
  LabConsoleBookingSchema,
  LabTestSchema,
  type CreateLabTestRequest,
  type LabCatalogue,
  type LabCategory,
  type LabCollectors,
  type LabConsoleBooking,
  type LabConsoleBookingList,
  type LabTest,
  type UpdateLabTestRequest,
} from '@doqto/shared';
import { apiRequest } from './api';

const lab = ENDPOINTS.consoleLab;

export const labCatalogueKey = (unitId: string) => ['console', 'lab', 'catalogue', unitId] as const;
export const labBookingsKey = (unitId: string) => ['console', 'lab', 'bookings', unitId] as const;
export const labCollectorsKey = (unitId: string) => ['console', 'lab', 'collectors', unitId] as const;

export const getLabCatalogue = (unitId: string): Promise<LabCatalogue> =>
  apiRequest(lab.catalogue(unitId), { schema: LabCatalogueSchema });

export const createLabCategory = (unitId: string, name: string): Promise<LabCategory> =>
  apiRequest(lab.categories(unitId), { method: 'POST', body: { name }, schema: LabCategorySchema });

export const createLabTest = (unitId: string, body: CreateLabTestRequest): Promise<LabTest> =>
  apiRequest(lab.tests(unitId), { method: 'POST', body, schema: LabTestSchema });

export const updateLabTest = (
  unitId: string,
  testId: string,
  body: UpdateLabTestRequest,
): Promise<LabTest> =>
  apiRequest(lab.test(unitId, testId), { method: 'PATCH', body, schema: LabTestSchema });

export const getLabBookings = (unitId: string): Promise<LabConsoleBookingList> =>
  apiRequest(lab.bookings(unitId), { schema: LabConsoleBookingListSchema });

export const getLabCollectors = (unitId: string): Promise<LabCollectors> =>
  apiRequest(lab.collectors(unitId), { schema: LabCollectorsSchema });

export const decideLabBooking = (
  unitId: string,
  bookingId: string,
  body: { decision: 'accept' | 'reject'; reason?: string },
): Promise<LabConsoleBooking> =>
  apiRequest(lab.decision(unitId, bookingId), {
    method: 'POST',
    body,
    schema: LabConsoleBookingSchema,
  });

export const progressLabBooking = (
  unitId: string,
  bookingId: string,
  step: 'collected' | 'no_show' | 'processing' | 'completed',
): Promise<LabConsoleBooking> =>
  apiRequest(lab.progress(unitId, bookingId), {
    method: 'POST',
    body: { step },
    schema: LabConsoleBookingSchema,
  });

export const assignLabCollector = (
  unitId: string,
  bookingId: string,
  accountId: string | null,
): Promise<LabConsoleBooking> =>
  apiRequest(lab.assignee(unitId, bookingId), {
    method: 'PUT',
    body: { accountId },
    schema: LabConsoleBookingSchema,
  });

export const uploadLabReport = (
  unitId: string,
  bookingId: string,
  file: File,
): Promise<LabConsoleBooking> => {
  const formData = new FormData();
  formData.append('file', file, file.name);
  return apiRequest(lab.report(unitId, bookingId), {
    method: 'PUT',
    formData,
    schema: LabConsoleBookingSchema,
  });
};
