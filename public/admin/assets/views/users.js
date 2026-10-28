import { h, icon, get, table, tag, pager, qs, when } from '../common.js';

export default async function users() {
  const st = { q: '', role: '', status: '', page: 1 };
  const holder = h('div', {});
  const q = h('input', { class: 'input', type: 'search', placeholder: 'Search name or e-mail…', 'aria-label': 'Search users' });
  const mk = (name, label, options) => h('select', { class: 'input', 'aria-label': label, onchange: (e) => { st[name] = e.target.value; st.page = 1; load(); } }, options.map(([v, l]) => h('option', { value: v }, l)));
  async function load() {
    const data = await get('/admin/users' + qs({ ...st, pageSize: 20 }));
    holder.replaceChildren(table([
      { label: 'User', render: (u) => h('div', {}, h('a', { href: '/admin/users/' + u.id, style: { fontWeight: 800 } }, u.displayName), h('div', { class: 'muted small' }, u.email)) },
      { label: 'Role', render: (u) => u.role }, { label: 'Status', render: (u) => tag(u.status) }, { label: 'XP', render: (u) => String(u.xpTotal) }, { label: 'Lessons', render: (u) => String(u.lessons) }, { label: 'Joined', render: (u) => when(u.createdAt) }, { label: 'Last active', render: (u) => when(u.lastActiveAt) },
      { label: '', cls: 'acts', render: (u) => h('a', { class: 'btn small secondary', href: '/admin/users/' + u.id }, 'View') },
    ], data.items, { empty: 'No users match.' }), pager(data, (p) => { st.page = p; load(); }));
  }
  let timer; q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { st.q = q.value.trim(); st.page = 1; load(); }, 300); });
  const el = h('div', {}, h('div', { class: 'page-head' }, h('h1', {}, 'Users')), h('div', { class: 'toolbar' }, q, mk('role', 'Role', [['', 'Any role'], ['learner', 'Learners'], ['editor', 'Editors'], ['admin', 'Administrators']]), mk('status', 'Status', [['', 'Any status'], ['active', 'Active'], ['suspended', 'Suspended']])), holder);
  await load();
  return { el, title: 'Users', nav: 'users' };
}
