import { GoogleMap, LatLngBounds } from '@capacitor/google-maps';
import { AppleMap } from 'capacitor-plugin-apple-maps';
import { platform } from '../native';
import { mapKey } from './keys';
import { loadMapKit } from './mapkit';
import type { LatLng } from '../geo';

// ---------------------------------------------------------------------------
// Cross-platform map abstraction
// ---------------------------------------------------------------------------
//
// The map screen renders behind one `MapHandle`, chosen by platform:
//   - iOS     → Apple Maps (MapKit) native, via capacitor-plugin-apple-maps
//   - Android → Google Maps native, via @capacitor/google-maps
//   - Web     → Apple MapKit JS (mapkit.Map), in the browser
//
// The two Capacitor plugins expose the same method names and payload shapes (the
// Apple plugin was written to mirror the Google one); the web MapKit-JS adapter
// is written to present the *same* `MapHandle`, so the route drives all three
// identically and only picks a different DOM element (native → a custom element,
// web → a plain div).
//
// Why Apple on iOS and web: MapKit needs no API key restriction and, on the web,
// no Google key at all — the browser build authenticates with a signed MapKit
// token instead (see mapkit.ts). Android keeps Google, which is what its key is
// provisioned for (see keys.ts).

/** True when this platform renders Apple Maps natively (iOS). */
export function usesAppleMaps(): boolean {
  return platform() === 'ios';
}

/** True when this platform renders Apple MapKit JS in the browser (web). */
export function usesMapKitJs(): boolean {
  return platform() === 'web';
}

/**
 * The DOM custom-element tag a *native* map mounts into. Only meaningful on
 * iOS/Android; the web MapKit map mounts into a plain `<div>` (the route branches
 * on `usesMapKitJs()`), so this is left as the Google tag there and unused.
 */
export const mapElementTag = usesAppleMaps() ? 'capacitor-apple-map' : 'capacitor-google-map';

export interface ProviderBounds {
  center: LatLng;
  southwest: LatLng;
  northeast: LatLng;
}

export interface CameraIdleData {
  latitude: number;
  longitude: number;
  zoom: number;
  bounds: ProviderBounds;
}

export interface MarkerClickData {
  markerId: string;
}

/**
 * A marker in provider-neutral terms. The route supplies `iconUrl`; the adapter
 * fills in each provider's positioning field:
 *  - Google wants `iconAnchor` (the point of the image pinned to the coordinate).
 *  - Apple wants `iconSize` (MapKit sizes the annotation image itself).
 */
export interface ProviderMarker {
  coordinate: LatLng;
  iconUrl?: string;
}

export interface CreateMapOptions {
  id: string;
  element: HTMLElement;
  config: { center: LatLng; zoom: number; minZoom?: number; colorScheme?: 'light' | 'dark' };
}

/** Provider-neutral handle over the native map, exposing only what the route needs. */
export interface MapHandle {
  setOnCameraIdleListener(callback: (data: CameraIdleData) => void): Promise<void>;
  /**
   * Fires once as the camera starts moving, before the ensuing idle, with the
   * plugin's authoritative `isGesture` flag: true for a user pan/zoom, false for
   * a programmatic move (our own `setCamera`/`fitBounds`, or the provider
   * recentring itself on a marker tap). Both plugins expose it identically.
   */
  setOnCameraMoveStartedListener(callback: (isGesture: boolean) => void): Promise<void>;
  setOnMarkerClickListener(callback: (data: MarkerClickData) => void): Promise<void>;
  getMapBounds(): Promise<ProviderBounds>;
  setCamera(config: { coordinate?: LatLng; zoom?: number }): Promise<void>;
  /** Frame the camera to enclose every coordinate. `padding` is an edge inset in pixels. */
  fitBounds(coordinates: LatLng[], padding?: number): Promise<void>;
  /** Match the map's appearance to a light/dark scheme. No-op where the provider has no such control (Google). */
  setColorScheme(scheme: 'light' | 'dark'): Promise<void>;
  addMarkers(markers: ProviderMarker[]): Promise<string[]>;
  removeMarkers(ids: string[]): Promise<void>;
  enableClustering(): Promise<void>;
  disableClustering(): Promise<void>;
  destroy(): Promise<void>;
}

/**
 * Bounding box of a set of coordinates, in the {southwest, center, northeast}
 * shape Google's `fitBounds` wants. Apple's `fitBounds` takes the raw `LatLng[]`
 * and computes this itself, so this is only needed on the Google branch.
 */
