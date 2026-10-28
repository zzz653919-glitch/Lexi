/* The adaptive placement test. The server picks every question; the browser only shows it and sends the answer.
   No right/wrong feedback is shown during the test (it measures, it does not teach). */
import { h, icon, toast, confirmDialog, speak } from '../ui.js';
import { get, post, session, ApiError } from '../api.js';
import { navigate } from '../app.js';
import { t, n } from '../i18n.js';
import { RENDERERS } from './exercises.js';
import { refreshUser } from './welcome.js';
import { resultCard } from './level-info.js';

/* a placement question in the shape the exercise renderers understand */
function asExercise(q) {
  const ex = { id: q.id, prompt: q.prompt, hint: '', difficulty: 1, direction: 'en-uz' };
  if (q.format === 'type') return /_{3,}/.test(q.prompt) ? { ...ex, type: 'fill_blank', prompt: t('placement.write_missing'), sentence: q.prompt } : { ...ex, type: 'translate_type', sentence: q.prompt, direction: 'uz-en' };
  const options = q.options;
  if (q.passage) return { ...ex, type: 'reading', passage: q.passage, options };
  if (q.audio) return { ...ex, type: 'listen_choice', audio: q.audio, options };
  return { ...ex, type: 'multiple_choice', options };
}

export default async function placement() {
  let state = await get('/assessment/current');
  if (state.status !== 'in_progress') {
    if (session.user.onboarded && state.status === 'none') { navigate('/profile', true); }
    else if (state.status === 'none') { navigate('/welcome', true); }
  }
  const root = h('main', { class: 'lesson placement' });
  let current = null, busy = false, cleaned = false;
  const bar = h('i', { style: { width: '0%' } });
  const progress = h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': 0, 'aria-label': t('placement.progress') }, bar);
  const counter = h('span', { class: 'muted small q-count', 'aria-live': 'polite' });
  const body = h('div', { class: 'lesson-body', id: 'lesson-body' });
  const next = h('button', { class: 'btn', type: 'button', disabled: true }, t('placement.next'));
  const dontKnow = h('button', { class: 'btn secondary', type: 'button' }, t('placement.dont_know'));
  const foot = h('div', { class: 'lesson-foot' }, h('div', { class: 'inner' }, dontKnow, next));
  const leaveBtn = h('button', { type: 'button', class: 'close', 'aria-label': t('placement.leave'), title: t('placement.leave'), onclick: leave }, icon('x'));
  const top = h('div', { class: 'lesson-top' }, leaveBtn, progress, counter);
  root.append(top, body, foot);

  async function leave() {
    if (!state || state.status !== 'in_progress') return navigate('/');
    if (await confirmDialog(t('placement.leave_title'), t('placement.leave_text'), t('placement.leave_button'))) navigate(session.user.onboarded ? '/profile' : '/welcome');
  }
  function show() {
    if (state.status === 'completed') return showResult();
    if (!state.question) return showResult();
    busy = false; foot.hidden = false; top.hidden = false;
    const ex = asExercise(state.question), r = RENDERERS[ex.type];
    current = r(ex, { changed: (ok) => { next.disabled = !ok; }, submit: () => send(false) });
    body.replaceChildren(current.el);
    body.classList.remove('q-in'); void body.offsetWidth; body.classList.add('q-in');
    const shown = state.asked + 1;
    counter.textContent = t('placement.question_n', { n: shown });
    const pct = Math.min(96, Math.round(100 * state.asked / state.max));
    bar.style.width = pct + '%'; progress.setAttribute('aria-valuenow', String(pct));
    next.disabled = true; dontKnow.disabled = false;
    setTimeout(() => current.focus && current.focus(), 60);
    if (ex.type === 'listen_choice' && ex.audio) setTimeout(() => speak(ex.audio), 350);
  }
  async function send(unknown) {
    if (busy) return;
    const value = unknown ? null : current.answer();
    if (!unknown && (value === null || value === undefined)) return;
    busy = true; next.disabled = true; dontKnow.disabled = true;
    try {
      state = await post(`/assessment/${state.assessmentId}/answer`, unknown ? { questionId: state.question.id, dontKnow: true } : { questionId: state.question.id, answer: value });
      if (state.status === 'completed') await refreshUser();
      show();
    } catch (e) {
      busy = false; next.disabled = false; dontKnow.disabled = false;
      toast(e instanceof ApiError ? e.message : t('placement.send_failed'), 'error', 5000);
      if (e instanceof ApiError && e.status === 409) { state = await get('/assessment/current'); show(); }
    }
  }
  next.onclick = () => send(false);
  dontKnow.onclick = () => send(true);

  async function showResult() {
    foot.hidden = true; top.hidden = true;
    const lv = await get('/me/level');
    const done = h('div', { class: 'stack' },
      h('a', { class: 'btn block', href: '/' }, t('result.start_learning')),
      h('a', { class: 'btn secondary block', href: '/profile' }, t('result.change_level')));
    body.replaceChildren(h('div', { class: 'result-wrap' }, resultCard(state, lv.plan, { after: done })));
    window.scrollTo(0, 0);
  }

  const onKey = (e) => {
    if (cleaned || state.status !== 'in_progress' || document.querySelector('dialog[open]')) return;
    if (e.key === 'Enter') { if (e.target.tagName === 'BUTTON' && !e.target.classList.contains('option')) return; if (!busy && !next.disabled) { e.preventDefault(); send(false); } return; }
    if (current && current.key && e.target.tagName !== 'INPUT' && !e.ctrlKey && !e.metaKey && !e.altKey) { if (current.key(e)) e.preventDefault(); }
  };
  document.addEventListener('keydown', onKey);
  if (state.status === 'in_progress') show(); else if (state.status === 'completed') showResult();
  return { el: root, title: t('placement.title'), nav: '', cleanup() { cleaned = true; document.removeEventListener('keydown', onKey); } };
}
