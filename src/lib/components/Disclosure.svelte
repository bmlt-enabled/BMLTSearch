<script lang="ts">
  import { slide } from 'svelte/transition';
  import { ChevronDown } from '@lucide/svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    open?: boolean;
    /** Rendered inside the button. Keep it to text and badges. */
    summary: Snippet;
    children: Snippet;
    /** Tints the header — used to mark today's meetings. */
    highlight?: boolean;
    /** For callers that keep open-state in a collection rather than one variable. */
    onopenchange?: (open: boolean) => void;
    class?: string;
  }

  let { open = $bindable(false), summary, children, highlight = false, onopenchange, class: className = '' }: Props = $props();

  function toggle() {
    open = !open;
    onopenchange?.(open);
  }

  const panelId = $props.id();
</script>

<!--
  The one expand/collapse primitive in the app, standing in for
  `ion-accordion`. A real <button> with aria-expanded and aria-controls, so it
  is reachable by keyboard and announced correctly — the Ionic version rendered
  its header as an <ion-item>, which screen readers read as static text.
-->
<div class="border-border overflow-hidden rounded-lg border {className}">
  <button
    type="button"
    class="focusable flex w-full items-center gap-3 px-4 py-3 text-left transition-colors {highlight ? 'bg-bmlt-tint text-white' : 'bg-bmlt hover:bg-bmlt-shade text-white'}"
    aria-expanded={open}
    aria-controls={panelId}
    onclick={toggle}
  >
    <span class="min-w-0 flex-1 font-semibold">{@render summary()}</span>
    <ChevronDown size={20} class="shrink-0 transition-transform duration-200 {open ? 'rotate-180' : ''}" aria-hidden="true" />
  </button>

  {#if open}
    <div id={panelId} class="bg-surface" transition:slide={{ duration: 180 }}>
      {@render children()}
    </div>
  {/if}
</div>
