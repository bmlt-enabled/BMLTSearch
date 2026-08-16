<script lang="ts">
  import { TriangleAlert } from '@lucide/svelte';
  import { t } from '$lib/i18n/index.svelte';

  interface Props {
    message?: string;
    onretry?: () => void;
  }

  let { message, onretry }: Props = $props();
</script>

<!--
  A failed search has to say so. The Ionic build dismissed its spinner and left
  an empty screen, which reads identically to "there are no meetings near you" —
  the one message it must never accidentally give someone looking for one.
-->
<div class="flex flex-col items-center gap-3 px-6 py-12 text-center">
  <span class="text-danger"><TriangleAlert size={32} aria-hidden="true" /></span>
  <p class="text-text text-sm font-medium">{message || t('LOAD_ERROR')}</p>
  {#if onretry}
    <button type="button" class="focusable bg-bmlt hover:bg-bmlt-shade rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-colors" onclick={onretry}>
      {t('RETRY')}
    </button>
  {/if}
</div>
