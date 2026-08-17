<script lang="ts">
  import { onMount } from 'svelte';
  import { ChevronRight, Search, X } from '@lucide/svelte';
  import { meetingsByServiceBody, aggregatorServiceBodies } from '$lib/api/bmlt';
  import AppBar from '$lib/components/AppBar.svelte';
  import ErrorState from '$lib/components/ErrorState.svelte';
  import MeetingList from '$lib/components/MeetingList.svelte';
  import ServiceBodyTree from '$lib/components/ServiceBodyTree.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import { buildServiceBodyTree, SEARCH_LIMIT, searchServiceBodies } from '$lib/serviceBodies';
  import { loading } from '$lib/stores/loading.svelte';
  import { drawer } from '$lib/stores/ui.svelte';
  import type { RawMeeting, ServiceBodyNode } from '$lib/types';

  let tree = $state<ServiceBodyNode[]>([]);
  let selected = $state<ServiceBodyNode | null>(null);
  let meetings = $state<RawMeeting[]>([]);
  let error = $state('');
  let query = $state('');

  /*
    Search replaces the tree rather than pruning it. Browsing answers "what is
    under Ohio"; searching answers "take me to WAGS Area", and rebuilding the
    path to it helps nobody. The match's branch is shown beside it instead,
    because area names repeat across regions.
  */
  const matches = $derived(searchServiceBodies(tree, query));
  const searching = $derived(query.trim().length > 0);

  onMount(() => void loadTree());

  async function loadTree() {
    error = '';
    try {
      const bodies = await loading.during(t('FINDING_MTGS'), aggregatorServiceBodies);
      tree = buildServiceBodyTree(bodies);
    } catch {
      error = t('LOAD_ERROR');
    }
  }

  async function open(node: ServiceBodyNode) {
    error = '';
    selected = node;
    try {
      meetings = await loading.during(t('FINDING_MTGS'), () => meetingsByServiceBody(node.id));
    } catch {
      error = t('LOAD_ERROR');
    }
  }
</script>

<svelte:head><title>{t('LISTFULL')}</title></svelte:head>

<AppBar title={selected ? selected.name : t('LISTFULL')} onmenu={() => drawer.toggle()} onback={selected ? () => (selected = null) : undefined} />

{#if error}
  <ErrorState message={error} onretry={() => (selected ? open(selected) : loadTree())} />
{:else if selected}
  <MeetingList {meetings} />
{:else}
  <div class="border-border bg-surface-raised border-b px-3 py-2.5">
    <div class="relative">
      <span class="text-text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"><Search size={16} aria-hidden="true" /></span>
      <input
        type="search"
        bind:value={query}
        placeholder={t('SEARCH_SERVICE_BODIES')}
        aria-label={t('SEARCH_SERVICE_BODIES')}
        class="focusable border-border bg-surface text-text placeholder:text-text-muted w-full rounded-lg border py-2.5 pr-10 pl-9 text-sm"
      />
      {#if searching}
        <button type="button" class="focusable text-text-muted hover:bg-surface-sunken absolute top-1/2 right-2 -translate-y-1/2 rounded p-1.5" onclick={() => (query = '')} aria-label={t('CANCEL')}>
          <X size={16} aria-hidden="true" />
        </button>
      {/if}
    </div>
  </div>

  <div class="p-3">
    {#if !searching}
      <ServiceBodyTree nodes={tree} onselect={open} />
    {:else if matches.length === 0}
      <p class="text-text-muted py-10 text-center text-sm">{t('NO_BODIES_MATCH')}</p>
    {:else}
      <ul class="space-y-1.5">
        {#each matches as match (match.node.id)}
          <li>
            <button
              type="button"
              class="focusable border-border bg-surface-raised text-text hover:bg-surface-sunken flex w-full items-center justify-between gap-2 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors"
              onclick={() => open(match.node)}
            >
              <span class="min-w-0">
                <span class="block truncate">{match.node.name}</span>
                {#if match.path.length > 0}
                  <span class="text-text-muted block truncate text-xs font-normal">{match.path.join(' › ')}</span>
                {/if}
              </span>
              <ChevronRight size={18} class="text-text-muted shrink-0" aria-hidden="true" />
            </button>
          </li>
        {/each}
      </ul>
      {#if matches.length >= SEARCH_LIMIT}
        <!-- Say when the list was cut. A silently truncated result set reads as
             "that is all there is", which is the wrong answer. -->
        <p class="text-text-muted pt-3 text-center text-xs">{t('MORE_MATCHES').replace('{n}', String(SEARCH_LIMIT))}</p>
      {/if}
    {/if}
  </div>
{/if}