function boundsOf(coordinates: LatLng[]): ProviderBounds {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const { lat, lng } of coordinates) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }
  return {
    southwest: { lat: minLat, lng: minLng },
    northeast: { lat: maxLat, lng: maxLng },
    center: { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 }
  };
}

/** Normalise either provider's bounds object into {center, southwest, northeast}. */
function normaliseBounds(bounds: ProviderBounds): ProviderBounds {
  return {
    center: { lat: bounds.center.lat, lng: bounds.center.lng },
    southwest: { lat: bounds.southwest.lat, lng: bounds.southwest.lng },
    northeast: { lat: bounds.northeast.lat, lng: bounds.northeast.lng }
  };
}

/**
 * Create a native map for the current platform. Both underlying `create` calls
 * take the same `{ id, element, config }`; only Google needs an API key.
 */
export async function createMap(options: CreateMapOptions): Promise<MapHandle> {
  if (usesMapKitJs()) return createMapKitWebMap(options);
  if (usesAppleMaps()) {
    // `clustering: true` starts the map clustered (capacitor-plugin-apple-maps
    // ≥0.3.4), so markers cluster on their first render instead of flashing as
    // individual pins. MapKit clusters natively as annotations are added — there
    // is no cluster manager to protect the way Google has — so `disableClustering`
    // below is a deliberate no-op: the shared draw path toggles clustering off
    // around marker updates, which only matters for Google; on Apple that toggle
    // is what caused the flash.
    const map = await AppleMap.create({
      id: options.id,
      element: options.element,
      config: { ...options.config, clustering: true },
      forceCreate: true
    });
    return {
      setOnCameraIdleListener: (cb) => map.setOnCameraIdleListener((d) => cb({ latitude: d.latitude, longitude: d.longitude, zoom: d.zoom, bounds: normaliseBounds(d.bounds) })),
      setOnCameraMoveStartedListener: (cb) => map.setOnCameraMoveStartedListener((d) => cb(d.isGesture)),
      setOnMarkerClickListener: (cb) => map.setOnMarkerClickListener((d) => cb({ markerId: d.markerId })),
      getMapBounds: async () => normaliseBounds(await map.getMapBounds()),
      setCamera: (config) => map.setCamera(config),
      // Apple's fitBounds takes the raw coordinates and frames them to the real
      // viewport aspect ratio (setVisibleMapRect(_:edgePadding:)).
      fitBounds: (coordinates, padding) => map.fitBounds(coordinates, padding),
      setColorScheme: (scheme) => map.setColorScheme(scheme),
      // MapKit sizes the annotation image; without a size the raw PNG pixels are
      // used, which is tiny on a hi-DPI screen. 60×72 keeps the pin art's ~0.83
      // aspect (the source is 83×100) and matches the marker size in the
      // NA-New-England app.
      addMarkers: (markers) => map.addMarkers(markers.map((m) => ({ coordinate: m.coordinate, iconUrl: m.iconUrl, iconSize: { width: 60, height: 72 } }))),
      removeMarkers: (ids) => map.removeMarkers(ids),
      enableClustering: () => map.enableClustering(),
      disableClustering: () => Promise.resolve(),
      destroy: () => map.destroy()
    };
  }

  const map = await GoogleMap.create({
    id: options.id,
    element: options.element,
    // Platform key: the native Maps SDK on Android, the web key in a browser.
    apiKey: mapKey(),
    forceCreate: true,
    config: options.config
  });
  return {
    setOnCameraIdleListener: (cb) =>
      map.setOnCameraIdleListener((d) => cb({ latitude: d.latitude, longitude: d.longitude, zoom: d.zoom, bounds: normaliseBounds(d.bounds as unknown as ProviderBounds) })),
    setOnCameraMoveStartedListener: (cb) => map.setOnCameraMoveStartedListener((d) => cb(d.isGesture)),
    setOnMarkerClickListener: (cb) => map.setOnMarkerClickListener((d) => cb({ markerId: d.markerId })),
    getMapBounds: async () => normaliseBounds((await map.getMapBounds()) as unknown as ProviderBounds),
    setCamera: (config) => map.setCamera(config),
    // Google's fitBounds wants a LatLngBounds; build it from the pins' box.
    fitBounds: (coordinates, padding) => map.fitBounds(new LatLngBounds(boundsOf(coordinates)), padding),
    // Google Maps has no runtime light/dark toggle here; the app follows the
    // system scheme via CSS on the web/Android paths.
    setColorScheme: () => Promise.resolve(),
    // The Google pin art is anchored by its tip: half its width across, its full
    // height down — the value the route used before this abstraction existed.
    addMarkers: (markers) => map.addMarkers(markers.map((m) => ({ coordinate: m.coordinate, iconUrl: m.iconUrl, iconAnchor: { x: 15, y: 45 } }))),
    removeMarkers: (ids) => map.removeMarkers(ids),
    enableClustering: () => map.enableClustering(),
    disableClustering: () => map.disableClustering(),
    destroy: () => map.destroy()
  };
}

