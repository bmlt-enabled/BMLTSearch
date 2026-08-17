import type { LatLng } from '../geo';
import { isMeetingMode, MEETING_MODES, type MeetingMode } from '../meetings/venue';

/**
 * User preferences and the last known location.
 *
 * The Ionic build kept these in `@ionic/storage` with the LocalStorage driver —
 * an async, IndexedDB-shaped API wrapped around synchronous `localStorage`,
 * which meant every screen opened with an `await` before it knew the reader's
 * search range and rendered a flash of defaults first. Reading `localStorage`
 * directly removes both the wrapper and the flash.
 */

const KEYS = {
  searchRange: 'bmltsearch.searchRange',
  location: 'bmltsearch.location',
  modes: 'bmltsearch.modes'
} as const;

/** Bounds of the search-range slider, in meetings. */
export const MIN_SEARCH_RANGE = 5;
export const MAX_SEARCH_RANGE = 50;
export const DEFAULT_SEARCH_RANGE = 25;

/** The last place we searched from, with the address we managed to resolve for it. */
export interface SavedLocation extends LatLng {
  address: string;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage disabled. The app works fine for this session; it just forgets.
  }
}

function clampRange(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SEARCH_RANGE;
  return Math.min(MAX_SEARCH_RANGE, Math.max(MIN_SEARCH_RANGE, Math.round(value)));
}

class Settings {
  /**
   * How many meetings a "nearest" search returns.
   *
   * This is a count, not a distance — BMLT's negative `geo_width_km` mode takes
   * the magnitude as a result count. See `nearestMeetings` in api/bmlt.ts.
   */
  #searchRange = $state(DEFAULT_SEARCH_RANGE);
  #location = $state<SavedLocation | null>(null);
  /**
   * Which kinds of meeting the geographic searches ask for. Both by default, so
   * a reader who never touches the filter sees exactly what they saw before.
   */
  #modes = $state<MeetingMode[]>([...MEETING_MODES]);

  get modes(): MeetingMode[] {
    return this.#modes;
  }

  set modes(value: MeetingMode[]) {
    this.#modes = MEETING_MODES.filter((mode) => value.includes(mode));
    write(KEYS.modes, this.#modes.join(','));
  }

  get searchRange(): number {
    return this.#searchRange;
  }

  set searchRange(value: number) {
    this.#searchRange = clampRange(value);
    write(KEYS.searchRange, String(this.#searchRange));
  }

  get location(): SavedLocation | null {
    return this.#location;
  }

  /** Remember where the reader searched from, so the next screen opens there. */
  setLocation(location: SavedLocation): void {
    this.#location = location;
    write(KEYS.location, JSON.stringify(location));
  }

  /** Update just the address, once reverse geocoding catches up with the fix. */
  setAddress(address: string): void {
    if (!this.#location) return;
    this.setLocation({ ...this.#location, address });
  }

  init(): void {
    const range = Number.parseInt(read(KEYS.searchRange) ?? '', 10);
    this.#searchRange = Number.isNaN(range) ? DEFAULT_SEARCH_RANGE : clampRange(range);

    // An absent entry means "never chosen", which is both modes — not none.
    const modes = read(KEYS.modes);
    if (modes !== null) {
      this.#modes = modes.split(',').filter(isMeetingMode);
    }

    const raw = read(KEYS.location);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<SavedLocation>;
      if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
        this.#location = { lat: parsed.lat, lng: parsed.lng, address: parsed.address ?? '' };
      }
    } catch {
      // Corrupt entry from an older build — start clean rather than crash.
    }
  }
}

export const settings = new Settings();
