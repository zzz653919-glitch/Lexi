/* Shared helpers. All modules hang off the global `VL` namespace so the app
   works when index.html is opened straight from disk (no ES-module/CORS issues). */
window.VL = { views: {} };

VL.util = (function () {
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function debounce(fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

  function dayKey(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function timeAgo(ts) {
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 45) return VL.t('ago.now');
    const m = Math.round(s / 60);
    if (m < 60) return VL.t('ago.min', { n: m });
    const h = Math.round(m / 60);
    if (h < 24) return VL.t('ago.hour', { n: h });
    const d = Math.round(h / 24);
    if (d < 7) return VL.n('ago.day', d);
    return new Date(ts).toLocaleDateString(VL.i18n.locale, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return { esc, uid, shuffle, debounce, pct, dayKey, timeAgo };
})();
