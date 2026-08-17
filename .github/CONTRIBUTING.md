# 🚀 Contributing

## Prerequisites

- Node.js 22+
- npm
- For iOS: Xcode 26+ and a macOS machine
- For Android: Android Studio and JDK 21

## Setup

```bash
git clone https://github.com/bmlt-enabled/BMLTSearchSvelte.git
cd BMLTSearchSvelte
npm install
cp .env.example .env      # then add your Google Maps keys
npm run dev               # http://localhost:5173
```

A checkout with no keys still builds, type-checks, and runs — only the map screen
is unavailable, and it says so rather than failing silently.

Run `npm run all` before pushing; CI enforces the same checks.

## Commands

```bash
npm run dev        # Vite dev server with HMR
npm run dev:host   # Same, exposed on the LAN for on-device testing
npm run build      # Production build into build/
npm run preview    # Serve the production build
npm run check      # svelte-check — types across .svelte and .ts
npm run lint       # Prettier check + ESLint
npm run format     # Prettier write
npm test           # Vitest
npm run coverage   # Vitest with a v8 coverage report
npm run all        # format → lint → check → test → build
npm run ios        # Build, sync, open Xcode
npm run android    # Build, sync, open Android Studio
npm run assets     # Regenerate native icons and splashes from assets/
```

## Tech Stack

| Category  | Technology                         |
| --------- | ---------------------------------- |
| Framework | SvelteKit 2 + Svelte 5 (runes API) |
| Build     | Vite + `adapter-static`            |
| Styling   | Tailwind CSS 4                     |
| Native    | Capacitor 8 (iOS + Android)        |
| Maps      | Google Maps                        |
| Language  | TypeScript 5 (strict)              |
| Testing   | Vitest + @testing-library/svelte   |
| Linting   | ESLint + Prettier + svelte-check   |
| PWA       | `@vite-pwa/sveltekit`              |

No component library — every UI primitive in `src/lib/components/` is hand-written.

## Project Structure

```
src/lib/
  api/            HTTP against the root servers, plus Google Geocoding
    http.ts       The single request path — CapacitorHttp, so native avoids CORS
    bmlt.ts       Every BMLT endpoint the app calls
    formats.ts    Format id/code → readable name, cached
    geocode.ts    Address ⇄ coordinates
  meetings/       Pure domain logic, no framework, fully unit-tested
    time.ts       Wall-clock arithmetic — start, end, sort and filter keys
    kind.ts       In-person / virtual / hybrid / temporarily closed
    list.ts       Decorate, sort, group by weekday, filter
    address.ts    Address lines and the BMLT delimiter quirk
    share.ts      Share-sheet payload
  maps/           Key selection, SDK loading, REST fallback, marker grouping
  i18n/           Nine languages, bundled
  stores/         Settings, loading, drawer — Svelte 5 runes
  components/     Every UI primitive; no component library
src/routes/       One directory per screen
ios/ android/     Committed native projects — see below
```

The domain logic in `src/lib/meetings/` has no Svelte, no network, and no
`Date.now()` in its hot paths, so it is tested directly. That is where the
behaviour worth trusting lives — if you are writing date maths or classification
inside a `.svelte` file, it is in the wrong place.

## Two root servers, not one

The app searches two separate BMLT databases, and the distinction runs all the
way down through the code:

- **Tomato** (`aggregator.bmltenabled.org`) — the worldwide aggregator. In-person
  and hybrid meetings.
- **Virtual NA** (`bmlt.virtual-na.org`) — online-only meetings.

A meeting lives in one or the other, never both. They differ in how formats are
keyed, which is why `MeetingSource` is threaded through format resolution and
meeting classification rather than inferred. See `src/lib/api/bmlt.ts`.

## Google Maps keys

**Three of them**, because Google allows a key exactly one _application_
restriction — Websites, or iOS apps, or Android apps, never a combination.

| Variable                               | Restriction                                      | APIs                                          | Used by                                            |
| -------------------------------------- | ------------------------------------------------ | --------------------------------------------- | -------------------------------------------------- |
| `PUBLIC_GOOGLE_MAPS_KEY_WEB`           | Websites                                         | Maps JavaScript, Places (New), Geocoding      | Everything, on the web only                        |
| `PUBLIC_GOOGLE_MAPS_KEY_IOS`           | iOS apps — `app.bmlt.search`                     | Maps SDK for iOS, Places (New), Geocoding     | Map, autocomplete and geocoding on iOS             |
| `PUBLIC_GOOGLE_MAPS_KEY_ANDROID`       | Android apps — `app.bmlt.search` + signing SHA-1 | Maps SDK for Android, Places (New), Geocoding | Map, autocomplete and geocoding on Android         |
| `PUBLIC_GOOGLE_MAPS_ANDROID_CERT_SHA1` | —                                                | —                                             | Proves the Android signature to the REST endpoints |

