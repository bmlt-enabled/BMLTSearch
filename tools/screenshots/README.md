# Store screenshots

Regenerates the App Store (and Google Play) screenshot sets from the iOS
Simulator and the Android emulator.

```bash
npm run screenshots              # every device set
npm run screenshots:ios          # App Store only (iPhone + iPad)
npm run screenshots:android      # Play only

node tools/screenshots/capture.mjs iphone-6.9 --scenes=map   # one screen, iterating
node tools/screenshots/capture.mjs ios --no-build            # reuse what is installed
```

Output lands in `store/screenshots/`. The PNGs are gitignored (see the root
`.gitignore`); regenerating is cheap and the stores keep what was uploaded.

## What it captures

Four screens, in upload order, on the device sets below:

| Set              | Device                | Size        | Where it goes                |
| ---------------- | --------------------- | ----------- | ---------------------------- |
| `iphone-6.9`     | iPhone 17 Pro Max     | 1320 × 2868 | App Store, iPhone (required) |
| `ipad-13`        | iPad Pro 13-inch (M5) | 2064 × 2752 | App Store, iPad (required¹)  |
| `play-phone`     | emulator at 1080×1920 | 1080 × 1920 | Play, phone                  |
| `play-tablet-10` | emulator at 1600×2560 | 1600 × 2560 | Play, 10-inch tablet         |

Scenes: `location-search`, `map`, `listfull`, `settings`.

¹ Required because the app ships `TARGETED_DEVICE_FAMILY = "1,2"`. Drop the iPad
target only if that changes.

## How it works

Two files. `harness.js` runs **inside** the app; `capture.mjs` drives the devices
from outside. Both have long headers explaining themselves — read `harness.js`
first.

The short version: the app is a webview on both platforms, so the harness walks
it to each screen by clicking its own nav links (the anchor whose href ends
`/map-search`), not a coordinate. Getting the harness in differs by platform:

- **iOS** has no debugging protocol to attach to, so the driver rewrites
  `index.html` _inside the installed app bundle_ — the simulator does not verify
  bundle signatures — and relaunches. No Xcode, no reinstall.
- **Android** has one, so nothing is rewritten: the harness is registered with
  `Page.addScriptToEvaluateOnNewDocument` and each screen is a `Runtime.evaluate`
  the driver can await.

**A shot is taken once two consecutive screenshots are byte-identical, and only
after two that differed.** While a scene runs, the harness animates a small square
in the corner, so a page mid-scene can never look settled; the square is removed
before the screen goes still. That second half also waits out map tiles, which
have no DOM signal at all — on iOS the map is a native view matched to a scroll
layer, on Android a native view _beneath_ the webview and not in the document.

## Seeded state

Every scene starts from a wiped `bmltsearch.*` and these values:

- **Charleston, SC** as `bmltsearch.location`. This is why no permission sheet
  appears and why the Android emulator's missing GPS does not matter: the
  geographic screens open from the stored location (which has no freshness check)
  rather than asking the device.
- Search range 25, English.

Everything else on screen is live: real meetings from the aggregator, real
service bodies, a real map.

## When a scene breaks

A scene that throws leaves the marker moving in red and prints its own message
into a red bar along the bottom of the screen. The driver cannot settle on that,
times out after 90 seconds, saves the last frame as `<name>.png.timeout.png` next
to the set, and stops. Open that file: the red bar says which element the harness
could not find.

The usual cause is a renamed control or route. The harness matches on route
suffixes (`/map-search`) and the English "Menu" button label, so it must run in
English — the seed forces it. Those strings are all in the scenes near the bottom
of `harness.js`.

## Requirements

- Xcode with the two simulators above installed.
- For Play: Android SDK (`ANDROID_HOME`, or the default `~/Library/Android/sdk`)
  and one AVD; the driver boots it. Also a `.env` with
  `PUBLIC_GOOGLE_MAPS_KEY_ANDROID` — the Android build passes it to Gradle as
  `GOOGLE_MAPS_KEY_ANDROID`, and **without a real Android Maps key the app does
  not start**, because the Maps SDK throws on init and takes the process down.
  iOS needs no Maps key: it renders Apple Maps.

The status bars are set to 9:41 with a full battery and full signal by the
platforms' own tools (`simctl status_bar` and SystemUI demo mode) and cleared
again afterwards.
