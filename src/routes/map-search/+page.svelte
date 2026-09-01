<script lang="ts">
  /**
   * The provider module is imported eagerly, not with a dynamic import inside
   * createMap().
   *
   * Importing it is what runs `customElements.define(...)` for the platform's
   * map element — `capacitor-apple-map` on iOS, `capacitor-google-map` on
   * Android/web — and the element's connectedCallback is what applies
   * `overflow: scroll` plus a 200%-height child, the two things that make WebKit
   * materialise the WKChildScrollView the native plugins hunt for in the view
   * tree.
   *
   * Defined late, the element gets inserted as an unknown element and is only
   * upgraded once the import resolves, so `create()` ran before WebKit had a
   * layout pass to build that scroll view: no match, blank map. The second visit
   * worked because by then the element was already defined and its scroll view
   * already existed. This route is its own chunk, so importing here costs
   * nothing elsewhere.
   */
  import { createMap as createNativeMap, mapElementTag, usesAppleMaps, type MapHandle, type MarkerClickData } from '$lib/maps/provider';
  import { RotateCw, Search, X } from '@lucide/svelte';
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
  import { MAP_VENUE_TYPES } from '$lib/meetings/venue';
  import { platform } from '$lib/native';
  import { newSessionToken, placeLocation, suggestPlaces, type PlaceSuggestion, type PlacesSession, type SearchBias } from '$lib/maps/places';
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

  let map: MapHandle | null = null;
  let mapElement = $state<HTMLElement | null>(null);
  let error = $state('');

  let queryText = $state('');
  let suggestions = $state<PlaceSuggestion[]>([]);
  let sessionToken: PlacesSession;

  /**
   * Current map region, used to bias iOS (MapKit) autocomplete toward what is on
   * screen. Not $state — only read by the async search handler, never rendered.
   * Ignored on the Google paths, which do their own biasing.
   */
  let searchBias: SearchBias | undefined;

  function updateSearchBias(center: LatLng, southwest: LatLng) {
    searchBias = {
      latitude: center.lat,
      longitude: center.lng,
      latitudeDelta: Math.abs(center.lat - southwest.lat) * 2,
      longitudeDelta: Math.abs(center.lng - southwest.lng) * 2
    };
  }

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
  /**
   * Set while we move the camera ourselves, so the camera-idle it may (or may
   * not) produce is ignored. Our own moves always search explicitly via
   * `searchCurrentView()` afterwards; only a user gesture searches through idle.
   */
  let programmaticMove = false;

  /**
   * True once the native view exists and is safe to drive. We set it a couple of
   * frames after `create()` resolves rather than waiting for a camera-idle:
   *
   * MapKit only emits `onCameraIdle` from its `regionDidChangeAnimated` delegate,
   * which does NOT fire for the region set during `create()` (our listener is not
   * attached yet) and fires only unreliably for a programmatic, non-animated
   * `setCamera`. So the first search — and every search after a programmatic move
   * — reads `getMapBounds()` and runs directly; idle is left to handle user pans.
   */
  let mapReady = false;
  let pendingCamera: { coordinate?: LatLng; zoom?: number } | null = null;

  /** Where the currently drawn markers were searched from. */
  let searchedCentre: LatLng | null = null;
  let lastCamera: CameraEvent | null = null;
  let canSearchArea = $state(false);

  onMount(() => {
    // Android draws the native map *underneath* the webview, so the page above
    // it has to be see-through or the map is invisible. Scoped to this screen so
    // the rest of the app keeps its background, and to Android because iOS
    // renders the map into the webview instead. See app.css.
    const needsUnderlay = platform() === 'android';
    if (needsUnderlay) document.documentElement.classList.add('map-underlay');

    void start();

    return () => {
      if (needsUnderlay) document.documentElement.classList.remove('map-underlay');
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
      // destroy() tears the native view down and drops its listeners; both
      // plugins clean up on destroy, so there is no separate listener removal.
      await instance.destroy();
    } catch {
      // Already gone — nothing to clean up.
    }
  }

  async function start() {
    // Apple Maps (iOS) needs no key; Google (Android/web) does.
    if (!usesAppleMaps() && !mapKey()) {
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

      if (settings.location) {
        // Search the opening view straight away — the map does not emit a
        // reliable idle for its initial region, so we cannot wait for one.
        await searchCurrentView();
      } else {
        // No stored location: refine to the device fix without blocking the map
        // appearing, and let that path run the first search where the reader is.
        void locateAndRecentre();
      }
    } catch {
      error = t('LOAD_ERROR');
    }
  }

  async function locateAndRecentre() {
    try {
      const fix = await currentPosition(6000);
      settings.setLocation({ ...fix, address: '' });
      // Otherwise the map slides to the reader's location while the pins stay
      // where the fallback centre was.
      searchedCentre = null;
      await moveCamera({ coordinate: fix, zoom: 11 });
      // The move may not emit an idle (see mapReady), so search the new view now.
      await searchCurrentView();
    } catch {
      // No fix: search the fallback view that is already on screen, so the reader
      // still gets meetings rather than an empty map.
      await searchCurrentView();
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
    await customElements.whenDefined(mapElementTag);
    await nextFrame();
    await nextFrame();

    // The element can disappear while we were waiting.
    if (!mapElement) return;

    // Apple Maps on iOS, Google on Android/web — the provider picks and only
    // Google is handed a key. minZoom keeps a zoom-out from asking the
    // aggregator for a continent's worth of meetings.
    map = await createNativeMap({
      id: 'bmlt-map',
      element: mapElement,
      config: { center: centre, zoom: 11, minZoom: MIN_SEARCH_ZOOM }
    });

    await map.setOnCameraIdleListener((data) => {
      // Idle handles user gestures only. Our own moves search explicitly, so the
      // idle they may emit is swallowed here — otherwise a programmatic recentre
      // (marker tap, locate, place pick) would fire a second, unwanted search.
      const wasProgrammatic = programmaticMove;
      programmaticMove = false;
      if (wasProgrammatic) return;

      // Normalise the provider payload into the {zoom, bounds:{center, southwest}}
      // shape the rest of the route uses.
      const event: CameraEvent = { zoom: data.zoom, bounds: { center: data.bounds.center, southwest: data.bounds.southwest } };
      updateSearchBias(event.bounds.center, event.bounds.southwest);

      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => void onCameraIdle(event), IDLE_DEBOUNCE_MS);
    });

    await map.setOnMarkerClickListener((data: MarkerClickData) => void onMarkerClick(data.markerId));

    // The native view exists now; give iOS a couple of frames to finish its first
    // render, then mark ready so setCamera / getMapBounds are safe. We do NOT wait
    // for a camera-idle to prove readiness — MapKit may never send one for the
    // initial region (see mapReady).
    await nextFrame();
    await nextFrame();
    markReady();
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

  /**
   * Read the map's current viewport and search it directly.
   *
   * This is how the first load and every programmatic move (locate, place pick)
   * run their search, instead of waiting for a camera-idle that MapKit does not
   * reliably send for non-gesture region changes. `getMapBounds()` returns the
   * real visible rectangle, so the search covers exactly what is on screen.
   */
  async function searchCurrentView(zoom = 11) {
    if (!map) return;
    try {
      const bounds = await map.getMapBounds();
      const event: CameraEvent = { zoom, bounds: { center: bounds.center, southwest: bounds.southwest } };
      updateSearchBias(event.bounds.center, event.bounds.southwest);
      await runSearch(event);
    } catch {
      // The view can be torn down mid-flight; a failed bounds read is not fatal.
    }
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
      const meetings = await meetingsWithinRadius(event.bounds.center.lat, event.bounds.center.lng, radiusKm, MAP_VENUE_TYPES);
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
        iconUrl: iconFor(marker)
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
    suggestions = queryText.trim() ? await suggestPlaces(queryText, i18n.locale, sessionToken, searchBias) : [];
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

      // Jumping somewhere new should search there, not wait to be asked — and the
      // move may not emit an idle, so run the search explicitly on the new view.
      searchedCentre = null;
      await searchCurrentView(12);

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

<!--
  The screen is a flex column exactly one viewport tall: the app bar takes its
  natural height (search box and top safe area included) and the map area takes
  whatever is left. The height is measured, not a magic constant, so the map's
  bottom edge lands right on the tab bar on every device — which is what keeps
  MapKit's required Apple logo and "Legal" link (drawn at the map's bottom-left)
  visible instead of tucked behind the nav or the home indicator. `.map-screen`
  reserves the nav + bottom safe-area itself and cancels the global `.app-main`
  bottom padding so there is no stray scroll. See the <style> block below.
-->
<div class="map-screen flex flex-col">
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

  <div class="relative min-h-0 flex-1">
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

    Styled as a floating white pill rather than a solid brand-blue one: it sits
    on top of a photographic surface, and a bordered light chip is what reads as
    controls-above-a-map. Google's own "search this area" does the same.

    `top-8` is as high as it can safely go. On the web the JS SDK draws its
    Map/Satellite control at the top left, roughly 10-50px down, and a centred
    pill any higher overlaps it on a narrow screen. Native has no such control,
    so this is a web-only ceiling — if the toggle is ever turned off, this can
    move to top-3.
  -->
    {#if canSearchArea && suggestions.length === 0}
      <button
        type="button"
        class="focusable bg-surface-raised text-brand-ink ring-border hover:bg-surface-sunken absolute top-8 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full px-5 py-3 text-[15px] font-semibold shadow-lg ring-1 transition-colors"
        onclick={searchThisArea}
      >
        <RotateCw size={16} aria-hidden="true" />
        {t('SEARCH_AREA')}
      </button>
    {/if}

    <!--
    The plugin's own element — `capacitor-apple-map` on iOS, `capacitor-google-map`
    on Android/web (see provider.ts). On the native platforms it is a transparent
    hole punched through the webview with the platform map view rendered behind
    it; on the web the Google plugin mounts a normal JS map inside.
  -->
    <svelte:element this={mapElementTag} bind:this={mapElement} class="block h-full w-full"></svelte:element>
  </div>
</div>

<Modal open={sheetOpen} title={t('MEETING_DETAILS')} onclose={() => (sheetOpen = false)}>
  {#if sheetLoading}
    <div class="text-bmlt flex items-center justify-center gap-3 py-12">
      <Spinner size={22} label={t('FINDING_MTGS')} />
      <span class="text-text-muted text-sm">{t('FINDING_MTGS')}</span>
    </div>
  {:else}
    <MeetingList meetings={sheetMeetings} expandAll />
  {/if}
</Modal>

<style>
  /*
   * The map screen owns the full viewport. `.app-main` (app.css) adds a
   * bottom padding of `4.5rem + safe-area-inset-bottom` so ordinary pages clear
   * the fixed bottom nav; here we cancel that with a matching negative margin and
   * reserve the same space as our own padding instead. Net effect: the wrapper is
   * exactly `100dvh`, the inner `flex-1` map area ends at the top of the tab bar,
   * and MapKit's Apple logo + "Legal" link sit just above it rather than behind
   * it (or behind the home indicator). box-sizing is border-box (Tailwind reset),
   * so the 100dvh height includes the padding.
   */
  .map-screen {
    height: 100dvh;
    padding-bottom: calc(4.5rem + env(safe-area-inset-bottom, 0px));
    margin-bottom: calc(-4.5rem - env(safe-area-inset-bottom, 0px));
  }
</style>
