import { CapacitorHttp } from '@capacitor/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BmltError, getJsonArray, query } from '$lib/api/http';

vi.mock('@capacitor/core', () => ({
  CapacitorHttp: { get: vi.fn() }
}));

const get = vi.mocked(CapacitorHttp.get);

// Block body, not a concise one: `mockReset()` returns the mock for chaining, and
// vitest treats a function returned from a hook as that hook's teardown callback.
// Returning it here made vitest *call the mock* after every test.
beforeEach(() => {
  get.mockReset();
});

function respond(data: unknown, status = 200) {
  get.mockResolvedValue({ data, status, headers: {}, url: 'https://example.test' });
}

describe('query', () => {
  it('encodes values and drops empty ones', () => {
    expect(query({ a: 'x y', b: 3, c: undefined, d: null, e: '' })).toBe('a=x%20y&b=3');
  });
});

describe('getJsonArray', () => {
  it('returns the array as sent', async () => {
    respond([{ id_bigint: '1' }]);
    await expect(getJsonArray('https://example.test')).resolves.toEqual([{ id_bigint: '1' }]);
  });

  it('treats BMLT’s empty-result object as an empty list', async () => {
    // The root servers answer `{}` rather than `[]` when nothing matches. Every
    // caller in the Ionic build re-discovered this for itself.
    respond({});
    await expect(getJsonArray('https://example.test')).resolves.toEqual([]);
  });

  it('parses a body handed back as a string', async () => {
    respond('[{"id_bigint":"7"}]');
    await expect(getJsonArray('https://example.test')).resolves.toEqual([{ id_bigint: '7' }]);
  });

  it('treats an empty string body as an empty list', async () => {
    respond('   ');
    await expect(getJsonArray('https://example.test')).resolves.toEqual([]);
  });

  it('throws on a non-2xx status rather than reporting no meetings', async () => {
    respond([], 503);
    await expect(getJsonArray('https://example.test')).rejects.toBeInstanceOf(BmltError);
  });

  it('throws when the body is not JSON', async () => {
    respond('<html>maintenance</html>');
    await expect(getJsonArray('https://example.test')).rejects.toBeInstanceOf(BmltError);
  });

  it('wraps a transport failure', async () => {
    get.mockRejectedValue(new Error('offline'));
    await expect(getJsonArray('https://example.test')).rejects.toBeInstanceOf(BmltError);
  });
});