// ---------------------------------------------------------------------------
// Web: Apple MapKit JS
// ---------------------------------------------------------------------------

/*
  MapKit JS has no zoom levels — the camera is a CoordinateRegion (centre plus a
  latitude/longitude span). These convert between a Google-style zoom and a span
  for the element's pixel size, using the standard web-mercator metres-per-pixel,
  so the web map opens and reports zoom at a scale comparable to the native maps.
  The map reports its true region back, so the route never depends on the zoom
  being exact — only on it crossing MIN_SEARCH_ZOOM sensibly.
*/
const TILE_SIZE = 256;
const EARTH_CIRCUMFERENCE_M = 40075016.686;
const METRES_PER_DEGREE_LAT = 111320;

function regionForZoom(center: LatLng, zoom: number, element: HTMLElement): mapkit.CoordinateRegion {
  const width = element.clientWidth || TILE_SIZE;
  const height = element.clientHeight || TILE_SIZE;
  const metresPerPx = (EARTH_CIRCUMFERENCE_M * Math.cos((center.lat * Math.PI) / 180)) / (TILE_SIZE * 2 ** zoom);
  const latitudeDelta = (metresPerPx * height) / METRES_PER_DEGREE_LAT;
  const longitudeDelta = (360 * width) / (TILE_SIZE * 2 ** zoom);
  return new mapkit.CoordinateRegion(new mapkit.Coordinate(center.lat, center.lng), new mapkit.CoordinateSpan(latitudeDelta, longitudeDelta));
}

function zoomFromRegion(region: mapkit.CoordinateRegion, element: HTMLElement): number {
  const width = element.clientWidth || TILE_SIZE;
  return Math.log2((360 * width) / (TILE_SIZE * region.span.longitudeDelta));
}

function boundsFromRegion(region: mapkit.CoordinateRegion): ProviderBounds {
  const { latitude, longitude } = region.center;
  const halfLat = region.span.latitudeDelta / 2;
  const halfLng = region.span.longitudeDelta / 2;
  return {
    center: { lat: latitude, lng: longitude },
    southwest: { lat: latitude - halfLat, lng: longitude - halfLng },
    northeast: { lat: latitude + halfLat, lng: longitude + halfLng }
  };
}

/*
  The pin art lives in static/ as bare filenames (marker-blue.png / marker-red.png)
  so the native plugins can load them as bundled assets. MapKit's ImageAnnotation
  resolves its url relative to the document, so a bare name would resolve against
  the current route path — anchor it to the origin root instead.
*/
function markerUrl(iconUrl: string): string {
  return /^(https?:|blob:|data:|\/)/.test(iconUrl) ? iconUrl : `/${iconUrl}`;
}

// One identifier so co-located pins cluster natively, mirroring the Apple plugin.
const WEB_CLUSTER_ID = 'bmlt';
const WEB_MARKER_SIZE = { width: 30, height: 45 };

