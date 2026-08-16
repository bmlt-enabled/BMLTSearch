<script lang="ts">
  import { ExternalLink } from '@lucide/svelte';
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { t } from '$lib/i18n/index.svelte';
  import { openExternal } from '$lib/native';

  const VIRTUAL_NA = 'https://virtual-na.org/';

  const tabs = [
    { href: resolve('/virtual'), labelKey: 'LIST' },
    { href: resolve('/virtual/search'), labelKey: 'SEARCH' }
  ];

  function isActive(href: string): boolean {
    return (page.url.pathname.replace(/\/+$/, '') || '/') === (href.replace(/\/+$/, '') || '/');
  }
</script>

<div class="border-border bg-surface-raised flex items-center gap-2 border-b px-3 py-2">
  <div class="bg-surface-sunken flex flex-1 rounded-lg p-1">
    {#each tabs as tab (tab.href)}
      {@const active = isActive(tab.href)}
      <a
        href={tab.href}
        aria-current={active ? 'page' : undefined}
        class="focusable flex-1 rounded-md px-3 py-1.5 text-center text-sm font-semibold transition-colors {active ? 'bg-bmlt text-white' : 'text-text-muted'}"
      >
        {t(tab.labelKey)}
      </a>
    {/each}
  </div>

  <button type="button" class="focusable text-bmlt hover:bg-surface-sunken flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold" onclick={() => openExternal(VIRTUAL_NA)}>
    <ExternalLink size={16} aria-hidden="true" />
    {t('VISIT')}
  </button>
</div>
