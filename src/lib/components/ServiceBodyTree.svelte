<script lang="ts">
  import { ChevronRight } from '@lucide/svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import { serviceBodyHasOwnMeetings } from '$lib/api/bmlt';
  import type { MeetingSource, ServiceBodyNode } from '$lib/types';
  import Disclosure from './Disclosure.svelte';
  // Self-import: this component renders itself for each level of the tree.
  import ServiceBodyTree from './ServiceBodyTree.svelte';

  interface Props {
    nodes: ServiceBodyNode[];
    onselect: (node: ServiceBodyNode) => void;
    /** Which root server to probe for a parent's own meetings. */
    source: MeetingSource;
    /** Indentation depth; set by the recursion, not by callers. */
    depth?: number;
  }

  let { nodes, onselect, source, depth = 0 }: Props = $props();

  /**
   * Whether a parent body holds meetings of its own, keyed by body id.
   *
   * A body with children can also hold meetings directly, and most do not: a
   * region usually exists only to contain its areas. Its self-row was rendered
   * unconditionally, so tapping "Buckeye Region" opened an empty list, while the
   * identical row under "CANA" — which does hold one meeting directly — worked.
   *
   * The answer is not in the service body records, so it takes a request, and
   * asking for every parent up front would be hundreds of them. It is asked once
   * per body, the first time that body is expanded, which is the moment the row
   * would become visible anyway.
   *
   * Absent means not yet known, and an unknown body renders no row: it is better
   * for the row to appear a moment late than to appear and then vanish.
   */
  const ownMeetings = new SvelteMap<string, boolean>();

  async function probe(node: ServiceBodyNode) {
    if (ownMeetings.has(node.id)) return;
    try {
      ownMeetings.set(node.id, await serviceBodyHasOwnMeetings(node.id, source));
    } catch {
      // A failed probe leaves the row hidden. Showing a link that may open an
      // empty list is the thing being fixed here, so a network blip must not
      // reinstate it — and the meetings stay reachable through map and location
      // search regardless.
      ownMeetings.set(node.id, false);
    }
  }
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
        <Disclosure onopenchange={(open) => open && probe(node)}>
          {#snippet summary()}
            {node.name}
          {/snippet}
          <div class="p-2">
            <!--
              A service body with children can also hold meetings of its own, so
              it gets its own selectable row above the descendants. Without it
              those meetings are unreachable — the Ionic build only ever made
              leaves tappable. Shown only once the probe confirms there is
              something to open; see `ownMeetings`.
            -->
            {#if ownMeetings.get(node.id)}
              <button
                type="button"
                class="focusable text-bmlt hover:bg-surface-sunken mb-1.5 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold"
                onclick={() => onselect(node)}
              >
                <ChevronRight size={16} aria-hidden="true" />
                {node.name}
              </button>
            {/if}
            <ServiceBodyTree nodes={node.children} {onselect} {source} depth={depth + 1} />
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
