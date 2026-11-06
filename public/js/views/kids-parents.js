/* LEXIO KIDS parent area: a grown-up sum (or the PIN) opens it; progress for parents and the child's settings. */
import { h, toast } from '../ui.js';
import { api, post, session } from '../api.js';
import { navigate } from '../app.js';
import { t, lang } from '../i18n.js';
import { initKids, profile, kidsState } from '../kids/common.js';
import { kidsPage, kidsView } from '../kids/shell.js';

const KEY = 'lexi.kids.parent';
const saved = () => { try { const v = JSON.parse(sessionStorage.getItem(KEY) || 'null'); return v && v.until > Date.now() ? v.token : null; } catch (_) { return null; } };
const store = (token) => { try { sessionStorage.setItem(KEY, JSON.stringify({ token, until: Date.now() + 19 * 60000 })); } catch (_) { /* ignore */ } };
const forget = () => { try { sessionStorage.removeItem(KEY); } catch (_) { /* ignore */ } };

export default async function kidsParents() {
  await initKids(true);
  const body = h('div', {});
  const page = kidsPage('home', h('h1', { class: 'k-h2' }, '⚙️ ', t('kids.parents')), body);
  page.setStars(profile().stars || 0);
  const authed = (method, url, data) => api(method, url, data, { headers: { 'X-Parent-Token': saved() || '' } });

  async function gate(message) {
    const ch = await api('GET', '/kids/parent/challenge');
    const err = h('p', { class: 'form-error', id: 'k-gate-error', role: 'alert', hidden: !message }, message || '');
    const input = h('input', { class: 'input k-gate-input', id: 'k-gate-input', name: ch.pin ? 'pin' : 'answer', type: ch.pin ? 'password' : 'text', inputmode: 'numeric', autocomplete: 'off', maxlength: ch.pin ? 4 : 3, 'aria-label': ch.pin ? t('kids.gate_pin') : t('kids.gate_sum') });
    const form = h('form', { class: 'k-card k-gate', id: 'k-gate', novalidate: true, onsubmit: async (e) => {
      e.preventDefault();
      try { const r = await post('/kids/parent/verify', ch.pin ? { pin: input.value } : { a: ch.a, b: ch.b, sig: ch.sig, answer: Number(input.value) }); store(r.token); dashboard(); }
      catch (x) { err.hidden = false; err.textContent = x.message; input.value = ''; if (!ch.pin) gate(x.message); }
    } },
      h('h2', {}, t('kids.gate_title')), h('p', {}, t('kids.gate_text')), ch.pin ? h('p', { class: 'k-sum' }, t('kids.gate_pin')) : h('p', { class: 'k-sum', id: 'k-gate-q', 'data-a': ch.a, 'data-b': ch.b }, `${ch.a} + ${ch.b} = ?`), input, err,
      h('div', { class: 'k-actions' }, h('button', { class: 'k-big-btn go', type: 'submit', id: 'k-gate-ok' }, t('kids.gate_open')), h('a', { class: 'k-big-btn me', href: '/kids' }, '🏠 ', t('kids.back_home'))));
    body.replaceChildren(form); input.focus();
  }

  async function dashboard() {
    let d;
    try { d = await authed('GET', '/kids/parent/summary'); } catch (e) { forget(); return gate(e.status === 403 ? '' : e.message); }
    const dayName = (iso) => { try { return new Date(iso + 'T12:00:00').toLocaleDateString(lang(), { weekday: 'short' }); } catch (_) { return iso.slice(5); } };
    const stat = (v, label, id) => h('div', { class: 'k-stat par', id }, h('b', {}, v), h('small', {}, label));
    const maxMin = Math.max(10, ...d.week.map((x) => x.minutes));
    const settings = d.settings, saveSet = async (patch, msg = true) => { try { const r = await authed('PATCH', '/kids/parent/settings', patch); kidsState.profile = { ...kidsState.profile, ...r }; if (msg) toast(t('kids.saved'), 'success', 1500); return r; } catch (e) { toast(e.message, 'error', 4000); if (e.status === 403) { forget(); gate(); } } };
    const toggle = (key, label, hint) => { const cb = h('input', { type: 'checkbox', id: 'k-set-' + key, checked: !!settings[key], onchange: () => saveSet({ [key]: cb.checked }) }); return h('label', { class: 'k-set-row' }, cb, h('span', {}, h('b', {}, label), hint ? h('small', {}, hint) : null)); };
    const time = h('input', { class: 'input', type: 'time', id: 'k-set-time', value: settings.reminderTime, onchange: () => saveSet({ reminderTime: time.value }) });
    const limit = h('input', { class: 'input', type: 'number', id: 'k-set-limit', min: 0, max: 240, step: 5, value: settings.dailyLimitMin, onchange: () => saveSet({ dailyLimitMin: Number(limit.value) || 0 }) });
    const age = h('select', { class: 'input', id: 'k-set-age', onchange: () => saveSet({ age: age.value }) }, ['young', 'older'].map((a) => h('option', { value: a, selected: settings.age === a }, t('kids.age.' + a))));
    const pin = h('input', { class: 'input', type: 'password', id: 'k-set-pin', inputmode: 'numeric', maxlength: 4, placeholder: '••••', 'aria-label': t('kids.pin_new') });
    const pinBtn = h('button', { class: 'btn small', type: 'button', id: 'k-set-pin-save', onclick: async () => { try { const r = await authed('POST', '/kids/parent/pin', { pin: pin.value }); toast(r.pinSet ? t('kids.pin_saved') : t('kids.pin_removed'), 'success', 2000); pin.value = ''; } catch (e) { toast(e.message, 'error', 4000); } } }, t('kids.pin_save'));
    body.replaceChildren(
      h('section', { class: 'k-stats', id: 'k-par-stats' }, stat(d.lessons.done + '/' + d.lessons.total, t('kids.par.lessons'), 'k-par-lessons'), stat(d.words.known, t('kids.par.words'), 'k-par-words'), stat(d.minutes.today + ' / ' + d.minutes.week + ' / ' + d.minutes.total, t('kids.par.time'), 'k-par-time'),
        stat(d.games.played + '/' + d.games.total, t('kids.stat_games'), 'k-par-games'), stat(d.stories.read + '/' + d.stories.total, t('kids.stat_stories'), 'k-par-stories'), stat(d.streak, t('kids.par.streak'), 'k-par-streak')),
      h('section', { class: 'k-card' }, h('h2', { class: 'k-h2' }, t('kids.par.week')), h('div', { class: 'k-bars' }, d.week.map((x) => h('div', { class: 'k-bar' + (x.today ? ' today' : '') }, h('span', { class: 'k-bar-n' }, x.minutes ? x.minutes + "'" : ''), h('i', { style: { height: Math.round(8 + (92 * x.minutes) / maxMin) + 'px' } }), h('small', {}, dayName(x.date)))))),
      h('section', { class: 'k-card', id: 'k-par-recommended' }, h('h2', { class: 'k-h2' }, t('kids.par.next')), d.recommended.length ? h('ul', { class: 'k-rec' }, d.recommended.map((r) => h('li', {}, h('a', { class: 'k-rec-link', href: `/kids/learn/${r.slug}?part=${r.part}`, 'data-slug': r.slug }, h('span', { 'aria-hidden': 'true' }, r.emoji), h('b', {}, r.title), h('small', {}, t('kids.par.reason_' + r.reason)))))) : h('p', {}, t('kids.all_done'))),
      h('section', { class: 'k-card' }, h('h2', { class: 'k-h2' }, t('kids.par.by_category')), h('ul', { class: 'k-cat-bars' }, d.categories.map((c) => h('li', { 'data-slug': c.slug }, h('span', { class: 'k-cat-bar-emoji', 'aria-hidden': 'true' }, c.emoji), h('b', {}, c.title),
        h('div', { class: 'k-mbar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': c.maxStars, 'aria-valuenow': c.stars, 'aria-label': c.title }, h('i', { style: { width: Math.round((100 * c.stars) / c.maxStars) + '%', background: c.color } })), h('small', {}, t('kids.par.known', { n: c.known, max: c.words })))))),
      h('section', { class: 'k-card', id: 'k-par-settings' }, h('h2', { class: 'k-h2' }, t('kids.par.settings')),
        toggle('sound', t('kids.set.sound'), t('kids.set.sound_hint')), toggle('narration', t('kids.set.narration'), t('kids.set.narration_hint')),
        toggle('mic', t('kids.set.mic'), t('kids.set.mic_hint')), toggle('reminders', t('kids.set.reminders'), t('kids.set.reminders_hint')),
        h('div', { class: 'k-set-grid' }, h('label', {}, h('b', {}, t('kids.set.time')), time), h('label', {}, h('b', {}, t('kids.set.age')), age), h('label', {}, h('b', {}, t('kids.set.limit')), limit, h('small', {}, t('kids.set.limit_hint'))), h('label', {}, h('b', {}, settings.pinSet ? t('kids.pin_change') : t('kids.pin_new')), pin, pinBtn, h('small', {}, t('kids.pin_hint')))),
        h('p', { class: 'k-note' }, '🔒 ', t('kids.privacy'))),
      h('div', { class: 'k-actions' }, h('button', { class: 'k-big-btn me', type: 'button', id: 'k-par-lock', onclick: () => { forget(); navigate('/kids', true); } }, '🔒 ', t('kids.par.lock'))));
  }
  if (saved()) dashboard(); else gate();
  return kidsView(page.el, t('kids.parents'));
}
