/* The one translation engine used by BOTH the server (CommonJS) and the browser (classic <script>, global LexiI18n).
   Messages are flat dictionaries: "nav.home": "Home". A message is a string with {placeholders} or a plural object
   {"one": "...", "few": "...", "other": "..."} chosen with Intl.PluralRules for the language. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.LexiI18n = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const LANGUAGES = [
    { code: 'uz', name: 'O‘zbekcha', flag: '🇺🇿', locale: 'uz-UZ', label: '🇺🇿 O‘zbekcha' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺', locale: 'ru-RU', label: '🇷🇺 Русский' },
    { code: 'en', name: 'English', flag: '🇬🇧', locale: 'en-GB', label: '🇬🇧 English' },
  ];
  const FALLBACK = 'en';
  const DEFAULT_LANGUAGE = 'uz';
  const CODES = LANGUAGES.map((l) => l.code);
  const isSupported = (c) => CODES.includes(c);
  const localeOf = (lang) => (LANGUAGES.find((l) => l.code === lang) || LANGUAGES[2]).locale;

  const PLURAL_CATEGORIES = { uz: ['one', 'other'], ru: ['one', 'few', 'many', 'other'], en: ['one', 'other'] };
  const PLACEHOLDER = /\{(\w+)\}/g;
  const placeholdersOf = (text) => Array.from(new Set(Array.from(String(text).matchAll(PLACEHOLDER)).map((m) => m[1]))).sort();

  const numberFormat = (lang, n, opts) => { try { return new Intl.NumberFormat(localeOf(lang), opts).format(n); } catch (_) { return String(n); } };
  function pluralCategory(lang, n) { try { return new Intl.PluralRules(localeOf(lang)).select(Number(n)); } catch (_) { return Number(n) === 1 ? 'one' : 'other'; } }

  function interpolate(text, params, lang) {
    if (!params) return text;
    return text.replace(PLACEHOLDER, (m, name) => {
      if (!(name in params)) return m;
      const v = params[name];
      return typeof v === 'number' ? numberFormat(lang, v) : String(v);
    });
  }
  /* picks the right form of a message value (string or plural object) */
  function pick(value, lang, params) {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
      const n = params && typeof params.n === 'number' ? params.n : (params && Number(params.count));
      const cat = Number.isFinite(n) ? pluralCategory(lang, n) : 'other';
      return value[cat] != null ? value[cat] : value.other != null ? value.other : value.one;
    }
    return undefined;
  }
  /* look the key up in `messages[lang]`, then in the fallback language, and finally return the key itself */
  function translate(dicts, lang, key, params) {
    for (const code of lang === FALLBACK ? [FALLBACK] : [lang, FALLBACK]) {
      const v = pick((dicts[code] || {})[key], code, params);
      if (typeof v === 'string' && v !== '') return interpolate(v, params, lang);
    }
    return key;
  }
  const formatDate = (lang, value, opts) => { if (!value) return '—'; try { return new Intl.DateTimeFormat(localeOf(lang), opts || { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)); } catch (_) { return String(value); } };

  return { LANGUAGES, FALLBACK, DEFAULT_LANGUAGE, CODES, PLURAL_CATEGORIES, isSupported, localeOf, placeholdersOf, numberFormat, pluralCategory, interpolate, pick, translate, formatDate };
});