These are **public** variables: inlined into the client bundle and readable by
anyone using the app. That is inherent to client-side Maps keys — what protects
them is restriction, not secrecy. See [SECURITY.md](SECURITY.md).

Use a **different web key for local development** than the one production builds
with, so neither referrer list has to carry the other's origins:

| Environment      | Referrers                                            |
| ---------------- | ---------------------------------------------------- |
| Local `.env`     | `http://localhost:5173/*`, `http://localhost:4173/*` |
| Cloudflare Pages | `https://app.bmlt.app/*`                             |

Android additionally needs its key at the Gradle level, from
`GOOGLE_MAPS_KEY_ANDROID` or `googleMapsKeyAndroid` in
`android/local.properties`, because the Maps SDK for Android reads the manifest
rather than the `apiKey` passed to `GoogleMap.create()`.

### Why native does not use the JS SDK

Autocomplete and geocoding take a different path on device than on the web, and
the reason is worth stating plainly because the obvious approach does not work.

Inside a Capacitor webview there is no origin Google will accept. Its guidance is
explicit: _"API key website restrictions are not guaranteed to work correctly,
unless your web app is loaded using HTTP or HTTPS from a website that you control
and have authorized."_ A bundle served from `localhost` is not that, so a
referrer-restricted key is unsupported there — not merely weak.

