import da from './locales/da.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fa from './locales/fa.json';
import fr from './locales/fr.json';
import it from './locales/it.json';
import pl from './locales/pl.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';

/**
 * Translation, kept deliberately small.
 *
 * The nine locale files come across unchanged from the Ionic build — they are
 * community-maintained and reused verbatim, so a translator's existing workflow
 * still applies. What changed is the loading: ngx-translate fetched them over
 * HTTP at runtime, which inside a Capacitor webview meant the first paint of
 * every screen showed raw keys until the request landed. All nine together are
 * under 40 KB, so they are bundled and the app is never in that state.
 */

export type LocaleCode = 'en' | 'fr' | 'it' | 'es' | 'da' | 'pl' | 'pt' | 'fa' | 'ru';

type Dictionary = Record<string, string>;

const DICTIONARIES: Record<LocaleCode, Dictionary> = { en, fr, it, es, da, pl, pt, fa, ru };

/** Ordered as the settings screen lists them; `labelKey` resolves to the endonym. */
export const LOCALES: ReadonlyArray<{ code: LocaleCode; labelKey: string }> = [
  { code: 'en', labelKey: 'ENGLISH' },
  { code: 'fr', labelKey: 'FRENCH' },
  { code: 'it', labelKey: 'ITALIAN' },
  { code: 'es', labelKey: 'SPANISH' },
  { code: 'da', labelKey: 'DANISH' },
  { code: 'pl', labelKey: 'POLISH' },
  { code: 'pt', labelKey: 'PORTUGUESE' },
  { code: 'fa', labelKey: 'PERSIAN' },
  { code: 'ru', labelKey: 'RUSSIAN' }
];

/** Persian is the one right-to-left language in the set. */
const RTL_LOCALES = new Set<LocaleCode>(['fa']);

const STORAGE_KEY = 'bmltsearch.language';

export function isLocaleCode(value: unknown): value is LocaleCode {
  return typeof value === 'string' && value in DICTIONARIES;
}

/** Best guess from the device, falling back to English. */
function detectLocale(): LocaleCode {
  if (typeof navigator === 'undefined') return 'en';
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag?.split('-')[0]?.toLowerCase();
    if (isLocaleCode(base)) return base;
  }
  return 'en';
}

class I18n {
  #locale = $state<LocaleCode>('en');

  get locale(): LocaleCode {
    return this.#locale;
  }

  get direction(): 'ltr' | 'rtl' {
    return RTL_LOCALES.has(this.#locale) ? 'rtl' : 'ltr';
  }

  /**
   * Look up a key.
   *
   * Falls back to English before falling back to the key itself. That matters:
   * only English is complete, and a reader is better served by an English string
   * than by seeing `SEARCHRANGESETTING` on screen. Reading `#locale` here is what
   * makes every `t(...)` call in a template re-run when the language changes.
   */
  t = (key: string): string => {
    return DICTIONARIES[this.#locale][key] ?? DICTIONARIES.en[key] ?? key;
  };

  set(locale: LocaleCode): void {
    if (!isLocaleCode(locale)) return;
    this.#locale = locale;
    this.#persist();
    this.#applyToDocument();
  }

  /** Restore the stored choice, or detect one. Safe to call more than once. */
  init(): void {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Private browsing with storage disabled — fall through to detection.
    }
    this.#locale = isLocaleCode(stored) ? stored : detectLocale();
    this.#applyToDocument();
  }

  #persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, this.#locale);
    } catch {
      // Not being able to remember the choice is not worth failing over.
    }
  }

  /**
   * Keep `<html lang>` and `<html dir>` in step.
   *
   * `dir` is what makes Persian lay out right-to-left. The Ionic build shipped a
   * Persian translation but never set it, so the whole app read left-to-right
   * with Persian text in it.
   */
  #applyToDocument(): void {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = this.#locale;
    document.documentElement.dir = this.direction;
  }
}

export const i18n = new I18n();

/** The shorthand templates use: `{t('HOME')}`. */
export const t = i18n.t;
