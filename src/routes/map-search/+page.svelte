<script lang="ts">
  /**
   * Imported eagerly, not with a dynamic import inside createMap().
   *
   * Importing the module is what runs `customElements.define('capacitor-google-map', …)`,
   * and the element's connectedCallback is what applies `overflow: scroll` plus a
   * 200%-height child — the two things that make WebKit materialise the
   * WKChildScrollView the iOS plugin hunts for in the native view tree.
   *
   * Defined late, the element gets inserted as an unknown element and is only
   * upgraded once the import resolves, so `create()` ran before WebKit had a
   * layout pass to build that scroll view: no match, blank map. The second visit
   * worked because by then the element was already defined and its scroll view
   * already existed. This route is its own chunk, so importing here costs
   * nothing elsewhere.
   */
  import { GoogleMap, type GoogleMap as GoogleMapType } from '@capacitor/google-maps';
  import { Search, X } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import { meetingsByIds, meetingsWithinRadius } from '$lib/api/bmlt';
  import { forwardGeocode } from '$lib/api/geocode';
  import AppBar from '$lib/components/AppBar.svelte';
  import ErrorState from '$lib/components/ErrorState.svelte';
  import MeetingList from '$lib/components/MeetingList.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import Spinner from '$lib/components/Spinner.svelte';
  import { distanceKm, type LatLng } from '$lib/geo';
  import { i18n, t } from '$lib/i18n/index.svelte';
  import { currentPosition } from '$lib/location';
  import { mapKey } from '$lib/maps/keys';
  import { newSessionToken, placeLocation, suggestPlaces, type PlaceSuggestion, type PlacesSession } from '$lib/maps/places';
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
  let sessionToken: PlacesSession;

  let sheetOpen = $state(false);
  let sheetLoading = $state(false);
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

  /**
   * True once the native map has emitted an event, which is the only reliable
   * proof its view exists — `create()` resolving is not, because the iOS side
   * renders on a later main-queue turn.
   */
  let mapReady = false;
  let pendingCamera: { coordinate?: LatLng; zoom?: number } | null = null;

  /** Where the currently drawn markers were searched from. */
  let searchedCentre: LatLng | null = null;
  let lastCamera: CameraEvent | null = null;
  let canSearchArea = $state(false);

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
    mapReady = false;
    pendingCamera = null;
    if (!instance) return;
    try {
      await instance.removeAllMapListeners();
      await instance.destroy();
    } catch {
      // Already gone — nothing to clean up.
    }
  }

  async function start() {
    if (!mapKey()) {
      error = 'Google Maps is not configured. See .env.example for the three keys this needs.';
      return;
    }

    try {
      // Places is only needed for the search box, so a failure there must not
      // stop the map itself from rendering.
      void newSessionToken(i18n.locale).then((token) => (sessionToken = token));

      // Open immediately at the last known position, or the fallback. Waiting on
      // a device fix first meant the very first visit showed nothing at all until
      // the permission prompt was answered.
      await createMap(settings.location ? { lat: settings.location.lat, lng: settings.location.lng } : FALLBACK_CENTRE);

      // Then refine, without blocking the map appearing.
      if (!settings.location) void locateAndRecentre();
    } catch {
      error = t('LOAD_ERROR');
    }
  }

  async function locateAndRecentre() {
    try {
      const fix = await currentPosition(6000);
      settings.setLocation({ ...fix, address: '' });
      await moveCamera({ coordinate: fix, zoom: 11 });
    } catch {
      // No fix: the fallback view stands, and the reader can search or pan.
    }
  }

  /**
   * Wait until the element has a real size before handing it to the plugin.
   *
   * The iOS implementation locates its render target by matching the element's
   * measured width and height (`getTargetContainer(refWidth:refHeight:)`). Called
   * before layout has settled it matches nothing, silently skips adding the map
   * view, and leaves `GMapView` nil forever — which shows up as a blank map and
   * then a hard crash on the next `setCamera`, because that property is an
   * implicitly unwrapped optional.
   */
  function nextFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  async function waitForLayout(element: HTMLElement, attempts = 30): Promise<boolean> {
    for (let i = 0; i < attempts; i += 1) {
      const { width, height } = element.getBoundingClientRect();
      if (width > 0 && height > 0) return true;
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }
    return false;
  }

  async function createMap(centre: LatLng) {
    if (!mapElement) return;
    if (!(await waitForLayout(mapElement))) return;

    // The element's connectedCallback must have run — it is what applies the
    // overflow styling WebKit needs — and WebKit then needs a layout and
    // compositing pass to actually build the child scroll view the native side
    // matches against. Two frames after upgrade is enough; creating in the same
    // turn is not.
    await customElements.whenDefined('capacitor-google-map');
    await nextFrame();
    await nextFrame();

    // The element can disappear while we were waiting.
    if (!mapElement) return;

    map = await GoogleMap.create({
      id: 'bmlt-map',
      element: mapElement,
      // Platform key: the native Maps SDK on device, the web key in a browser.
      apiKey: mapKey(),
      forceCreate: true,
      language: i18n.locale,
      config: { center: centre, zoom: 11 }
    });

    await map.setOnCameraIdleListener((event) => {
      // The first idle is proof the native map view exists: the event came from
      // it. `create()` resolving is not proof — the iOS side renders on a later
      // main-queue turn, so a camera call in that window hits a nil map view.
      markReady();

      if (programmaticMove) {
        programmaticMove = false;
        return;
      }
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => void onCameraIdle(event), IDLE_DEBOUNCE_MS);
    });

    await map.setOnMarkerClickListener((event) => void onMarkerClick(event.markerId));
  }

  /** Applies any camera move that was requested before the map was usable. */
  function markReady() {
    if (mapReady) return;
    mapReady = true;
    const pending = pendingCamera;
    pendingCamera = null;
    if (pending) void moveCamera(pending);
  }

  /**
   * The only path that moves the camera.
   *
   * Guarded because `setCamera` force-unwraps the native map view: calling it
   * before the view exists crashes the app outright rather than failing. Until
   * the map has proved itself by emitting an event, the request is held and
   * replayed.
   */
  async function moveCamera(config: { coordinate?: LatLng; zoom?: number }) {
    if (!map) return;
    if (!mapReady) {
      pendingCamera = config;
      return;
    }
    try {
      programmaticMove = true;
      await map.setCamera(config);
    } catch {
      // A destroyed or not-yet-rendered map. Nothing to recover, and it must not
      // take the app down.
      programmaticMove = false;
    }
  }

  interface CameraEvent {
    zoom: number;
    bounds: { center: LatLng; southwest: LatLng };
  }

  /**
   * Camera settled — offer a search, do not run one.
   *
   * Searching on every camera idle was wrong in a way that only shows up on a
   * device: tapping a marker near the edge makes Google recentre the map, which
   * fires an idle, which started a fresh search and rebuilt the very markers
   * that were just tapped. It also meant every idle pan spent a request and
   * churned the pins while someone was still reading them.
   *
   * So the reader asks. This is the pattern Google Maps, Airbnb and Zillow all
   * settled on for the same reason.
   */
  async function onCameraIdle(event: CameraEvent) {
    if (!map) return;
    lastCamera = event;

    if (event.zoom < MIN_SEARCH_ZOOM) {
      await moveCamera({ zoom: MIN_SEARCH_ZOOM });
      return;
    }

    // The first settle after load searches on its own, so the screen is never
    // just an empty map with a button on it.
    if (!searchedCentre) {
      await runSearch(event);
      return;
    }

    // Offer the button once the view has moved meaningfully — a quarter of the
    // visible radius — rather than after every stray pixel of drift.
    const radiusKm = distanceKm(event.bounds.center, event.bounds.southwest);
    canSearchArea = distanceKm(searchedCentre, event.bounds.center) > radiusKm * 0.25;
  }

  async function runSearch(event: CameraEvent) {
    if (!map) return;

    const radiusKm = Math.ceil(distanceKm(event.bounds.center, event.bounds.southwest));
    // Every search invalidates any still in flight, so a slow response for a pane
    // the reader has already left cannot repaint over the markers for the pane
    // they are looking at now.
    const sequence = ++searchSequence;
    error = '';

    const release = loading.begin(t('FINDING_MTGS'));
    try {
      const meetings = await meetingsWithinRadius(event.bounds.center.lat, event.bounds.center.lng, radiusKm);
      if (sequence !== searchSequence || !map) return;
      await drawMarkers(meetings);
      searchedCentre = event.bounds.center;
      canSearchArea = false;
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

    // Tapping a pin makes Google recentre the map by itself. That recentre is
    // not the reader panning, so it must not offer to search the new area.
    programmaticMove = true;

    // The sheet opens straight away with its own spinner rather than raising the
    // app-wide overlay. Loading a pin's meetings is not an area search, and
    // borrowing that overlay — and its "Finding Meetings…" wording — made a tap
    // look like it had kicked off the very search the button is there to defer.
    sheetMeetings = [];
    sheetLoading = true;
    sheetOpen = true;
    try {
      sheetMeetings = await meetingsByIds(ids);
    } catch {
      sheetMeetings = [];
    } finally {
      sheetLoading = false;
    }
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
      const point = (await placeLocation(suggestion.placeId, i18n.locale)) ?? (await forwardGeocode(suggestion.description, i18n.locale));
      if (!point) return;

      // Through the guard: picking a place is exactly the moment the map might
      // not be ready yet, and an unguarded setCamera here is what crashed the
      // app when someone typed a search before the map had rendered.
      await moveCamera({ coordinate: point, zoom: 12 });

      // Jumping somewhere new should search there, not wait to be asked.
      searchedCentre = null;

      // A new session token per completed search is what keeps Places billing
      // on the per-session rate rather than per-keystroke.
      sessionToken = await newSessionToken(i18n.locale);
    });
  }

  function searchThisArea() {
    if (lastCamera) void runSearch(lastCamera);
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
    Offered only once the view has moved away from where the current pins were
    found. Nothing searches on its own after the first load: an automatic search
    per camera idle rebuilt the markers underneath the reader — including when
    tapping a pin near the edge made Google recentre the map by itself.

    Sits at top-14 rather than top-3 to clear Google's own Map/Satellite control,
    which occupies the top left and otherwise collides with it on a narrow screen.
  -->
  {#if canSearchArea && suggestions.length === 0}
    <button
      type="button"
      class="focusable bg-bmlt hover:bg-bmlt-shade absolute top-14 left-1/2 z-20 -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors"
      onclick={searchThisArea}
    >
      {t('SEARCH_AREA')}
    </button>
  {/if}

  <!--
    `capacitor-google-map` is the plugin's own element. On the native platforms
    it is a transparent hole punched through the webview with the platform map
    view rendered behind it; on the web the plugin mounts a normal JS map inside.
  -->
  <capacitor-google-map bind:this={mapElement} class="block h-full w-full"></capacitor-google-map>
</div>

<Modal open={sheetOpen} title={t('MEETING_DETAILS')} onclose={() => (sheetOpen = false)}>
  {#if sheetLoading}
    <div class="text-bmlt flex items-center justify-center gap-3 py-12">
      <Spinner size={22} label={t('FINDING_MTGS')} />
      <span class="text-text-muted text-sm">{t('FINDING_MTGS')}</span>
    </div>
  {:else}
    <MeetingList meetings={sheetMeetings} source="tomato" expandAll />
  {/if}
</Modal>
