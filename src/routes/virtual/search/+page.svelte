<script lang="ts">
  import { onMount } from 'svelte';
  import { allVirtualMeetings } from '$lib/api/bmlt';
  import AppBar from '$lib/components/AppBar.svelte';
  import ErrorState from '$lib/components/ErrorState.svelte';
  import MeetingList from '$lib/components/MeetingList.svelte';
  import VirtualTabs from '$lib/components/VirtualTabs.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import { loading } from '$lib/stores/loading.svelte';
  import { drawer } from '$lib/stores/ui.svelte';
  import type { RawMeeting } from '$lib/types';

  let meetings = $state<RawMeeting[]>([]);
  let error = $state('');
  let loaded = $state(false);

  onMount(() => void load());

  async function load() {
    error = '';
    try {
      meetings = await loading.during(t('FINDING_MTGS'), allVirtualMeetings);
      loaded = true;
    } catch {
      error = t('LOAD_ERROR');
      loaded = false;
    }
  }
</script>

<svelte:head><title>{t('VIRTUAL_MEETINGS')}</title></svelte:head>

<AppBar title={t('VIRTUAL_MEETINGS')} onmenu={() => drawer.toggle()} />
<VirtualTabs />

{#if error}
  <ErrorState message={error} onretry={load} />
{:else if loaded}
  <MeetingList {meetings} source="virtual" />
{/if}
