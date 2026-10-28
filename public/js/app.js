import { h, clear, icon, avatar, toast, spinner } from './ui.js';
import { api, get, session, ApiError } from './api.js';
import { applyBrand } from './brand.js';
import { t, n, init as initI18n, onChange, lang } from './i18n.js';
import { languageSwitcher } from './lang-switcher.js';
import * as splash from './splash.js';
import { countUp, play } from './motion.js';
import { showLoader } from './loaders.js';

const routes = [];
const route = (pattern, loader, opts = {}) => routes.push({ re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '/?$'), loader, ...opts });
const view = (name) => async (...a) => (await import('./views/' + name + '.js')).default(...a);

route('/', view('home'), { any: true });
route('/login', view('auth-login'), { guest: true });
route('/register', view('auth-register'), { guest: true });
route('/forgot', view('auth-forgot'), { guest: true });
route('/reset', view('auth-reset'), { guest: true });
route('/learn', view('path'), { auth: true });
route('/attempt/:id', view('lesson'), { auth: true, focus: true });
route('/daily/:id', async (ctx) => (await import('./views/lesson.js')).default({ ...ctx, daily: true }), { auth: true, focus: true });
route('/welcome', view('welcome'), { auth: true, onboarding: true });
route('/placement', view('placement'), { auth: true, focus: true });
route('/results', view('results'), { auth: true });
route('/practice', view('practice'), { auth: true });
route('/vocabulary', view('vocabulary'), { auth: true });
route('/review', view('review'), { auth: true });
route('/leaderboard', view('leaderboard'), { auth: true });
route('/achievements', view('achievements'), { auth: true });
route('/profile', view('profile'), { auth: true });

const root = document.getElementById('app');
let shell = null, cleanup = null, navToken = 0;

