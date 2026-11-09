import type { MetadataRoute } from 'next';

/** The colour of the app's surface, so the status bar and splash screen blend into the app. */
const SURFACE = '#f0f4f0';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Doqto: find a doctor, see live status, book',
    short_name: 'Doqto',
    description:
      'Find verified doctors near you, see if the doctor is running late, and book a slot.',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: SURFACE,
    theme_color: SURFACE,
    lang: 'en',
    dir: 'ltr',
    categories: ['health', 'medical', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Find a doctor',
        url: '/search',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'My appointments',
        url: '/appointments',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Book a visit',
        url: '/appointments/new',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
  };
}
