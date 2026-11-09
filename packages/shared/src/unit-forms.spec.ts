import { checkUnitProfile, UNIT_FORMS, UNIT_NAME_FIELD, WORKSPACE_TYPES, type WorkspaceType } from './index';

const valid = {
  clinic: {
    displayName: 'Dr Asha Rao',
    specialty: 'general_physician',
    qualifications: 'MBBS, MD',
    registrationNumber: 'KMC-12345',
    registrationCouncil: 'Karnataka Medical Council',
    registrationYear: 2012,
    experienceYears: 12,
    city: 'Hubballi',
    state: 'Karnataka',
    pincode: '580020',
    address: '12 Main Road, Hubballi',
    consultationFeeRupees: 300,
  },
  lab: {
    labName: 'Rao Diagnostics',
    ownerName: 'Asha Rao',
    city: 'Hubballi',
    address: '12 Main Road',
    registrationNumber: 'LAB-778',
    nablAccredited: false,
    homeCollection: true,
    testsOffered: 'CBC, LFT, thyroid',
  },
  pharmacy: {
    storeName: 'Rao Medicals',
    ownerName: 'Asha Rao',
    city: 'Hubballi',
    address: '12 Main Road',
    drugLicenceNumber: 'KA-HBL-20-1234',
    drugLicenceValidUntil: '2030-03-31',
    pharmacistName: 'Ravi Kumar',
    pharmacistRegistrationNumber: 'KSPC-5566',
    homeDelivery: true,
  },
} as const;

describe('unit forms', () => {
  it.each(WORKSPACE_TYPES as readonly WorkspaceType[])('accepts a complete %s application', (kind) => {
    const res = checkUnitProfile(kind, { ...valid[kind] });
    expect(res.ok).toBe(true);
  });

  it.each(WORKSPACE_TYPES as readonly WorkspaceType[])('names the %s from one of its fields', (kind) => {
    expect(UNIT_FORMS[kind].some((f) => f.key === UNIT_NAME_FIELD[kind])).toBe(true);
  });

  it.each(WORKSPACE_TYPES as readonly WorkspaceType[])('reports every missing required field of %s', (kind) => {
    const res = checkUnitProfile(kind, {});
    expect(res.ok).toBe(false);
    if (res.ok) return;
    const required = UNIT_FORMS[kind].filter((f) => f.required).map((f) => f.key);
    expect(res.issues.map((i) => i.path).sort()).toEqual(required.sort());
  });

  it('rejects unknown fields, bad values and wrong types', () => {
    const bad = checkUnitProfile('clinic', { ...valid.clinic, specialty: 'magic', experienceYears: -1, extra: 1 });
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.issues.map((i) => i.path).sort()).toEqual(['experienceYears', 'extra', 'specialty']);
  });

  it('treats an empty optional text as not given, and checks the GST format', () => {
    expect(checkUnitProfile('pharmacy', { ...valid.pharmacy, gstNumber: '' }).ok).toBe(true);
    expect(checkUnitProfile('pharmacy', { ...valid.pharmacy, gstNumber: '29ABCDE1234F1Z5' }).ok).toBe(true);
    expect(checkUnitProfile('pharmacy', { ...valid.pharmacy, gstNumber: 'nope' }).ok).toBe(false);
  });

  it('requires a real date for the licence expiry', () => {
    expect(checkUnitProfile('pharmacy', { ...valid.pharmacy, drugLicenceValidUntil: '31/03/2030' }).ok).toBe(false);
  });
});