const NAV = [
  { key: 'home', href: '/', label: 'nav.home', icon: 'home', mobile: true },
  { key: 'learn', href: '/learn', label: 'nav.learn', icon: 'path', mobile: true },
  { key: 'vocabulary', href: '/vocabulary', label: 'nav.vocabulary', icon: 'book', mobile: true },
  { key: 'review', href: '/review', label: 'nav.review', icon: 'cards', mobile: true },
  { key: 'leaderboard', href: '/leaderboard', label: 'nav.leaderboard', icon: 'trophy' },
  { key: 'achievements', href: '/achievements', label: 'nav.achievements', icon: 'star' },
  { key: 'profile', href: '/profile', label: 'nav.profile', icon: 'user', mobile: true },
];
const stats = { data: null, prev: null };
const LOADER_KIND = [[/^\/learn/, 'progress'], [/^\/achievements/, 'progress'], [/^\/vocabulary/, 'vocab'], [/^\/(attempt|daily)\//, 'lesson'], [/^\/(placement|welcome)/, 'quiz'], [/^\/(review|practice)/, 'quiz']];
const loaderKind = (path) => (LOADER_KIND.find(([re]) => re.test(path)) || [null, 'generic'])[1];
let firstPaint = true;
const siteName = () => (session.config ? session.config.siteName : 'Lexi Learn');

export function navigate(path, replace = false) {
  if (path === location.pathname + location.search) return render();
  history[replace ? 'replaceState' : 'pushState']({}, '', path);
  return render();
}
document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a[href]');
  if (!a || a.target || a.hasAttribute('download') || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
  const u = new URL(a.href, location.href);
  if (u.origin !== location.origin || u.pathname.startsWith('/admin') || u.pathname.startsWith('/api') || u.pathname.startsWith('/uploads')) return;
  e.preventDefault(); navigate(u.pathname + u.search);
});
window.addEventListener('popstate', () => render());

/* the language choice is stored on this device and, when signed in, in the user's profile (the profile wins on the next visit) */
export const saveLanguage = (code) => (session.user ? api('PATCH', '/me', { uiLanguage: code }).then((r) => { session.user = r.user; }) : Promise.resolve());
export const switcher = (cls) => languageSwitcher({ save: saveLanguage, className: cls });

function buildShell() {
  const chipBox = h('div', { class: 'chips top-chips', id: 'top-chips', 'aria-label': t('nav.progress') });
  const sideChips = h('div', { class: 'chips', id: 'side-chips', style: { padding: '0 8px 12px' } });
  const sidebar = h('aside', { class: 'sidebar', 'aria-label': t('nav.main') },
    h('a', { class: 'brand', href: '/' }, h('img', { src: '/img/logo.svg', alt: '' }), siteName()),
    sideChips,
    h('div', { class: 'side-lang' }, switcher('wide')),
    h('nav', { class: 'nav', 'aria-label': t('nav.main') }, NAV.map((it) => h('a', { href: it.href, 'data-nav': it.key }, icon(it.icon), t(it.label)))),
    h('div', { class: 'spacer' }),
    session.user && ['admin', 'editor'].includes(session.user.role) ? h('a', { class: 'btn secondary small', href: '/admin', target: '_self' }, icon('shield'), t('nav.admin')) : null);
  const topbar = h('header', { class: 'topbar' }, h('a', { class: 'brand', href: '/' }, h('img', { src: '/img/logo.svg', alt: '' }), h('span', { class: 'brand-name' }, siteName())), switcher('compact'), chipBox);
  const tabbar = h('nav', { class: 'tabbar', 'aria-label': t('nav.main') }, NAV.filter((it) => it.mobile).map((it) => h('a', { href: it.href, 'data-nav': it.key }, icon(it.icon), h('span', {}, t(it.label)))));
  const content = h('div', { class: 'content', id: 'content' });
  const main = h('main', { class: 'main', id: 'main', tabindex: '-1' }, content);
  const el = h('div', { class: 'app' }, h('a', { class: 'skip', href: '#main' }, t('app.skip')), sidebar, h('div', {}, topbar, main), tabbar);
  return { el, content, main, chipBox, sideChips };
}

function statChips(into) {
  clear(into);
  const s = stats.data;
  if (!s) return;
  const prev = stats.prev;
  const xpNum = h('span', { class: 'num' }, String(s.xpTotal)), streakNum = h('span', { class: 'num' }, String(s.streak.current));
  const flame = h('span', { class: 'chip flame' + (s.streak.current > 0 ? ' lit' : ''), title: t('stats.streak') }, icon('flame'), streakNum, h('span', { class: 'sr-only' }, ' ' + t('stats.streak')));
  const bolt = h('span', { class: 'chip bolt', title: t('stats.total_xp') }, icon('bolt'), xpNum, h('span', { class: 'sr-only' }, ' ' + t('stats.xp')));
  // real changes only: the XP counter counts up from the old total, the streak chip pops when the streak grew
  if (prev && s.xpTotal > prev.xpTotal) { countUp(xpNum, prev.xpTotal, s.xpTotal); play(bolt, 'stat-pop'); }
  if (prev && s.streak.current > prev.streak.current) play(flame, 'stat-pop', 700);
  into.append(
    flame,
    bolt,
    s.hearts.enabled ? h('span', { class: 'chip heart', title: t('stats.hearts') }, icon('heart'), String(s.hearts.hearts), h('span', { class: 'sr-only' }, ' ' + t('stats.hearts'))) : null);
}
export async function refreshStats() {
  if (!session.user) return;
  try { stats.prev = stats.data; stats.data = await get('/me/stats'); if (shell) { statChips(shell.chipBox); statChips(shell.sideChips); stats.prev = null; } } catch (_) { /* optional */ }
  return stats.data;
}

function setActive(key) {
  document.querySelectorAll('[data-nav]').forEach((a) => { if (a.dataset.nav === key) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
}

function showMaintenance(msg) {
  document.title = t('app.maintenance_title');
  root.replaceChildren(h('main', { class: 'guest' }, h('div', { class: 'guest-bar' }, switcher('compact')), h('div', { class: 'card auth-card center' }, h('img', { class: 'mascot', src: '/img/mascot.svg', alt: '' }), h('h1', {}, t('app.maintenance_title')), h('p', { class: 'muted' }, msg), h('a', { class: 'btn', href: '/login' }, t('app.staff_sign_in')))));
}

async function render() {
  const token = ++navToken;
  if (cleanup) { try { cleanup(); } catch (_) { /* ignore */ } cleanup = null; }
  window.speechSynthesis && window.speechSynthesis.cancel();
  const path = location.pathname;
  let match = null, params = {};
  for (const r of routes) { const m = r.re.exec(path); if (m) { match = r; params = m.groups || {}; break; } }
  if (!match) return renderOutcome(token, { el: h('div', { class: 'card center' }, h('h1', {}, t('app.not_found_title')), h('p', { class: 'muted' }, t('app.not_found_text')), h('a', { class: 'btn', href: '/' }, t('app.go_home'))), title: t('app.not_found_title'), nav: '' }, { auth: true });
  if (match.auth && !session.user) return navigate('/login?next=' + encodeURIComponent(path + location.search), true);
  if (match.guest && session.user) return navigate('/', true);
  // a new learner starts with the welcome screen (placement test or choosing a level); staff accounts and existing learners skip it
  const fresh = session.user && session.user.role === 'learner' && !session.user.onboarded;
  if (fresh && match.auth && !['/welcome', '/placement'].includes(path)) return navigate('/welcome', true);
  if (match.onboarding && session.user && !fresh) return navigate('/', true);
  document.body.classList.toggle('focus', !!match.focus);
  // a loader appears only if the page really takes a moment to load (and is removed as soon as it has loaded)
  const stopLoader = shell && !firstPaint ? showLoader(shell.content, loaderKind(path), { onRetry: () => render() }) : () => {};
  try {
    const res = await match.loader({ params, query: new URLSearchParams(location.search), navigate, refreshStats });
    stopLoader();
    if (token !== navToken) return;
    renderOutcome(token, res, match);
  } catch (e) {
    stopLoader();
    if (token !== navToken) return;
    if (e instanceof ApiError && e.status === 503) return;
    renderOutcome(token, { el: h('div', { class: 'card center' }, h('h1', {}, t('app.error_title')), h('p', { class: 'muted' }, e.message || t('app.error_text')), h('button', { class: 'btn', onclick: () => render() }, t('common.try_again'))), title: t('app.error_title'), nav: '' }, match || {});
  }
}

function renderOutcome(token, res, match) {
  cleanup = res.cleanup || null;
  document.title = (res.title ? res.title + ' · ' : '') + siteName();
  const wantsShell = session.user && !match.focus && !res.bare;
  if (wantsShell) {
    if (!shell || !root.contains(shell.el)) { shell = buildShell(); root.replaceChildren(shell.el); statChips(shell.chipBox); statChips(shell.sideChips); }
    shell.content.replaceChildren(res.el);
    transition(res.el, match);
    setActive(res.nav);
    window.scrollTo(0, 0);
    shell.main.focus({ preventScroll: true });
    refreshStats();
  } else {
    shell = null;
    root.replaceChildren(res.el);
    transition(res.el, match);
    window.scrollTo(0, 0);
  }
  if (firstPaint) { firstPaint = false; splash.say(t('load.almost')); setTimeout(splash.finish, 320); }
}
/* fade / slide / scale the new page in (lessons zoom in); the class is removed afterwards so it can play again */
function transition(node, match) {
  if (!node || !node.classList) return;
  const cls = match && match.focus ? 'page-zoom' : 'page-in';
  node.classList.add(cls);
  setTimeout(() => node.classList.remove(cls), 450);
}

export async function boot() {
  session.onUnauthorized = () => { session.user = null; navigate('/login', true); };
  session.onMaintenance = (m) => { splash.dismiss(); showMaintenance(m); };
  try {
    // real start-up stages: 1 texts of the device language, 2 site settings + account, 3 the account's language, 4 the first page
    splash.step(0, 4);
    await initI18n({ user: null, config: null });
    splash.step(1, 4, t('load.prepare'));
    const [cfg, me] = await Promise.all([get('/public/config'), get('/auth/me')]);
    session.config = cfg; session.user = me.user; session.csrf = me.csrfToken;
    if (cfg.brandColor) applyBrand(cfg.brandColor);
    splash.step(2, 4);
    await initI18n({ user: me.user, config: cfg });
    splash.step(3, 4, t('load.lessons'));
    if (cfg.maintenance && !(me.user && ['admin', 'editor'].includes(me.user.role)) && location.pathname !== '/login') { splash.dismiss(); return showMaintenance(cfg.maintenance); }
  } catch (e) {
    try { await initI18n({ user: null, config: null }); } catch (_) { /* texts stay as keys */ }
    splash.dismiss();
    root.replaceChildren(h('main', { class: 'guest' }, h('div', { class: 'card auth-card center' }, h('h1', {}, t('app.cannot_connect')), h('p', { class: 'muted' }, e.message), (e.data && e.data.notApi) || e.status === 0 ? h('p', { class: 'small muted' }, t('app.not_server')) : null, h('button', { class: 'btn', onclick: () => location.reload() }, t('app.retry')))));
    return;
  }
  // changing the language re-renders the current page (and rebuilds the navigation) without reloading the application
  onChange(async () => {
    shell = null;
    if (session.config && session.config.maintenance && !(session.user && ['admin', 'editor'].includes(session.user.role))) { try { const c = await get('/public/config'); session.config = c; showMaintenance(c.maintenance || ''); } catch (_) { /* ignore */ } return; }
    document.title = siteName();
    await render();
  });
  await render();
}
export function setUser(user, csrf) { session.user = user; if (csrf) session.csrf = csrf; stats.data = null; shell = null; }
export const getStats = () => stats.data;
boot();
