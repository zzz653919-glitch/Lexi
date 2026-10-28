import { h, get, table, pager, qs, when } from '../common.js';

export default async function audit() {
  const st = { action: '', page: 1 };
  const holder = h('div', {});
  async function load() {
    const d = await get('/admin/audit' + qs({ ...st, pageSize: 25 }));
    holder.replaceChildren(table([
      { label: 'When', render: (a) => when(a.created_at) }, { label: 'Who', render: (a) => a.admin_email }, { label: 'Action', render: (a) => h('code', {}, a.action) }, { label: 'Item', render: (a) => `${a.entity} ${a.entity_id}` },
      { label: 'Details', render: (a) => h('span', { class: 'truncate muted', title: JSON.stringify(a.details) }, JSON.stringify(a.details)) },
    ], d.items, { empty: 'No entries.' }), pager(d, (p) => { st.page = p; load(); }));
  }
  let timer; const f = h('input', { class: 'input', type: 'search', placeholder: 'Filter by action, e.g. course.', 'aria-label': 'Filter by action', oninput: (e) => { clearTimeout(timer); timer = setTimeout(() => { st.action = e.target.value.trim(); st.page = 1; load(); }, 300); } });
  await load();
  return { el: h('div', {}, h('div', { class: 'page-head' }, h('h1', {}, 'Audit log')), h('div', { class: 'toolbar' }, f), holder), title: 'Audit log', nav: 'audit' };
}
