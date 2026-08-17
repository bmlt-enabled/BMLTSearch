import { CapacitorHttp } from '@capacitor/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { serviceBodyHasOwnMeetings, AGGREGATOR_ROOT } from '$lib/api/bmlt';

vi.mock('@capacitor/core', () => ({
  CapacitorHttp: { get: vi.fn() }
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
