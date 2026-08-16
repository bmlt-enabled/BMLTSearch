<script lang="ts">
  import { ArrowLeft, Menu } from '@lucide/svelte';
  import type { Snippet } from 'svelte';
  import { t } from '$lib/i18n/index.svelte';

  interface Props {
    title: string;
    onmenu: () => void;
    /** When set, the hamburger is replaced by a back affordance. */
    onback?: () => void;
    /** Trailing controls — a search field, an action button. */
    actions?: Snippet;
    /** Secondary row beneath the title, e.g. the map's search box. */
    below?: Snippet;
  }

  let { title, onmenu, onback, actions, below }: Props = $props();
</script>

<!--
  Sticky rather than fixed, so the page below scrolls under it without needing a
  matching top padding that would have to be kept in sync. `safe-top` carries
  the notch inset; nothing else in here may add top padding, or the inset is
  silently overridden — see the note in app.css.
-->
<header class="bg-bmlt safe-top sticky top-0 z-30 text-white shadow-md">
  <div class="flex h-14 items-center gap-1 px-1">
    {#if onback}
      <button type="button" class="focusable rounded-lg p-3 transition-colors hover:bg-white/15" onclick={onback} aria-label={t('BACK')}>
        <ArrowLeft size={22} aria-hidden="true" />
      </button>
    {:else}
      <button type="button" class="focusable rounded-lg p-3 transition-colors hover:bg-white/15" onclick={onmenu} aria-label={t('MENU')}>
        <Menu size={22} aria-hidden="true" />
      </button>
    {/if}

    <h1 class="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>

    {#if actions}
      <div class="flex items-center gap-1 pr-1">{@render actions()}</div>
    {/if}
  </div>

  {#if below}
    <div class="px-3 pb-3">{@render below()}</div>
  {/if}
</header>
