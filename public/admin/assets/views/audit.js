import { h, get, table, pager, qs, when, t } from '../common.js';

export default async function audit() {
  const st = { action: '', page: 1 };
  const holder = h('div', {});
  async function load() {
    const d = await get('/admin/audit' + qs({ ...st, pageSize: 25 }));
    holder.replaceChildren(table([
      { label: t('adm.col.when'), render: (a) => when(a.created_at) }, { label: t('adm.col.who'), render: (a) => a.admin_email }, { label: t('adm.col.action'), render: (a) => h('code', {}, a.action) }, { label: t('adm.col.item'), render: (a) => `${a.entity} ${a.entity_id}` },
      { label: t('adm.col.details'), render: (a) => h('span', { class: 'truncate muted', title: JSON.stringify(a.details) }, JSON.stringify(a.details)) },
    ], d.items, { empty: t('adm.no_entries') }), pager(d, (p) => { st.page = p; load(); }));
  }
  let timer; const f = h('input', { class: 'input', type: 'search', placeholder: t('adm.audit_filter_ph'), 'aria-label': t('adm.audit_filter'), oninput: (e) => { clearTimeout(timer); timer = setTimeout(() => { st.action = e.target.value.trim(); st.page = 1; load(); }, 300); } });
  await load();
  return { el: h('div', {}, h('div', { class: 'page-head' }, h('h1', {}, t('adm.nav.audit'))), h('div', { class: 'toolbar' }, f), holder), title: t('adm.nav.audit'), nav: 'audit' };
}
