<script lang="ts">
  import { onMount } from 'svelte';
  import { meetingsByServiceBody, aggregatorServiceBodies } from '$lib/api/bmlt';
  import AppBar from '$lib/components/AppBar.svelte';
  import ErrorState from '$lib/components/ErrorState.svelte';
  import MeetingList from '$lib/components/MeetingList.svelte';
  import ServiceBodyTree from '$lib/components/ServiceBodyTree.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import { buildServiceBodyTree } from '$lib/serviceBodies';
  import { loading } from '$lib/stores/loading.svelte';
  import { drawer } from '$lib/stores/ui.svelte';
  import type { RawMeeting, ServiceBodyNode } from '$lib/types';

  let tree = $state<ServiceBodyNode[]>([]);
  let selected = $state<ServiceBodyNode | null>(null);
  let meetings = $state<RawMeeting[]>([]);
  let error = $state('');

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
  <div class="p-3">
    <ServiceBodyTree nodes={tree} onselect={open} />
  </div>
{/if}
