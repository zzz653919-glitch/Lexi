import { h, icon, modal, toast, confirmDialog, clear } from '/js/ui.js';
import { api, get, post, put, patch, del, ApiError, session } from '/js/api.js';
import { field, wireForm, formErrorBox } from '/js/forms.js';
import { t, n, fmt, has } from '/js/i18n.js';

export { t, n, fmt, has, h, icon, modal, toast, confirmDialog, clear, api, get, post, put, patch, del, ApiError, session, field, wireForm, formErrorBox };
export const qs = (obj) => { const p = new URLSearchParams(); Object.entries(obj).forEach(([k, v]) => { if (v !== '' && v != null) p.set(k, v); }); const s = p.toString(); return s ? '?' + s : ''; };
export const tag = (status) => h('span', { class: 'badge tag-' + status }, t('adm.status.' + status));
export const when = (iso) => (iso ? fmt.dateTime(iso) : '—');

export function pager(data, onPage) {
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return h('div', { class: 'pager' }, h('button', { class: 'btn secondary small', disabled: data.page <= 1, onclick: () => onPage(data.page - 1) }, t('common.previous')), h('span', { class: 'muted' }, t('adm.page_total', { page: data.page, pages, total: fmt.number(data.total) })), h('button', { class: 'btn secondary small', disabled: data.page >= pages, onclick: () => onPage(data.page + 1) }, t('common.next')));
}
export function table(columns, rows, { empty = t('adm.nothing_here') } = {}) {
  const head = h('tr', {}, columns.map((c) => h('th', { scope: 'col', class: c.cls || '' }, c.label)));
  const body = rows.length ? rows.map((r) => h('tr', {}, columns.map((c) => h('td', { class: c.cls || '' }, c.render(r))))) : [h('tr', {}, h('td', { colspan: columns.length, class: 'muted center' }, empty))];
  return h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, head), h('tbody', {}, body)));
}
export const iconBtn = (name, label, onclick, kind = 'secondary') => h('button', { type: 'button', class: 'btn icon ' + kind, 'aria-label': label, title: label, onclick }, icon(name));
export const crumbs = (...items) => h('nav', { class: 'crumbs', 'aria-label': t('adm.breadcrumb') }, items.flatMap((it, i) => [i ? h('span', { 'aria-hidden': 'true' }, '/') : null, it.href ? h('a', { href: it.href }, it.label) : h('span', {}, it.label)]));

/* a modal with a generated form. fields: [{name,label,type,options,value,hint,...}] ; save(values) must throw ApiError on validation problems */
export function formDialog({ title, fields, save, submitLabel = t('common.save'), wide = false, extra }) {
  return new Promise((resolve) => {
    const f = {};
    const err = formErrorBox();
    const form = h('form', { novalidate: true }, err);
    fields.forEach((d) => { f[d.name] = field(d); form.append(f[d.name].el); });
    if (extra) form.append(extra);
    const dlg = h('dialog', { class: wide ? 'wide' : '', 'aria-label': title });
    const cancel = h('button', { type: 'button', class: 'btn secondary', onclick: () => dlg.close() }, t('common.cancel'));
    const submit = h('button', { type: 'submit', class: 'btn' }, submitLabel);
    form.append(h('div', { class: 'dialog-actions' }, cancel, submit));
    let result = null;
    wireForm(form, f, err, async () => {
      const values = {}; Object.entries(f).forEach(([k, fld]) => { values[k] = fld.value; });
      result = await save(values); dlg.close();
    });
    dlg.append(h('div', { class: 'dialog-body' }, h('h2', {}, title), form));
    dlg.addEventListener('close', () => { dlg.remove(); resolve(result); });
    document.body.append(dlg); dlg.showModal();
    const first = dlg.querySelector('input, select, textarea'); if (first) first.focus();
  });
}
export const opts = (list, labelFn) => list.map((x) => (typeof x === 'string' ? { value: x, label: x } : { value: x.id ?? x.value, label: labelFn ? labelFn(x) : x.label ?? x.title }));
export async function typedConfirm(title, message, word, label = t('common.delete')) {
  const input = h('input', { class: 'input', type: 'text', autocomplete: 'off', 'aria-label': t('adm.confirmation') });
  const ok = await modal({ title, content: h('div', {}, h('p', {}, message), h('p', { class: 'small muted' }, t('adm.type_to_confirm', { word })), input), actions: [{ label: t('common.cancel'), value: false, kind: 'secondary' }, { label, value: true, kind: 'danger' }], dismissValue: false });
  return ok && input.value === word;
}

/* titles / descriptions in the other interface languages (stored in the `translations` column; English is the base text) */
export const trOf = (row) => { try { const v = JSON.parse((row && row.translations) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } };
export const trFields = (row, names = ['title', 'description']) => ['uz', 'ru'].flatMap((lang) => names.map((nm) => ({ name: `tr_${lang}_${nm}`, label: t('adm.tr_field', { field: t('adm.f.' + nm), language: t('lang.native.' + lang) }), type: nm === 'description' ? 'textarea' : 'text', value: (trOf(row)[lang] || {})[nm] || '', maxlength: nm === 'description' ? 500 : 100 })));
export const trPack = (values, names = ['title', 'description']) => {
  const out = {};
  ['uz', 'ru'].forEach((lang) => { const o = {}; names.forEach((nm) => { const v = String(values[`tr_${lang}_${nm}`] || '').trim(); if (v) o[nm] = v; }); if (Object.keys(o).length) out[lang] = o; });
  return out;
};
export const withTr = (values, names) => { const body = { ...values }; Object.keys(body).filter((k) => k.startsWith('tr_')).forEach((k) => delete body[k]); body.translations = trPack(values, names); return body; };
