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

## Regenerating

```bash
npm run assets
```

That rewrites ~150 files across both native projects, and the result is
committed. Run it only when a master here actually changes.

Splashes are square and centred because a launch screen is cropped to whatever
aspect ratio the device happens to be — the safe area is the middle third, and
the artwork keeps the mark well inside it.

## The web icons

`static/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, and
`apple-touch-icon.png` are derived from `icon.png` and committed separately.
They are not produced by `npm run assets` — that tool only writes into the native
projects. To regenerate them after changing `icon.png`:

```bash
sips -Z 512 assets/icon.png --out static/icon-512.png
sips -Z 192 assets/icon.png --out static/icon-192.png
sips -Z 180 assets/icon.png --out static/apple-touch-icon.png
# The maskable variant needs padding: Android crops it to a circle, and an
# unpadded icon loses its edges.
magick assets/icon.png -resize 410x410 -background '#0a61ad' -gravity center -extent 512x512 static/icon-maskable-512.png
```
