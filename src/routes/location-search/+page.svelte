<script lang="ts">
  import { LocateFixed } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import { nearestMeetings } from '$lib/api/bmlt';
  import VenueFilter from '$lib/components/VenueFilter.svelte';
  import { Monitor } from '@lucide/svelte';
  import { venueTypesParam, type MeetingMode } from '$lib/meetings/venue';
  import { openExternal } from '$lib/native';
  import AppBar from '$lib/components/AppBar.svelte';
  import ErrorState from '$lib/components/ErrorState.svelte';
  import MeetingList from '$lib/components/MeetingList.svelte';
  import RangeSlider from '$lib/components/RangeSlider.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import { LocationError, resolveSearchOrigin } from '$lib/location';
  import { loading } from '$lib/stores/loading.svelte';
  import { MAX_SEARCH_RANGE, MIN_SEARCH_RANGE, settings } from '$lib/stores/settings.svelte';
  import { drawer } from '$lib/stores/ui.svelte';
  import type { RawMeeting } from '$lib/types';

  let meetings = $state<RawMeeting[]>([]);
  let range = $state(settings.searchRange);
  let error = $state('');
  let loaded = $state(false);

  onMount(() => {
    range = settings.searchRange;
    void search(false);
  });

  /**
   * `refreshLocation` forces a new device fix rather than reusing the stored
   * one — what the locate button asks for. A plain range change reuses it, so
   * nudging the slider does not re-prompt for GPS.
   */
  async function search(refreshLocation: boolean) {
    error = '';
    try {
      const origin = await loading.during(t('LOCATING'), () => resolveSearchOrigin(refreshLocation));
      meetings = await loading.during(t('FINDING_MTGS'), () => nearestMeetings(origin.lat, origin.lng, range, venueTypesParam(settings.modes)));
      loaded = true;
    } catch (cause) {
      // A denied or unavailable fix is a different problem from a root server
      // that will not answer, and saying which one is what tells the reader
      // whether to check their settings or their signal.
      error = cause instanceof LocationError ? t('NO_LOCATION') : t('LOAD_ERROR');
      loaded = false;
    }
  }

  function onRangeCommit(value: number) {
    settings.searchRange = value;
    range = settings.searchRange;
    void search(false);
  }

  /** Changing the filter re-runs the search, reusing the stored fix. */
  function onModesChange(modes: MeetingMode[]) {
    settings.modes = modes;
    if (loaded || error) void search(false);
  }

  /**
   * Online-only search that found nothing.
   *
   * This app has no worldwide online-meeting list — the aggregator will not
   * serve one — so an empty online search here is not evidence that none exist,
   * only that none are registered near this point. Saying so, and pointing at
   * NA's own directory, is the difference between a dead end and an answer.
   */
  const onlineOnlyAndEmpty = $derived(loaded && meetings.length === 0 && settings.modes.length === 1 && settings.modes[0] === 'online');
</script>

<svelte:head><title>{t('LOCATIONSEARCH')}</title></svelte:head>

<AppBar title={t('LOCATIONSEARCH')} onmenu={() => drawer.toggle()}>
  {#snippet actions()}
    <button type="button" class="focusable rounded-lg p-2.5 transition-colors hover:bg-white/15" onclick={() => search(true)} aria-label={t('MY_LOCATION')}>
      <LocateFixed size={20} aria-hidden="true" />
    </button>
  {/snippet}
</AppBar>

<div class="border-border bg-surface-raised border-b px-4 py-3">
  <p class="text-text text-sm">
    <span class="font-semibold">{range}</span>
    {t('MEETINGS_NEAREST')}
    {#if settings.location?.address}
      <span class="font-semibold">“{settings.location.address}”</span>
    {/if}
  </p>
  <RangeSlider bind:value={range} min={MIN_SEARCH_RANGE} max={MAX_SEARCH_RANGE} label={t('SEARCHRANGESETTING')} oncommit={onRangeCommit} class="mt-2" />
  <VenueFilter modes={settings.modes} onchange={onModesChange} class="mt-3" />
</div>

{#if error}
  <ErrorState message={error} onretry={() => search(true)} />
{:else if loaded}
  <MeetingList {meetings} />
  {#if onlineOnlyAndEmpty}
    <div class="px-4 pb-6">
      <p class="text-text-muted mb-3 text-center text-sm">{t('NO_ONLINE_NEARBY')}</p>
      <button
        type="button"
        class="focusable border-bmlt text-bmlt hover:bg-bmlt/10 mx-auto flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors"
        onclick={() => openExternal('https://na.org/virtual/')}
      >
        <Monitor size={18} aria-hidden="true" />
        {t('NA_VIRTUAL')}
      </button>
    </div>
  {/if}
{/if}
