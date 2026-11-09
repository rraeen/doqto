import type { Address, GeoPoint } from '@doqto/shared';
import type { MockClinic, MockDoctor } from './db';

/** Demo directory the mocks start with: 3 clinics, 5 verified, listed doctors (like BE-11). */
const at = '2026-10-01T04:30:00.000Z';
const id = (n: number) => `5eed0000000000000000${String(n).padStart(4, '0')}`;
const point = (lat: number, lng: number): GeoPoint => ({ type: 'Point', coordinates: [lng, lat] });
const address = (line1: string, area: string, city: string, pincode: string): Address => ({
  line1,
  area,
  city,
  state: 'Uttar Pradesh',
  pincode,
});

const CITIES = [
  {
    city: 'Bareilly',
    pin: '2430',
    lat: 28.36,
    lng: 79.43,
    areas: ['Civil Lines', 'Rajendra Nagar'],
  },
  { city: 'Lucknow', pin: '2260', lat: 26.85, lng: 80.95, areas: ['Gomti Nagar', 'Aliganj'] },
  { city: 'Kanpur', pin: '2080', lat: 26.45, lng: 80.33, areas: ['Swaroop Nagar', 'Kakadeo'] },
] as const;

/** Extra clinics (two per city) that the generated example doctors practise in. */
const GENERATED_CLINICS: MockClinic[] = CITIES.flatMap((c, ci) =>
  c.areas.map((area, ai) => {
    const n = 111 + ci * 2 + ai;
    return {
      id: id(n),
      name: `${area} Health Clinic`,
      phone: null,
      address: address(`${10 + ai * 7} Main Road`, area, c.city, `${c.pin}${10 + ai}`),
      location: point(c.lat + ai * 0.012, c.lng + ai * 0.014),
      photoUrls: [],
      ownerUserId: id(n),
      doctorIds: [] as string[],
      staffUserIds: [],
      createdAt: at,
    } satisfies MockClinic;
  }),
);

const FIRST = [
  'Aarav',
  'Neha',
  'Imran',
  'Pooja',
  'Sandeep',
  'Ritu',
  'Mohit',
  'Kavita',
  'Arjun',
  'Seema',
  'Tariq',
  'Meena',
  'Rohit',
  'Anjali',
];
const LAST = [
  'Verma',
  'Singh',
  'Agarwal',
  'Saxena',
  'Ansari',
  'Tiwari',
  'Yadav',
  'Pandey',
  'Srivastava',
];
const SPECIALTY_ROTATION: [MockDoctor['specialties'], string][] = [
  [['general_physician'], 'MBBS, MD (Medicine)'],
  [['paediatrics'], 'MBBS, DCH'],
  [['dermatology'], 'MBBS, MD (Dermatology)'],
  [['orthopaedics'], 'MBBS, MS (Ortho)'],
  [['ophthalmology'], 'MBBS, MS (Ophthalmology)'],
  [['gynaecology'], 'MBBS, MS (Obs & Gyn)'],
  [['dentistry'], 'BDS, MDS'],
  [['ent'], 'MBBS, MS (ENT)'],
];

/** 52 example doctors spread over the generated clinics, so search has enough to page through. */
function doctorsFromGenerator(): MockDoctor[] {
  const out: MockDoctor[] = [];
  for (let i = 0; i < 52; i++) {
    const clinic = GENERATED_CLINICS[i % GENERATED_CLINICS.length] as MockClinic;
    const [specialties, degree] = SPECIALTY_ROTATION[i % SPECIALTY_ROTATION.length] as [
      MockDoctor['specialties'],
      string,
    ];
    const female = i % 2 === 0;
    const name = `Dr. ${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length) % LAST.length]}`;
    const d = doctor(
      301 + i,
      301 + i,
      name,
      female ? 'female' : 'male',
      specialties,
      degree,
      4 + ((i * 3) % 22),
      20000 + (i % 6) * 5000,
      clinic.address.city,
    );
    clinic.doctorIds.push(d.id);
    out.push(d);
  }
  return out;
}

