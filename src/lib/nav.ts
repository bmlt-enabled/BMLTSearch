import { Globe, HelpCircle, Home, Info, List, Map, Search, Settings } from '@lucide/svelte';
import type { Component } from 'svelte';
import { resolve } from '$app/paths';

export interface NavItem {
  href: string;
  /** Key into the translation files, so the menu is localised like everything else. */
  labelKey: string;
  icon: Component;
}

/**
 * The full destination list, in the order the Ionic side menu had it.
 *
 * `resolve()` applies the configured base path. That matters inside the native
 * webview, where the bundle is not served from a domain root.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: resolve('/'), labelKey: 'HOME', icon: Home },
  { href: resolve('/settings'), labelKey: 'SETTINGS', icon: Settings },
  { href: resolve('/map-search'), labelKey: 'MAP_SEARCH', icon: Map },
  { href: resolve('/location-search'), labelKey: 'LOCATIONSEARCH', icon: Search },
  { href: resolve('/listfull'), labelKey: 'LISTFULL', icon: List },
  { href: resolve('/virtual'), labelKey: 'VIRTUAL_MEETINGS', icon: Globe },
  { href: resolve('/do-i-have-the-bmlt'), labelKey: 'DOIHAVETHEBMLT', icon: HelpCircle },
  { href: resolve('/contact'), labelKey: 'CONTACT', icon: Info }
];

/**
 * The four search modes that earn a permanent bottom bar.
 *
 * The Ionic build put all eight destinations behind a hamburger, which buried
 * the four things the app exists to do two taps deep. The rest stay in the
 * drawer, which the bar does not replace.
 */
export const BOTTOM_NAV: readonly NavItem[] = [
  { href: resolve('/location-search'), labelKey: 'LOCATIONSEARCH', icon: Search },
  { href: resolve('/map-search'), labelKey: 'MAP_SEARCH', icon: Map },
  { href: resolve('/listfull'), labelKey: 'LISTFULL', icon: List },
  { href: resolve('/virtual'), labelKey: 'VIRTUAL_MEETINGS', icon: Globe }
];
