# @doqto/console

The one app for everyone except patients: doctors, clinics, labs, pharmacies and the Doqto team. What each person sees depends on who they are: providers get their own workspaces, and the Doqto team gets the admin area. Next.js 16, React 19, Tailwind 4, TanStack Query. Talks to the one Nest API; shares the contract (`@doqto/shared`), the design system (`@doqto/ui`), the translation core (`@doqto/i18n`) and the API client (`@doqto/api-client`) with the other apps.

Plan: `docs/plans/console-and-partner-platform-plan.md` (sections 4.5 to 4.8). **Status: sign-in works, screens are skeletons.** Register, sign-in and forgot-password are real (see below). The workspace screens are still placeholders that name the phase that builds them.

```
pnpm --filter @doqto/console dev        # http://localhost:3010
pnpm --filter @doqto/console typecheck
pnpm --filter @doqto/console test
```

## Routes

| Path | What |
| --- | --- |
| `/` | Public landing page for providers (who it is for, what they get, how it works). The patient site's "Doctor console" links come here |
| `/register` | Name, phone or email and a password, then confirm it once with a code. No service is chosen here |
| `/login` | Phone or email and password. No code at each sign-in |
| `/forgot-password` | Code to the phone or email, then a new password. Signs the account out everywhere |
| `/services` | The panel after sign-in: cards for approved services (open their dashboards), their applications with status (waiting for approval, changes requested), and one "+" card to apply for a service. With exactly one approved service you land on its dashboard instead and reach the panel from "All services" |
| `/apply` | The one application form: tick the services you run (clinic or doctor, lab, pharmacy) and a section appears for each. Same page from Settings > "Add more services" and to fix an application sent back for changes |
| `/clinic/*` | Doctor and clinic workspace |
| `/lab/*` | Lab workspace (phase 3A) |
| `/pharmacy/*` | Pharmacy workspace (phase 3B) |

Each workspace type has its own sidebar, so a pharmacy never sees clinic screens. The navigation lives in `src/lib/app-config.ts`.

## Sign-in

Talks to `/api/v1/console/auth/*` on the one API (contract `console-auth.ts`). Tokens are httpOnly cookies (`doqto_ct`, `doqto_crt`), different from the patient cookies. The workspace frame (`components/shell/app-chrome.tsx`) asks `GET /console/auth/me`: nobody signed in goes to `/login`, and an account that does not have that service goes back to the panel. Only an approved service opens a dashboard; anything else goes back to the panel. The API decides access on every request.

In demo mode no email or SMS is sent and the code is `123456` (shown on screen). A real email provider is not chosen yet; phone codes need the SMS provider (MSG91, INT-20).

## Queue (the visit day)

`/clinic/queue` is for today. **With the doctor now** shows who is in consult and one button, **Call next patient** (or **Finish and call next**), which finishes the current patient and calls the next in line. **Waiting to be called** lists checked-in patients in the order they will be called (booked on time: by slot; late or walk-in: by arrival), with **Move to front** and **Did not come**. **Booked, not arrived** lists today's confirmed bookings, each with **Check in**: online bookings need the 4-digit visit code the patient got; walk-in and phone bookings need a 6-digit code that the screen sends to the patient. The side panel sets the doctor's live status that patients see (in the clinic, running late with minutes, on a break, done, on leave, with a short message) and adds a walk-in or phone booking. The page refreshes every 10 seconds.

## Doctor appointments

`/clinic/appointments` shows the approved clinic or doctor's bookings: first the paid bookings waiting to be accepted (any date, with a **Confirm** button: confirming creates the patient's 4-digit visit code and sends it to them), A booking the patient moved to another time comes back into the waiting list marked "Time changed by the patient": it is not confirmed for the new time until the doctor confirms again. Then **Upcoming bookings** (accepted bookings from today on, any date, which is where a booking goes after you confirm it), then one day's list with a date picker. The clinic dashboard shows a reminder when bookings wait. The visit day is run from `/clinic/queue` (see below).