export const SEED_CLINICS: MockClinic[] = [
  ...GENERATED_CLINICS,
  {
    id: id(101),
    name: 'Sharma Family Clinic',
    phone: '+919812300001',
    address: address('12 Civil Lines Road', 'Civil Lines', 'Bareilly', '243001'),
    location: point(28.364, 79.43),
    photoUrls: [],
    ownerUserId: id(1),
    doctorIds: [id(201), id(202)],
    staffUserIds: [],
    createdAt: at,
  },
  {
    id: id(102),
    name: 'Rajendra Nagar Child Care',
    phone: null,
    address: address('B-45 Rajendra Nagar', 'Rajendra Nagar', 'Bareilly', '243122'),
    location: point(28.381, 79.417),
    photoUrls: [],
    ownerUserId: id(3),
    doctorIds: [id(203)],
    staffUserIds: [],
    createdAt: at,
  },
  {
    id: id(103),
    name: 'Gomti Skin and Eye Centre',
    phone: '+919812300003',
    address: address('Plot 7, Sector 14, Indira Nagar', 'Indira Nagar', 'Lucknow', '226016'),
    location: point(26.877, 80.998),
    photoUrls: [],
    ownerUserId: id(4),
    doctorIds: [id(204), id(205)],
    staffUserIds: [],
    createdAt: at,
  },
];

function doctor(
  n: number,
  userN: number,
  name: string,
  gender: 'female' | 'male',
  specialties: MockDoctor['specialties'],
  degree: string,
  experienceYears: number,
  consultFee: number,
  city: string,
): MockDoctor {
  const slugName = name
    .toLowerCase()
    .replace(/^dr\.?\s*/, '')
    .replace(/[^a-z]+/g, '-');
  return {
    id: id(n),
    userId: id(userN),
    phone: `+91981230${String(n).padStart(4, '0')}`,
    slug: `dr-${slugName}-${city.toLowerCase()}`,
    name,
    gender,
    photoUrl: null,
    bio: `${name} has practised in ${city} for ${experienceYears} years.`,
    languages: ['Hindi', 'English'],
    qualifications: [
      { degree, institute: 'King George’s Medical University', year: 2026 - experienceYears - 1 },
    ],
    specialties,
    experienceYears,
    registration: {
      council: 'Uttar Pradesh Medical Council',
      number: `UPMC-${40000 + n}`,
      year: 2026 - experienceYears,
    },
    documentUrl: null,
    documentUploaded: true,
    verification: { status: 'verified', notes: null, verifiedAt: at },
    consultFee,
    bookingFee: 1500,
    createdAt: at,
    updatedAt: at,
  };
}

export const SEED_DOCTORS: MockDoctor[] = [
  ...doctorsFromGenerator(),
  doctor(
    201,
    1,
    'Dr. Anita Sharma',
    'female',
    ['general_physician'],
    'MBBS, MD (Medicine)',
    14,
    30000,
    'Bareilly',
  ),
  doctor(
    202,
    2,
    'Dr. Rakesh Sharma',
    'male',
    ['orthopaedics'],
    'MBBS, MS (Ortho)',
    21,
    50000,
    'Bareilly',
  ),
  doctor(203, 3, 'Dr. Farah Khan', 'female', ['paediatrics'], 'MBBS, DCH', 9, 40000, 'Bareilly'),
  doctor(
    204,
    4,
    'Dr. Vivek Mishra',
    'male',
    ['dermatology'],
    'MBBS, MD (Dermatology)',
    11,
    60000,
    'Lucknow',
  ),
  doctor(
    205,
    5,
    'Dr. Neha Gupta',
    'female',
    ['ophthalmology'],
    'MBBS, MS (Ophthalmology)',
    7,
    50000,
    'Lucknow',
  ),
];
