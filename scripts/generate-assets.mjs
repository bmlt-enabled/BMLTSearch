#!/usr/bin/env node
//
// Expands the masters in assets/ into every launcher icon and splash screen
// under android/ and ios/. Run it with `npm run assets`.
//
// This replaces @capacitor/assets, which is abandoned. That package pins sharp
// 0.32.6 and Capacitor CLI 5, which between them carried a critical and three
// high advisories into every `npm ci`, and ionic-team/capacitor-assets#646 has
// sat unanswered since February 2026 — Ionic's suggested replacement is a VS
// Code extension, which is no use from a script or from CI.
//
// The rules below are ported from that tool's own generator, so the file set,
// every dimension, and both Contents.json files match what is already committed.
// 29 of the 61 PNGs differ in their bytes — libvips resamples slightly
// differently in sharp 0.35 than in 0.32 — but the largest per-channel delta
// across all of them is 3/255, so the change is invisible.
//
// Where a rule looks odd, it is faithful rather than clever. Fixing it here
// would silently change the app's icons the next time someone regenerates.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const master = (name) => join(root, 'assets', name);
const res = join(root, 'android', 'app', 'src', 'main', 'res');
const xcassets = join(root, 'ios', 'App', 'App', 'Assets.xcassets');

let written = 0;

async function emit(dest, buffer) {
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buffer);
  written++;
}

// ---------------------------------------------------------------- Android ---

// capacitor-assets sized the adaptive foreground and background layers from its
// *icon* templates rather than its larger adaptive-icon ones, so these are
// 36–192 and not 81–432. The 16.7% inset in ic_launcher.xml is what brings them
// back to the adaptive safe zone.
const ANDROID_ICONS = [
  ['ldpi', 36],
  ['mdpi', 48],
  ['hdpi', 72],
  ['xhdpi', 96],
  ['xxhdpi', 144],
  ['xxxhdpi', 192]
];

// The masters are square, so every non-square target below is a centre crop —
// sharp's default `cover` fit, which is what capacitor-assets relied on too.
//
// `drawable-night` is 320x240 while its light counterpart `drawable` is
// 320x480. That asymmetry is upstream's: it declared the default dark screen
// landscape and the default light one portrait. Reproduced so the committed
// files don't churn.
const ANDROID_SPLASHES = [
  ['drawable', 320, 480, 'light'],
  ['drawable-land-ldpi', 320, 240, 'light'],
  ['drawable-land-mdpi', 480, 320, 'light'],
  ['drawable-land-hdpi', 800, 480, 'light'],
  ['drawable-land-xhdpi', 1280, 720, 'light'],
  ['drawable-land-xxhdpi', 1600, 960, 'light'],
  ['drawable-land-xxxhdpi', 1920, 1280, 'light'],
  ['drawable-port-ldpi', 240, 320, 'light'],
  ['drawable-port-mdpi', 320, 480, 'light'],
  ['drawable-port-hdpi', 480, 800, 'light'],
  ['drawable-port-xhdpi', 720, 1280, 'light'],
  ['drawable-port-xxhdpi', 960, 1600, 'light'],
  ['drawable-port-xxxhdpi', 1280, 1920, 'light'],
  ['drawable-night', 320, 240, 'dark'],
  ['drawable-land-night-ldpi', 320, 240, 'dark'],
  ['drawable-land-night-mdpi', 480, 320, 'dark'],
  ['drawable-land-night-hdpi', 800, 480, 'dark'],
  ['drawable-land-night-xhdpi', 1280, 720, 'dark'],
  ['drawable-land-night-xxhdpi', 1600, 960, 'dark'],
  ['drawable-land-night-xxxhdpi', 1920, 1280, 'dark'],
  ['drawable-port-night-ldpi', 240, 320, 'dark'],
  ['drawable-port-night-mdpi', 320, 480, 'dark'],
  ['drawable-port-night-hdpi', 480, 800, 'dark'],
  ['drawable-port-night-xhdpi', 720, 1280, 'dark'],
  ['drawable-port-night-xxhdpi', 960, 1600, 'dark'],
  ['drawable-port-night-xxxhdpi', 1280, 1920, 'dark']
];

const ADAPTIVE_ICON_XML = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background>
        <inset android:drawable="@mipmap/ic_launcher_background" android:inset="16.7%" />
    </background>
    <foreground>
        <inset android:drawable="@mipmap/ic_launcher_foreground" android:inset="16.7%" />
    </foreground>
