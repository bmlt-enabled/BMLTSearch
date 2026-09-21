import { beforeEach, describe as suite, expect, it, vi } from 'vitest';
import type { SavedLocation } from '$lib/stores/settings.svelte';

/*
  The address lookup behind "locate".

  A phone refines its fix for a few seconds after the tap, and every search
  calls `describe()` while the address is blank. Left alone that is a burst of
  geocoder calls for one place, which is precisely what Apple's CLGeocoder
  throttles — and a throttled lookup leaves the heading without an address.
*/

const mocks = vi.hoisted(() => ({
  getCurrentPosition: vi.fn(),
  reverseGeocode: vi.fn<(lat: number, lng: number, language: string) => Promise<string | null>>(),
  location: null as SavedLocation | null
}));

vi.mock('@capacitor/geolocation', () => ({ Geolocation: { getCurrentPosition: mocks.getCurrentPosition } }));
vi.mock('$lib/api/geocode', () => ({ reverseGeocode: mocks.reverseGeocode }));
vi.mock('$lib/i18n/index.svelte', () => ({ i18n: { locale: 'en' } }));
vi.mock('$lib/stores/settings.svelte', () => ({
  settings: {
    get location() {
      return mocks.location;
    },
    setLocation(value: SavedLocation) {
      mocks.location = value;
    },
    setAddress(address: string) {
      if (mocks.location) mocks.location = { ...mocks.location, address };
    }
  }
}));

const { describe, resetDescribe, resolveSearchOrigin } = await import('$lib/location');

const CORK = { lat: 51.8655, lng: -8.4613 };
/** About 11 m north of CORK: the same place, as a refined fix reports it. */
const CORK_REFINED = { lat: 51.8656, lng: -8.4613 };
const DUBLIN = { lat: 53.3498, lng: -6.2603 };

function fix(point: { lat: number; lng: number }) {
  mocks.getCurrentPosition.mockResolvedValue({ coords: { latitude: point.lat, longitude: point.lng } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  mocks.location = null;
  resetDescribe();
});

suite('locate', () => {
  it('asks for the address of a new fix, without waiting for it', async () => {
    fix(CORK);
    mocks.reverseGeocode.mockResolvedValue('Patrick St, Cork');
    const saved = await resolveSearchOrigin(true);
    expect(saved).toEqual({ ...CORK, address: '' });
    await vi.waitFor(() => expect(mocks.location?.address).toBe('Patrick St, Cork'));
    expect(mocks.reverseGeocode).toHaveBeenCalledTimes(1);
  });

  it('keeps the address when a refined fix is the same place, and asks nothing', async () => {
    mocks.location = { ...CORK, address: 'Patrick St, Cork' };
    fix(CORK_REFINED);
    const saved = await resolveSearchOrigin(true);
    expect(saved).toEqual({ ...CORK_REFINED, address: 'Patrick St, Cork' });
    expect(mocks.reverseGeocode).not.toHaveBeenCalled();
  });

  it('drops the address and asks again when the fix is somewhere else', async () => {
    mocks.location = { ...CORK, address: 'Patrick St, Cork' };
    fix(DUBLIN);
    mocks.reverseGeocode.mockResolvedValue("O'Connell St, Dublin");
    const saved = await resolveSearchOrigin(true);
    expect(saved.address).toBe('');
    await vi.waitFor(() => expect(mocks.location?.address).toBe("O'Connell St, Dublin"));
  });
});

suite('describe', () => {
  it('asks once for a burst of lookups of the same place', async () => {
    mocks.location = { ...CORK, address: '' };
    mocks.reverseGeocode.mockResolvedValue(null); // throttled, offline: nothing came back
    await Promise.all([describe(CORK), describe(CORK_REFINED), describe(CORK)]);
    expect(mocks.reverseGeocode).toHaveBeenCalledTimes(1);
  });

  it('tries again once the retry window has passed', async () => {
    vi.useFakeTimers();
    mocks.location = { ...CORK, address: '' };
    mocks.reverseGeocode.mockResolvedValueOnce(null).mockResolvedValueOnce('Patrick St, Cork');
    await describe(CORK);
    vi.advanceTimersByTime(31_000);
    await describe(CORK);
    expect(mocks.reverseGeocode).toHaveBeenCalledTimes(2);
    expect(mocks.location?.address).toBe('Patrick St, Cork');
  });

  it('does not wait to look up a different place', async () => {
    mocks.location = { ...CORK, address: '' };
    mocks.reverseGeocode.mockResolvedValue(null);
    await describe(CORK);
    await describe(DUBLIN);
    expect(mocks.reverseGeocode).toHaveBeenCalledTimes(2);
  });

  it('never attaches an address to a place the reader has since left', async () => {
    mocks.location = { ...CORK, address: '' };
    let answer: (address: string) => void = () => {};
    mocks.reverseGeocode.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const pending = describe(CORK);
    mocks.location = { ...DUBLIN, address: '' }; // moved the search while the lookup was out
    answer('Patrick St, Cork');
    await pending;
    expect(mocks.location.address).toBe('');
  });
});
