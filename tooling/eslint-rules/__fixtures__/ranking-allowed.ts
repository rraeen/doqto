// Allowed (INT-01): ranking input has no payment field and imports nothing
// from payments. Linted as apps/api/src/doctors/ranking.ts.
import { type DoctorRankInput } from './ranking.types';

export function rankScore(input: DoctorRankInput): number {
  return input.score;
}
