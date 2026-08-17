# AGENTS.md

Guidance for AI agents working in this repository. [README.md](README.md) is the
front door and [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md) covers setup,
commands, architecture, and the Google Maps key model; this file covers the
things that are easy to get wrong, and why they are the way they are.

## Stack

SvelteKit 2 / Svelte 5 (runes) / Tailwind 4 / Capacitor 8 / Vitest. TypeScript
strict. No component library — every UI primitive in `src/lib/components/` is
hand-written.

A rewrite of the Ionic + Angular BMLTSearch3. Where this app deliberately
diverges from the original, the tests say so — several assert the specific bug
they replaced. Matching the old behaviour is not itself a goal; if you are about
to port something across, check whether a test already pins the corrected
version.

## Before you say it works

```bash
npm run all      # format, lint, check, test, build
```

`svelte-check` must be at zero. The editor's language server lags badly on
`$lib` imports right after new files are created — trust `npm run check`, not the
inline diagnostics.

**For anything user-facing, run it.** `npm run dev` and look at the screen. Most
of the bugs in this app's history were invisible to the types and the tests:
a blank map, an autocomplete that silently returned nothing, a search that never
fired. If a change touches the map or a native plugin, a browser check is
necessary but not sufficient — see the native sections below.

## Rules that matter

**Svelte 5 runes only.** `$state`, `$derived`, `$props`, `$effect`. No stores, no
`export let`, no `svelte:self` (components import themselves). Runes mode is
forced in `svelte.config.js`.

**Prefer `$derived` to `$effect`.** An effect that seeds state on first render
only fires when its dependencies change _after_ mount, which silently does
nothing when a component is handed complete data up front. That exact bug hid the
meeting list's auto-open. If you can express it as a derivation, do.

**Reactive collections.** Use `SvelteSet` / `SvelteMap` from `svelte/reactivity`
when the template reads them. A plain `Map` is fine for a lookup table nothing
renders from — say so in a comment, since ESLint flags it.

**Never key an `{#each}` by user data that can repeat.** Address lines, place
names, and format strings all duplicate in real BMLT data, and a duplicate key is
a hard render error that takes the whole list down. Key by index unless you have
a genuine unique id.

**Domain logic goes in `src/lib/meetings/`,** framework-free and unit-tested. If
you are writing date maths or classification inside a `.svelte` file, it is in
the wrong place.

**No date library.** Meeting times are wall-clock strings plus a duration;
`src/lib/meetings/time.ts` does the arithmetic in minutes. The original used
date-fns and date-fns-tz for this and got timezone conversion wrong in both
directions. Do not reintroduce them without a reason that survives a test.

**`CapacitorHttp`, never `fetch`, for BMLT calls.** The root servers send no
permissive CORS headers and an in-webview `fetch` is blocked on device. All
requests go through `src/lib/api/http.ts`, which also absorbs two wire quirks:
empty result sets arrive as `{}` rather than `[]`, and bodies sometimes arrive as
unparsed strings.

**One root server.** Everything comes from the aggregator
(`aggregator.bmltenabled.org`, formerly called Tomato), which carries
`venue_type`, so in-person, hybrid and online meetings all arrive from the same
place. There used to be a second — `bmlt.virtual-na.org` — with its own screen
and its own format keying, which is why a `MeetingSource` was threaded through
format resolution and classification. Both are gone. Online meetings are reached
through the venue filter on the geographic searches, not a screen of their own.

**Do not propose a worldwide online-meeting list without reading
`meetings/venue.ts` first.** Two independent reasons it does not work: the
aggregator refuses unbounded queries (`venue_types` is not one of the filters
that satisfies its gate, so `venue_types=2` alone returns `[]` silently, and the
~5,255 matching rows time out even when it is satisfied), and only ~37% of those
records carry a `time_zone`, so most cannot be given a start time a reader can
act on.

**A failed request must never look like an empty result.** Someone looking for a
meeting reading "nothing found" when the server was actually down is the worst
outcome this app has. Catch, surface, offer a retry.

**Fail-soft has a cost — pay attention to it.** Several call sites deliberately
swallow errors and return `[]` or `null` so a dead autocomplete does not break
the search box. That is right, but it means misconfiguration is invisible. When
something "just does nothing", suspect a swallowed error before suspecting the
logic, and probe the API directly with `curl`.

## Google Maps: three keys, two code paths

Google allows a key exactly one _application_ restriction, so there is one key
per platform (`src/lib/maps/keys.ts`), and — less obviously — **a native session
uses two of them at once**.

|               | Map view                     | Autocomplete + geocoding |
| ------------- | ---------------------------- | ------------------------ |
| Web           | JS SDK, web key              | JS SDK, web key          |
| iOS / Android | **native SDK, platform key** | **REST, platform key**   |

On device the map is a native view authenticated by bundle ID / package + SHA-1,
while Places and geocoding go over REST with an app-identity header
(`src/lib/maps/rest.ts`, `identity.ts`). They do **not** use the JS SDK, because
a Capacitor webview cannot satisfy an HTTP-referrer restriction — Google states
website restrictions are "not guaranteed to work correctly" unless the page is
served from a site you control, and `localhost` is not that.

