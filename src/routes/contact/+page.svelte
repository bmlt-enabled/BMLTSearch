<script lang="ts">
  import { Bug, Code, Users, Globe } from '@lucide/svelte';
  import AppBar from '$lib/components/AppBar.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import { openExternal } from '$lib/native';
  import { drawer } from '$lib/stores/ui.svelte';

  const links = [
    { titleKey: 'SRC_CODE', label: 'github.com/bmlt-enabled/BMLTSearchSvelte', url: 'https://github.com/bmlt-enabled/BMLTSearchSvelte', icon: Code },
    { titleKey: 'BUG_REPORT', label: 'github.com/bmlt-enabled/BMLTSearchSvelte/issues', url: 'https://github.com/bmlt-enabled/BMLTSearchSvelte/issues', icon: Bug },
    { titleKey: 'JOIN_FB_GROUP', label: 'facebook.com/groups/BMLT', url: 'https://www.facebook.com/groups/149214049107349/', icon: Users },
    { titleKey: 'VISIT_WEBSITE', label: 'bmlt.app', url: 'https://bmlt.app/', icon: Globe }
  ];
</script>

<svelte:head><title>{t('CONTACT')}</title></svelte:head>

<AppBar title={t('CONTACT')} onmenu={() => drawer.toggle()} />

<div class="space-y-3 p-4">
  {#each links as link (link.url)}
    {@const Icon = link.icon}
    <button
      type="button"
      class="focusable border-border bg-surface-raised hover:border-bmlt flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors"
      onclick={() => openExternal(link.url)}
    >
      <span class="text-bmlt shrink-0"><Icon size={22} aria-hidden="true" /></span>
      <span class="min-w-0">
        <span class="text-text block text-sm font-semibold">{t(link.titleKey)}</span>
        <span class="text-text-muted block truncate text-xs">{link.label}</span>
      </span>
    </button>
  {/each}
</div>
