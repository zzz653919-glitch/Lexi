import { h, icon, clear, spinner, toast } from '/js/ui.js';
import { api, get, session, ApiError } from '/js/api.js';
import { applyBrand } from '/js/brand.js';

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

const NAV = [
  { key: 'dashboard', href: '/admin', label: 'Dashboard', icon: 'chart', roles: ['admin'] },
  { key: 'courses', href: '/admin/courses', label: 'Courses', icon: 'path' },
  { key: 'vocabulary', href: '/admin/vocabulary', label: 'Vocabulary', icon: 'book' },
  { key: 'users', href: '/admin/users', label: 'Users', icon: 'users', roles: ['admin'] },
  { key: 'settings', href: '/admin/settings', label: 'Settings', icon: 'gear', roles: ['admin'] },
  { key: 'audit', href: '/admin/audit', label: 'Audit log', icon: 'list', roles: ['admin'] },
];
function buildShell() {
  const u = session.user;
  const main = h('main', { class: 'adm-main', id: 'main', tabindex: '-1' });
  const side = h('aside', { class: 'adm-side' },
    h('a', { class: 'brand', href: '/admin' }, h('img', { src: '/img/logo.svg', alt: '' }), session.config ? session.config.siteName : 'Lexi Learn'),
    h('div', { class: 'tag' }, 'Admin panel · ' + u.role),
    h('nav', { 'aria-label': 'Admin' }, NAV.filter((n) => !n.roles || n.roles.includes(u.role)).map((n) => h('a', { class: 'nav-i', href: n.href, 'data-nav': n.key }, icon(n.icon), n.label)), h('a', { class: 'nav-i', href: '/learn' }, icon('home'), 'Learner site')),
    h('div', { class: 'spacer', style: { flex: 1 } }),
    h('button', { class: 'btn ghost small', type: 'button', onclick: async () => { await api('POST', '/auth/logout', {}); location.href = '/admin/login'; } }, icon('logout'), `Sign out (${u.displayName})`));
  const el = h('div', { class: 'adm' }, h('a', { class: 'skip', href: '#main' }, 'Skip to content'), side, main);
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
  shell.main.replaceChildren(spinner());
  if (!m) { shell.main.replaceChildren(h('div', { class: 'card center' }, h('h1', {}, 'Page not found'), h('a', { class: 'btn', href: user.role === 'admin' ? '/admin' : '/admin/courses' }, 'Back'))); return; }
  try {
    const res = await m.loader({ params, query: new URLSearchParams(location.search), navigate });
    if (token !== navToken) return;
    document.title = (res.title ? res.title + ' · ' : '') + 'Admin';
    shell.main.replaceChildren(res.el);
    document.querySelectorAll('[data-nav]').forEach((a) => { if (a.dataset.nav === res.nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    window.scrollTo(0, 0); shell.main.focus({ preventScroll: true });
  } catch (e) {
    if (token !== navToken) return;
    shell.main.replaceChildren(h('div', { class: 'card center' }, h('h1', {}, e.status === 404 ? 'Not found' : 'Something went wrong'), h('p', { class: 'muted' }, e.message), h('button', { class: 'btn', onclick: () => render() }, 'Try again')));
  }
}
(async () => {
  try {
    const [cfg, me] = await Promise.all([get('/public/config'), get('/auth/me')]);
    session.config = cfg; session.csrf = me.csrfToken; session.user = me.user;
    if (cfg.brandColor) applyBrand(cfg.brandColor);
    if (!me.user || !['admin', 'editor'].includes(me.user.role)) return location.replace('/admin/login');
    session.onUnauthorized = () => location.replace('/admin/login');
    await render();
  } catch (e) { root.replaceChildren(h('div', { class: 'guest' }, h('div', { class: 'card center auth-card' }, h('h1', {}, 'Cannot load the admin panel'), h('p', { class: 'muted' }, e.message)))); }
})();