There is no native Places plugin for Capacitor. `@capacitor/google-maps` wraps
the Maps SDK only; the community proposal
([capacitor-community/proposals#111], 2021) was closed unimplemented and the
request against the Maps plugin ([ionic-team/capacitor-google-maps#111], 2022) is
still open. Places API (New) _is_ the REST API — the SDKs are clients for it.

**The Android SHA-1 is a trap.** `X-Android-Cert` is baked in at build time from
`PUBLIC_GOOGLE_MAPS_ANDROID_CERT_SHA1` and must be a fingerprint registered on
the key. Google validates the header against the allowlist — it cannot check the
app's real signature — so one registered value works for every build type, but a
stale one fails with "Requests from this Android client application are blocked",
which the app swallows into an empty suggestion list. If autocomplete works on
web and not on Android, check this first.

## The Capacitor map plugin will lie to you

Three separate days were lost to this plugin. All three causes are in its source,
not ours.

**Android: the map renders _beneath_ the webview.** Every layer above it must be
transparent or the map is invisible while drawing perfectly. `app.css` has a
`map-underlay` class applied only on the map screen and only on Android; the app
bar and bottom nav deliberately stay opaque. The plugin's README calls this out
as the first thing to check.

**iOS: `create()` resolving does not mean the map exists.** `render()` hops onto
the main queue _after_ the promise resolves, and finds its target by matching the
element's measured size against a `WKChildScrollView` that WebKit only creates
because the custom element's `connectedCallback` sets `overflow: scroll` and
appends a 200%-height child. Import `@capacitor/google-maps` **eagerly** so the
element is defined before Svelte inserts it, then `await
customElements.whenDefined(...)` and two animation frames before `create()`. A
lazy `import()` inside the create path leaves the element unupgraded and the map
blank until you navigate away and back.

**`setCamera` force-unwraps the native map view.** `var GMapView: GMSMapView!` —
calling it before the view exists crashes the app outright rather than failing.
All camera moves go through `moveCamera()` in the map route, which holds the
request until the map has _emitted an event_ (the only real proof it exists) and
replays it.

Related: a camera move we make ourselves must not arm "Search this area", but
some of them must still search — picking a place, or the first device fix
arriving. That is what the one-shot `searchAfterMove` flag is for. Nothing
searches automatically on pan; tapping a marker makes Google recentre the map,
and searching on every idle rebuilt the very pins the reader had just tapped.

## Translations

`src/lib/i18n/locales/*.json`, nine languages, flat key/value, carried over
unchanged from the Ionic build so existing translators are unaffected. English is
the source; add new strings to `en.json` only and let the rest fall back.
Bundled at build time, not fetched.

## Environment

All keys are read through `import.meta.env`, **not** `$env/static/public`. The
latter is a hard build error when a variable _name_ is absent — not merely unset
— which broke `git clone && npm run build`, broke `npm run check` in CI, and
failed the first Cloudflare Pages deploy. An absent key now degrades to an empty
string and only the map screen notices. See `envPrefix` in `vite.config.ts`.

Never hardcode a key. See `.env.example` for the full list and what each is for.

## Native projects

`ios/` and `android/` are committed and hold hand-written configuration: manifest
placeholders, location permission strings, the Maps key wiring, the privacy
manifest, and the shared Xcode scheme (without which CI cannot resolve
`-scheme App`). Do not regenerate them wholesale; `npx cap sync` is enough after
a dependency change. `npm run assets` rewrites ~150 icon files, so run it only
when `assets/` changes.

**Do not set `CODE_SIGN_IDENTITY`.** It contradicts `CODE_SIGN_STYLE=Automatic`,
and on the `xcodebuild` command line it applies to every target in the graph
including SPM dependencies, which then fail with their own provisioning
conflict. The Capacitor default is correct; leave it alone.

**Android `versionCode` is hardcoded to 1.** Fine for sideloading; Play rejects a
second upload with the same code. Derive it from the CI run number before the
first Play upload.

## Secrets and signing

Nothing secret belongs in this repository, including in `ios/` and `android/`.
Keys, keystores and certificates live outside every repo and reach CI as
encrypted secrets; `.gitignore` carries belt-and-braces patterns (`*.p12`,
`*.jks`, `*.keystore`, `*.p8`, `*.cer`, …) but the real defence is not putting
them here.

The Apple team identifier is supplied by CI as a secret rather than committed, so
`DEVELOPMENT_TEAM` is blank in the Xcode project and `ExportOptions.plist`
carries no `teamID`.

Machine-specific details — where signing material lives, account identifiers —
are deliberately not in this file. They belong in a local, uncommitted note.

[capacitor-community/proposals#111]: https://github.com/capacitor-community/proposals/issues/111
[ionic-team/capacitor-google-maps#111]: https://github.com/ionic-team/capacitor-google-maps/issues/111
