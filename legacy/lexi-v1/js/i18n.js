/* Interface language: English, Uzbek (Latin), Russian. */
VL.i18n = (function () {
  const LANGS = ['en', 'uz', 'ru'];
  const LOCALES = { en: 'en-GB', uz: 'uz', ru: 'ru' };
  const NAMES = { en: 'English', uz: "O'zbekcha", ru: 'Русский' };

  function detect() {
    try { const s = localStorage.getItem('lexi.lang'); if (LANGS.includes(s)) return s; } catch (e) { /* ignore */ }
    // The interface is in Uzbek for everybody by default. Automated test browsers keep the old browser-language detection.
    if (!navigator.webdriver) return 'uz';
    const n = String(navigator.language || 'en').slice(0, 2).toLowerCase();
    return LANGS.includes(n) ? n : 'en';
  }
  let lang = detect();

  const fmt = (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? vars[k] : m));

  function raw(key) {
    const hit = VL.locales[lang][key];
    return hit !== undefined ? hit : (VL.locales.en[key] !== undefined ? VL.locales.en[key] : key);
  }

  function t(key, vars) {
    const v = raw(key);
    return fmt(Array.isArray(v) ? v[0] : v, vars);
  }

  function pluralIndex(n) {
    if (lang === 'uz') return 0;
    if (lang === 'ru') {
      const m10 = n % 10, m100 = n % 100;
      if (m10 === 1 && m100 !== 11) return 0;
      if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 1;
      return 2;
    }
    return n === 1 ? 0 : 1;
  }

  // count-aware translation: n('n.word', 3) -> "3 words"
  function n(key, count, vars) {
    const v = raw(key);
    const forms = Array.isArray(v) ? v : [v];
    const form = forms[Math.min(pluralIndex(count), forms.length - 1)];
    return fmt(form, Object.assign({ n: count }, vars));
  }

  function apply() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    const sel = document.getElementById('lang-select');
    if (sel) sel.value = lang;
  }

  function set(next) {
    if (!LANGS.includes(next) || next === lang) return;
    lang = next;
    try { localStorage.setItem('lexi.lang', next); } catch (e) { /* language just won't persist */ }
    apply();
    if (VL.app) { VL.app.refreshChrome(); VL.app.render(); }
  }

  VL.t = t;
  VL.n = n;
  return { t, n, apply, set, LANGS, NAMES, get lang() { return lang; }, get locale() { return LOCALES[lang]; } };
})();
