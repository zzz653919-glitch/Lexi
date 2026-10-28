/* Browser side of the translation system (the engine itself is /shared/i18n-core.js, shared with the server).
   Language precedence:  1. the signed-in user's saved language (server)  2. this device's last choice (localStorage)
   3. the site default (Uzbek unless an administrator changed it).  Switching re-renders the current page without reloading the app. */
const core = globalThis.LexiI18n;
export const LANGUAGES = core.LANGUAGES;
export const FALLBACK = core.FALLBACK;
export const isSupported = core.isSupported;
const STORE_KEY = 'lexi.lang';

let current = core.DEFAULT_LANGUAGE;
let dicts = {};
let offered = LANGUAGES.map((l) => l.code);
const listeners = new Set();

const readStore = () => { try { const v = localStorage.getItem(STORE_KEY); return isSupported(v) ? v : null; } catch (_) { return null; } };
const writeStore = (v) => { try { localStorage.setItem(STORE_KEY, v); } catch (_) { /* private mode: the choice still applies to this visit */ } };

async function load(code) {
  const res = await fetch('/api/i18n/' + code, { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Cannot load language ' + code);
  const body = await res.json();
  dicts[code] = body.messages || {};
  if (code !== FALLBACK) dicts[FALLBACK] = body.fallback || dicts[FALLBACK] || {};
}

export const lang = () => current;
export const languages = () => LANGUAGES.filter((l) => offered.includes(l.code));
export const info = (code = current) => LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

/* picks the starting language (see precedence above) and loads its texts */
export async function init({ user, config }) {
  if (config && Array.isArray(config.languages) && config.languages.length) offered = config.languages.map((l) => l.code);
  const wanted = [user && user.uiLanguage, readStore(), config && config.defaultLanguage, core.DEFAULT_LANGUAGE].find((c) => c && isSupported(c) && offered.includes(c)) || core.DEFAULT_LANGUAGE;
  await use(wanted, { remember: !!(user && user.uiLanguage) || !!readStore() });
  return current;
}
async function use(code, { remember = true } = {}) {
  try { await load(code); } catch (e) { if (code !== FALLBACK) { code = FALLBACK; await load(code); } else throw e; }
  current = code;
  document.documentElement.lang = code;
  if (remember) writeStore(code);
}
/* adopts a language that comes from the server (e.g. right after sign-in) without saving it back or re-rendering */
export async function adopt(code) {
  if (!isSupported(code) || code === current) return current;
  await use(code);
  return current;
}
/* switches the interface language; save(code) is called to store it in the user's profile when signed in */
export async function setLanguage(code, { save } = {}) {
  if (!isSupported(code) || code === current) return current;
  await use(code);
  if (save) { try { await save(code); } catch (_) { /* the device choice is kept; the profile is updated on the next change */ } }
  listeners.forEach((fn) => { try { fn(code); } catch (e) { console.error(e); } });
  return current;
}

export const t = (key, params) => core.translate(dicts, current, key, params);
/* t() with a number: plural forms and locale-aware number formatting ({n} in the text) */
export const n = (key, count, params) => core.translate(dicts, current, key, { ...(params || {}), n: count });
export const has = (key) => typeof (dicts[current] || {})[key] !== 'undefined';
export const fmt = {
  date: (v, opts) => core.formatDate(current, v, opts),
  dateTime: (v) => core.formatDate(current, v, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
  time: (v) => (v ? core.formatDate(current, v, { hour: '2-digit', minute: '2-digit' }) : ''),
  weekday: (v, style = 'narrow') => core.formatDate(current, v, { weekday: style }),
  number: (v, opts) => core.numberFormat(current, v, opts),
};
