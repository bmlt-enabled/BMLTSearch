# Changelog

## 6.0.0 (unreleased)

Complete rewrite. The app is now **SvelteKit 2 + Svelte 5 + Tailwind 4 +
Capacitor 8**, replacing the Ionic 8 + Angular 20 build that shipped through
5.4.6. The user-facing feature set is unchanged; everything below the surface is
new.

- **Rewritten in Svelte** — one static bundle serving web, iOS, and Android. No component library: every UI primitive is hand-written against Tailwind, and every route is prerendered because there is no server inside a webview
- **Now a web app too** — deployed to [app.bmlt.app](https://app.bmlt.app) and installable as a PWA, alongside the iOS and Android builds
- **Domain logic extracted and tested** — time arithmetic, meeting classification, grouping, filtering, the service body tree, marker clustering, and the share payload now live framework-free in `src/lib/meetings/` under 118 unit tests
- **Zonal forums are flattened out of the browse tree** — whether a region sat under a zone was a per-server configuration choice, so 43 regions appeared at the top level while 73 more hid one tap down behind a zone, with nothing to tell them apart. Zones are dropped and their regions promoted, making all 116 regions siblings. The screen is now called **Service Body List** rather than BMLT Meeting List
- **A region's own row is hidden when it has no meetings of its own** — expanding a region listed the region itself above its areas, and tapping it opened a blank list for the majority of regions that exist only to contain areas. The row now appears only for a body that genuinely holds meetings directly, which is checked once per body the first time it is expanded
- **Virtual and hybrid meetings are badged** — a meeting's kind is now stated on the card rather than implied by which buttons it happens to offer. BMLT requires coordinates on every record, so an online-only meeting still gets a map pin, often on its home town; previously the only thing marking it as online was the _absence_ of a Directions button
- **No date library** — meeting times are wall-clock strings plus a duration, and the arithmetic is done in minutes. Online meetings show their own timezone, labelled, rather than being converted
- **Source-aware meeting handling** — Tomato (in-person, hybrid) and Virtual NA (online) key formats differently, so `MeetingSource` is threaded explicitly through format resolution and classification rather than inferred
- **Errors no longer look like empty results** — a failed search says so and offers a retry, instead of dismissing the spinner and leaving an empty screen behind
- **Search modes moved to a permanent bottom bar** — the four ways to search were previously behind the hamburger menu; results also open on today's meetings rather than a stack of collapsed bars
- **CI builds all three platforms** — `ci.yml` lints, type-checks and tests on every push; a `v*` tag produces a signed Android APK and AAB and uploads an iOS build to TestFlight, with versions derived from the tag
- **MIT licensed**
