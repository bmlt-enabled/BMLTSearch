import { describe, expect, it } from 'vitest';
import { distanceKm, coordinateKey, isValidLatLng } from '$lib/geo';
import { buildMarkers, iconFor, SHARED_ICON, SINGLE_ICON } from '$lib/maps/markers';
import type { RawMeeting } from '$lib/types';

function at(id: string, lat: string, lng: string): RawMeeting {
  return { id_bigint: id, latitude: lat, longitude: lng, weekday_tinyint: '1', start_time: '19:00' };
}

describe('distanceKm', () => {
  it('is zero for the same point', () => {
    expect(distanceKm({ lat: 51.5, lng: -0.12 }, { lat: 51.5, lng: -0.12 })).toBe(0);
  });

  it('matches the known London–Paris great-circle distance', () => {
    const km = distanceKm({ lat: 51.5074, lng: -0.1278 }, { lat: 48.8566, lng: 2.3522 });
    expect(km).toBeGreaterThan(340);
    expect(km).toBeLessThan(346);
  });

  it('is symmetric', () => {
    const a = { lat: 34.05, lng: -118.24 };
    const b = { lat: 40.71, lng: -74.01 };
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 6);
  });
});

describe('isValidLatLng', () => {
  it('rejects out-of-range and non-finite values', () => {
    expect(isValidLatLng({ lat: 91, lng: 0 })).toBe(false);
    expect(isValidLatLng({ lat: 0, lng: 181 })).toBe(false);
    expect(isValidLatLng({ lat: Number.NaN, lng: 0 })).toBe(false);
    expect(isValidLatLng(null)).toBe(false);
    expect(isValidLatLng({ lat: 51.5, lng: -0.12 })).toBe(true);
  });
});

describe('coordinateKey', () => {
  it('rounds to three decimals, so ~110 m apart is the same place', () => {
    expect(coordinateKey(51.50731, -0.12776)).toBe(coordinateKey(51.5073, -0.12781));
  });
});

describe('buildMarkers', () => {
  it('gives a lone meeting its own pin', () => {
    const markers = buildMarkers([at('1', '51.5074', '-0.1278')]);
    expect(markers).toHaveLength(1);
    expect(markers[0].ids).toEqual(['1']);
    expect(iconFor(markers[0])).toBe(SINGLE_ICON);
  });

  it('collapses meetings at one venue into a single pin carrying every id', () => {
    const markers = buildMarkers([at('1', '51.5074', '-0.1278'), at('2', '51.5074', '-0.1278'), at('3', '51.50741', '-0.12779')]);
    expect(markers).toHaveLength(1);
    expect(markers[0].ids).toEqual(['1', '2', '3']);
    expect(iconFor(markers[0])).toBe(SHARED_ICON);
  });

  it('keeps the last meeting of a co-located run', () => {
    // The Ionic scan walked a mutable index into a nested do…while and read one
    // past the end, dropping the final meeting of every group.
    const markers = buildMarkers([at('1', '51.5074', '-0.1278'), at('2', '51.5074', '-0.1278'), at('3', '48.8566', '2.3522')]);
    const ids = markers.flatMap((marker) => marker.ids).sort();
    expect(ids).toEqual(['1', '2', '3']);
  });

  it('does not depend on co-located meetings arriving adjacently', () => {
    const markers = buildMarkers([at('1', '51.5074', '-0.1278'), at('2', '48.8566', '2.3522'), at('3', '51.5074', '-0.1278')]);
    expect(markers).toHaveLength(2);
    expect(markers.find((marker) => marker.ids.length === 2)?.ids).toEqual(['1', '3']);
  });

  it('skips records with unusable coordinates', () => {
    expect(buildMarkers([at('1', '', ''), at('2', 'nope', '3')])).toEqual([]);
  });

  it('is empty for an empty result set', () => {
    expect(buildMarkers([])).toEqual([]);
  });
});
