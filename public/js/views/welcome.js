/* First screen after sign-up: take the placement test (recommended) or choose a level by hand. */
import { h, icon, toast, canSpeak } from '../ui.js';
import { get, post, session, ApiError } from '../api.js';
import { navigate } from '../app.js';
import { t, n } from '../i18n.js';
import { LEVELS, levelName, levelBadge } from './level-info.js';

export async function refreshUser() { const me = await get('/auth/me'); session.user = me.user; return me.user; }

export function levelPicker({ current, onPick, label }) {
  let chosen = current || null;
  const rows = LEVELS.map((code) => h('button', { type: 'button', class: 'level-option', role: 'radio', 'aria-checked': String(code === chosen), 'data-level': code, onclick: () => pick(code) },
    levelBadge(code), h('span', { class: 'lo-text' }, h('b', {}, levelName(code)), h('span', { class: 'muted small' }, t('level.' + code + '.desc')))));
  const go = h('button', { class: 'btn block', type: 'button', disabled: !chosen, onclick: async () => { go.disabled = true; try { await onPick(chosen); } catch (e) { go.disabled = false; toast(e instanceof ApiError ? e.message : t('app.error_text'), 'error', 5000); } } }, label);
  function pick(code) { chosen = code; rows.forEach((r) => r.setAttribute('aria-checked', String(r.dataset.level === code))); go.disabled = false; }
  return h('div', { class: 'stack' }, h('div', { class: 'level-options', role: 'radiogroup', 'aria-label': t('welcome.choose_title') }, rows), go);
}

export default async function welcome() {
  const [info, cur] = await Promise.all([get('/assessment/info'), get('/assessment/current')]);
  const listening = h('input', { type: 'checkbox', id: 'wl', checked: canSpeak() });
  const startBtn = h('button', { class: 'btn block', type: 'button' }, cur.status === 'in_progress' ? t('welcome.continue_test') : t('welcome.start_test'));
  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    try { if (cur.status !== 'in_progress') await post('/assessment/start', { listening: listening.checked }); navigate('/placement'); }
    catch (e) { startBtn.disabled = false; toast(e instanceof ApiError ? e.message : t('app.error_text'), 'error', 5000); }
  });
  const choose = h('div', { class: 'card', hidden: true, id: 'choose-card' }, h('h2', {}, t('welcome.choose_title')), h('p', { class: 'muted' }, t('welcome.choose_text')),
    levelPicker({ onPick: async (code) => { await post('/me/level', { level: code }); await refreshUser(); navigate('/', true); }, label: t('welcome.confirm_level') }));
  const chooseBtn = h('button', { class: 'btn secondary block', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'choose-card', onclick: () => { choose.hidden = !choose.hidden; chooseBtn.setAttribute('aria-expanded', String(!choose.hidden)); if (!choose.hidden) choose.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, t('welcome.choose_level'));
  const el = h('main', { class: 'guest welcome' }, h('div', { class: 'welcome-wrap stack' },
    h('div', { class: 'center' }, h('img', { class: 'mascot', src: '/img/mascot.svg', alt: '', width: 110, height: 110 }), h('h1', {}, t('welcome.title', { name: session.user.displayName })), h('p', { class: 'muted' }, t('welcome.subtitle'))),
    h('section', { class: 'card choice-card recommended' }, h('span', { class: 'chip ok' }, icon('star'), t('welcome.recommended')), h('h2', {}, t('welcome.test_title')),
      h('p', { class: 'muted' }, t('welcome.test_text', { min: info.min, max: info.max })),
      h('ul', { class: 'check-list' }, ['welcome.test_point_1', 'welcome.test_point_2', 'welcome.test_point_3'].map((k) => h('li', {}, icon('check'), t(k)))),
      info.available ? h('label', { class: 'switch field', for: 'wl' }, listening, h('span', {}, t('welcome.include_listening'))) : null,
      info.available ? startBtn : h('p', { class: 'notice' }, t('welcome.test_unavailable'))),
    h('section', { class: 'card choice-card' }, h('h2', {}, t('welcome.manual_title')), h('p', { class: 'muted' }, t('welcome.manual_text')), chooseBtn), choose));
  return { el, title: t('welcome.page_title'), nav: '', bare: true };
}
