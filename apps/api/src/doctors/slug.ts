/** `dr-anita-sharma-bareilly`: ASCII, lower-case, hyphenated (DB doc 3.2). */
export function baseSlug(name: string, city: string): string {
  const clean = (s: string) =>
    s
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/^\s*dr\.?\s+/, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  const parts = ['dr', clean(name) || 'doctor', clean(city)].filter(Boolean);
  return parts.join('-').slice(0, 80).replace(/-+$/, '');
}

/** A slug for something that is not a doctor, like `city-lab-name`: `prefix-name-city`. */
export function plainSlug(name: string, city: string, prefix: string): string {
  const clean = (v: string) =>
    v
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  return [clean(name) || prefix, clean(city)].filter(Boolean).join('-').slice(0, 80).replace(/-+$/, '');
}

/** First free slug: the base, then `-2`, `-3`, ... `exists` checks the unique index's collection. */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  for (let n = 1; n < 1000; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error('No free slug');
}

/** A duplicate-key error on the `slug` unique index (not on `userId`). */
export function isSlugConflict(e: unknown): boolean {
  const err = e as { code?: number; keyPattern?: Record<string, unknown> } | null;
  return err?.code === 11000 && err.keyPattern !== undefined && 'slug' in err.keyPattern;
}

/**
 * Runs a write that picks a slug with `uniqueSlug`. Two writers can pick the same free slug at
 * once; the unique index stops the second, which then re-picks (the winner's slug is now taken).
 */
export async function retryOnSlugConflict<T>(write: () => Promise<T>, attempts = 5): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await write();
    } catch (e) {
      if (!isSlugConflict(e) || i >= attempts) throw e;
    }
  }
}