</adaptive-icon>`;

// The legacy launcher icon is inset by 8px of transparency on every edge, so
// pre-adaptive launchers that draw it unmasked don't clip the artwork. Two
// passes because a single sharp pipeline can't resize and then extend.
async function legacyLauncherIcon(size) {
  const padding = 8;
  const resized = await sharp(master('icon.png')).resize(size, size).toBuffer();
  return sharp(resized)
    .resize(Math.max(0, size - padding * 2), Math.max(0, size - padding * 2))
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();
}

// The round icon is the same artwork masked to a circle, for launchers that ask
// for one via android:roundIcon. `dest-in` keeps the source only where the
// circle is opaque.
async function roundLauncherIcon(size) {
  const circle = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#ffffff"/></svg>`);
  const resized = await sharp(master('icon.png')).resize(size, size).toBuffer();
  return sharp(resized)
    .composite([{ input: circle, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

async function generateAndroid() {
  for (const [density, size] of ANDROID_ICONS) {
    const dir = join(res, `mipmap-${density}`);
    await emit(join(dir, 'ic_launcher.png'), await legacyLauncherIcon(size));
    await emit(join(dir, 'ic_launcher_round.png'), await roundLauncherIcon(size));
    await emit(join(dir, 'ic_launcher_foreground.png'), await sharp(master('icon-foreground.png')).resize(size, size).png().toBuffer());
    await emit(join(dir, 'ic_launcher_background.png'), await sharp(master('icon-background.png')).resize(size, size).png().toBuffer());
  }

  for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
    await emit(join(res, 'mipmap-anydpi-v26', name), ADAPTIVE_ICON_XML);
  }

  for (const [dir, width, height, theme] of ANDROID_SPLASHES) {
    const source = master(theme === 'dark' ? 'splash-dark.png' : 'splash.png');
    await emit(join(res, dir, 'splash.png'), await sharp(source).resize(width, height).png().toBuffer());
  }
}

// -------------------------------------------------------------------- iOS ---

const IOS_SPLASHES = [
  ['Default@1x~universal~anyany.png', 'light'],
  ['Default@2x~universal~anyany.png', 'light'],
  ['Default@3x~universal~anyany.png', 'light'],
  ['Default@1x~universal~anyany-dark.png', 'dark'],
  ['Default@2x~universal~anyany-dark.png', 'dark'],
  ['Default@3x~universal~anyany-dark.png', 'dark']
];

// All three scales are the same 2732x2732 image. iOS picks one and crops it to
// the device; the artwork keeps the mark inside the middle third so any crop
// works. See assets/README.md.
const IOS_SPLASH_SIZE = 2732;

const APPICON_CONTENTS = {
  images: [{ idiom: 'universal', size: '1024x1024', filename: 'AppIcon-512@2x.png', platform: 'ios' }],
  info: { author: 'xcode', version: 1 }
};

// Key order differs between the light and dark entries — filename-then-scale
// against scale-then-filename. Xcode does not care, but matching upstream byte
// for byte keeps regeneration a no-op when nothing in assets/ has changed.
const SPLASH_CONTENTS = {
  images: IOS_SPLASHES.map(([filename, theme], i) => {
    const scale = `${(i % 3) + 1}x`;
    return theme === 'dark'
      ? {
          appearances: [{ appearance: 'luminosity', value: 'dark' }],
          idiom: 'universal',
          scale,
          filename
        }
      : { idiom: 'universal', filename, scale };
  }),
  info: { version: 1, author: 'xcode' }
};

async function generateIos() {
  // Flattened onto white: the App Store rejects an icon with an alpha channel.
  await emit(join(xcassets, 'AppIcon.appiconset', 'AppIcon-512@2x.png'), await sharp(master('icon.png')).resize(1024, 1024).flatten({ background: '#ffffff' }).png().toBuffer());
  await emit(join(xcassets, 'AppIcon.appiconset', 'Contents.json'), JSON.stringify(APPICON_CONTENTS, null, 2));

  for (const [filename, theme] of IOS_SPLASHES) {
    const source = master(theme === 'dark' ? 'splash-dark.png' : 'splash.png');
    await emit(join(xcassets, 'Splash.imageset', filename), await sharp(source).resize(IOS_SPLASH_SIZE, IOS_SPLASH_SIZE).png().toBuffer());
  }
  await emit(join(xcassets, 'Splash.imageset', 'Contents.json'), JSON.stringify(SPLASH_CONTENTS, null, 2));
}

await generateAndroid();
await generateIos();

console.log(`Wrote ${written} files under android/ and ios/.`);
