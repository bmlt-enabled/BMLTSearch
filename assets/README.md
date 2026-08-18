# Source assets

These are the masters that `npm run assets` expands into every launcher icon and
splash screen under `ios/` and `android/`. Nothing here ships in the web bundle —
the web icons live in `static/`.

| File                  | Size      | Used for                                                         |
| --------------------- | --------- | ---------------------------------------------------------------- |
| `icon.png`            | 1024×1024 | iOS app icon, Android legacy icon, source for the `static/` PNGs |
| `icon-foreground.png` | 1024×1024 | Android adaptive icon foreground layer                           |
| `icon-background.png` | 1024×1024 | Android adaptive icon background layer                           |
| `splash.png`          | 2732×2732 | Launch screen, light                                             |
| `splash-dark.png`     | 2732×2732 | Launch screen, dark                                              |

All five are carried over unchanged from the Ionic build's `resources/` folder,
so the rebuilt app is visually identical on the home screen and at launch.

**Five files, two images.** `icon.png`, `icon-foreground.png` and
`icon-background.png` are byte-identical, and so are `splash.png` and
`splash-dark.png`. That is inherited from the Ionic build, not a mistake in the
generator: the Android adaptive icon is the full artwork stacked on an identical
background layer, and dark mode gets the light splash. The separate filenames
are the seams to cut along if the app ever wants a real adaptive foreground or a
real dark launch screen — change one file and rerun, nothing else needs to move.

## Regenerating

```bash
npm run assets
```

That runs [`scripts/generate-assets.mjs`](../scripts/generate-assets.mjs), which
writes 61 files across both native projects, and the result is committed. Run it
only when a master here actually changes.

Splashes are square and centred because a launch screen is cropped to whatever
aspect ratio the device happens to be — the safe area is the middle third, and
the artwork keeps the mark well inside it.

### Why a local script

This used to be `@capacitor/assets`. That package is abandoned — it pins sharp
0.32.6 and Capacitor CLI 5, which between them dragged a critical and three high
advisories into every `npm ci`, and
[ionic-team/capacitor-assets#646](https://github.com/ionic-team/capacitor-assets/issues/646)
has sat unanswered since February 2026. Ionic's suggested replacement is a VS
Code extension, which is no use from a script or from CI.

`generate-assets.mjs` ports that tool's generation rules exactly, so the file set
and every dimension are unchanged. It depends only on a current `sharp`.

If the script ever drifts from what Capacitor expects — a new Capacitor major
adding a density, say — the original still runs without being a dependency:

```bash
npx @capacitor/assets@3 generate --ios --android
```

Reach for that to see what upstream _would_ have written, then port the
difference back into the script. Don't leave it as the regeneration path: it
reintroduces the vulnerable tree, and it will rot further.

## The web icons

`static/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, and
`apple-touch-icon.png` are derived from `icon.png` and committed separately.
They are not produced by `npm run assets` — that script only writes into the
native projects. To regenerate them after changing `icon.png`:

```bash
sips -Z 512 assets/icon.png --out static/icon-512.png
sips -Z 192 assets/icon.png --out static/icon-192.png
sips -Z 180 assets/icon.png --out static/apple-touch-icon.png
# The maskable variant needs padding: Android crops it to a circle, and an
# unpadded icon loses its edges.
magick assets/icon.png -resize 410x410 -background '#0a61ad' -gravity center -extent 512x512 static/icon-maskable-512.png
```
