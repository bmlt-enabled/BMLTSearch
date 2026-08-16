<script lang="ts">
  import { X } from '@lucide/svelte';
  import { fade, fly } from 'svelte/transition';
  import type { Snippet } from 'svelte';
  import { t } from '$lib/i18n/index.svelte';

  interface Props {
    open: boolean;
    title: string;
    onclose: () => void;
    children: Snippet;
  }

  let { open, title, onclose, children }: Props = $props();

  let panel = $state<HTMLElement | null>(null);

  // Focus moves into the sheet when it opens, so a keyboard or screen-reader
  // user is not left behind on the map underneath it.
  $effect(() => {
    if (open) panel?.focus();
  });

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') onclose();
  }
</script>

<svelte:window on:keydown={open ? onkeydown : undefined} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-50 bg-black/50" transition:fade={{ duration: 140 }} onclick={onclose}></div>

  <div
    bind:this={panel}
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    aria-label={title}
    class="bg-surface safe-bottom fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl shadow-2xl outline-none"
    transition:fly={{ y: 400, duration: 220 }}
  >
    <header class="border-border bg-surface-raised flex items-center gap-2 rounded-t-2xl border-b px-4 py-3">
      <h2 class="min-w-0 flex-1 truncate text-base font-semibold">{title}</h2>
      <button type="button" class="focusable text-text-muted hover:bg-surface-sunken rounded-lg p-2" onclick={onclose} aria-label={t('CLOSE')}>
        <X size={20} aria-hidden="true" />
      </button>
    </header>

    <div class="flex-1 overflow-y-auto overscroll-contain">
      {@render children()}
    </div>
  </div>
{/if}
