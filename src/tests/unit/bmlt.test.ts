import { CapacitorHttp } from '@capacitor/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { serviceBodyHasOwnMeetings, nearestMeetings, meetingsWithinRadius, meetingsByIds, AGGREGATOR_ROOT } from '$lib/api/bmlt';

// `Capacitor` is needed because http.ts reaches native.ts for the platform (the
// custom User-Agent). `false` keeps these tests in web mode.
vi.mock('@capacitor/core', () => ({
  CapacitorHttp: { get: vi.fn() },
  Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' }
}));

const get = vi.mocked(CapacitorHttp.get);

beforeEach(() => {
  get.mockReset();
});

function respond(data: unknown, status = 200) {
  get.mockResolvedValue({ data, status, headers: {}, url: 'https://example.test' });
}

function requestedUrl(): string {
  return String(get.mock.calls[0]?.[0]?.url ?? '');
}

describe('serviceBodyHasOwnMeetings', () => {
  it('is false for a region that only contains areas', async () => {
    // The reported bug: expanding "Buckeye Region" offered a row for the region
    // itself, which opened a blank list because every meeting under it belongs
    // to one of its areas rather than to the region.
    respond([]);
    await expect(serviceBodyHasOwnMeetings('2348')).resolves.toBe(false);
  });

  it('is true for a region that holds a meeting directly', async () => {
    // "CANA" does, which is why its row worked and made the bug look inconsistent.
    respond([{ id_bigint: '183659' }]);
    await expect(serviceBodyHasOwnMeetings('1318')).resolves.toBe(true);
  });

  it('treats BMLT’s empty-result object as no meetings', async () => {
    // The root servers answer `{}` rather than `[]` when nothing matches. A
    // truthy object here would put the dead row back.
    respond({});
    await expect(serviceBodyHasOwnMeetings('2348')).resolves.toBe(false);
  });

  it('asks only for meetings belonging to that body, not its descendants', async () => {
    // `services` alone is exact; BMLT walks the tree only with `recursive=1`.
    // Passing it would report every region as non-empty and restore the bug.
    respond([]);
    await serviceBodyHasOwnMeetings('2348');
    const url = requestedUrl();
    expect(url).toContain('services=2348');
    expect(url).not.toContain('recursive');
  });

  it('requests a single field, so an empty answer costs almost nothing', async () => {
    respond([]);
    await serviceBodyHasOwnMeetings('2348');
    expect(requestedUrl()).toContain('data_field_key=id_bigint');
  });

  it('always probes the aggregator', () => {
    // There used to be a second root server and a `source` argument choosing
    // between them. One root now, so the probe takes an id and nothing else.
    respond([]);
    return serviceBodyHasOwnMeetings('1').then(() => {
      expect(requestedUrl().startsWith(AGGREGATOR_ROOT)).toBe(true);
    });
  });
});

describe('repeated keys', () => {
  /*
    Since iOS 17, `URL(string:)` — which CapacitorHttp hands the URL to — answers
    one illegal character by percent-encoding the whole string, `%` included. A
    literal `[` in `venue_types[]=1` therefore turned `sort_keys=a%2Cb` into
    `a%252Cb` on every iPhone, and the aggregator silently ignored the parameter.
  */
  const ILLEGAL_IN_A_QUERY = /[^A-Za-z0-9\-._~%&=]/;

  function requestedQuery(): string {
    return requestedUrl().split('?')[1] ?? '';
  }

  it('encodes the brackets on venue_types', async () => {
    respond([]);
    await nearestMeetings(32.78, -79.93, 25, ['1', '3']);
    expect(requestedUrl()).toContain('venue_types%5B%5D=1&venue_types%5B%5D=3');
    expect(requestedQuery()).not.toMatch(ILLEGAL_IN_A_QUERY);
  });

  it('keeps a radius search legal too', async () => {
    respond([]);
    await meetingsWithinRadius(32.78, -79.93, 10, ['1', '3']);
    expect(requestedQuery()).not.toMatch(ILLEGAL_IN_A_QUERY);
  });

  it('encodes the brackets on meeting_ids', async () => {
    respond([]);
    await meetingsByIds(['1', '2']);
    expect(requestedUrl()).toContain('meeting_ids%5B%5D=1&meeting_ids%5B%5D=2');
    expect(requestedQuery()).not.toMatch(ILLEGAL_IN_A_QUERY);
  });
});
