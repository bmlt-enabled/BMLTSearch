<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { page } from '$app/state';
  import { t } from '$lib/i18n/index.svelte';
  import { i18n } from '$lib/i18n/index.svelte';
  import { NAV_ITEMS } from '$lib/nav';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open, onclose }: Props = $props();

  // Persian lays out right-to-left, so the drawer has to come from the other
  // edge or it covers the side the reader's eye starts on.
  const fromRight = $derived(i18n.direction === 'rtl');

  function isActive(href: string): boolean {
    const path = page.url.pathname.replace(/\/+$/, '') || '/';
    const target = href.replace(/\/+$/, '') || '/';
    return path === target;
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-40 bg-black/45" transition:fade={{ duration: 150 }} onclick={onclose}></div>

  <nav
    class="bg-surface-raised safe-top safe-bottom fixed inset-y-0 z-40 flex w-72 max-w-[85vw] flex-col shadow-2xl"
    class:left-0={!fromRight}
    class:right-0={fromRight}
    transition:fly={{ x: fromRight ? 288 : -288, duration: 200 }}
    aria-label={t('MENU')}
  >
    <p class="text-text-muted px-5 pt-5 pb-2 text-xs font-bold tracking-widest uppercase">{t('MENU')}</p>

    <ul class="flex-1 overflow-y-auto px-3 pb-4">
      {#each NAV_ITEMS as item (item.href)}
        {@const Icon = item.icon}
        {@const active = isActive(item.href)}
        <li class:border-border={item.dividerBefore} class:mt-2={item.dividerBefore} class:border-t={item.dividerBefore} class:pt-2={item.dividerBefore}>
          <!-- eslint-disable svelte/no-navigation-without-resolve -- every href in NAV_ITEMS is already built with resolve() in $lib/nav.ts; the rule only recognises a literal resolve() at the call site. -->
          <a
            href={item.href}
            onclick={onclose}
            aria-current={active ? 'page' : undefined}
            class="focusable my-0.5 flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors {active ? 'bg-bmlt/12 text-bmlt' : 'text-text hover:bg-surface-sunken'}"
          >
            <!-- eslint-enable svelte/no-navigation-without-resolve -->
            <Icon size={20} aria-hidden="true" />
            {t(item.labelKey)}
          </a>
        </li>
      {/each}
    </ul>
  </nav>
{/if}
