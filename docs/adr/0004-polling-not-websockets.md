# 0004. Polling and WhatsApp for live status, no websockets

- Status: Accepted, 2026-10-09 (TDD section 6.5)

## Context

Patients want to know if the doctor is in and how long the wait is. Doctor status changes a few times a day; the queue moves every 5 to 15 minutes. Users are on flaky 3G and PWAs that Android kills in the background.

## Decision

- Patient pages poll `GET /doctors/:id/status` every 30 seconds with TanStack Query, paused when the tab is hidden and refetched on focus. The clinic console polls every 15 seconds.
- The status endpoint returns `Cache-Control: public, s-maxage=15` and carries no personal data; Cloudflare caches it, so many viewers cause about one origin request per 15 seconds.
- Patients not looking at the screen get WhatsApp (and Web Push where installed) through the notifications outbox.

## Consequences

- Up to about 30 seconds of lag on screen, which is invisible at this pace of change.
- No connection state to manage on the server or the phone; nothing extra to host.
- The status response must stay small and free of personal data because it is public and cached.

## When to revisit

A clinic wants a waiting-room TV display, or concurrent viewers pass a few thousand. Then add Server-Sent Events on the same endpoint, not websockets.
