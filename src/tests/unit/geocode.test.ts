import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
  Which geocoder answers on which platform.

  This exists because the iOS branch once did not: iOS holds no Google key, the
  native path went to Google REST anyway, `mapKey()` was empty, and every lookup
  resolved `null` without a sound. The locate button searched correctly and the
  heading read "10 meetings nearest" with nothing after it. Nothing failed, so
  nothing caught it. These tests pin the routing so it cannot quietly regress.
*/

const mocks = vi.hoisted(() => ({
  platform: vi.fn<() => 'ios' | 'android' | 'web'>(),
  appleReverse: vi.fn(),
  appleForward: vi.fn(),
  restReverse: vi.fn(),
  restForward: vi.fn(),
  mapKey: vi.fn<() => string>()
}));

vi.mock('$lib/native', () => ({ platform: mocks.platform, isNative: () => mocks.platform() !== 'web' }));
vi.mock('capacitor-plugin-apple-maps', () => ({ reverseGeocode: mocks.appleReverse, geocode: mocks.appleForward }));
vi.mock('$lib/maps/rest', () => ({ reverseGeocode: mocks.restReverse, forwardGeocode: mocks.restForward }));
vi.mock('$lib/maps/keys', () => ({ mapKey: mocks.mapKey }));
vi.mock('$lib/maps/mapkit', () => ({ loadMapKit: vi.fn().mockRejectedValue(new Error('no MapKit in tests')), mapKitConfigured: () => false }));

const { forwardGeocode, geocodingAvailable, reverseGeocode } = await import('$lib/api/geocode');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mapKey.mockReturnValue('');
});

describe('on iOS', () => {
  beforeEach(() => mocks.platform.mockReturnValue('ios'));

  it('reverse geocodes through the Apple plugin, never Google', async () => {
    mocks.appleReverse.mockResolvedValue({ address: '1 Main St, Cork, Ireland', locality: 'Cork' });
    await expect(reverseGeocode(51.8655, -8.4613, 'en')).resolves.toBe('1 Main St, Cork, Ireland');
    expect(mocks.appleReverse).toHaveBeenCalledWith({ latitude: 51.8655, longitude: -8.4613, language: 'en' });
    expect(mocks.restReverse).not.toHaveBeenCalled();
  });

  it('resolves null, not an empty string or a throw, when Apple finds nothing', async () => {
    mocks.appleReverse.mockResolvedValue({});
    await expect(reverseGeocode(0, 0)).resolves.toBeNull();
    mocks.appleReverse.mockRejectedValue(new Error('plugin missing'));
    await expect(reverseGeocode(0, 0)).resolves.toBeNull();
  });

  it('forward geocodes through the Apple plugin and maps the coordinates', async () => {
    mocks.appleForward.mockResolvedValue({ latitude: 51.9, longitude: -8.47, address: 'Cork, Ireland' });
    await expect(forwardGeocode('Cork', 'en')).resolves.toEqual({ lat: 51.9, lng: -8.47 });
    expect(mocks.restForward).not.toHaveBeenCalled();
  });

  it('forward geocoding resolves null without coordinates or on failure', async () => {
    mocks.appleForward.mockResolvedValue({});
    await expect(forwardGeocode('nowhere')).resolves.toBeNull();
    mocks.appleForward.mockRejectedValue(new Error('offline'));
    await expect(forwardGeocode('nowhere')).resolves.toBeNull();
  });

  it('is available with no key at all', () => {
    expect(geocodingAvailable()).toBe(true);
  });
});

describe('on Android', () => {
  beforeEach(() => mocks.platform.mockReturnValue('android'));

  it('uses Google REST and never the Apple plugin', async () => {
    mocks.restReverse.mockResolvedValue('1 Main St');
    mocks.restForward.mockResolvedValue({ lat: 1, lng: 2 });
    await expect(reverseGeocode(1, 2, 'en')).resolves.toBe('1 Main St');
    await expect(forwardGeocode('1 Main St', 'en')).resolves.toEqual({ lat: 1, lng: 2 });
    expect(mocks.appleReverse).not.toHaveBeenCalled();
    expect(mocks.appleForward).not.toHaveBeenCalled();
  });

  it('is available only with its key', () => {
    expect(geocodingAvailable()).toBe(false);
    mocks.mapKey.mockReturnValue('key');
    expect(geocodingAvailable()).toBe(true);
  });
});

describe('on the web', () => {
  beforeEach(() => mocks.platform.mockReturnValue('web'));

  it('uses neither native path, and fails soft when MapKit is not there', async () => {
    await expect(reverseGeocode(1, 2)).resolves.toBeNull();
    expect(mocks.appleReverse).not.toHaveBeenCalled();
    expect(mocks.restReverse).not.toHaveBeenCalled();
  });
});

it('an empty address is never sent anywhere', async () => {
  mocks.platform.mockReturnValue('ios');
  await expect(forwardGeocode('   ')).resolves.toBeNull();
  expect(mocks.appleForward).not.toHaveBeenCalled();
});
