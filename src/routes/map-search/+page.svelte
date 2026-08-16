<script lang="ts">
  import type { GoogleMap as GoogleMapType } from '@capacitor/google-maps';
  import { Search, X } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import { PUBLIC_GOOGLE_MAPS_KEY } from '$env/static/public';
  import { meetingsByIds, meetingsWithinRadius } from '$lib/api/bmlt';
  import { forwardGeocode } from '$lib/api/geocode';
  import AppBar from '$lib/components/AppBar.svelte';
  import ErrorState from '$lib/components/ErrorState.svelte';
  import MeetingList from '$lib/components/MeetingList.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { distanceKm, type LatLng } from '$lib/geo';
  import { i18n, t } from '$lib/i18n/index.svelte';
  import { currentPosition } from '$lib/location';
  import { loadGoogleMaps, mapsAvailable, newSessionToken, placeLocation, suggestPlaces, type PlaceSuggestion } from '$lib/maps/loader';
  import { buildMarkers, iconFor } from '$lib/maps/markers';
  import { loading } from '$lib/stores/loading.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { drawer } from '$lib/stores/ui.svelte';
  import type { RawMeeting } from '$lib/types';

  /** Where the map opens when there is no stored location and no device fix. */
  const FALLBACK_CENTRE: LatLng = { lat: 34.2359855, lng: -118.5656689 };

  /**
   * Below this the visible area covers a continent, and the radius query it
   * implies would ask the aggregator for tens of thousands of meetings.
   */
  const MIN_SEARCH_ZOOM = 8;

  /** Camera-idle fires repeatedly through a fling; only the last one matters. */
  const IDLE_DEBOUNCE_MS = 400;

  let map: GoogleMapType | null = null;
  let mapElement = $state<HTMLElement | null>(null);
  let error = $state('');

  let queryText = $state('');
  let suggestions = $state<PlaceSuggestion[]>([]);
  let sessionToken: unknown;

  let sheetOpen = $state(false);
  let sheetMeetings = $state<RawMeeting[]>([]);

  /**
   * markerId → the meeting ids that pin stands for.
   *
   * A plain Map, not a SvelteMap: nothing renders from it. It is read only
   * inside the marker-tap handler, so making it reactive would cost work on
   * every rebuild and change nothing on screen.
   */
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- lookup table, never rendered
  const markerIds = new Map<string, string[]>();
  let placedMarkerIds: string[] = [];

  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let searchSequence = 0;
  /** Set while we move the camera ourselves, so it does not trigger a search. */
  let programmaticMove = false;

  onMount(() => {
    void start();
    return () => {
      clearTimeout(idleTimer);
      void teardown();
    };
  });

  async function teardown() {
    const instance = map;
    map = null;
    if (!instance) return;
    try {
      await instance.removeAllMapListeners();
      await instance.destroy();
    } catch {
      // Already gone — nothing to clean up.
    }
  }

  async function start() {
    if (!mapsAvailable()) {
      error = 'Google Maps is not configured. Set PUBLIC_GOOGLE_MAPS_KEY in .env.';
      return;
    }

    try {
      // The Places SDK is only needed for the search box, so a failure there
      // must not stop the map itself from rendering.
      void loadGoogleMaps(i18n.locale).then(() => (sessionToken = newSessionToken()));

      const centre = await openingCentre();
      await createMap(centre);
    } catch {
      error = t('LOAD_ERROR');
    }
  }

  /** Stored location, else a quick device fix, else the fallback. */
  async function openingCentre(): Promise<LatLng> {
    if (settings.location) return { lat: settings.location.lat, lng: settings.location.lng };
    try {
      const fix = await currentPosition(6000);
      settings.setLocation({ ...fix, address: '' });
      return fix;
    } catch {
      return FALLBACK_CENTRE;
    }
  }

  async function createMap(centre: LatLng) {
    if (!mapElement) return;
    const { GoogleMap } = await import('@capacitor/google-maps');

    map = await GoogleMap.create({
      id: 'bmlt-map',
      element: mapElement,
      apiKey: PUBLIC_GOOGLE_MAPS_KEY,
      forceCreate: true,
      language: i18n.locale,
      config: { center: centre, zoom: 11 }
    });

    await map.setOnCameraIdleListener((event) => {
      if (programmaticMove) {
        programmaticMove = false;
        return;
      }
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => void onCameraIdle(event), IDLE_DEBOUNCE_MS);
    });

    await map.setOnMarkerClickListener((event) => void onMarkerClick(event.markerId));
  }

  interface CameraEvent {
    zoom: number;
    bounds: { center: LatLng; southwest: LatLng };
  }

  async function onCameraIdle(event: CameraEvent) {
    if (!map) return;

    if (event.zoom < MIN_SEARCH_ZOOM) {
      programmaticMove = true;
      await map.setCamera({ zoom: MIN_SEARCH_ZOOM });
      return;
    }

    const radiusKm = Math.ceil(distanceKm(event.bounds.center, event.bounds.southwest));
    // Every idle starts a new search and invalidates any still in flight, so a
    // slow response for a pane the reader has already left cannot repaint over
    // the markers for the pane they are looking at now.
    const sequence = ++searchSequence;

    const release = loading.begin(t('FINDING_MTGS'));
    try {
      const meetings = await meetingsWithinRadius(event.bounds.center.lat, event.bounds.center.lng, radiusKm);
      if (sequence !== searchSequence || !map) return;
      await drawMarkers(meetings);
    } catch {
      if (sequence === searchSequence) error = t('LOAD_ERROR');
    } finally {
      release();
    }
  }

  async function drawMarkers(meetings: RawMeeting[]) {
    if (!map) return;

    if (placedMarkerIds.length > 0) {
      await map.removeMarkers(placedMarkerIds);
      await map.disableClustering();
      placedMarkerIds = [];
      markerIds.clear();
    }

    const markers = buildMarkers(meetings);
    if (markers.length === 0) return;

    const placed = await map.addMarkers(
      markers.map((marker) => ({
        coordinate: marker.coordinate,
        iconUrl: iconFor(marker),
        iconAnchor: { x: 15, y: 45 }
      }))
    );

    // `addMarkers` returns ids positionally, which is what lets a tap be mapped
    // back to the meetings behind that pin without smuggling them through the
    // marker's title field.
    placed.forEach((id, index) => markerIds.set(id, markers[index].ids));
    placedMarkerIds = placed;

    await map.enableClustering();
  }

  async function onMarkerClick(markerId: string) {
    const ids = markerIds.get(markerId);
    if (!ids?.length) return;

    await loading.during(t('FINDING_MTGS'), async () => {
      sheetMeetings = await meetingsByIds(ids);
      sheetOpen = true;
    });
  }

  async function onSearchInput(event: Event & { currentTarget: HTMLInputElement }) {
    queryText = event.currentTarget.value;
    suggestions = queryText.trim() ? await suggestPlaces(queryText, i18n.locale, sessionToken) : [];
  }

  async function choose(suggestion: PlaceSuggestion) {
    queryText = suggestion.description;
    suggestions = [];

    await loading.during(t('LOCATING'), async () => {
      // Places first; if it cannot resolve the id, geocode the text instead.
      const point = (await placeLocation(suggestion.placeId)) ?? (await forwardGeocode(suggestion.description, i18n.locale));
      if (!point || !map) return;
      await map.setCamera({ coordinate: point, zoom: 12 });
      // A new session token per completed search is what keeps Places billing
      // on the per-session rate rather than per-keystroke.
      sessionToken = newSessionToken();
    });
  }

  function clearSearch() {
    queryText = '';
    suggestions = [];
  }
