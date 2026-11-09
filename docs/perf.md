# Frontend performance notes

**Date:** 2026-10-20
**Scope:** the patient web app (`apps/web`) as a production build (`next build` + `next start`), measured in headless Edge at a 390×844 phone size with the service worker bypassed and the cache off.
**Story:** FE-32 (performance pass). Target in the backlog: under 200 KB of first-load JS on doctor and booking pages, tested on a throttled 3G profile and a low-end Android profile.

## What was measured

Transferred (compressed) size on first load, signed out, English:

| Page | JS | CSS | Fonts | HTML |
| --- | --- | --- | --- | --- |
| `/` (landing) | 250 KB | 13 KB | 143 KB | 21 KB |
| `/login` | 222 KB | 13 KB | 143 KB | 19 KB |
| `/install` | 241 KB | 13 KB | 143 KB | 21 KB |
| `/privacy` | 234 KB | 13 KB | 143 KB | 23 KB |
| `/transparency` | 238 KB | 13 KB | 143 KB | 20 KB |
| `/for-doctors` | 234 KB | 13 KB | 143 KB | 22 KB |
| `/search` | 238 KB | 13 KB | 158 KB | 21 KB |
| `/offline` | 213 KB | 13 KB | 143 KB | 18 KB |

Signed-in pages (doctor profile, booking, appointments) were not sized this way, because they need the backend; the shared JS above is their floor.

Time to first paint and full load (after the font change below):

| Profile | FCP | Load |
| --- | --- | --- |
| No throttling | 0.2 to 0.5 s | 0.2 to 0.4 s |
| Slow 4G + 4× slower CPU | 0.8 to 1.5 s | about 2.5 s |
| 3G + 4× slower CPU (low-end Android) | 2.1 to 2.8 s | 7.2 to 8.7 s |

## What the JS is made of

On `/login` (222 KB): React DOM 71 KB, the Next.js client runtime 44 KB, Zod 38 KB (loaded when the first API call is made), the rest is app code in small chunks. The mock API library (MSW, 96 KB) is in the build but is **not loaded** in production: it loads only when `NEXT_PUBLIC_API_MOCKS=true`.

## Changes made

- **Hindi font no longer preloaded.** `Noto Sans Devanagari` (119 KB) was fetched and preloaded on every English page. It is now `preload: false` in `app/layout.tsx`, so it loads only once a Devanagari character is on screen. On 3G this cut the landing page load from about 9.5 s to about 7.2 s.

## Findings and recommendations

1. **The Hindi font still loads on English pages** because the language switch shows the letter `हि`. Options: show that label in a system font, or serve a font file cut down to only the characters the interface uses (the interface strings are known). Either saves up to 119 KB on every first visit.
2. **Zod is 38 KB on the first load.** It arrives with the first API call (the "who am I" check). Deferring that check until after the first paint, or validating responses with a lighter check on the landing page, would remove it from the critical path.
3. **The 200 KB target** is close but not met on the landing page (250 KB). React and Next account for about 115 KB, which is unavoidable. The shared app code is about 100 KB; the two items above would bring it near the target.
4. **Throttled results are from a desktop browser with emulated limits.** They show direction, not real-device numbers. Before launch, repeat on a real low-end Android phone and run Lighthouse on the landing, search and doctor pages.
5. **`public/mockServiceWorker.js`** is still copied into the production output. It does nothing unless mocks are on, but it should be excluded from production builds.

## How to repeat

```
cd apps/web
NEXT_PUBLIC_API_URL=/api/v1 NEXT_DIST_DIR=.next-perf npx next build
NEXT_DIST_DIR=.next-perf npx next start -p 3101
```

Then open the pages in a phone-sized browser with the network and CPU throttled, with the service worker bypassed.
