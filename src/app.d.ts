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
}

export {};
