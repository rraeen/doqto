import type {
  DoctorStatus,
  Clinic as ClinicView,
  DoctorListItem,
  DoctorPrivateProfile,
  DoctorProfile,
  RatingSummary,
} from '@doqto/shared';
import { fromGeoJsonPoint, googleMapsLink } from '../integrations';
import type { ClinicDocument } from '../clinics/clinic.schema';
import type { DoctorDocument } from './doctor.schema';
import { missingRequirements } from './listing';

/** Public rating summary: hidden ("New on Doqto") below 5 counted reviews. */
export const MIN_REVIEWS_FOR_SUMMARY = 5;

function ratingSummary(d: DoctorDocument): RatingSummary | null {
  const r = d.ratingSummary;
  if (!r || r.count < MIN_REVIEWS_FOR_SUMMARY) return null;
  return { ...r, updatedAt: r.updatedAt.toISOString() };
}

export function toClinicView(c: ClinicDocument): ClinicView {
  const point = c.location ? fromGeoJsonPoint(c.location) : null;
  return {
    id: c._id.toHexString(),
    name: c.name,
    phone: c.phone ?? null,
    address: {
      line1: c.address.line1,
      area: c.address.area,
      city: c.address.city,
      district: c.address.district,
      state: c.address.state,
      pincode: c.address.pincode,
    },
    location: c.location
      ? { type: 'Point', coordinates: [c.location.coordinates[0], c.location.coordinates[1]] }
      : null,
    photoUrls: c.photos.map((p) => p.url),
    timezone: 'Asia/Kolkata',
    mapsUrl: point ? googleMapsLink(point, c.name) : null,
  };
}

export function toPrivateProfile(d: DoctorDocument): DoctorPrivateProfile {
  return {
    id: d._id.toHexString(),
    slug: d.slug,
    name: d.name,
    gender: d.gender ?? null,
    photoUrl: d.photoUrl ?? null,
    bio: d.bio ?? null,
    languages: d.languages,
    qualifications: d.qualifications.map((q) => ({
      degree: q.degree,
      institute: q.institute,
      year: q.year,
    })),
    specialties: d.specialties,
    experienceYears: d.experienceYears ?? null,
    registration: {
      council: d.registration.council,
      number: d.registration.number,
      year: d.registration.year,
      documentUploaded: Boolean(d.registration.docKey),
    },
    verification: {
      status: d.verification.status,
      notes: d.verification.notes ?? null,
      verifiedAt: d.verification.verifiedAt?.toISOString() ?? null,
    },
    consultFee: d.consultFee ?? null,
    bookingFee: d.bookingFee ?? null,
    clinicIds: d.clinicIds.map((id) => id.toHexString()),
    city: d.city ?? null,
    isListed: d.isListed,
    missing: missingRequirements(d),
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

export function toPublicProfile(
  d: DoctorDocument,
  clinics: ClinicDocument[],
  todayStatus: DoctorStatus | null = null,
): DoctorProfile {
  const primary = clinics[0];
  return {
    id: d._id.toHexString(),
    slug: d.slug,
    name: d.name,
    gender: d.gender ?? null,
    photoUrl: d.photoUrl ?? null,
    bio: d.bio ?? null,
    languages: d.languages,
    qualifications: d.qualifications.map((q) => ({
      degree: q.degree,
      institute: q.institute,
      year: q.year,
    })),
    specialties: d.specialties,
    experienceYears: d.experienceYears ?? null,
    verificationStatus: d.verification.status,
    city: primary?.address.city ?? d.city ?? '',
    consultFee: d.consultFee ?? null,
    bookingFee: d.bookingFee ?? null,
    clinics: clinics.map(toClinicView),
    ratingSummary: ratingSummary(d),
    todayStatus,
  };
}

export function toListItem(
  d: DoctorDocument,
  primary: ClinicDocument | undefined,
  distanceMeters: number | null,
): DoctorListItem {
  return {
    id: d._id.toHexString(),
    slug: d.slug,
    name: d.name,
    photoUrl: d.photoUrl ?? null,
    specialties: d.specialties,
    experienceYears: d.experienceYears ?? null,
    city: primary?.address.city ?? d.city ?? '',
    consultFee: d.consultFee ?? null,
    ratingSummary: ratingSummary(d),
    distanceMeters,
    primaryClinic: primary
      ? { id: primary._id.toHexString(), name: primary.name, area: primary.address.area ?? null }
      : null,
  };
}
