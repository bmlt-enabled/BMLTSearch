<script lang="ts">
  import AppBar from '$lib/components/AppBar.svelte';
  import RangeSlider from '$lib/components/RangeSlider.svelte';
  import Select from '$lib/components/Select.svelte';
  import { i18n, LOCALES, t, type LocaleCode } from '$lib/i18n/index.svelte';
  import { MAX_SEARCH_RANGE, MIN_SEARCH_RANGE, settings } from '$lib/stores/settings.svelte';
  import { drawer } from '$lib/stores/ui.svelte';

  const languageOptions = $derived(LOCALES.map((locale) => ({ value: locale.code, label: t(locale.labelKey) })));

  // A writable derived: the slider assigns to it on every frame of the drag so
  // the number beside the label keeps up, and it falls back into step with the
  // store whenever that changes. The store itself is only written on release,
  // since each write persists.
  let range = $derived(settings.searchRange);
</script>

<svelte:head><title>{t('SETTINGS')}</title></svelte:head>

<AppBar title={t('SETTINGS')} onmenu={() => drawer.toggle()} />

<div class="space-y-4 p-4">
  <section class="border-border bg-surface-raised rounded-xl border p-4">
    <Select value={i18n.locale} options={languageOptions} label={t('LANGUAGE')} onchange={(code: LocaleCode) => i18n.set(code)} />
  </section>

  <section class="border-border bg-surface-raised rounded-xl border p-4">
    <p class="text-text-muted mb-1 text-xs font-semibold tracking-wide uppercase">{t('SEARCHRANGESETTING')}</p>
    <p class="text-text mb-3 text-sm font-medium">{range}{t('MEETINGS')}</p>
    <RangeSlider bind:value={range} min={MIN_SEARCH_RANGE} max={MAX_SEARCH_RANGE} label={t('SEARCHRANGESETTING')} oncommit={(value: number) => (settings.searchRange = value)} />
    <div class="text-text-muted mt-1 flex justify-between text-xs">
      <span>{MIN_SEARCH_RANGE}{t('MEETINGS')}</span>
      <span>{MAX_SEARCH_RANGE}{t('MEETINGS')}</span>
    </div>
  </section>
</div>
