import type { WorkspaceType } from '@doqto/shared';

/** What each form field is called when staff review an application. Keys match `UNIT_FORMS`. */
export const FORM_LABELS: Record<WorkspaceType, Record<string, string>> = {
  clinic: {
    displayName: 'Name shown to patients',
    specialty: 'Specialty',
    qualifications: 'Qualifications',
    registrationNumber: 'Medical council registration number',
    registrationCouncil: 'Registered with',
    registrationYear: 'Year of registration',
    experienceYears: 'Years of experience',
    city: 'City or town',
    state: 'State',
    pincode: 'PIN code',
    address: 'Clinic address',
    consultationFeeRupees: 'Consultation fee (₹)',
    languages: 'Languages',
    about: 'About',
  },
  lab: {
    labName: 'Lab name',
    ownerName: 'Owner name',
    city: 'City or town',
    address: 'Lab address',
    registrationNumber: 'Registration or licence number',
    nablAccredited: 'NABL accredited',
    homeCollection: 'Collects samples at home',
    testsOffered: 'Tests offered',
    turnaroundHours: 'Usual hours to a report',
  },
  pharmacy: {
    storeName: 'Store name',
    ownerName: 'Owner name',
    city: 'City or town',
    address: 'Store address',
    drugLicenceNumber: 'Drug licence number',
    drugLicenceValidUntil: 'Licence valid until',
    pharmacistName: 'Registered pharmacist',
    pharmacistRegistrationNumber: 'Pharmacist registration number',
    gstNumber: 'GST number',
    homeDelivery: 'Delivers to homes',
  },
};
