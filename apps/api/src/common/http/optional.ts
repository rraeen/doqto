import { ValidateIf } from 'class-validator';

/**
 * Optional field that may be omitted but never `null` (Zod `.optional()`). Use instead of
 * `@IsOptional()`, which also lets `null` through and lets it reach the database (RD BE-07).
 */
export const Optional = () => ValidateIf((_o, v) => v !== undefined);

/** Optional field where `null` clears the value (Zod `.nullable().optional()`). */
export const NullableOptional = () => ValidateIf((_o, v) => v !== undefined && v !== null);
