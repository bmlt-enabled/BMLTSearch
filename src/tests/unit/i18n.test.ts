import { describe, expect, it } from 'vitest';
import en from '$lib/i18n/locales/en.json';
import da from '$lib/i18n/locales/da.json';
import es from '$lib/i18n/locales/es.json';
import fa from '$lib/i18n/locales/fa.json';
import fr from '$lib/i18n/locales/fr.json';
// Aliased: the Italian locale code collides with vitest's `it`.
import italian from '$lib/i18n/locales/it.json';
import pl from '$lib/i18n/locales/pl.json';
import pt from '$lib/i18n/locales/pt.json';
import ru from '$lib/i18n/locales/ru.json';
import { i18n, isLocaleCode, LOCALES } from '$lib/i18n/index.svelte';

const DICTIONARIES: Record<string, Record<string, string>> = { en, da, es, fa, fr, it: italian, pl, pt, ru };

describe('locale registry', () => {
  it('lists a dictionary for every advertised language', () => {
    for (const locale of LOCALES) {
      expect(DICTIONARIES[locale.code], `missing dictionary for ${locale.code}`).toBeDefined();
    }
  });

  it('names each language in its own script, so the picker is readable', () => {
    for (const locale of LOCALES) {
      expect(DICTIONARIES[locale.code][locale.labelKey], `${locale.code} has no endonym`).toBeTruthy();
    }
  });

  it('recognises only the nine shipped codes', () => {
    expect(isLocaleCode('en')).toBe(true);
    expect(isLocaleCode('de')).toBe(false);
    expect(isLocaleCode(undefined)).toBe(false);
  });
});

describe('translation coverage', () => {
  it('has no translation carrying keys English does not', () => {
    const known = new Set(Object.keys(en));
    for (const [code, dictionary] of Object.entries(DICTIONARIES)) {
      const stray = Object.keys(dictionary).filter((key) => !known.has(key));
      expect(stray, `${code} has keys absent from en.json`).toEqual([]);
    }
  });

  it('resolves every key the weekday and meeting-kind code paths use', () => {
    const required = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'WEEKDAYS', 'TEMPCLOSED', 'TEMP_CLOSED', 'FORMATS', 'MAP', 'VIRTUAL_LINK', 'PHONE_MEETING'];
    for (const key of required) expect(en[key as keyof typeof en], `en.json is missing ${key}`).toBeTruthy();
  });
});

describe('lookup', () => {
  it('falls back to English rather than showing a raw key', () => {
    // Only English is complete; the others are community-contributed and lag.
    i18n.set('da');
    const missingInDanish = Object.keys(en).filter((key) => !(key in da));
    for (const key of missingInDanish) {
      expect(i18n.t(key)).toBe(en[key as keyof typeof en]);
    }
  });

  it('returns the key itself when nothing has it, so the gap is visible', () => {
    i18n.set('en');
    expect(i18n.t('NO_SUCH_KEY')).toBe('NO_SUCH_KEY');
  });

  it('reports Persian as right-to-left and the rest as left-to-right', () => {
    i18n.set('fa');
    expect(i18n.direction).toBe('rtl');
    i18n.set('en');
    expect(i18n.direction).toBe('ltr');
  });
});
