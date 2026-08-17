<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';
  import NavDrawer from '$lib/components/NavDrawer.svelte';
  import { i18n } from '$lib/i18n/index.svelte';
  import { initNativeShell, isNative } from '$lib/native';
  import { registerPWA } from '$lib/pwa';
  import { settings } from '$lib/stores/settings.svelte';
  import { drawer } from '$lib/stores/ui.svelte';

  let { children } = $props();

  onMount(() => {
    // Both read localStorage synchronously, so the first paint already has the
    // reader's language and search range rather than defaults that flip a moment
    // later.
    i18n.init();
    settings.init();

    // Web keeps native text selection; the native shells suppress it (app.css).
    if (!isNative()) document.body.classList.add('is-web');

    void initNativeShell();
    void registerPWA();

    return listenForDeepLinks();
  });

  /**
   * Route an incoming `bmltsearch://` or universal link to the matching screen.
   *
   * Native only — in the browser the URL is already the address bar and
   * SvelteKit has routed it before this runs.
   */
  function listenForDeepLinks(): () => void {
    if (!isNative()) return () => {};

    let dispose = () => {};
    void import('@capacitor/app').then(async ({ App }) => {
      const handle = await App.addListener('appUrlOpen', (event) => {
        const path = pathFromUrl(event.url);
        // The target comes from a URL someone else typed or shared, so it
        // cannot go through resolve() — that takes a known route id, and the
        // whole point here is handling a path we have not seen before. An
        // unrecognised path lands on SvelteKit's 404, which is correct.
        // eslint-disable-next-line svelte/no-navigation-without-resolve -- runtime path from an incoming deep link
        if (path) void goto(path);
      });
      dispose = () => void handle.remove();
    });

    return () => dispose();
  }

  function pathFromUrl(url: string): string | null {
    try {
      const { pathname } = new URL(url);
      return pathname && pathname !== '/' ? pathname : null;
    } catch {
      return null;
    }
  }
</script>

<div class="app-shell bg-surface flex min-h-dvh flex-col">
  <main class="app-main flex-1">
    {@render children()}
  </main>

  <BottomNav />
</div>

<NavDrawer open={drawer.open} onclose={() => drawer.close()} />
<LoadingOverlay />