## Doctor schedule

An approved clinic or doctor sets their weekly hours at `/clinic/schedule`: tick the days, set one to three sessions a day, the slot length (5 to 60 minutes) and how far ahead patients can book. "Use a typical week" fills Monday to Saturday, 10:00 to 13:00 and 17:00 to 20:00, to edit. Until hours are saved, patients see no available days for the doctor, and the clinic dashboard shows a reminder. Leave days and the walk-in share are kept as saved (screens for those come later).

## The admin area (Doqto team)

One login page for everyone. An account with the `admin` role lands on `/admin` after signing in; a provider who opens `/admin` is sent back to their own services. The API checks the role on every request, so hiding a link is only a convenience.

| Path | What |
| --- | --- |
| `/admin` | Dashboard: registration requests waiting, and a card per provider type |
| `/admin/requests` | Applications with tabs by status (waiting for review, changes requested, approved, rejected, all) and counts |
| `/admin/requests/:id` | One application: submitted details, the applicant, the business's other services, and Approve / Request changes / Reject (the last two need a reason shown to the applicant) |
| `/admin/{doctors,clinics,labs,pharmacies}` and `/:id` | Lists and provider pages (placeholders) |
| `/admin/{bookings,reviews,payments,notifications,audit,settings}` | Placeholders |

The admin screens live in `src/components/admin`, their navigation in `src/lib/admin-config.ts`, and their texts in `src/i18n/admin` (a second catalog behind the same language switch).

**Team accounts.** There is no sign-up for the team. Set the login in the root `.env`:

```
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=a-long-password-with-1-number
ADMIN_NAME=Your Name
```

The API creates or updates that account every time it starts, so to change the login edit those lines and restart the API. Leave them empty to use the command instead:

```
ADMIN_PASSWORD='a-long-password-with-1-number' pnpm --filter @doqto/api admin:create <email> "<Full Name>"
```

Approving a **clinic or doctor** application also puts the doctor on the patient site (it appears in search and gets a profile page at `/d/<slug>`); sending back or rejecting an approved one takes them off again. An application missing the details the patient listing needs (registration year, state, PIN code) cannot be approved: use Request changes. A service that is approved opens for its provider on their next sign-in; one sent back for changes shows the reason on their panel. An authenticator-code step for the team is not built yet.

## Folder structure

```
src/
  app/
    layout.tsx               fonts, i18n, React Query, toasts (no PWA, never indexed)
    page.tsx                 landing
    (auth)/login, register   centred card pages
    (app)/home               post sign-in landing
    (app)/{clinic,lab,pharmacy}/   layout (sidebar for that type) + one folder per screen
  components/
    landing/                 console-landing (server component)
    auth/                    auth-frame, login-card, register-card
    shell/                   app-chrome (sidebar wiring), language-switch
    home/                    workspace-preview
    planned-screen.tsx       placeholder for screens not built yet
  i18n/                      this app's message catalogs (en, hi) on top of @doqto/i18n
  lib/
    app-config.ts            workspace types, navigation, roadmap phase per screen
    api.ts                   the API client, with this app's own session settings
    env.ts                   NEXT_PUBLIC_* values
```

## Adding a screen

1. Add it to its workspace in `src/lib/app-config.ts` (key, path, icon, phase) and add `nav.*` and `areas.*` texts in both `en.ts` and `hi.ts`. The tests fail if a screen has no label or no Hindi text.
2. Add `src/app/(app)/<type>/<name>/page.tsx`. Start from `PlannedScreen` and replace it with the real screen.
3. Put feature code in `src/features/<name>/` once a screen has more than one component.

## Rules

- The server decides what a person may do; hiding a button is only a convenience (plan section 4.3).
- Use `@doqto/ui` for anything visual. If a component is useful to another app, add it there, not here.
- No patient data in page titles, URLs or analytics events.
