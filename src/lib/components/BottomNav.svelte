<script lang="ts">
  import { page } from '$app/state';
  import { t } from '$lib/i18n/index.svelte';
  import { BOTTOM_NAV } from '$lib/nav';

  function isActive(href: string): boolean {
    const path = page.url.pathname.replace(/\/+$/, '') || '/';
    const target = href.replace(/\/+$/, '') || '/';
    // Prefix match so /virtual/search keeps the Virtual tab lit.
    return path === target || path.startsWith(`${target}/`);
  }
</script>

<nav class="border-border bg-surface-raised/95 safe-bottom fixed right-0 bottom-0 left-0 z-30 border-t backdrop-blur" aria-label={t('MENU')}>
  <div class="mx-auto flex max-w-lg">
    {#each BOTTOM_NAV as item (item.href)}
      {@const Icon = item.icon}
      {@const active = isActive(item.href)}
      <!-- eslint-disable svelte/no-navigation-without-resolve -- every href in BOTTOM_NAV is already built with resolve() in $lib/nav.ts; the rule only recognises a literal resolve() at the call site. -->
      <a
        href={item.href}
        aria-current={active ? 'page' : undefined}
        class="focusable flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors {active ? 'text-bmlt' : 'text-text-muted'}"
      >
        <!-- eslint-enable svelte/no-navigation-without-resolve -->
        <Icon size={21} strokeWidth={active ? 2.4 : 1.8} aria-hidden="true" />
        <!--
          `min-w-0` on the anchor is what lets a flex item shrink below its
          content width; without it the label cannot wrap or ellipsise and
          simply spills over its neighbours. Two lines rather than one because
          several of these names are long in English and longer in translation —
          "Current Location Search", "Encontrar reuniones cercanas" — and the
          full drawer carries the untruncated name for anything still clipped.
        -->
        <span class="line-clamp-2 w-full px-1 text-center text-[10px] leading-tight font-semibold">{t(item.labelKey)}</span>
      </a>
    {/each}
  </div>
</nav>
