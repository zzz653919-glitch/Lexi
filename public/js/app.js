import { h, clear, icon, avatar, toast, spinner } from './ui.js';
import { api, get, session, ApiError } from './api.js';

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
route('/practice', view('practice'), { auth: true });
route('/vocabulary', view('vocabulary'), { auth: true });
route('/review', view('review'), { auth: true });
route('/leaderboard', view('leaderboard'), { auth: true });
route('/achievements', view('achievements'), { auth: true });
route('/profile', view('profile'), { auth: true });

const root = document.getElementById('app');
let shell = null, cleanup = null, navToken = 0;

const NAV = [
  { key: 'home', href: '/', label: 'Home', icon: 'home', mobile: true },
  { key: 'learn', href: '/learn', label: 'Learn', icon: 'path', mobile: true },
  { key: 'vocabulary', href: '/vocabulary', label: 'Words', icon: 'book', mobile: true },
  { key: 'review', href: '/review', label: 'Review', icon: 'cards', mobile: true },
  { key: 'leaderboard', href: '/leaderboard', label: 'Leaderboard', icon: 'trophy' },
  { key: 'achievements', href: '/achievements', label: 'Achievements', icon: 'star' },
  { key: 'profile', href: '/profile', label: 'Profile', icon: 'user', mobile: true },
];
const stats = { data: null };

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

function buildShell() {
  const site = session.config ? session.config.siteName : 'Lexi Learn';
  const chipBox = h('div', { class: 'chips', id: 'top-chips', 'aria-label': 'Your progress' });
  const sideChips = h('div', { class: 'chips', id: 'side-chips', style: { padding: '0 8px 12px' } });
  const sidebar = h('aside', { class: 'sidebar', 'aria-label': 'Main' },
    h('a', { class: 'brand', href: '/' }, h('img', { src: '/img/logo.svg', alt: '' }), site),
    sideChips,
    h('nav', { class: 'nav', 'aria-label': 'Main navigation' }, NAV.map((n) => h('a', { href: n.href, 'data-nav': n.key }, icon(n.icon), n.label))),
    h('div', { class: 'spacer' }),
    session.user && ['admin', 'editor'].includes(session.user.role) ? h('a', { class: 'btn secondary small', href: '/admin', target: '_self' }, icon('shield'), 'Admin panel') : null);
  const topbar = h('header', { class: 'topbar' }, h('a', { class: 'brand', href: '/' }, h('img', { src: '/img/logo.svg', alt: '' }), site), chipBox);
  const tabbar = h('nav', { class: 'tabbar', 'aria-label': 'Main navigation' }, NAV.filter((n) => n.mobile).map((n) => h('a', { href: n.href, 'data-nav': n.key }, icon(n.icon), h('span', {}, n.label))));
  const content = h('div', { class: 'content', id: 'content' });
  const main = h('main', { class: 'main', id: 'main', tabindex: '-1' }, content);
  const el = h('div', { class: 'app' }, h('a', { class: 'skip', href: '#main' }, 'Skip to content'), sidebar, h('div', {}, topbar, main), tabbar);
  return { el, content, main, chipBox, sideChips };
}

function statChips(into) {
  clear(into);
  const s = stats.data;
  if (!s) return;
  into.append(
    h('span', { class: 'chip flame', title: 'Day streak' }, icon('flame'), String(s.streak.current), h('span', { class: 'sr-only' }, ' day streak')),
    h('span', { class: 'chip bolt', title: 'Total XP' }, icon('bolt'), String(s.xpTotal), h('span', { class: 'sr-only' }, ' XP')),
    s.hearts.enabled ? h('span', { class: 'chip heart', title: 'Hearts' }, icon('heart'), String(s.hearts.hearts), h('span', { class: 'sr-only' }, ' hearts')) : null);
}
export async function refreshStats() {
  if (!session.user) return;
  try { stats.data = await get('/me/stats'); if (shell) { statChips(shell.chipBox); statChips(shell.sideChips); } } catch (_) { /* optional */ }
  return stats.data;
}

