import { GoogleMap } from '@capacitor/google-maps';
import { AppleMap } from 'capacitor-plugin-apple-maps';
import { platform } from '../native';
import { mapKey } from './keys';
import type { LatLng } from '../geo';

// ---------------------------------------------------------------------------
// Cross-platform native map abstraction
// ---------------------------------------------------------------------------
//
// The map screen renders a native map on device: Apple Maps (MapKit) on iOS,
// Google Maps on Android and the web. Both plugins — `@capacitor/google-maps`
// and `capacitor-plugin-apple-maps` — expose the same method names and payload
// shapes (the Apple plugin was written to mirror the Google one), so this module
// is a thin adapter that normalises the handful of fields the route uses and
// hides the provider choice behind one `MapHandle`.
//
// Why Apple Maps on iOS: MapKit needs no API key and no per-platform key
// restriction, and it is the map users expect inside an iOS app. Android and web
// keep Google, which is what their keys are provisioned for (see keys.ts).

/** True when this platform renders Apple Maps (iOS); false for Google (Android/web). */
export function usesAppleMaps(): boolean {
  return platform() === 'ios';
}

/** The DOM custom-element tag the current platform's native map mounts into. */
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
  config: { center: LatLng; zoom: number; minZoom?: number };
}

/** Provider-neutral handle over the native map, exposing only what the route needs. */
export interface MapHandle {
  setOnCameraIdleListener(callback: (data: CameraIdleData) => void): Promise<void>;
  setOnMarkerClickListener(callback: (data: MarkerClickData) => void): Promise<void>;
  getMapBounds(): Promise<ProviderBounds>;
  setCamera(config: { coordinate?: LatLng; zoom?: number }): Promise<void>;
  addMarkers(markers: ProviderMarker[]): Promise<string[]>;
  removeMarkers(ids: string[]): Promise<void>;
  enableClustering(): Promise<void>;
  disableClustering(): Promise<void>;
  destroy(): Promise<void>;
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
      setOnMarkerClickListener: (cb) => map.setOnMarkerClickListener((d) => cb({ markerId: d.markerId })),
      getMapBounds: async () => normaliseBounds(await map.getMapBounds()),
      setCamera: (config) => map.setCamera(config),
      // MapKit sizes the annotation image; without a size the raw PNG pixels are
      // used, which is tiny on a hi-DPI screen. 30×36 matches the pin art.
      addMarkers: (markers) => map.addMarkers(markers.map((m) => ({ coordinate: m.coordinate, iconUrl: m.iconUrl, iconSize: { width: 30, height: 36 } }))),
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
    setOnMarkerClickListener: (cb) => map.setOnMarkerClickListener((d) => cb({ markerId: d.markerId })),
    getMapBounds: async () => normaliseBounds((await map.getMapBounds()) as unknown as ProviderBounds),
    setCamera: (config) => map.setCamera(config),
    // The Google pin art is anchored by its tip: half its width across, its full
    // height down — the value the route used before this abstraction existed.
    addMarkers: (markers) => map.addMarkers(markers.map((m) => ({ coordinate: m.coordinate, iconUrl: m.iconUrl, iconAnchor: { x: 15, y: 45 } }))),
    removeMarkers: (ids) => map.removeMarkers(ids),
    enableClustering: () => map.enableClustering(),
    disableClustering: () => map.disableClustering(),
    destroy: () => map.destroy()
  };
}
