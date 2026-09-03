// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
/// <reference types="vite-plugin-pwa/client" />
// The `google.maps.*` namespace comes from @types/google.maps. It is referenced
// explicitly because SvelteKit's generated tsconfig pins `types`, so the usual
// automatic pickup from node_modules/@types does not apply.
//
// This replaces a hand-written `const google: any` shim, which typed the whole
// SDK as `any` and so hid the very errors that made the loader's readiness bug
// invisible for as long as it was.
/// <reference types="google.maps" />

declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }

  /** Short commit this bundle was built from; see `gitCommit` in vite.config.ts. */
  const __GIT_SHA__: string;

  /** Release version, from the git tag; see `appVersion` in vite.config.ts. */
  const __APP_VERSION__: string;

  /**
   * The Maps keys, read from `import.meta.env` rather than `$env/static/public`
   * — see src/lib/maps/keys.ts for why.
   *
   * This must live inside `declare global`: the trailing `export {}` makes this
   * file a module, and a top-level interface in a module is module-local rather
   * than an augmentation of Vite's global `ImportMetaEnv`. Declared outside, it
   * silently typed nothing and the keys fell back to the `any` from Vite's index
   * signature.
   *
   * All three are optional on purpose — a checkout with no keys must still build.
   */
  interface ImportMetaEnv {
    readonly PUBLIC_GOOGLE_MAPS_KEY_WEB?: string;
    readonly PUBLIC_GOOGLE_MAPS_KEY_IOS?: string;
    readonly PUBLIC_GOOGLE_MAPS_KEY_ANDROID?: string;
    readonly PUBLIC_GOOGLE_MAPS_ANDROID_CERT_SHA1?: string;
  }
}

export {};