function setActive(key) {
  document.querySelectorAll('[data-nav]').forEach((a) => { if (a.dataset.nav === key) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
}

function showMaintenance(msg) {
  document.title = 'Maintenance';
  root.replaceChildren(h('div', { class: 'guest' }, h('div', { class: 'card auth-card center' }, h('img', { class: 'mascot', src: '/img/mascot.svg', alt: '' }), h('h1', {}, 'Back soon'), h('p', { class: 'muted' }, msg || 'We are updating the platform.'), h('a', { class: 'btn', href: '/login' }, 'Staff sign in'))));
}

async function render() {
  const token = ++navToken;
  if (cleanup) { try { cleanup(); } catch (_) { /* ignore */ } cleanup = null; }
  window.speechSynthesis && window.speechSynthesis.cancel();
  const path = location.pathname;
  let match = null, params = {};
  for (const r of routes) { const m = r.re.exec(path); if (m) { match = r; params = m.groups || {}; break; } }
  if (!match) return renderOutcome(token, { el: h('div', { class: 'card center' }, h('h1', {}, 'Page not found'), h('p', { class: 'muted' }, 'That page does not exist.'), h('a', { class: 'btn', href: '/' }, 'Go home')), title: 'Not found', nav: '' }, { auth: true });
  if (match.auth && !session.user) return navigate('/login?next=' + encodeURIComponent(path + location.search), true);
  if (match.guest && session.user) return navigate('/', true);
  const out = match.focus ? null : null;
  document.body.classList.toggle('focus', !!match.focus);
  if (shell) shell.content.replaceChildren(spinner());
  try {
    const res = await match.loader({ params, query: new URLSearchParams(location.search), navigate, refreshStats });
    if (token !== navToken) return;
    renderOutcome(token, res, match);
  } catch (e) {
    if (token !== navToken) return;
    if (e instanceof ApiError && e.status === 503) return;
    renderOutcome(token, { el: h('div', { class: 'card center' }, h('h1', {}, 'Something went wrong'), h('p', { class: 'muted' }, e.message || 'Please try again.'), h('button', { class: 'btn', onclick: () => render() }, 'Try again')), title: 'Error', nav: '' }, match || {});
  }
}

function renderOutcome(token, res, match) {
  cleanup = res.cleanup || null;
  document.title = (res.title ? res.title + ' · ' : '') + (session.config ? session.config.siteName : 'Lexi Learn');
  const wantsShell = session.user && !match.focus && !res.bare;
  if (wantsShell) {
    if (!shell || !root.contains(shell.el)) { shell = buildShell(); root.replaceChildren(shell.el); statChips(shell.chipBox); statChips(shell.sideChips); }
    shell.content.replaceChildren(res.el);
    setActive(res.nav);
    window.scrollTo(0, 0);
    shell.main.focus({ preventScroll: true });
    refreshStats();
  } else {
    shell = null;
    root.replaceChildren(res.el);
    window.scrollTo(0, 0);
  }
}

export async function boot() {
  session.onUnauthorized = () => { session.user = null; navigate('/login', true); };
  session.onMaintenance = showMaintenance;
  try {
    const [cfg, me] = await Promise.all([get('/public/config'), get('/auth/me')]);
    session.config = cfg; session.user = me.user; session.csrf = me.csrfToken;
    if (cfg.brandColor) document.documentElement.style.setProperty('--brand', cfg.brandColor);
    if (cfg.maintenance && !(me.user && ['admin', 'editor'].includes(me.user.role)) && location.pathname !== '/login') return showMaintenance(cfg.maintenance);
  } catch (e) {
    root.replaceChildren(h('div', { class: 'guest' }, h('div', { class: 'card auth-card center' }, h('h1', {}, 'Cannot connect'), h('p', { class: 'muted' }, e.message), h('button', { class: 'btn', onclick: () => location.reload() }, 'Retry'))));
    return;
  }
  await render();
}
export function setUser(user, csrf) { session.user = user; if (csrf) session.csrf = csrf; stats.data = null; shell = null; }
export const getStats = () => stats.data;
boot();
