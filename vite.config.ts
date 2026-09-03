/// <reference types="vitest/config" />

import { execSync } from 'node:child_process';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// Kit options (adapter, paths, runes) live in svelte.config.js — see the note
// there for why they can't be inline here.

/**
 * The commit this bundle was built from.
 *
 * CI is the case that matters: `GITHUB_SHA` is the only reliable answer there,
 * because the checkout is detached and the worktree is thrown away afterwards.
 * Locally it falls back to git, and to a placeholder when there is no git at
 * all — a tarball, or a container without the binary. A build must never fail
 * for want of a label.
 *
 * This exists because working out which commit produced TestFlight build 6
 * meant correlating an upload timestamp against workflow run times. That works
 * until two builds go out twenty minutes apart, which has already happened.
 */
function git(command: string): string | undefined {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return undefined;
  }
}

/**
 * The version this build calls itself.
 *
 * The git tag, not `package.json`. The tag is what actually ships: CI sets
 * `MARKETING_VERSION` from `GITHUB_REF_NAME` on a tagged run, and nothing reads
 * the package version on the way to a store. They have already drifted apart —
 * package.json says 0.1.0 while v1.0.0 is in TestFlight — so taking the tag is
 * the difference between a number that matches the store listing and one that
 * quietly does not.
 *
 * Falls back to the package version, then to `dev`, for a checkout with no tags
 * at all. Paired with the commit below, an approximate version is still useful:
 * the sha is the exact answer, the version is the readable one.
 */
function appVersion(): string {
  const tag = process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : git('git describe --tags --abbrev=0');
  return (tag ?? process.env.npm_package_version ?? 'dev').replace(/^v/, '');
}

function gitCommit(): string {
  const fromCi = process.env.GITHUB_SHA;
  if (fromCi) return fromCi.slice(0, 7);
  return git('git rev-parse --short=7 HEAD') ?? 'unknown';
}

export default defineConfig({
  define: {
    __GIT_SHA__: JSON.stringify(gitCommit()),
    __APP_VERSION__: JSON.stringify(appVersion())
  },
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
  build: {
    rolldownOptions: {
      // Rolldown prints a [PLUGIN_TIMINGS] advisory whenever most of the build
      // is spent inside plugin hooks. That's simply what a SvelteKit build is —
      // Svelte compilation, Tailwind, and Workbox are all plugin work — so the
      // notice reports nothing actionable and only obscures real build output.
      checks: { pluginTimings: false }
    }
  },
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
