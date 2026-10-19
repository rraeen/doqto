/**
 * On-demand entry to the API client. Zod and the shared schemas load with the first API call
 * instead of in every page's first-load JS (FE-02 budget). Client components import from here;
 * the modules themselves are for tests, server code and code that is already lazily loaded.
 */

/** Wraps an async-function module so each call loads it first. Every export must be async. */
function lazyModule<M extends object>(load: () => Promise<M>): M {
  return new Proxy({} as M, {
    get:
      (_target, key) =>
      async (...args: unknown[]) => {
        const mod = await load();
        return (mod[key as keyof M] as (...a: unknown[]) => unknown)(...args);
      },
  });
}

export const authApi = lazyModule(() => import('./auth'));
export const doctorApi = lazyModule(() => import('./doctor'));
export const clinicsApi = lazyModule(() => import('./clinics'));
export const adminApi = lazyModule(() => import('./admin'));
export const searchApi = lazyModule(() => import('./doctors'));
