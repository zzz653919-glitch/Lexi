import { h, get, table, tag, pager, qs, when, t, fmt } from '../common.js';

export default async function users() {
  const st = { q: '', role: '', status: '', page: 1 };
  const holder = h('div', {});
  const q = h('input', { class: 'input', type: 'search', placeholder: t('adm.users_search_ph'), 'aria-label': t('adm.users_search') });
  const mk = (name, label, options) => h('select', { class: 'input', 'aria-label': label, onchange: (e) => { st[name] = e.target.value; st.page = 1; load(); } }, options.map(([v, l]) => h('option', { value: v }, l)));
  async function load() {
    const data = await get('/admin/users' + qs({ ...st, pageSize: 20 }));
    holder.replaceChildren(table([
      { label: t('adm.col.user'), render: (u) => h('div', {}, h('a', { href: '/admin/users/' + u.id, style: { fontWeight: 800 } }, u.displayName), h('div', { class: 'muted small' }, u.email)) },
      { label: t('adm.col.role'), render: (u) => t('adm.role.' + u.role) }, { label: t('adm.col.status'), render: (u) => tag(u.status) }, { label: 'XP', render: (u) => fmt.number(u.xpTotal) }, { label: t('adm.col.lessons'), render: (u) => fmt.number(u.lessons) }, { label: t('adm.col.joined'), render: (u) => when(u.createdAt) }, { label: t('adm.col.last_active'), render: (u) => when(u.lastActiveAt) },
      { label: '', cls: 'acts', render: (u) => h('a', { class: 'btn small secondary', href: '/admin/users/' + u.id }, t('adm.view')) },
    ], data.items, { empty: t('adm.no_users') }), pager(data, (p) => { st.page = p; load(); }));
  }
  let timer; q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { st.q = q.value.trim(); st.page = 1; load(); }, 300); });
  const el = h('div', {}, h('div', { class: 'page-head' }, h('h1', {}, t('adm.nav.users'))), h('div', { class: 'toolbar' }, q, mk('role', t('adm.col.role'), [['', t('adm.any_role')], ['learner', t('adm.role.learners')], ['editor', t('adm.role.editors')], ['admin', t('adm.role.admins')]]), mk('status', t('adm.col.status'), [['', t('adm.any_status')], ['active', t('adm.status.active')], ['suspended', t('adm.status.suspended')]])), holder);
  await load();
  return { el, title: t('adm.nav.users'), nav: 'users' };
}
