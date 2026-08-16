<script lang="ts">
  import { onMount } from 'svelte';
  import { virtualMeetingsByServiceBody, virtualServiceBodies } from '$lib/api/bmlt';
  import AppBar from '$lib/components/AppBar.svelte';
  import ErrorState from '$lib/components/ErrorState.svelte';
  import MeetingList from '$lib/components/MeetingList.svelte';
  import ServiceBodyTree from '$lib/components/ServiceBodyTree.svelte';
  import VirtualTabs from '$lib/components/VirtualTabs.svelte';
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
      const bodies = await loading.during(t('FINDING_MTGS'), virtualServiceBodies);
      tree = buildServiceBodyTree(bodies);
    } catch {
      error = t('LOAD_ERROR');
    }
  }

  async function open(node: ServiceBodyNode) {
    error = '';
    selected = node;
    try {
      meetings = await loading.during(t('FINDING_MTGS'), () => virtualMeetingsByServiceBody(node.id));
    } catch {
      error = t('LOAD_ERROR');
    }
  }
</script>

<svelte:head><title>{t('VIRTUAL_MEETINGS')}</title></svelte:head>

<AppBar title={selected ? selected.name : t('VIRTUAL_MEETINGS')} onmenu={() => drawer.toggle()} onback={selected ? () => (selected = null) : undefined} />

{#if !selected}
  <VirtualTabs />
{/if}

{#if error}
  <ErrorState message={error} onretry={() => (selected ? open(selected) : loadTree())} />
{:else if selected}
  <!--
    source="virtual" — these come from the Virtual NA root, whose meetings carry
    format *codes* rather than world format ids. The Ionic build passed
    'regular' here, so every format on this screen silently failed to resolve
    and the formats line came out blank.
  -->
  <MeetingList {meetings} source="virtual" />
{:else}
  <div class="p-3">
    <ServiceBodyTree nodes={tree} onselect={open} />
  </div>
{/if}
