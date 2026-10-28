import { h, icon, get, put, del, table, pager, qs, formDialog, toast, t, n, fmt, ApiError } from '../common.js';
import { LANGUAGES } from '/js/i18n.js';

/* Administrator page: how complete each interface language is, which texts are missing, and validated edits that are stored in the database */
export default async function translations({ query }) {
  const info = await get('/admin/i18n');
  const st = { lang: LANGUAGES.some((l) => l.code === query.get('lang')) ? query.get('lang') : 'uz', filter: query.get('filter') || 'all', q: '', group: '', page: 1 };
  const holder = h('div', {}), cards = h('div', { class: 'lang-cards' });
  const plain = (v) => (typeof v === 'string' ? v : v && typeof v === 'object' ? Object.entries(v).map(([k, x]) => `${k}: ${x}`).join(' · ') : '');

  const drawCards = (langs) => cards.replaceChildren(...langs.map((l) => h('button', { type: 'button', class: 'card lang-card', 'aria-pressed': String(l.code === st.lang), onclick: () => { st.lang = l.code; st.page = 1; drawCards(langs); load(); } },
    h('b', {}, `${LANGUAGES.find((x) => x.code === l.code).flag} ${t('lang.native.' + l.code)}`, info.defaultLanguage === l.code ? h('span', { class: 'badge', style: { marginLeft: '8px' } }, t('adm.i18n.default')) : null),
    h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': l.percent, 'aria-label': t('adm.i18n.complete', { percent: l.percent }) }, h('i', { style: { width: l.percent + '%' } })),
    h('div', { class: 'muted small' }, t('adm.i18n.stats', { percent: l.percent, translated: fmt.number(l.translated), total: fmt.number(l.total) })),
    l.missing ? h('div', { class: 'chip bad' }, n('adm.i18n.n_missing', l.missing)) : h('div', { class: 'chip ok' }, icon('check'), t('adm.i18n.complete_all')),
    l.overrides ? h('div', { class: 'muted small' }, n('adm.i18n.n_overrides', l.overrides)) : null)));
  drawCards(info.languages);

  async function refreshCards() { const r = await get('/admin/i18n'); info.languages = r.languages; drawCards(r.languages); }

  async function edit(entry) {
    const cats = entry.plural ? data.pluralCategories : null;
    const cur = entry.value;
    const fields = entry.plural
      ? cats.map((c) => ({ name: 'p_' + c, label: t('adm.i18n.form', { form: c }), type: 'textarea', rows: 2, value: (cur && cur[c]) || '', maxlength: 600 }))
      : [{ name: 'value', label: t('adm.i18n.text'), type: 'textarea', rows: 3, value: typeof cur === 'string' ? cur : '', maxlength: 600 }];
    const enBox = h('div', { class: 'card tight' }, h('div', { class: 'muted small' }, t('adm.i18n.english_reference')), h('div', { lang: 'en' }, plain(entry.en)));
    const hint = h('p', { class: 'muted small' }, t('adm.i18n.placeholders_hint'));
    const r = await formDialog({ title: t('adm.i18n.edit_title', { key: entry.key }), wide: true, fields, extra: h('div', {}, enBox, hint), submitLabel: t('adm.i18n.publish'),
      save: async (v) => {
        const value = entry.plural ? Object.fromEntries(cats.map((c) => [c, String(v['p_' + c] || '').trim()]).filter(([, x]) => x)) : String(v.value || '').trim();
        try { return await put('/admin/i18n/' + st.lang, { key: entry.key, value }); }
        catch (e) { if (e instanceof ApiError && e.fields && e.fields.value) throw new ApiError(e.status, e.fields.value, { fields: { [fields[0].name]: e.fields.value } }); throw e; }
      } });
    if (r) { toast(t('adm.i18n.published'), 'success'); await refreshCards(); load(); }
  }
  async function reset(entry) { await del(`/admin/i18n/${st.lang}/${encodeURIComponent(entry.key)}`); toast(t('adm.i18n.reset_done'), 'success'); await refreshCards(); load(); }

  let data = { pluralCategories: ['one', 'other'] };
  async function load() {
    data = await get(`/admin/i18n/${st.lang}` + qs({ filter: st.filter, q: st.q, group: st.group, page: st.page, pageSize: 25 }));
    holder.replaceChildren(table([
      { label: t('adm.i18n.key'), render: (e) => h('code', {}, e.key) },
      { label: t('adm.i18n.english'), render: (e) => h('span', { lang: 'en' }, plain(e.en)) },
      { label: t('adm.i18n.translation'), render: (e) => (e.missing ? h('span', { class: 'chip bad' }, t('adm.i18n.missing')) : h('span', { lang: st.lang }, plain(e.value))) },
      { label: t('adm.col.status'), render: (e) => (e.overridden ? h('span', { class: 'badge' }, t('adm.i18n.edited')) : e.missing ? '' : h('span', { class: 'muted small' }, t('adm.i18n.from_file'))) },
      { label: '', cls: 'acts', render: (e) => h('div', { class: 'row', style: { flexWrap: 'nowrap', justifyContent: 'flex-end' } }, e.overridden ? h('button', { class: 'btn ghost small', type: 'button', onclick: () => reset(e) }, t('adm.i18n.reset')) : null, h('button', { class: 'btn secondary small', type: 'button', onclick: () => edit(e) }, icon('edit'), t('adm.edit'))) },
    ], data.items, { empty: t('adm.i18n.nothing') }), pager(data, (p) => { st.page = p; load(); }));
  }
  let timer;
  const q = h('input', { class: 'input', type: 'search', placeholder: t('adm.i18n.search_ph'), 'aria-label': t('adm.search'), oninput: (e) => { clearTimeout(timer); timer = setTimeout(() => { st.q = e.target.value.trim(); st.page = 1; load(); }, 300); } });
  const mk = (name, label, options) => h('select', { class: 'input', 'aria-label': label, onchange: (e) => { st[name] = e.target.value; st.page = 1; load(); } }, options.map(([v, l]) => h('option', { value: v, selected: String(st[name]) === String(v) }, l)));
  const el = h('div', {}, h('div', { class: 'page-head' }, h('h1', {}, t('adm.nav.translations')), h('a', { class: 'btn secondary small', href: '#', onclick: (e) => { e.preventDefault(); location.href = `/api/admin/i18n/${st.lang}/export`; } }, icon('download'), t('adm.i18n.export'))),
    h('p', { class: 'muted' }, t('adm.i18n.intro')), cards,
    h('div', { class: 'toolbar' }, q, mk('filter', t('adm.i18n.filter'), [['all', t('adm.i18n.filter_all')], ['missing', t('adm.i18n.filter_missing')], ['overridden', t('adm.i18n.filter_edited')]]), mk('group', t('adm.i18n.group'), [['', t('adm.i18n.all_groups')]].concat(info.groups.map((g) => [g, g])))),
    holder);
  await load();
  return { el, title: t('adm.nav.translations'), nav: 'i18n' };
}
