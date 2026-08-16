// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
/// <reference types="vite-plugin-pwa/client" />

declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }

  // The Maps JS SDK is injected at runtime by src/lib/maps/loader.ts rather than
  // from a script tag in app.html, so the key can come from an env var. It is
  // only ever touched behind `await loadGoogleMaps()`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const google: any;

  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google?: any;
  }
}

export {};
