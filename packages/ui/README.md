# @doqto/ui

The Doqto design system, used by `apps/web` and `apps/console`. Source only: the apps compile it (`transpilePackages`).

## Use it

In each app's `globals.css`:

```css
@import 'tailwindcss';
@import '@doqto/ui/theme.css';
@source '../../../../packages/ui/src'; /* path relative to that CSS file, so Tailwind sees the classes used here */
```

Import a component by its file name: `import { Button } from '@doqto/ui/button'`, `import { cn } from '@doqto/ui/cn'`.

## What is in it

| Group | Components |
| --- | --- |
| Tokens | `theme.css`: brand and status colours, type scale, radii, shadows, base styles, the `neu-*` utilities |
| Primitives | `button`, `input` (with `Field`), `checkbox`, `switch`, `chip`, `badge`, `avatar`, `card`, `skeleton`, `sheet`, `confirm-sheet`, `empty-state`, `toast`, `logo` |
| Console and admin | `app-shell` (sidebar, drawer, top bar), `page-header`, `panel` (flat bordered surface), `stat-card`, `status-chip`, `planned-panel` |

## Rules

- A component lives here when two apps need it. Patient-only pieces (phone and OTP inputs, PWA, booking) stay in `apps/web`.
- No imports from an app (`@/...`) and no app text: labels come in through props.
- Dense work screens use `Panel`; the soft raised `Card` is for sign-in screens and highlights.
- Still to come (plan section 2.1): data table, filter bar, timeline, chart wrapper, permission-aware button.

```
pnpm --filter @doqto/ui typecheck
pnpm --filter @doqto/ui test
```
