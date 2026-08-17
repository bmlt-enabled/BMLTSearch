import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `platform()` decides which identity headers apply, so it is the one thing
// mocked here. Everything else is the real module.
const platform = vi.hoisted(() => vi.fn<() => 'ios' | 'android' | 'web'>());
vi.mock('$lib/native', () => ({ platform, isNative: () => platform() !== 'web' }));

const { APP_ID, appIdentityHeaders, canAuthenticateNatively } = await import('$lib/maps/identity');

beforeEach(() => {
  platform.mockReset();
});

describe('APP_ID', () => {
  it('matches the appId Capacitor actually builds with', () => {
    // The header has to carry the bundle identifier of the running app or Google
    // rejects the request, so a rename in capacitor.config.ts that missed this
    // constant would break every Places call on device — silently, since the
    // callers fail soft. This test is the link between the two.
    const config = readFileSync('capacitor.config.ts', 'utf8');
    const declared = /appId:\s*'([^']+)'/.exec(config)?.[1];
    expect(declared).toBe(APP_ID);
  });
});

describe('appIdentityHeaders', () => {
  it('sends the bundle identifier on iOS', () => {
    platform.mockReturnValue('ios');
    expect(appIdentityHeaders()).toEqual({ 'X-Ios-Bundle-Identifier': APP_ID });
  });

  it('sends package and certificate on Android', () => {
    platform.mockReturnValue('android');
    const headers = appIdentityHeaders();
    expect(headers['X-Android-Package']).toBe(APP_ID);
    // The cert is build-time configuration; present only when supplied.
    if (headers['X-Android-Cert'] !== undefined) {
      expect(headers['X-Android-Cert']).toMatch(/^[0-9A-F]+$/);
      expect(headers['X-Android-Cert']).not.toContain(':');
    }
  });

  it('sends nothing on the web, where the referrer identifies the caller', () => {
    platform.mockReturnValue('web');
    expect(appIdentityHeaders()).toEqual({});
  });
});

describe('canAuthenticateNatively', () => {
  it('is true on iOS, where the bundle id is always known', () => {
    platform.mockReturnValue('ios');
    expect(canAuthenticateNatively()).toBe(true);
  });

  it('is false on the web', () => {
    platform.mockReturnValue('web');
    expect(canAuthenticateNatively()).toBe(false);
  });
});
