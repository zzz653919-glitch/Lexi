import { h, icon, clear, spinner, toast } from '/js/ui.js';
import { api, get, session, ApiError } from '/js/api.js';
import { applyBrand } from '/js/brand.js';
import { t, init as initI18n, onChange } from '/js/i18n.js';
import { languageSwitcher } from '/js/lang-switcher.js';
import '/js/motion.js';
import { showLoader } from '/js/loaders.js';

const routes = [];
const route = (pattern, loader, roles) => routes.push({ re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '/?$'), loader, roles });
const view = (n) => async (...a) => (await import('./views/' + n + '.js')).default(...a);
route('/admin', view('dashboard'), ['admin']);
route('/admin/courses', view('courses'));
route('/admin/courses/:id', view('course'));
route('/admin/lessons/:id', view('lesson'));
route('/admin/vocabulary', view('vocabulary'));
route('/admin/users', view('users'), ['admin']);
route('/admin/users/:id', view('user'), ['admin']);
route('/admin/settings', view('settings'), ['admin']);
route('/admin/translations', view('translations'), ['admin']);
route('/admin/audit', view('audit'), ['admin']);

const root = document.getElementById('app');
let shell = null, navToken = 0;

export function navigate(path, replace) { history[replace ? 'replaceState' : 'pushState']({}, '', path); return render(); }
document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a[href]');
  if (!a || a.target || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
  const u = new URL(a.href, location.href);
  if (u.origin !== location.origin || !u.pathname.startsWith('/admin') || u.pathname.startsWith('/admin/login')) return;
  e.preventDefault(); navigate(u.pathname + u.search);
});
window.addEventListener('popstate', () => render());

const saveLanguage = (code) => api('PATCH', '/me', { uiLanguage: code }).then((r) => { session.user = r.user; });
const NAV = [
  { key: 'dashboard', href: '/admin', labelKey: 'adm.nav.dashboard', icon: 'chart', roles: ['admin'] },
  { key: 'courses', href: '/admin/courses', labelKey: 'adm.nav.courses', icon: 'path' },
  { key: 'vocabulary', href: '/admin/vocabulary', labelKey: 'adm.nav.vocabulary', icon: 'book' },
  { key: 'users', href: '/admin/users', labelKey: 'adm.nav.users', icon: 'users', roles: ['admin'] },
  { key: 'settings', href: '/admin/settings', labelKey: 'adm.nav.settings', icon: 'gear', roles: ['admin'] },
  { key: 'i18n', href: '/admin/translations', labelKey: 'adm.nav.translations', icon: 'globe', roles: ['admin'] },
  { key: 'audit', href: '/admin/audit', labelKey: 'adm.nav.audit', icon: 'list', roles: ['admin'] },
];
function buildShell() {
  const u = session.user;
  const main = h('main', { class: 'adm-main', id: 'main', tabindex: '-1' });
  const side = h('aside', { class: 'adm-side' },
    h('a', { class: 'brand', href: '/admin' }, h('img', { src: '/img/logo.svg', alt: '' }), session.config ? session.config.siteName : 'Lexi Learn'),
    h('div', { class: 'tag' }, t('adm.panel_role', { role: t('adm.role.' + u.role) })),
    h('nav', { 'aria-label': t('adm.nav_label') }, NAV.filter((n) => !n.roles || n.roles.includes(u.role)).map((n) => h('a', { class: 'nav-i', href: n.href, 'data-nav': n.key }, icon(n.icon), t(n.labelKey))), h('a', { class: 'nav-i', href: '/learn' }, icon('home'), t('nav.learner_site'))),
    h('div', { class: 'spacer', style: { flex: 1 } }),
    languageSwitcher({ save: saveLanguage, className: 'wide' }),
    h('button', { class: 'btn ghost small', type: 'button', onclick: async () => { await api('POST', '/auth/logout', {}); location.href = '/admin/login'; } }, icon('logout'), t('nav.sign_out_as', { name: u.displayName })));
  const el = h('div', { class: 'adm' }, h('a', { class: 'skip', href: '#main' }, t('app.skip')), side, main);
  return { el, main };
}
async function render() {
  const token = ++navToken;
  const path = location.pathname;
  let m = null, params = {};
  for (const r of routes) { const x = r.re.exec(path); if (x) { m = r; params = x.groups || {}; break; } }
  if (!shell) { shell = buildShell(); root.replaceChildren(shell.el); }
  const user = session.user;
  if (m && m.roles && !m.roles.includes(user.role)) return navigate('/admin/courses', true);
  const stopLoader = showLoader(shell.main, 'generic', { onRetry: () => render() });
  if (!m) { shell.main.replaceChildren(h('div', { class: 'card center' }, h('h1', {}, t('adm.page_not_found')), h('a', { class: 'btn', href: user.role === 'admin' ? '/admin' : '/admin/courses' }, t('common.back')))); return; }
  try {
    const res = await m.loader({ params, query: new URLSearchParams(location.search), navigate });
    stopLoader();
    if (token !== navToken) return;
    document.title = (res.title ? res.title + ' · ' : '') + t('adm.admin');
    shell.main.replaceChildren(res.el);
    res.el.classList.add('page-in'); setTimeout(() => res.el.classList.remove('page-in'), 450);
    document.querySelectorAll('[data-nav]').forEach((a) => { if (a.dataset.nav === res.nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    window.scrollTo(0, 0); shell.main.focus({ preventScroll: true });
  } catch (e) {
    stopLoader();
    if (token !== navToken) return;
    shell.main.replaceChildren(h('div', { class: 'card center' }, h('h1', {}, e.status === 404 ? t('err.not_found') : t('app.error_title')), h('p', { class: 'muted' }, e.message), h('button', { class: 'btn', onclick: () => render() }, t('app.retry'))));
  }
}
(async () => {
  try {
    const [cfg, me] = await Promise.all([get('/public/config'), get('/auth/me')]);
    session.config = cfg; session.csrf = me.csrfToken; session.user = me.user;
    if (cfg.brandColor) applyBrand(cfg.brandColor);
    await initI18n({ user: me.user, config: cfg });
    if (!me.user || !['admin', 'editor'].includes(me.user.role)) return location.replace('/admin/login');
    session.onUnauthorized = () => location.replace('/admin/login');
    onChange(() => { shell = null; render(); });
    await render();
  } catch (e) { root.replaceChildren(h('div', { class: 'guest' }, h('div', { class: 'card center auth-card' }, h('h1', {}, t('adm.cannot_load')), h('p', { class: 'muted' }, e.message)))); }
})();
