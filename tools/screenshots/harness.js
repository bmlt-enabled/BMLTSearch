/*
  The half of the screenshot job that runs inside the app.

  Everything here executes in the webview, before the SvelteKit bundle does, and
  it does three things: seeds the reader state a store screenshot needs, drives
  the app to one named screen through its own DOM, and tells the outside world
  when it has finished.

  Why the DOM rather than taps. This app is a webview on both platforms, so its
  own buttons and links are reachable directly — a click on the anchor whose
  href ends `/map-search` stays correct when the bar is restyled, and fails
  loudly rather than silently tapping empty space when a route is renamed. The
  alternative, Quartz mouse events at fractions of the simulator window, needs a
  table of magic coordinates per device that has to be re-derived by eye whenever
  the layout moves.

  Why a blinking square. Neither platform gives us a clean way to ask the page
  "are you finished?" from outside: WKWebView console output does not reach the
  system log, and the iOS driver has no debugging protocol to attach to. So the
  signal is visual and works identically on both platforms. While a scene is
  running, a small square in the corner changes every 60ms, which guarantees two
  consecutive screenshots can never match. When the scene finishes, the square is
  removed, the page goes still, and the driver's "capture once two shots are
  identical" loop fires on a screen that is settled by definition — no spinner,
  no half-drawn list, no map still fading in.

  The square is gone before the shot is taken. It never appears in output.
*/
(function () {
  'use strict';

  // Injected by the driver ahead of this file: { scene, seed }.
  var CONFIG = window.__SHOT_CONFIG || {};
  var SEED = CONFIG.seed || {};

  /* ------------------------------------------------------------------ state */

  /*
    Seeding runs now, at parse time in <head>, and that timing is the whole
    point: `stores/settings.svelte.ts` and the i18n store both read localStorage
    synchronously while the module graph evaluates, so a value written after boot
    is a value the first screen has already rendered without.

    A seeded `bmltsearch.location` is also what keeps the device GPS out of this
    entirely. The geographic screens open from `settings.location` when it is
    present (there is no freshness check on it), so there is no permission sheet
    to dismiss on iOS and no dependence on the Android emulator's location.
  */
  function seed() {
    try {
      // Wipe first, so a scene never inherits the one before it — localStorage
      // outlives the per-scene relaunch (iOS) and reload (Android).
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var key = localStorage.key(i);
        if (key && key.indexOf('bmltsearch.') === 0) localStorage.removeItem(key);
      }

      if (SEED.location) {
        localStorage.setItem('bmltsearch.location', JSON.stringify({ lat: SEED.location.lat, lng: SEED.location.lng, address: SEED.location.address }));
      }
      if (SEED.searchRange != null) localStorage.setItem('bmltsearch.searchRange', String(SEED.searchRange));
      if (SEED.modes) localStorage.setItem('bmltsearch.modes', SEED.modes);
      if (SEED.language) localStorage.setItem('bmltsearch.language', SEED.language);
    } catch (error) {
      // Storage refused. Nothing here is recoverable and every scene would show
      // the wrong thing, so fail where it will be read rather than press on.
      throw new Error('screenshot harness: could not seed storage', { cause: error });
    }
  }

  seed();

  /* ------------------------------------------------------------- busy marker */

  var busyEl = null;
  var busyTimer = null;

  function startBusy() {
    if (busyEl) return;
    busyEl = document.createElement('div');
    busyEl.id = '__shot_busy';
    // Falls back to documentElement because this can start before <body> exists:
    // the auto-run path calls it while <head> is still parsing.
    busyEl.style.cssText = 'position:fixed;top:0;left:0;width:14px;height:14px;z-index:2147483647;pointer-events:none;background:#000';
    (document.body || document.documentElement).appendChild(busyEl);
    /*
      The colour is a counter, not an alternation. A marker that flips between two
      states has a period, and the driver samples on a period of its own; a
      counter cannot repeat until it wraps (days away at this rate), so no two
      samples can match while a scene is running. The size changes too, so a human
      watching the simulator sees it blink.
    */
    var tick = 0;
    busyTimer = setInterval(function () {
      tick = (tick + 1) % 0xffffff;
      busyEl.style.background = '#' + ('000000' + tick.toString(16)).slice(-6);
      busyEl.style.width = busyEl.style.height = 10 + (tick % 5) + 'px';
    }, 60);
  }

  function stopBusy() {
    if (busyTimer) clearInterval(busyTimer);
    busyTimer = null;
    if (busyEl && busyEl.parentNode) busyEl.parentNode.removeChild(busyEl);
    busyEl = null;
  }

  /*
    A scene that throws must not leave the page looking finished — a still screen
    is exactly the signal the driver captures on. Failure keeps *moving*, in red:
    the driver can never settle on it, times out, and says so.
  */
  function failBusy() {
    if (!busyEl) return;
    if (busyTimer) clearInterval(busyTimer);
    var tick = 0;
    busyTimer = setInterval(function () {
      tick = (tick + 1) % 0xff;
      busyEl.style.background = 'rgb(255,' + tick + ',' + tick + ')';
      busyEl.style.width = busyEl.style.height = 10 + (tick % 5) + 'px';
    }, 60);
  }

  /* ------------------------------------------------------------- DOM helpers */

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  /** Poll until `probe` returns something truthy, or give up loudly. */
  async function waitFor(probe, label, timeoutMs) {
    var deadline = Date.now() + (timeoutMs || 20000);
    for (;;) {
      var hit;
      try {
        hit = probe();
      } catch {
        hit = null;
      }
      if (hit) return hit;
      if (Date.now() > deadline) throw new Error('screenshot harness: timed out waiting for ' + label);
      await sleep(100);
    }
  }

  /*
    Click the way a reader does. `element.click()` is enough for SvelteKit's link
    interception and for every button in this app, and it cannot land on the
    wrong element or depend on scroll position the way a synthesised pointer
    sequence would.
  */
  async function click(element, settleMs) {
    if (!element) throw new Error('screenshot harness: nothing to click');
    element.click();
    await sleep(settleMs == null ? 600 : settleMs);
  }

  function isVisible(el) {
    return !!el && el.offsetParent !== null;
  }

  /** The first *visible* anchor whose path ends with `suffix`. */
  function visibleHref(suffix) {
    var anchors = document.querySelectorAll('a[href]');
    for (var i = 0; i < anchors.length; i++) {
      var href = (anchors[i].getAttribute('href') || '').replace(/[?#].*$/, '').replace(/\/+$/, '');
      if (href.slice(-suffix.length) === suffix && isVisible(anchors[i])) return anchors[i];
    }
    return null;
  }

  function onRoute(suffix) {
    var path = location.pathname.replace(/\/+$/, '');
    return path.slice(-suffix.length) === suffix;
  }

  /** Follow one of the app's own nav links and confirm the route changed. */
  async function navigate(suffix, settleMs) {
    var link = await waitFor(function () {
      return visibleHref(suffix);
    }, 'a visible link to ' + suffix);
    await click(link, settleMs == null ? 900 : settleMs);
    await waitFor(function () {
      return onRoute(suffix);
    }, 'the route to become ' + suffix);
  }

  /** True while the app-wide loading overlay is up (LoadingOverlay.svelte). */
  function isLoading() {
    return !!document.querySelector('[aria-busy="true"]');
  }

  /*
    Wait out a screen's initial fetch.

    The geographic screens raise the global overlay while they talk to the
    aggregator. We give it a moment to appear, then wait for it to clear — a
    generous window, because this is a live request over the simulator's network
    and it is the one wait in the set that depends on someone else's server.
  */
  async function waitForIdle(timeoutMs) {
    await sleep(1200);
    await waitFor(
      function () {
        return !isLoading();
      },
      'the loading overlay to clear',
      timeoutMs || 30000
    );
  }

  /* ------------------------------------------------------------------ scenes */

  var scenes = {
    /*
      Current Location Search: the nearest meetings to the seeded location. It
      searches itself on mount from `settings.location`, so there is no GPS
      prompt — we just wait out that first request.
    */
    async 'location-search'() {
      await navigate('/location-search');
      await waitForIdle();
      await sleep(800);
    },

    /*
      Map Search, centred on the meetings around the seeded location. There is no
      DOM signal for "the tiles have drawn" — on iOS the map is a native view
      matched to a scroll layer, on Android a native view *beneath* the webview,
      not in this document at all — so after the element exists we dwell, and the
      driver's settle loop is what actually decides the shot is ready. Our own map
      fix searches and drops markers on first load, so both need to land inside
      the dwell + settle window.
    */
    async map() {
      await navigate('/map-search');
      await waitFor(function () {
        return document.querySelector('capacitor-apple-map, capacitor-google-map');
      }, 'the map element');
      await sleep(6500);
    },

    /* Service Body List: the tree of service bodies the aggregator carries. */
    async listfull() {
      await navigate('/listfull');
      await waitForIdle();
      await sleep(800);
    },

    /*
      Settings. Not in the bottom bar — reached through the drawer, opened from
      the app-bar menu button (the only button labelled "Menu"; the navs that
      share that label are <nav> elements, not buttons).
    */
    async settings() {
      var menu = await waitFor(function () {
        var b = document.querySelector('button[aria-label="Menu"]');
        return isVisible(b) ? b : null;
      }, 'the menu button');
      await click(menu, 500);
      await navigate('/settings');
      await sleep(800);
    }
  };

  /* ------------------------------------------------------------------ runner */

  async function run(name) {
    var scene = scenes[name];
    if (!scene) throw new Error('screenshot harness: no scene named "' + name + '"');
    startBusy();
    try {
      await scene();
    } catch (error) {
      failBusy();
      throw error;
    }
    stopBusy();
    return name;
  }

  // Android drives this over the debugging protocol, one call per screen, with no
  // reload in between. iOS cannot, so it bakes the scene name in and the page
  // starts itself.
  window.__shot = { run: run, scenes: Object.keys(scenes) };

  if (CONFIG.scene) {
    startBusy();
    window.addEventListener('load', function () {
      run(CONFIG.scene).catch(function (error) {
        failBusy();
        // Surfaced where a human looking at the simulator can see it, since
        // console output from this webview reaches nothing on iOS.
        var note = document.createElement('pre');
        note.style.cssText = 'position:fixed;inset:auto 0 0 0;z-index:2147483646;margin:0;padding:8px;background:#f00;color:#fff;font:12px monospace;white-space:pre-wrap';
        note.textContent = String(error && error.message ? error.message : error);
        (document.body || document.documentElement).appendChild(note);
      });
    });
  }
})();
