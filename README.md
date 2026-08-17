# BMLT Search

Find Narcotics Anonymous meetings worldwide — in person, hybrid, and online —
from the [BMLT](https://bmlt.app/). Runs as a web app, an iOS app, and an Android
app from one codebase.

Built with **SvelteKit 2 + Svelte 5 + Tailwind 4 + Capacitor 8**. This is a
rewrite of [BMLTSearch3](https://github.com/bmlt-enabled/BMLTSearch3), which was
Ionic 8 + Angular. The user-facing feature set is the same; what changed is the
stack underneath and a number of long-standing bugs, listed at the bottom.

## Quick start

```bash
npm install
cp .env.example .env      # then add your Google Maps keys
npm run dev               # http://localhost:5173
```

Everything except the map screen works without keys.

## Commands

| Command            | Does                                                |
| ------------------ | --------------------------------------------------- |
| `npm run dev`      | Vite dev server with HMR                            |
| `npm run dev:host` | Same, exposed on the LAN for on-device testing      |
| `npm run build`    | Production build into `build/`                      |
| `npm run preview`  | Serve the production build                          |
| `npm run check`    | `svelte-check` — types across `.svelte` and `.ts`   |
| `npm run lint`     | Prettier check + ESLint                             |
| `npm run format`   | Prettier write                                      |
| `npm test`         | Vitest                                              |
| `npm run coverage` | Vitest with a v8 coverage report                    |
| `npm run all`      | format → lint → check → test → build                |
| `npm run ios`      | Build, sync, open Xcode                             |
| `npm run android`  | Build, sync, open Android Studio                    |
| `npm run assets`   | Regenerate native icons and splashes from `assets/` |

## Architecture

### Two root servers, not one

The app searches two separate BMLT databases, and the distinction runs all the
way down through the code:

- **Tomato** (`aggregator.bmltenabled.org`) — the worldwide aggregator. In-person
  and hybrid meetings.
- **Virtual NA** (`bmlt.virtual-na.org`) — online-only meetings.

A meeting lives in one or the other, never both. They differ in how formats are
keyed, which is why `MeetingSource` is threaded through format resolution and
meeting classification rather than inferred. See `src/lib/api/bmlt.ts`.

### Layout

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
  maps/           Google Maps SDK loading and marker grouping
  i18n/           Nine languages, bundled
  stores/         Settings, loading, drawer — Svelte 5 runes
  components/     Every UI primitive; no component library
src/routes/       One directory per screen
```

The domain logic in `src/lib/meetings/` has no Svelte, no network, and no
`Date.now()` in its hot paths, so it is tested directly. That is where the
behaviour worth trusting lives.

### Native

Capacitor wraps the same static bundle. Every route is prerendered
(`+layout.ts`), because there is no server inside a webview.

`CapacitorHttp` rather than `fetch` for BMLT calls: the root servers do not send
permissive CORS headers, and an in-webview `fetch` is blocked outright on device.

`ios/` and `android/` **are committed**. They hold hand-written configuration
that `npx cap add` does not regenerate — the Maps key wiring, the location
permission strings, the manifest placeholders. Only build products are ignored.

## The Google Maps keys

**Three of them**, because Google allows a key exactly one _application_
restriction — Websites, or iOS apps, or Android apps, never a combination.

| Variable                               | Restriction                                      | APIs                                          | Used by                                            |
| -------------------------------------- | ------------------------------------------------ | --------------------------------------------- | -------------------------------------------------- |
| `PUBLIC_GOOGLE_MAPS_KEY_WEB`           | Websites                                         | Maps JavaScript, Places (New), Geocoding      | Everything, on the web only                        |
| `PUBLIC_GOOGLE_MAPS_KEY_IOS`           | iOS apps — `app.bmlt.search`                     | Maps SDK for iOS, Places (New), Geocoding     | Map, autocomplete and geocoding on iOS             |
| `PUBLIC_GOOGLE_MAPS_KEY_ANDROID`       | Android apps — `app.bmlt.search` + signing SHA-1 | Maps SDK for Android, Places (New), Geocoding | Map, autocomplete and geocoding on Android         |
| `PUBLIC_GOOGLE_MAPS_ANDROID_CERT_SHA1` | —                                                | —                                             | Proves the Android signature to the REST endpoints |

The web key's referrer allowlist only needs the origins you actually serve from:

```
https://app.bmlt.app/*
http://localhost:5173/*        # npm run dev
http://localhost:4173/*        # npm run preview
```

These are **public** variables: inlined into the client bundle and readable by
anyone using the app. That is inherent to client-side Maps keys — what protects
them is restriction, not secrecy.

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
returns `403 API_KEY_IOS_APP_BLOCKED`, which is exactly the verification Google
tells you to perform before relying on it.

On the web the JS SDK is kept, because there the browser sends a real referrer
from a real origin and the restriction works as designed.

Google's strongest recommendation is a proxy server holding the key server-side.
That remains open: `PLACES_BASE` and `GEOCODE_BASE` in `src/lib/maps/rest.ts` are
two constants precisely so they can be pointed at our own origin, dropping the
key and headers, without touching any caller. It is not done yet because it would
protect only Places and Geocoding — the map view needs the key in-app regardless
— while giving the native app a hard runtime dependency on our web
infrastructure.

[capacitor-community/proposals#111]: https://github.com/capacitor-community/proposals/issues/111
[ionic-team/capacitor-google-maps#111]: https://github.com/ionic-team/capacitor-google-maps/issues/111

All three are optional. An unset key degrades to an empty string rather than
failing the build — the keys are read through `import.meta.env`, not
`$env/static/public`, precisely because the latter is a hard build error when a
variable _name_ is absent. Android additionally needs its key at the Gradle
level, from
`GOOGLE_MAPS_KEY_ANDROID` or `googleMapsKeyAndroid` in
`android/local.properties`, because the Maps SDK for Android reads the manifest
rather than the `apiKey` passed to `GoogleMap.create()`.

A checkout with no keys still builds and runs; only the map screen is
unavailable, and it says so rather than failing silently.

### Why the web path loads the SDK through `@googlemaps/js-api-loader`

Loading the SDK with a hand-rolled script tag and resolving on `onload` is
subtly wrong. Under `loading=async` the file that arrives is only a bootstrap:
at `onload` `google.maps` exists but `google.maps.Geocoder` does not, and
`google.maps.importLibrary` is not yet defined either. Every caller wraps its
work in a try/catch and reports failure as "no result", so the resulting
TypeError was invisible — reverse geocoding silently returned null on a cold
page load and worked on a warm one. Google's loader handles readiness properly
and hands back typed library objects, which is also how `@types/google.maps`
replaced an `any`-typed `google` global that had been hiding the same class of
error.

## Translations

Nine languages: English, French, Italian, Spanish, Danish, Polish, Portuguese,
Persian, Russian. The files in `src/lib/i18n/locales/` are carried over
unchanged from the Ionic build, so an existing translator's workflow still
applies — flat JSON, one key per string.

They are **bundled**, not fetched. All nine together are under 40 KB, and
loading them over HTTP meant every screen painted raw keys until the request
landed. Missing keys fall back to English, then to the key itself.

English is the source. If you add a string, add it to `en.json`; the other eight
fall back until a translator catches up.

Persian is right-to-left, and `<html dir>` is set from the active locale.

## Testing

97 unit tests over the domain logic — time arithmetic, meeting classification,
grouping and filtering, the service body tree, marker clustering, the share
payload, the HTTP wrapper's handling of BMLT's quirks, and translation coverage.

```bash
npm test
npm run coverage
```

The tests deliberately cover the parts that were wrong before. Several assert the
specific bug they replaced.

## What was fixed along the way

Behaviour that changed because the original was wrong, not because the stack did:

- **Virtual meeting times displayed the wrong hour.** The original converted a
  wall-clock time to an instant with `toZonedTime` and then formatted it again
  with `formatInTimeZone`, shifting it twice — a 19:00 London meeting read as
  05:00 to a New York user. Times are now the meeting's own clock, labelled with
  its zone.
- **Online meetings offered directions.** Virtual NA records rarely carry the
  `VM` format key, so they classified as in-person and got a Directions button
  pointing at nominal coordinates. Classification is now source-aware.
- **Virtual meetings showed no formats.** The Virtual NA browse screen passed
  `meetingType='regular'`, so format codes were looked up in the wrong scheme and
  the formats line came out blank.
- **The last meeting of every co-located map group was dropped.** The marker scan
  walked a mutable index into a nested `do…while` and read one past the end.
- **Service bodies vanished.** A body whose parent was absent from the response —
  routine on the aggregator — was silently discarded along with every meeting
  under it. Orphans are now promoted to the root.
- **The Virtual NA tree stopped at four levels.** Its template hand-unrolled four
  nested accordions; a fifth-level body rendered as an empty expandable. The tree
  is now recursive.
- **Phone-only meetings never showed their dial-in.** The button was nested
  inside a check for `virtual_meeting_link`.
- **Shared meetings read "NaN".** `shareText += + meeting.location_text` coerced
  the venue name to a number.
- **A failed search looked like no results.** The spinner was dismissed and an
  empty screen left behind — indistinguishable from "no meetings near you", which
  is the one wrong answer this app must not give. Failures now say so and offer a
  retry.
- **A meeting marked both temporarily closed and hybrid rendered a blank card.**
  The classification chain had no branch for that combination.
- **Overlapping searches fought over the spinner.** A single-promise guard meant
  a second request could dismiss the first one's overlay while work continued.
- **Persian rendered left-to-right.**

Two visible changes that are preferences rather than fixes: results now open on
today's meetings instead of a stack of closed bars, and the four search modes get
a permanent bottom bar instead of living behind the hamburger.

## Deployment

**Web** — Cloudflare Pages at [app.bmlt.app](https://app.bmlt.app), built from
this repository on every push to `main`. The project is declared in
[bmlt-enabled/cloudflare-pages](https://github.com/bmlt-enabled/cloudflare-pages)
(`terraform/terraform.tfvars`), which also holds the three Maps keys as Pages
environment variables. `.github/workflows/ci.yml` only lints, type-checks,
tests, and proves the build compiles — it does not deploy.

**iOS** — `.github/workflows/ios-testflight.yml`, triggered by hand or by a `v*`
tag. Archives, exports, and uploads to TestFlight. It is deliberately not on
every push: macOS runners bill at a 10× multiplier, and every upload creates a
permanent build record — build numbers cannot be reused, and builds can be
expired but never deleted.

### Identifiers

|                       |                                   |
| --------------------- | --------------------------------- |
| Bundle ID             | `app.bmlt.search`                 |
| Android applicationId | `app.bmlt.search`                 |
| Apple team            | `APPLE_TEAM_ID` repository secret |

The Apple team ID is supplied by CI rather than committed, so `DEVELOPMENT_TEAM`
is blank in the Xcode project and `ios/App/ExportOptions.plist` carries no
`teamID`. The workflow passes it to `xcodebuild` and writes it into the export
options at build time. Building locally in Xcode means picking your own team
under Signing & Capabilities — which is what a fork wants anyway.

The rewrite does **not** reuse `ie.nasouth.bmltsearch`; that identifier belongs to
the original publisher's Apple team and cannot be signed from another account, so
builds go out under a new one.

Two consequences worth being explicit about, because neither is reversible by
editing a config file:

- **A bundle ID is claimed permanently.** Once App Store Connect has seen one it
  cannot be released, reclaimed, or registered by anyone else. Moving the app
  between Apple accounts later takes an Apple **app transfer**, not a rebuild.
- **Existing users are not upgraded.** A different bundle ID is a different app
  on the store, so this installs alongside the current BMLT Search rather than
  replacing it.

Changing the identifier means editing `capacitor.config.ts`,
`ios/App/App.xcodeproj/project.pbxproj`, `android/app/build.gradle`,
`android/app/src/main/res/values/strings.xml`, the Java package directory under
`android/app/src/main/java/`, and `BUNDLE_ID` in the iOS workflow. Cheap now,
impossible after the first upload.

### Required repository secrets

| Secret                     | Notes                                            |
| -------------------------- | ------------------------------------------------ |
| `GOOGLE_MAPS_KEY_WEB`      | Websites-restricted key                          |
| `GOOGLE_MAPS_KEY_IOS`      | iOS-apps-restricted key                          |
| `GOOGLE_MAPS_KEY_ANDROID`  | Android-apps-restricted key                      |
| `APPLE_TEAM_ID`            | 10-character Apple team ID; kept out of the tree |
| `APPSTORE_ISSUER_ID`       | App Store Connect API issuer for the team        |
| `APPSTORE_KEY_ID`          | ASC API key id                                   |
| `APPSTORE_PRIVATE_KEY`     | The `.p8`, contents inline                       |
| `IOS_DIST_CERT_P12_BASE64` | Distribution `.p12`, base64                      |
| `IOS_DIST_CERT_PASSWORD`   | Password for that `.p12`                         |

The four Apple secrets are per-team, not per-app, so a team that already has them
configured on another repository reuses the same values verbatim.

## Licence

Same as the upstream project.
