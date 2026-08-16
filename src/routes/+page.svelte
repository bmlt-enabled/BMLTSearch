<script lang="ts">
  import AppBar from '$lib/components/AppBar.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import { BOTTOM_NAV } from '$lib/nav';
  import { drawer } from '$lib/stores/ui.svelte';
</script>

<svelte:head><title>{t('HOME_TITLE')}</title></svelte:head>

<AppBar title={t('HOME')} onmenu={() => drawer.toggle()} />

<div class="bg-bmlt px-6 pt-8 pb-10 text-center text-white">
  <h2 class="text-2xl font-bold">{t('HOME_TITLE')}</h2>
  <p class="mt-1 text-sm text-white/85">{t('HOME_MESSAGE')}</p>
  <img src="./logo.png" alt="" class="mx-auto mt-6 w-full max-w-xs" />
</div>

<!--
  The four search modes, spelled out. The Ionic home screen was a logo and a
  heading with every route behind the hamburger, so nothing on the first screen
  told a first-time reader what the app could actually do.
-->
<nav class="grid grid-cols-2 gap-3 p-4" aria-label={t('MENU')}>
  {#each BOTTOM_NAV as item (item.href)}
    {@const Icon = item.icon}
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- every href in BOTTOM_NAV is built with resolve() in $lib/nav.ts; the rule only recognises a literal call site. -->
    <a href={item.href} class="focusable border-border bg-surface-raised hover:border-bmlt flex flex-col items-center gap-2 rounded-xl border p-5 text-center transition-colors">
      <span class="text-bmlt"><Icon size={26} aria-hidden="true" /></span>
      <span class="text-text text-sm font-semibold">{t(item.labelKey)}</span>
    </a>
  {/each}
</nav>
