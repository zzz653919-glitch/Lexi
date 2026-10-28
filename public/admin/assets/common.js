import { h, icon, modal, toast, confirmDialog, clear } from '/js/ui.js';
import { api, get, post, put, patch, del, ApiError, session } from '/js/api.js';
import { field, wireForm, formErrorBox } from '/js/forms.js';

export { h, icon, modal, toast, confirmDialog, clear, api, get, post, put, patch, del, ApiError, session, field, wireForm, formErrorBox };
export const qs = (obj) => { const p = new URLSearchParams(); Object.entries(obj).forEach(([k, v]) => { if (v !== '' && v != null) p.set(k, v); }); const s = p.toString(); return s ? '?' + s : ''; };
export const tag = (status) => h('span', { class: 'badge tag-' + status }, status);
export const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

export function pager(data, onPage) {
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return h('div', { class: 'pager' }, h('button', { class: 'btn secondary small', disabled: data.page <= 1, onclick: () => onPage(data.page - 1) }, 'Previous'), h('span', { class: 'muted' }, `Page ${data.page} of ${pages} · ${data.total} total`), h('button', { class: 'btn secondary small', disabled: data.page >= pages, onclick: () => onPage(data.page + 1) }, 'Next'));
}
export function table(columns, rows, { empty = 'Nothing here yet.' } = {}) {
  const head = h('tr', {}, columns.map((c) => h('th', { scope: 'col', class: c.cls || '' }, c.label)));
  const body = rows.length ? rows.map((r) => h('tr', {}, columns.map((c) => h('td', { class: c.cls || '' }, c.render(r))))) : [h('tr', {}, h('td', { colspan: columns.length, class: 'muted center' }, empty))];
  return h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, head), h('tbody', {}, body)));
}
export const iconBtn = (name, label, onclick, kind = 'secondary') => h('button', { type: 'button', class: 'btn icon ' + kind, 'aria-label': label, title: label, onclick }, icon(name));
export const crumbs = (...items) => h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' }, items.flatMap((it, i) => [i ? h('span', { 'aria-hidden': 'true' }, '/') : null, it.href ? h('a', { href: it.href }, it.label) : h('span', {}, it.label)]));

/* a modal with a generated form. fields: [{name,label,type,options,value,hint,...}] ; save(values) must throw ApiError on validation problems */
export function formDialog({ title, fields, save, submitLabel = 'Save', wide = false, extra }) {
  return new Promise((resolve) => {
    const f = {};
    const err = formErrorBox();
    const form = h('form', { novalidate: true }, err);
    fields.forEach((d) => { f[d.name] = field(d); form.append(f[d.name].el); });
    if (extra) form.append(extra);
    const dlg = h('dialog', { class: wide ? 'wide' : '', 'aria-label': title });
    const cancel = h('button', { type: 'button', class: 'btn secondary', onclick: () => dlg.close() }, 'Cancel');
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
export async function typedConfirm(title, message, word, label = 'Delete') {
  const input = h('input', { class: 'input', type: 'text', autocomplete: 'off', 'aria-label': 'Confirmation' });
  const ok = await modal({ title, content: h('div', {}, h('p', {}, message), h('p', { class: 'small muted' }, 'Type ', h('b', {}, word), ' to confirm.'), input), actions: [{ label: 'Cancel', value: false, kind: 'secondary' }, { label, value: true, kind: 'danger' }], dismissValue: false });
  return ok && input.value === word;
}
