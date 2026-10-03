<script lang="ts">
  import { X } from '@lucide/svelte';
  import { t } from '$lib/i18n/index.svelte';
  import { openNamnmListing } from '$lib/native';

  interface Props {
    class?: string;
  }

  let { class: className = '' }: Props = $props();

  // Shown on every visit. Closing it lasts until the reader leaves the screen;
  // nothing is remembered.
  let visible = $state(true);
</script>

<!--
  Not a modal, and never in the way of a search: it sits beside the results and
  closes with one tap, until the next visit.
-->
{#if visible}
  <aside class="border-border bg-surface-raised flex items-center gap-3 rounded-xl border p-3 {className}" aria-label={t('NAMNM_TITLE')}>
    <img src="./namnm-icon.png" alt="" class="size-12 shrink-0 rounded-xl" />
    <div class="min-w-0 flex-1">
      <p class="text-text text-sm font-semibold">{t('NAMNM_TITLE')}</p>
      <p class="text-text-muted text-xs">{t('NAMNM_MESSAGE')}</p>
      <button type="button" class="focusable text-brand-ink mt-1 text-sm font-semibold hover:underline" onclick={() => openNamnmListing()}>
        {t('NAMNM_GET')}
      </button>
    </div>
    <button type="button" class="focusable text-text-muted hover:bg-surface-sunken -me-1 self-start rounded-lg p-2.5 transition-colors" onclick={() => (visible = false)} aria-label={t('CLOSE')}>
      <X size={18} aria-hidden="true" />
    </button>
  </aside>
{/if}
