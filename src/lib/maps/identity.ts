import { platform } from '../native';

/**
 * Proving to Google which app a request came from.
 *
 * On device the app talks to the Places and Geocoding REST endpoints directly,
 * authenticated by an *application-restricted* key — bundle ID on iOS, package
 * name plus signing certificate on Android. Google's documented way to present
 * that identity over HTTP is these headers:
 *
 *   https://developers.google.com/maps/api-security-best-practices
 *
 * This is the mechanism that makes an app-restricted key usable outside the
 * native SDKs, and it is genuinely enforced: the same request without the header
 * comes back `403 API_KEY_IOS_APP_BLOCKED`. Google explicitly tells you to
 * verify exactly that before relying on it, which is what the unit tests and a
 * manual check against the live API confirmed.
 *
 * The alternative — an HTTP-referrer-restricted key used from the webview — is
 * not merely weaker, it is unsupported: "API key website restrictions are not
 * guaranteed to work correctly, unless your web app is loaded using HTTP or
 * HTTPS from a website that you control and have authorized." A Capacitor
 * webview served from localhost is not that.
 */

/**
 * Must match `appId` in capacitor.config.ts, which is what actually ends up in
 * the built app. A unit test asserts the two agree, so a rename cannot silently
 * break device requests.
 */
export const APP_ID = 'app.bmlt.search';

/**
 * SHA-1 of the certificate that signed the running Android build.
 *
 * Android's restriction checks package name *and* signature, so this has to be
 * the fingerprint of the keystore that actually signed the APK — the debug
 * keystore locally, the upload or Play app-signing certificate for a release.
 * The app cannot read its own signature from JavaScript, so it is supplied at
 * build time. Colons are stripped and case normalised because the console
 * displays it colon-separated while the header wants it bare.
 */
const ANDROID_CERT_SHA1 = (import.meta.env.PUBLIC_GOOGLE_MAPS_ANDROID_CERT_SHA1 ?? '').replace(/[:\s]/g, '').toUpperCase();

/** Headers identifying this app to Google. Empty on the web, where the referrer does the job. */
export function appIdentityHeaders(): Record<string, string> {
  switch (platform()) {
    case 'ios':
      return { 'X-Ios-Bundle-Identifier': APP_ID };
    case 'android': {
      const headers: Record<string, string> = { 'X-Android-Package': APP_ID };
      // Sent only when configured. Without it Android requests are rejected, but
      // an empty header is rejected just the same and reads as a bug rather than
      // as missing configuration.
      if (ANDROID_CERT_SHA1) headers['X-Android-Cert'] = ANDROID_CERT_SHA1;
      return headers;
    }
    default:
      return {};
  }
}

/** Whether this platform can actually satisfy its key's application restriction. */
export function canAuthenticateNatively(): boolean {
  switch (platform()) {
    case 'ios':
      return true;
    case 'android':
      return Boolean(ANDROID_CERT_SHA1);
    default:
      return false;
  }
}