async function createMapKitWebMap(options: CreateMapOptions): Promise<MapHandle> {
  await loadMapKit();

  const element = options.element;
  const map = new mapkit.Map(element, {
    region: regionForZoom(options.config.center, options.config.zoom, element),
    colorScheme: options.config.colorScheme === 'dark' ? mapkit.Map.ColorSchemes.Dark : mapkit.Map.ColorSchemes.Light,
    showsUserLocation: false,
    showsUserLocationControl: false,
    showsCompass: mapkit.FeatureVisibility.Hidden,
    showsScale: mapkit.FeatureVisibility.Hidden,
    showsMapTypeControl: false,
    showsZoomControl: true,
    isRotationEnabled: false
  });

  let onMoveStarted: ((isGesture: boolean) => void) | null = null;
  let onIdle: ((data: CameraIdleData) => void) | null = null;
  let onMarkerClick: ((data: MarkerClickData) => void) | null = null;
  // MapKit gives no gesture flag, so a move we made is fenced off here: set before
  // our own setRegion/fitBounds, read by region-change-start to report the move as
  // non-gesture, then cleared when the region settles.
  let suppressPan = false;
  const annotationsById = new Map<string, mapkit.Annotation>();
  let counter = 0;

  map.addEventListener('region-change-start', () => onMoveStarted?.(!suppressPan));
  map.addEventListener('region-change-end', () => {
    const region = map.region;
    onIdle?.({ latitude: region.center.latitude, longitude: region.center.longitude, zoom: zoomFromRegion(region, element), bounds: boundsFromRegion(region) });
    suppressPan = false;
  });
  map.addEventListener('select', (event) => {
    const id = event.annotation?.data;
    if (typeof id === 'string') onMarkerClick?.({ markerId: id });
  });

  function move(run: () => void) {
    suppressPan = true;
    run();
  }

  return {
    setOnCameraIdleListener: (cb) => {
      onIdle = cb;
      return Promise.resolve();
    },
    setOnCameraMoveStartedListener: (cb) => {
      onMoveStarted = cb;
      return Promise.resolve();
    },
    setOnMarkerClickListener: (cb) => {
      onMarkerClick = cb;
      return Promise.resolve();
    },
    getMapBounds: () => Promise.resolve(boundsFromRegion(map.region)),
    setCamera: (config) => {
      const center = config.coordinate ?? { lat: map.region.center.latitude, lng: map.region.center.longitude };
      move(() => {
        if (config.zoom == null) map.setCenterAnimated(new mapkit.Coordinate(center.lat, center.lng), true);
        else map.setRegionAnimated(regionForZoom(center, config.zoom, element), true);
      });
      return Promise.resolve();
    },
    fitBounds: (coordinates, padding = 0) => {
      const box = boundsOf(coordinates);
      const width = element.clientWidth || TILE_SIZE;
      const height = element.clientHeight || TILE_SIZE;
      const latSpan = Math.max((box.northeast.lat - box.southwest.lat) * (1 + (2 * padding) / height), 0.01);
      const lngSpan = Math.max((box.northeast.lng - box.southwest.lng) * (1 + (2 * padding) / width), 0.01);
      move(() => map.setRegionAnimated(new mapkit.CoordinateRegion(new mapkit.Coordinate(box.center.lat, box.center.lng), new mapkit.CoordinateSpan(latSpan, lngSpan)), true));
      return Promise.resolve();
    },
    setColorScheme: (scheme) => {
      map.colorScheme = scheme === 'dark' ? mapkit.Map.ColorSchemes.Dark : mapkit.Map.ColorSchemes.Light;
      return Promise.resolve();
    },
    addMarkers: (markers) => {
      const annotations = markers.map((marker) => {
        const id = `w${counter++}`;
        const url = marker.iconUrl ? markerUrl(marker.iconUrl) : '';
        const annotation = new mapkit.ImageAnnotation(new mapkit.Coordinate(marker.coordinate.lat, marker.coordinate.lng), {
          url: { 1: url, 2: url },
          size: WEB_MARKER_SIZE,
          // Anchor the pin's tip (bottom-centre) to the coordinate.
          anchorOffset: new DOMPoint(0, -WEB_MARKER_SIZE.height / 2),
          clusteringIdentifier: WEB_CLUSTER_ID,
          data: id
        });
        annotationsById.set(id, annotation);
        return annotation;
      });
      map.addAnnotations(annotations);
      return Promise.resolve(annotations.map((annotation) => annotation.data as string));
    },
    removeMarkers: (ids) => {
      const annotations = ids.map((id) => annotationsById.get(id)).filter((annotation): annotation is mapkit.Annotation => Boolean(annotation));
      if (annotations.length) map.removeAnnotations(annotations);
      for (const id of ids) annotationsById.delete(id);
      return Promise.resolve();
    },
    // MapKit clusters natively via each annotation's clusteringIdentifier, so
    // there is no map-level toggle to drive — both are no-ops, matching Apple.
    enableClustering: () => Promise.resolve(),
    disableClustering: () => Promise.resolve(),
    destroy: () => {
      map.destroy();
      return Promise.resolve();
    }
  };
}
