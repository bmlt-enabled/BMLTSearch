/**
 * A hand-written, minimal ambient declaration for the slice of Apple MapKit JS
 * this app actually uses. MapKit JS ships no first-party types and the community
 * packages drift from the CDN build, so — as with the rest of `maps/` — the
 * surface is declared here, deliberately narrow: a Map, annotations, Search and
 * Geocoder, and the handful of options and events the web provider and place
 * search touch. Widen it only when a real call needs more.
 *
 * `mapkit` is a global installed by the CDN script; see `loadMapKit` in
 * `mapkit.ts`. Declared through `declare global` (with the trailing `export {}`
 * that makes this a module) to match app.d.ts — a bare ambient script file is
 * not picked up by this project's generated tsconfig. It must NOT be named
 * `mapkit.d.ts`: a `.d.ts` sitting next to `mapkit.ts` is treated as that
 * module's companion declaration and the globals here would be ignored.
 */

export {};

declare global {
  namespace mapkit {
    /** Initialise the library with an authorization token. Called once by the loader. */
    function init(options: { authorizationCallback: (done: (token: string) => void) => void; language?: string }): void;

    /** Library-level events. `error` fires on an authorization failure. */
    function addEventListener(type: 'error' | 'configuration-change', listener: (event: unknown) => void): void;

    /** Set once init has run and libraries are present. */
    const loadedLibraries: string[];

    class Coordinate {
      constructor(latitude: number, longitude: number);
      latitude: number;
      longitude: number;
    }

    class CoordinateSpan {
      constructor(latitudeDelta: number, longitudeDelta: number);
      latitudeDelta: number;
      longitudeDelta: number;
    }

    class CoordinateRegion {
      constructor(center: Coordinate, span: CoordinateSpan);
      center: Coordinate;
      span: CoordinateSpan;
    }

    class Padding {
      constructor(top: number, right: number, bottom: number, left: number);
    }

    /** The event object handed to a Map listener; only the fields we read. */
    interface MapEvent {
      annotation?: Annotation;
    }

    interface MapConstructorOptions {
      region?: CoordinateRegion;
      center?: Coordinate;
      colorScheme?: string;
      showsUserLocation?: boolean;
      showsUserLocationControl?: boolean;
      showsCompass?: string;
      showsScale?: string;
      showsZoomControl?: boolean;
      showsMapTypeControl?: boolean;
      isRotationEnabled?: boolean;
      showsPointsOfInterest?: boolean;
      padding?: Padding;
    }

    class Map {
      constructor(parent: Element | string, options?: MapConstructorOptions);
      region: CoordinateRegion;
      center: Coordinate;
      colorScheme: string;
      readonly element: Element;
      setRegionAnimated(region: CoordinateRegion, animate?: boolean): Map;
      setCenterAnimated(coordinate: Coordinate, animate?: boolean): Map;
      addAnnotations(annotations: Annotation[]): Annotation[];
      removeAnnotations(annotations: Annotation[]): Annotation[];
      addEventListener(type: string, listener: (event: MapEvent) => void): void;
      removeEventListener(type: string, listener: (event: MapEvent) => void): void;
      destroy(): void;
    }

    namespace Map {
      const ColorSchemes: { Light: string; Dark: string };
    }

    namespace FeatureVisibility {
      const Adaptive: string;
      const Hidden: string;
      const Visible: string;
    }

    class Annotation {
      coordinate: Coordinate;
      /** Caller payload — the app stores its marker id here to resolve a tap. */
      data: unknown;
      title: string;
      selected: boolean;
    }

    interface MarkerAnnotationOptions {
      color?: string;
      glyphColor?: string;
      glyphText?: string;
      title?: string;
      selected?: boolean;
      data?: unknown;
      clusteringIdentifier?: string;
    }

    class MarkerAnnotation extends Annotation {
      constructor(coordinate: Coordinate, options?: MarkerAnnotationOptions);
    }

    interface ImageAnnotationOptions {
      /** Scale factor → image URL, e.g. `{ 1: url, 2: url }`. */
      url: { [scale: number]: string };
      size?: { width: number; height: number };
      /** Offset of the image's centre from the coordinate, in CSS pixels. */
      anchorOffset?: DOMPoint;
      title?: string;
      data?: unknown;
      clusteringIdentifier?: string;
    }

    class ImageAnnotation extends Annotation {
      constructor(coordinate: Coordinate, options: ImageAnnotationOptions);
    }

    interface SearchOptions {
      region?: CoordinateRegion;
      coordinate?: Coordinate;
      language?: string;
      getsUserLocation?: boolean;
      includeAddresses?: boolean;
      includePointsOfInterest?: boolean;
    }

    interface SearchAutocompleteResult {
      /** e.g. `["First Church", "Charlotte, NC, United States"]`. */
      displayLines: string[];
      coordinate?: Coordinate;
    }

    interface Place {
      coordinate: Coordinate;
      name?: string;
      formattedAddress?: string;
      displayLines?: string[];
    }

    class Search {
      constructor(options?: SearchOptions);
      autocomplete(query: string, callback: (error: Error | null, data: { results: SearchAutocompleteResult[] }) => void, options?: SearchOptions): number;
      search(query: string | SearchAutocompleteResult, callback: (error: Error | null, data: { places: Place[] }) => void, options?: SearchOptions): number;
      cancel(id: number): boolean;
    }

    class Geocoder {
      constructor(options?: { language?: string; getsUserLocation?: boolean });
      reverseLookup(coordinate: Coordinate, callback: (error: Error | null, data: { results: Place[] }) => void): number;
      lookup(query: string, callback: (error: Error | null, data: { results: Place[] }) => void): number;
    }
  }

  interface Window {
    mapkit?: typeof mapkit;
  }
}
