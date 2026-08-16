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

// The Maps keys are read from import.meta.env, not $env/static/public, so their
// types are declared here. All three are optional on purpose: a checkout with no
// keys must still build. See src/lib/maps/keys.ts.
interface ImportMetaEnv {
  readonly PUBLIC_GOOGLE_MAPS_KEY_WEB?: string;
  readonly PUBLIC_GOOGLE_MAPS_KEY_IOS?: string;
  readonly PUBLIC_GOOGLE_MAPS_KEY_ANDROID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