The native SDKs are not an option either: `@capacitor/google-maps` wraps the Maps
SDK only, with no Places or geocoding surface. The community proposal for a
Places plugin ([capacitor-community/proposals#111], April 2021) was closed
unimplemented, and the request against the Maps plugin
([ionic-team/capacitor-google-maps#111], June 2022) is still open and unanswered.

So on device the app calls the Places and Geocoding **REST** endpoints with the
platform key and an app-identity header — `X-Ios-Bundle-Identifier`, or
`X-Android-Package` plus `X-Android-Cert`. This is Google's documented mechanism
for app-restricted keys over HTTP, and these are the same endpoints the JS SDK
calls internally: Places API (New) _is_ the REST API and the SDKs are clients for
it. The restriction is genuinely enforced — the same request without the header
returns `403 API_KEY_IOS_APP_BLOCKED`.

Google's strongest recommendation is a proxy server holding the key server-side.
That remains open: `PLACES_BASE` and `GEOCODE_BASE` in `src/lib/maps/rest.ts` are
two constants precisely so they can be pointed at our own origin, dropping the
key and headers, without touching any caller. It is not done yet because it would
protect only Places and Geocoding — the map view needs the key in-app regardless
— while giving the native app a hard runtime dependency on our web
infrastructure.

### Why the web path uses `@googlemaps/js-api-loader`

Loading the SDK with a hand-rolled script tag and resolving on `onload` is subtly
wrong. Under `loading=async` the file that arrives is only a bootstrap: at
`onload` `google.maps` exists but `google.maps.Geocoder` does not, and
`google.maps.importLibrary` is not yet defined either. Every caller wraps its work
in a try/catch and reports failure as "no result", so the resulting TypeError was
invisible — reverse geocoding silently returned null on a cold page load and
worked on a warm one. Google's loader handles readiness properly and hands back
typed library objects.

[capacitor-community/proposals#111]: https://github.com/capacitor-community/proposals/issues/111
[ionic-team/capacitor-google-maps#111]: https://github.com/ionic-team/capacitor-google-maps/issues/111

## Native

Capacitor wraps the same static bundle. Every route is prerendered
(`+layout.ts`), because there is no server inside a webview.

`CapacitorHttp` rather than `fetch` for BMLT calls: the root servers do not send
permissive CORS headers, and an in-webview `fetch` is blocked outright on device.

`ios/` and `android/` **are committed**. They hold hand-written configuration
that `npx cap add` does not regenerate — the Maps key wiring, the location
permission strings, the manifest placeholders, the privacy manifest, and the
shared Xcode scheme. Only build products are ignored. `npx cap sync` is enough
after a dependency change; do not regenerate them wholesale.

Two things the Capacitor map plugin will mislead you about are documented in
[AGENTS.md](../AGENTS.md) — read it before touching the map screen.

## Testing

132 unit tests over the domain logic — time arithmetic, meeting classification,
grouping and filtering, the service body tree, marker clustering, the share
payload, the HTTP wrapper's handling of BMLT's quirks, and translation coverage.

```bash
npm test
npm run coverage
```

Types and tests do not catch the failures this app actually has. A blank map, an
autocomplete that silently returns nothing, a search that never fires — all were
invisible to both. **For anything user-facing, run it**, and for anything
touching the map or a native plugin, run it on a device.

## Translations

Nine languages in `src/lib/i18n/locales/`: flat JSON, one key per string.
**Bundled**, not fetched — all nine together are under 40 KB, and loading them
over HTTP meant every screen painted raw keys until the request landed.

English is the source. Add new strings to `en.json` only; the other eight fall
back to English, then to the key itself, until a translator catches up. Persian
is right-to-left, and `<html dir>` is set from the active locale.

A translation fix is a welcome first contribution — edit the relevant
`locales/{code}.json` and open a PR.

## CI/CD

| Workflow             | Trigger            | Action                                               |
| -------------------- | ------------------ | ---------------------------------------------------- |
| `ci.yml`             | Push / PR          | Lint, type-check, test, and prove the build compiles |
| `android.yml`        | Manual or `v*` tag | Signed release APK + AAB as downloadable artifacts   |
| `ios-testflight.yml` | Manual or `v*` tag | Archive, export, and upload to TestFlight            |

**Web** deploys separately: Cloudflare Pages builds
[app.bmlt.app](https://app.bmlt.app) from `main`. The project is declared in
[bmlt-enabled/cloudflare-pages](https://github.com/bmlt-enabled/cloudflare-pages),
which also holds the Maps key as a Pages environment variable. `ci.yml` does not
deploy.

### Releasing

Pushing a `v*` tag builds both apps and uploads iOS to TestFlight:

```bash
git tag v6.0.1 && git push origin v6.0.1
```

The tag sets the version. Android's `versionCode` comes from the workflow run
number (Play permanently refuses a code it has already accepted, and run numbers
only ever increase); `versionName` and iOS's `MARKETING_VERSION` come from the tag
with the leading `v` stripped. A manual run stamps `0.0.0-dev` so it cannot be
mistaken for a release.

macOS runners bill at a 10× multiplier and every TestFlight upload creates a
permanent build record — build numbers cannot be reused, and builds can be
expired but never deleted. Tag deliberately.

### Identifiers

|                       |                                   |
| --------------------- | --------------------------------- |
| Bundle ID             | `app.bmlt.search`                 |
| Android applicationId | `app.bmlt.search`                 |
| Apple team            | `APPLE_TEAM_ID` repository secret |

The Apple team ID is supplied by CI rather than committed, so `DEVELOPMENT_TEAM`
is blank in the Xcode project and `ios/App/ExportOptions.plist` carries no
`teamID`. Building locally in Xcode means picking your own team under Signing &
Capabilities — which is what a fork wants anyway.

**A bundle ID is claimed permanently.** Once App Store Connect has seen one it
cannot be released, reclaimed, or registered by anyone else, and moving the app
between Apple accounts later takes an Apple **app transfer**, not a config
change. Changing it means editing `capacitor.config.ts`,
`ios/App/App.xcodeproj/project.pbxproj`, `android/app/build.gradle`,
`android/app/src/main/res/values/strings.xml`, the Java package directory under
`android/app/src/main/java/`, and `BUNDLE_ID` in the iOS workflow. Cheap now,
impossible after the first upload.

### Required repository secrets

| Secret                          | Notes                                            |
| ------------------------------- | ------------------------------------------------ |
| `GOOGLE_MAPS_KEY_WEB`           | Websites-restricted key                          |
| `GOOGLE_MAPS_KEY_IOS`           | iOS-apps-restricted key                          |
| `GOOGLE_MAPS_KEY_ANDROID`       | Android-apps-restricted key                      |
| `GOOGLE_MAPS_ANDROID_CERT_SHA1` | SHA-1 registered on the Android Maps key         |
| `APPLE_TEAM_ID`                 | 10-character Apple team ID; kept out of the tree |
| `APPSTORE_ISSUER_ID`            | App Store Connect API issuer for the team        |
| `APPSTORE_KEY_ID`               | ASC API key id                                   |
| `APPSTORE_PRIVATE_KEY`          | The `.p8`, contents inline                       |
| `IOS_DIST_CERT_P12_BASE64`      | Distribution `.p12`, base64                      |
| `IOS_DIST_CERT_PASSWORD`        | Password for that `.p12`                         |
| `ANDROID_KEYSTORE_BASE64`       | Upload keystore, base64                          |
| `ANDROID_KEYSTORE_PASSWORD`     | Keystore password                                |
| `ANDROID_KEY_ALIAS`             | Key alias (defaults to `upload`)                 |
| `ANDROID_KEY_PASSWORD`          | Key password                                     |

The four Apple secrets are per-team, not per-app, so a team that already has them
configured on another repository reuses the same values verbatim.

The Android keystore is irreplaceable: its SHA-1 is what the Maps key is
restricted to, so an APK signed with any other key shows a blank map.
