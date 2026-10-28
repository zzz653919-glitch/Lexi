import { h } from './ui.js';
import { ApiError } from './api.js';

let uid = 0;
/* a labelled input with an inline error line (aria-describedby) */
export function field({ label, name, type = 'text', value = '', options, hint, required, autocomplete, rows, min, max, maxlength, placeholder, disabled }) {
  const id = 'f' + (++uid) + '-' + name;
  const errEl = h('div', { class: 'error-text', id: id + '-err', role: 'alert', hidden: true });
  let input;
  if (type === 'select') {
    input = h('select', { class: 'input', id, name, disabled }, (options || []).map((o) => h('option', { value: String(o.value), selected: String(o.value) === String(value) }, o.label)));
  } else if (type === 'textarea') {
    input = h('textarea', { class: 'input', id, name, rows: rows || 3, maxlength, placeholder, disabled }, value);
  } else if (type === 'checkbox') {
    input = h('input', { type: 'checkbox', id, name, checked: !!value, disabled });
    const el = h('label', { class: 'switch field', for: id }, input, h('span', {}, label));
    return { el, input, error: () => {}, get value() { return input.checked; }, set value(v) { input.checked = !!v; } };
  } else {
    input = h('input', { class: 'input', id, name, type, value, required, autocomplete, min, max, maxlength, placeholder, disabled, 'aria-describedby': id + '-err' });
  }
  const el = h('div', { class: 'field' }, h('label', { for: id }, h('span', { class: 'label' }, label)), input, hint ? h('div', { class: 'muted small' }, hint) : null, errEl);
  const api = {
    el, input,
    error(msg) { errEl.hidden = !msg; errEl.textContent = msg || ''; el.classList.toggle('invalid', !!msg); input.setAttribute('aria-invalid', msg ? 'true' : 'false'); },
    get value() { return input.value; }, set value(v) { input.value = v; },
  };
  return api;
}

/* runs `fn`, disables the submit button meanwhile and maps server validation errors (error.fields) onto the fields */
export function wireForm(form, fields, formError, fn) {
  const btn = form.querySelector('button[type="submit"]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.dataset.busy) return;
    form.dataset.busy = '1'; if (btn) btn.disabled = true;
    formError.hidden = true; Object.values(fields).forEach((f) => f.error && f.error(''));
    try { await fn(); }
    catch (err) {
      if (err instanceof ApiError) {
        let first = null;
        for (const [k, m] of Object.entries(err.fields || {})) if (fields[k]) { fields[k].error(m); first = first || fields[k]; }
        formError.textContent = err.message; formError.hidden = false;
        if (first && first.input) first.input.focus();
      } else { formError.textContent = 'Something went wrong. Please try again.'; formError.hidden = false; console.error(err); }
    } finally { delete form.dataset.busy; if (btn) btn.disabled = false; }
  });
}
export const formErrorBox = () => h('div', { class: 'form-error', role: 'alert', hidden: true });
