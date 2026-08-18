import { HelpCircle, Home, Info, List, Map, Search, Settings } from '@lucide/svelte';
import type { Component } from 'svelte';
import { resolve } from '$app/paths';

export interface NavItem {
  href: string;
  /** Key into the translation files, so the menu is localised like everything else. */
  labelKey: string;
  icon: Component;
  /** Draw a rule above this item, separating the searches from the utilities. */
  dividerBefore?: boolean;
}

/**
 * The full destination list, grouped: the things you came to do, then the things
 * you occasionally need.
 *
 * The Ionic build listed Settings second, straight after Home, which put a
 * preferences screen ahead of all four ways to find a meeting. Utility
 * destinations belong at the bottom where people expect to reach for them, so
 * `dividerBefore` marks where the searches end.
 *
 * `resolve()` applies the configured base path. That matters inside the native
 * webview, where the bundle is not served from a domain root.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: resolve('/'), labelKey: 'HOME', icon: Home },
  { href: resolve('/location-search'), labelKey: 'LOCATIONSEARCH', icon: Search },
  { href: resolve('/map-search'), labelKey: 'MAP_SEARCH', icon: Map },
  { href: resolve('/listfull'), labelKey: 'LISTFULL', icon: List },
  { href: resolve('/do-i-have-the-bmlt'), labelKey: 'DOIHAVETHEBMLT', icon: HelpCircle, dividerBefore: true },
  { href: resolve('/settings'), labelKey: 'SETTINGS', icon: Settings },
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
  // Fourth so the bar divides evenly. It took the slot the Virtual NA tab left
  // behind when that root server was dropped.
  { href: resolve('/contact'), labelKey: 'CONTACT', icon: Info }
];
