/// <reference types="vitest/config" />

import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// Kit options (adapter, paths, runes) live in svelte.config.js — see the note
// there for why they can't be inline here.

export default defineConfig({
  // Vite only exposes VITE_-prefixed variables on `import.meta.env`; adding
  // PUBLIC_ lets the Maps keys be read that way instead of through
  // `$env/static/public`.
  //
  // The difference matters: `$env/static/public` is a hard build error when a
  // variable *name* is absent, not merely unset. That made `git clone && npm
  // run build` fail on a fresh checkout with an opaque MISSING_EXPORT, and it
  // failed the first Cloudflare Pages deploy before the project's environment
  // variables existed. `import.meta.env` yields undefined for an unset name, so
  // an unconfigured build succeeds and only the map screen reports itself
  // unavailable — which is the degradation the README always described.
  envPrefix: ['VITE_', 'PUBLIC_'],
  plugins: [
    tailwindcss(),
    sveltekit(),
    // SvelteKitPWA rather than plain VitePWA: the static adapter writes the
    // prerendered HTML after Vite's build finishes, so a plain Workbox glob runs
    // too early and precaches zero HTML — leaving the app broken offline. This
    // integration hooks the adapter's output instead.
    SvelteKitPWA({
      registerType: 'autoUpdate',
      // Registration happens in src/lib/pwa.ts so it can be skipped inside the
      // Capacitor shell, where a service worker only adds a stale-cache risk.
      injectRegister: null,
      manifestFilename: 'manifest.json',
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'BMLT Search',
        short_name: 'BMLT Search',
        description: 'Find Narcotics Anonymous meetings worldwide, in person and online.',
        theme_color: '#0a61ad',
        background_color: '#0a61ad',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['health', 'lifestyle', 'utilities'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Any navigation that misses the precache falls back to the app shell,
        // which is what makes a client-routed SPA work offline.
        navigateFallback: '/',
        runtimeCaching: [
          {
            // Meeting data must never come from a cache: a stale meeting sends
            // someone to a room that isn't open. Both BMLT roots and the Google
            // APIs are network-only.
            urlPattern: ({ url }: { url: URL }) => url.hostname === 'aggregator.bmltenabled.org' || url.hostname === 'bmlt.virtual-na.org' || url.hostname.endsWith('googleapis.com'),
            handler: 'NetworkOnly'
          }
        ]
      },
      devOptions: { enabled: false }
    }),
    svelteTesting()
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/unit/setup.ts',
    include: ['src/tests/unit/**/*.{test,spec}.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**/*.{ts,svelte}'],
      exclude: ['src/tests/**'],
      thresholds: { lines: 70, functions: 70, statements: 70 }
    }
  }
});
