import { baseSlug, isSlugConflict, retryOnSlugConflict, uniqueSlug } from './slug';

describe('slugs', () => {
  it('builds dr-<name>-<city>', () => {
    expect(baseSlug('Dr. Anita Sharma', 'Bareilly')).toBe('dr-anita-sharma-bareilly');
    expect(baseSlug('  Rohit  K. Verma ', 'Moradabad')).toBe('dr-rohit-k-verma-moradabad');
    expect(baseSlug('José Núñez', 'Goa')).toBe('dr-jose-nunez-goa');
    expect(baseSlug('डॉ शर्मा', 'Agra')).toBe('dr-doctor-agra');
  });

  it('adds a numeric suffix on collision', async () => {
    const taken = new Set(['dr-a-b', 'dr-a-b-2']);
    expect(await uniqueSlug('dr-a-b', async (s) => taken.has(s))).toBe('dr-a-b-3');
    expect(await uniqueSlug('dr-c-d', async (s) => taken.has(s))).toBe('dr-c-d');
  });
});

describe('retryOnSlugConflict', () => {
  const slugDup = Object.assign(new Error('E11000'), { code: 11000, keyPattern: { slug: 1 } });
  const userDup = Object.assign(new Error('E11000'), { code: 11000, keyPattern: { userId: 1 } });

  it('re-picks the slug when a concurrent writer took it first', async () => {
    const taken = new Set<string>();
    let saves = 0;
    const slug = await retryOnSlugConflict(async () => {
      // `exists` said free, but the other writer inserts first: the first save loses.
      const s = await uniqueSlug('dr-rajesh-kumar', (c) => Promise.resolve(taken.has(c)));
      if (saves++ === 0) {
        taken.add(s);
        throw slugDup;
      }
      return s;
    });
    expect(slug).toBe('dr-rajesh-kumar-2');
  });

  it('does not retry other duplicate keys and gives up after a few tries', async () => {
    await expect(retryOnSlugConflict(() => Promise.reject(userDup))).rejects.toBe(userDup);
    let n = 0;
    await expect(
      retryOnSlugConflict(() => {
        n++;
        return Promise.reject(slugDup);
      }, 3),
    ).rejects.toBe(slugDup);
    expect(n).toBe(3);
    expect(isSlugConflict(userDup)).toBe(false);
  });
});
