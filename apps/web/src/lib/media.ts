/**
 * Demo storage hands out photo links that start with the API's public address. That address is
 * whatever `API_PUBLIC_URL` said when the photo was saved, and on a laptop it goes stale (the LAN
 * address changes, the tunnel is renamed). The app already reaches the API on its own origin, so
 * such a link is loaded from there instead. Links of a real storage bucket are left as they are.
 */
export function mediaSrc(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const m = /^https?:\/\/[^/]+(\/api\/v1\/demo-storage\/.*)$/.exec(url);
  return m ? m[1] : url;
}
