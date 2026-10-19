/**
 * Controlled list of specialties (DB doc 3.2 "from a controlled list"). Stored and queried by
 * `key`; the web app shows `en` / `hi`. Append only: never rename a key that has shipped.
 */
import { z } from 'zod';

export const SPECIALTIES = [
  { key: 'general_physician', en: 'General Physician', hi: 'सामान्य चिकित्सक' },
  { key: 'paediatrics', en: 'Paediatrician', hi: 'बाल रोग विशेषज्ञ' },
  { key: 'gynaecology', en: 'Gynaecologist', hi: 'स्त्री रोग विशेषज्ञ' },
  { key: 'dermatology', en: 'Dermatologist', hi: 'त्वचा रोग विशेषज्ञ' },
  { key: 'orthopaedics', en: 'Orthopaedic', hi: 'हड्डी रोग विशेषज्ञ' },
  { key: 'ent', en: 'ENT Specialist', hi: 'नाक, कान, गला विशेषज्ञ' },
  { key: 'ophthalmology', en: 'Eye Specialist', hi: 'नेत्र रोग विशेषज्ञ' },
  { key: 'dentistry', en: 'Dentist', hi: 'दंत चिकित्सक' },
  { key: 'cardiology', en: 'Cardiologist', hi: 'हृदय रोग विशेषज्ञ' },
  { key: 'neurology', en: 'Neurologist', hi: 'तंत्रिका रोग विशेषज्ञ' },
  { key: 'psychiatry', en: 'Psychiatrist', hi: 'मनोचिकित्सक' },
  { key: 'gastroenterology', en: 'Gastroenterologist', hi: 'पेट रोग विशेषज्ञ' },
  { key: 'pulmonology', en: 'Chest Physician', hi: 'छाती रोग विशेषज्ञ' },
  { key: 'urology', en: 'Urologist', hi: 'मूत्र रोग विशेषज्ञ' },
  { key: 'nephrology', en: 'Nephrologist', hi: 'गुर्दा रोग विशेषज्ञ' },
  { key: 'endocrinology', en: 'Diabetologist / Endocrinologist', hi: 'मधुमेह / हार्मोन विशेषज्ञ' },
  { key: 'general_surgery', en: 'General Surgeon', hi: 'सामान्य शल्य चिकित्सक' },
  { key: 'ayurveda', en: 'Ayurveda', hi: 'आयुर्वेद' },
  { key: 'homoeopathy', en: 'Homoeopathy', hi: 'होम्योपैथी' },
  { key: 'physiotherapy', en: 'Physiotherapist', hi: 'फिजियोथेरेपिस्ट' },
] as const;

export type SpecialtyKey = (typeof SPECIALTIES)[number]['key'];
export const SPECIALTY_KEYS = SPECIALTIES.map((s) => s.key) as [SpecialtyKey, ...SpecialtyKey[]];
export const SpecialtyKeySchema = z.enum(SPECIALTY_KEYS);

/** Medical councils a registration can belong to: NMC, a state council, or the AYUSH bodies. */
export const REGISTRATION_COUNCIL_MAX = 120;