</script>

<svelte:head><title>{t('MAP_SEARCH')}</title></svelte:head>

<AppBar title={t('MAP_SEARCH')} onmenu={() => drawer.toggle()}>
  {#snippet below()}
    <div class="relative">
      <Search size={18} class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-white/70" aria-hidden="true" />
      <input
        type="search"
        value={queryText}
        oninput={onSearchInput}
        placeholder={t('PLACE_SEARCH')}
        aria-label={t('PLACE_SEARCH')}
        class="focusable w-full rounded-lg bg-white/15 py-2.5 pr-10 pl-10 text-sm text-white placeholder:text-white/60"
      />
      {#if queryText}
        <button type="button" class="focusable absolute top-1/2 right-2 -translate-y-1/2 rounded p-1.5 text-white/70 hover:bg-white/15" onclick={clearSearch} aria-label={t('CANCEL')}>
          <X size={16} aria-hidden="true" />
        </button>
      {/if}
    </div>
  {/snippet}
</AppBar>

{#if error}
  <ErrorState message={error} onretry={() => ((error = ''), start())} />
{/if}

<div class="relative" style="height: calc(100dvh - 12rem)">
  {#if suggestions.length > 0}
    <ul class="border-border bg-surface-raised absolute inset-x-0 top-0 z-20 max-h-72 overflow-y-auto border-b shadow-lg">
      <!-- Keyed by position: Places can return two suggestions with the same
           text and no place id, and a duplicate key is a hard render error. -->
      {#each suggestions as suggestion, index (index)}
        <li>
          <button type="button" class="focusable border-border hover:bg-surface-sunken text-text w-full border-b px-4 py-3 text-left text-sm last:border-0" onclick={() => choose(suggestion)}>
            {suggestion.description}
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <!--
    `capacitor-google-map` is the plugin's own element. On the native platforms
    it is a transparent hole punched through the webview with the platform map
    view rendered behind it; on the web the plugin mounts a normal JS map inside.
  -->
  <capacitor-google-map bind:this={mapElement} class="block h-full w-full"></capacitor-google-map>
</div>

<Modal open={sheetOpen} title={t('MEETING_DETAILS')} onclose={() => (sheetOpen = false)}>
  <MeetingList meetings={sheetMeetings} source="tomato" expandAll />
</Modal>
