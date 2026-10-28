/* The language selector: a button showing the current language (flag + name) that opens a listbox of the offered languages.
   Keyboard: Enter / Space / ArrowDown open it, arrows move, Home / End jump, Enter selects, Escape closes, Tab leaves. */
import { h, icon } from './ui.js';
import { t, lang, languages, setLanguage, onChange, info } from './i18n.js';

let uid = 0;
export function languageSwitcher({ save, className = '' } = {}) {
  const id = 'lang-' + (++uid);
  const flag = h('span', { class: 'lang-flag', 'aria-hidden': 'true' });
  const name = h('span', { class: 'lang-name' });
  const code = h('span', { class: 'lang-code', 'aria-hidden': 'true' });
  const button = h('button', { type: 'button', class: 'lang-btn', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-controls': id + '-list' }, flag, name, code, icon('down', 'lang-caret'));
  const list = h('ul', { class: 'lang-list', role: 'listbox', id: id + '-list', tabindex: '-1', hidden: true });
  const root = h('div', { class: 'lang-switcher ' + className, 'data-lang-switcher': '' }, button, list);
  let open = false, items = [], active = 0;

  function paint() {
    const cur = info();
    flag.textContent = cur.flag; name.textContent = cur.name; code.textContent = cur.code.toUpperCase();
    button.setAttribute('aria-label', t('lang.switch', { language: cur.name }));
    button.title = t('lang.switch', { language: cur.name });
    list.setAttribute('aria-label', t('lang.list'));
    items = languages().map((l) => h('li', { role: 'option', id: `${id}-${l.code}`, 'aria-selected': String(l.code === lang()), class: 'lang-option' + (l.code === lang() ? ' current' : ''), lang: l.code, 'data-code': l.code, onclick: () => choose(l.code) },
      h('span', { class: 'lang-flag', 'aria-hidden': 'true' }, l.flag), h('span', { class: 'lang-label' }, l.name), l.code === lang() ? h('span', { class: 'lang-active' }, icon('check'), h('span', { class: 'sr-only' }, t('lang.active'))) : null));
    list.replaceChildren(...items);
  }
  function setOpen(v, focusButton) {
    open = v; button.setAttribute('aria-expanded', String(v)); list.hidden = !v; root.classList.toggle('open', v);
    if (v) { active = Math.max(0, items.findIndex((li) => li.getAttribute('aria-selected') === 'true')); mark(); list.focus(); document.addEventListener('pointerdown', outside, true); }
    else { document.removeEventListener('pointerdown', outside, true); if (focusButton) button.focus(); }
  }
  const outside = (e) => { if (!root.contains(e.target)) setOpen(false); };
  function mark() { items.forEach((li, i) => li.classList.toggle('active', i === active)); if (items[active]) list.setAttribute('aria-activedescendant', items[active].id); }
  async function choose(c) { setOpen(false, true); await setLanguage(c, { save }); }

  button.addEventListener('click', () => setOpen(!open));
  button.addEventListener('keydown', (e) => { if (['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); setOpen(true); } });
  list.addEventListener('keydown', (e) => {
    const last = items.length - 1;
    if (e.key === 'ArrowDown') { e.preventDefault(); active = active >= last ? 0 : active + 1; mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = active <= 0 ? last : active - 1; mark(); }
    else if (e.key === 'Home') { e.preventDefault(); active = 0; mark(); }
    else if (e.key === 'End') { e.preventDefault(); active = last; mark(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(items[active].dataset.code); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false, true); }
    else if (e.key === 'Tab') setOpen(false);
  });
  root.addEventListener('focusout', (e) => { if (open && e.relatedTarget && !root.contains(e.relatedTarget)) setOpen(false); });
  paint();
  const off = onChange(() => { if (!root.isConnected) return off(); paint(); });   // stop listening once the page part that holds it is gone
  return root;
}
