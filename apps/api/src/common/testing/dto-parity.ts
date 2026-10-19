import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { ZodType } from 'zod';

/** Runs a body through a class-validator DTO exactly as the global pipe does. */
export function dtoAccepts(cls: new () => object, body: Record<string, unknown>): boolean {
  return (
    validateSync(plainToInstance(cls, body), { whitelist: true, forbidNonWhitelisted: true })
      .length === 0
  );
}

export type ParityCase = [string, new () => object, ZodType, Record<string, unknown>[]];

/** DTOs must accept and reject exactly what the shared Zod contract does. */
export function expectParity(cases: ParityCase[]): void {
  it.each(cases)('%s', (_name, cls, schema, bodies) => {
    for (const body of bodies) {
      expect({ body, ok: dtoAccepts(cls, body) }).toEqual({
        body,
        ok: schema.safeParse(body).success,
      });
    }
  });
}
