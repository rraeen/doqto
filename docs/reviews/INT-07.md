# Review: INT-07 Maps: geocoding helper and static map links

- Owner: INT
- Reviewed: 2026-10-10, by RD
- Round: 1
- **Verdict: Approved**

## What was checked

I read `maps/maps.ts`, `geocoder.provider.ts`, `demo-geocoder.provider.ts`, `nominatim-geocoder.provider.ts`, `maps.spec.ts`, and the `GEOCODER_PROVIDER` binding in `integrations.module.ts`.

The tests run in the same 93-test pass as INT-06.

Checklist sections applied: A, E, H.

## Acceptance criteria

| Criterion | Holds? | Evidence |
| --- | --- | --- |
| Clinic location picker support: a free geocoding option or manual pin | Yes | Live mode uses OpenStreetMap Nominatim. It sticks to India, sends an identifying User-Agent, spaces requests 1.1 s apart (Nominatim's policy is 1 per second), has an LRU-style cache and a 5 s timeout, and returns `[]` on any failure so FE falls back to a manual pin. Demo uses a fixed city table with no network |
| "Open in Google Maps" link builder for profiles and WhatsApp templates | Yes | `googleMapsLink` and `googleMapsDirectionsLink` use the keyless Maps URLs API. Query text is `encodeURIComponent`-encoded |
| No paid map API | Yes | No API keys anywhere |

`toGeoJsonPoint` keeps `[lng, lat]` order for the `2dsphere` index, and `isInIndia` catches swapped coordinates.

## Findings

### Blockers

None.

### Should fix

None.

### Nits

1. FE cannot import from `apps/api`. As INT notes, BE should either move the pure link builders into `packages/shared` or return `mapsUrl` in the clinic response (the contract already has `Clinic.mapsUrl`). The latter is simpler; RD will check it in BE-08 and BE-10.
2. The in-memory cache and rate gate are per instance. That is fine on one Render instance, and worth a comment for when a second one appears.

## Re-review log

- None yet.
