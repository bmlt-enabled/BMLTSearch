<script lang="ts">
  import { fade } from 'svelte/transition';
  import { loading } from '$lib/stores/loading.svelte';
  import Spinner from './Spinner.svelte';
</script>

<!--
  Rendered once, by the root layout. `aria-live="polite"` announces the message
  when it appears; `pointer-events-none` keeps the overlay from eating taps,
  since it is a progress indicator and not a modal — the reader is free to keep
  scrolling results already on screen while more load.
-->
{#if loading.active}
  <div class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center" transition:fade={{ duration: 120 }} aria-live="polite" aria-busy="true">
    <div class="bg-surface-raised/95 border-border flex items-center gap-3 rounded-xl border px-5 py-4 shadow-lg backdrop-blur">
      <span class="text-bmlt"><Spinner size={22} label={loading.message || 'Loading'} /></span>
      {#if loading.message}
        <span class="text-text text-sm font-medium">{loading.message}</span>
      {/if}
    </div>
  </div>
{/if}
