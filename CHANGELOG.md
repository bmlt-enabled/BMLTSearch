# Changelog

## 6.0.0 (unreleased)

Complete rewrite. The app is now **SvelteKit 2 + Svelte 5 + Tailwind 4 +
Capacitor 8**, replacing the Ionic 8 + Angular 20 build that shipped through
5.5.0. The user-facing feature set is unchanged; everything below the surface is
new.

- **Rewritten in Svelte** — one static bundle serving web, iOS, and Android. No component library: every UI primitive is hand-written against Tailwind, and every route is prerendered because there is no server inside a webview
- **Now a web app too** — deployed to [app.bmlt.app](https://app.bmlt.app) and installable as a PWA, alongside the iOS and Android builds
- **Domain logic extracted and tested** — time arithmetic, meeting classification, grouping, filtering, the service body tree, marker clustering, and the share payload now live framework-free in `src/lib/meetings/` under 133 unit tests
- **Zonal forums are flattened out of the browse tree** — whether a region sat under a zone was a per-server configuration choice, so 43 regions appeared at the top level while 73 more hid one tap down behind a zone, with nothing to tell them apart. Zones are dropped and their regions promoted, making all 116 regions siblings. A promoted region keeps its context as a suffix — "Region 1 (Iran Zone)" — since some are named only in relation to their zone and read as anonymous areas once flattened. The screen is now called **Service Body List** rather than BMLT Meeting List
- **A region's own row is hidden when it has no meetings of its own** — expanding a region listed the region itself above its areas, and tapping it opened a blank list for the majority of regions that exist only to contain areas. The row now appears only for a body that genuinely holds meetings directly, which is checked once per body the first time it is expanded
- **In person / online filter on Near Me** — the aggregator holds ~4,300 virtual and ~950 hybrid meetings, and they were already coming back unfiltered. Online meetings can now be asked for, or excluded when only a room will do. Hybrid meetings appear under _both_ filters rather than being a third option nobody searches for
- **The map no longer plots online meetings** — a pin asserts that the meeting is _there_, and for an online meeting that is false: BMLT requires coordinates on every record whether or not the meeting happens anywhere, so online groups are pinned to a home town or somewhere arbitrary. The map now asks only for meetings with a real venue, in person and hybrid. This is the same judgement the app already made in refusing to offer directions to an online meeting; a pin was a quieter version of the same claim. The filter is therefore on the list search only, where a result is a row rather than a location
- **Virtual and hybrid meetings are badged** — a meeting's kind is now stated on the card rather than implied by which buttons it happens to offer. Previously the only thing marking an online meeting as online was the _absence_ of a Directions button, which asks the reader to notice something that is not there
- **No date library** — meeting times are wall-clock strings plus a duration, and the arithmetic is done in minutes. Online meetings show their own timezone, labelled, rather than being converted
- **One root server instead of two** — the app now reads everything from the worldwide BMLT aggregator, which carries `venue_type` and so holds in-person, hybrid and online meetings alike. The separate `bmlt.virtual-na.org` root and its browse screen are gone: nobody maintains that data, and the aggregator carries ~45% more online meetings. Online meetings are reached through the venue filter on the geographic searches rather than a screen of their own, and the `MeetingSource` that used to be threaded through format resolution and classification went with it
- **About moved into the bottom bar** — it takes the fourth slot the Virtual NA tab left behind
- **Errors no longer look like empty results** — a failed search says so and offers a retry, instead of dismissing the spinner and leaving an empty screen behind
- **Search modes moved to a permanent bottom bar** — the four ways to search were previously behind the hamburger menu; results also open on today's meetings rather than a stack of collapsed bars
- **CI builds all three platforms** — `ci.yml` lints, type-checks and tests on every push; a `v*` tag produces a signed Android APK and AAB and uploads an iOS build to TestFlight, with versions derived from the tag
- **MIT licensed**
