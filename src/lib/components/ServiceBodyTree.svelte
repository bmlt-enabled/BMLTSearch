<script lang="ts">
  import { ChevronRight } from '@lucide/svelte';
  import type { ServiceBodyNode } from '$lib/types';
  import Disclosure from './Disclosure.svelte';
  // Self-import: this component renders itself for each level of the tree.
  import ServiceBodyTree from './ServiceBodyTree.svelte';

  interface Props {
    nodes: ServiceBodyNode[];
    onselect: (node: ServiceBodyNode) => void;
    /** Indentation depth; set by the recursion, not by callers. */
    depth?: number;
  }

  let { nodes, onselect, depth = 0 }: Props = $props();
</script>

<!--
  Recursive, so it handles a service body tree of any depth. The Ionic build
  hand-unrolled four levels of nested accordions in the Virtual NA template and
  simply stopped: a fifth-level body rendered as an empty expandable with no way
  to reach the meetings inside it. Depth here is whatever the data says.
-->
<ul class="space-y-1.5" class:pl-3={depth > 0}>
  {#each nodes as node (node.id)}
    <li>
      {#if node.children.length > 0}
        <Disclosure>
          {#snippet summary()}
            {node.name}
          {/snippet}
          <div class="p-2">
            <!--
              A service body with children can also hold meetings of its own, so
              it gets its own selectable row above the descendants. Without it
              those meetings are unreachable — the Ionic build only ever made
              leaves tappable.
            -->
            <button
              type="button"
              class="focusable text-bmlt hover:bg-surface-sunken mb-1.5 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold"
              onclick={() => onselect(node)}
            >
              <ChevronRight size={16} aria-hidden="true" />
              {node.name}
            </button>
            <ServiceBodyTree nodes={node.children} {onselect} depth={depth + 1} />
          </div>
        </Disclosure>
      {:else}
        <button
          type="button"
          class="focusable border-border bg-surface-raised text-text hover:bg-surface-sunken flex w-full items-center justify-between gap-2 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors"
          onclick={() => onselect(node)}
        >
          <span class="min-w-0">{node.name}</span>
          <ChevronRight size={18} class="text-text-muted shrink-0" aria-hidden="true" />
        </button>
      {/if}
    </li>
  {/each}
</ul>
