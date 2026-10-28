import { h, icon, toast, confirmDialog, fmt, spinner } from '../ui.js';
import { get, post, ApiError } from '../api.js';
import { navigate, refreshStats } from '../app.js';
import { RENDERERS } from './exercises.js';

export default async function lesson({ params }) {
  const id = Number(params.id);
  let state = await get('/attempts/' + id);
  const root = h('main', { class: 'lesson' });
  let current = null, answered = false, busy = false, cleaned = false;
  let celebrate = null;

  const heartsEl = h('div', { class: 'hearts', 'aria-label': 'Hearts' });
  const bar = h('i', { style: { width: '0%' } });
  const progress = h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': 0, 'aria-label': 'Lesson progress' }, bar);
  const body = h('div', { class: 'lesson-body', id: 'lesson-body' });
  const foot = h('div', { class: 'lesson-foot' });
  const feedback = h('div', { class: 'feedback', 'aria-live': 'assertive', role: 'status' });
  const action = h('button', { class: 'btn', type: 'button' });
  foot.append(h('div', { class: 'inner' }, feedback, action));
  const top = h('div', { class: 'lesson-top' },
    h('button', { type: 'button', class: 'close', 'aria-label': 'Leave lesson', onclick: leave }, icon('x')), progress, heartsEl);
  root.append(top, body, foot);

  function setHearts() {
    heartsEl.hidden = !state.heartsEnabled;
    heartsEl.replaceChildren(icon('heart'), String(state.hearts));
    heartsEl.setAttribute('aria-label', `${state.hearts} hearts left`);
  }
  function setProgress() { bar.style.width = state.progress + '%'; progress.setAttribute('aria-valuenow', String(state.progress)); }
  async function leave() {
    if (state.status !== 'in_progress') return navigate('/learn');
    if (await confirmDialog('Leave this lesson?', 'Your progress is saved. You can continue later.', 'Leave')) navigate('/learn');
  }

  function showExercise() {
    answered = false; busy = false; feedback.replaceChildren(); foot.className = 'lesson-foot';
    const ex = state.exercise;
    const r = RENDERERS[ex.type];
    if (!r) { body.replaceChildren(h('div', { class: 'form-error' }, 'This exercise type is not supported.')); return; }
    setHearts(); setProgress();
    current = r(ex, { changed: (ok) => { action.disabled = !ok; }, submit: check });
    body.replaceChildren(current.el);
    action.textContent = 'Check'; action.className = 'btn'; action.disabled = true; action.onclick = check;
    foot.hidden = false;
    setTimeout(() => current.focus && current.focus(), 50);
    if ((ex.type === 'listen_choice' || ex.type === 'listen_type') && ex.audio) setTimeout(() => { import('../ui.js').then((m) => m.speak(ex.audio)); }, 350);
  }

  async function check() {
    if (answered || busy) return;
    const value = current.answer();
    if (value === null || value === undefined) return;
    busy = true; action.disabled = true;
    try {
      const res = await post(`/attempts/${id}/answer`, { exerciseId: state.exercise.id, answer: value });
      answered = true; current.lock(); current.reveal && current.reveal(res.feedback);
      state = res.state; celebrate = res.celebrate || celebrate;
      setHearts(); setProgress();
      const fb = res.feedback;
      foot.className = 'lesson-foot ' + (fb.correct ? 'good' : 'bad');
      feedback.replaceChildren(...[
        h('b', {}, icon(fb.correct ? 'check' : 'x'), fb.correct ? (fb.typo ? 'Correct — watch the spelling' : pick(['Correct!', 'Well done!', 'Great!', 'Nice one!'])) : 'Not quite', fb.xp ? h('span', { class: 'xp' }, `+${fb.xp} XP`) : null),
        !fb.correct || fb.typo ? h('p', {}, 'Correct answer: ', h('span', { class: 'correct-answer' }, fb.correctAnswer)) : null,
        fb.explanation ? h('p', {}, fb.explanation) : null, fb.translation && !fb.correct ? h('p', { class: 'muted' }, fb.translation) : null].filter(Boolean));
      action.textContent = state.status === 'in_progress' ? 'Continue' : 'Finish'; action.className = 'btn' + (fb.correct ? '' : ' danger'); action.disabled = false; action.onclick = next; action.focus();
    } catch (e) {
      busy = false; action.disabled = false;
      toast(e instanceof ApiError ? e.message : 'Could not check the answer.', 'error', 5000);
      if (e instanceof ApiError && e.status === 409) { state = await get('/attempts/' + id); render(); }
    }
  }
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function next() { if (state.status !== 'in_progress') return showResult(); render(); }
  function render() { if (state.status !== 'in_progress') return showResult(); if (!state.exercise) return showResult(); showExercise(); }

  function showResult() {
    refreshStats();
    const r = state.result || { correct: state.correct, incorrect: state.incorrect, total: state.totalPlanned, accuracy: 0, xp: 0, mistakes: [], words: [], outcome: state.status };
    foot.hidden = true; top.hidden = true;
    if (r.outcome === 'out_of_hearts') {
      body.replaceChildren(h('div', { class: 'result' }, h('img', { src: '/img/mascot.svg', alt: '' }), h('h1', {}, 'Out of hearts'),
        h('p', { class: 'muted' }, 'You ran out of hearts, so this lesson is paused. Hearts come back over time, and a vocabulary review earns one.'),
        h('div', { class: 'stack' }, h('a', { class: 'btn block', href: '/review' }, 'Review words'), h('a', { class: 'btn secondary block', href: '/learn' }, 'Back to the path'))));
      return;
    }
    const earned = celebrate && celebrate.earned ? celebrate.earned : [];
    body.replaceChildren(h('div', { class: 'result' }, h('img', { src: '/img/mascot.svg', alt: '' }),
      h('h1', {}, state.kind === 'mistakes' ? 'Mistakes reviewed!' : r.accuracy === 100 ? 'Perfect lesson!' : 'Lesson complete!'),
      h('div', { class: 'result-stats' },
        h('div', { class: 'card xp' }, h('b', {}, '+' + r.xp), h('span', { class: 'muted small' }, 'XP earned')),
        h('div', { class: 'card acc' }, h('b', {}, r.accuracy + '%'), h('span', { class: 'muted small' }, 'Accuracy')),
        h('div', { class: 'card' }, h('b', {}, `${r.correct}/${r.total}`), h('span', { class: 'muted small' }, 'Right first time'))),
      h('div', { class: 'chips', style: { justifyContent: 'center', marginBottom: '12px' } }, h('span', { class: 'chip ok' }, icon('check'), `${r.correct} correct`), h('span', { class: 'chip bad' }, icon('x'), `${r.incorrect} incorrect`)),
      earned.length ? h('div', { class: 'card', style: { textAlign: 'left' } }, h('h2', {}, 'New achievement' + (earned.length > 1 ? 's' : '')), earned.map((a) => h('div', { class: 'ach-card', style: { marginTop: '8px' } }, h('div', { class: 'ico' }, icon(a.icon === 'flame' ? 'flame' : a.icon === 'bolt' ? 'bolt' : a.icon === 'trophy' ? 'trophy' : a.icon === 'target' ? 'target' : a.icon === 'cards' ? 'cards' : a.icon === 'flag' ? 'flag' : 'star')), h('div', {}, h('b', {}, a.title), h('div', { class: 'muted small' }, a.description))))) : null,
      r.words.length ? h('div', { class: 'card', style: { textAlign: 'left' } }, h('h2', {}, 'Words to review'), h('ul', { class: 'review-list' }, r.words.map((w) => h('li', {}, h('b', {}, w.en), ' — ', w.uz, w.example ? h('div', { class: 'muted small' }, w.example) : null)))) : null,
      r.mistakes.length ? h('div', { class: 'card', style: { textAlign: 'left' } }, h('h2', {}, 'Your mistakes'), h('ul', { class: 'review-list' }, r.mistakes.map((m) => h('li', {}, h('span', { class: 'muted' }, m.prompt), m.answer ? h('div', {}, 'Answer: ', h('b', {}, m.answer)) : null)))) : null,
      h('div', { class: 'stack', style: { marginTop: '18px' } }, h('a', { class: 'btn block', href: '/learn' }, 'Continue'), r.mistakes.length ? h('a', { class: 'btn secondary block', href: '/practice' }, 'Review my mistakes') : null)));
    document.querySelector('.result a.btn') && document.querySelector('.result a.btn').focus();
  }

  const onKey = (e) => {
    if (cleaned || document.querySelector('dialog[open]')) return;
    if (e.key === 'Enter') {
      if (e.target.tagName === 'BUTTON' && e.target !== action) return;
      if (answered) { e.preventDefault(); next(); } else if (current && !busy) { e.preventDefault(); check(); }
      return;
    }
    if (!answered && current && current.key && !(e.target.tagName === 'INPUT') && !e.ctrlKey && !e.metaKey && !e.altKey) { if (current.key(e)) e.preventDefault(); }
  };
  document.addEventListener('keydown', onKey);

  setHearts(); setProgress();
  if (state.status !== 'in_progress') showResult(); else render();
  document.title = state.lesson ? state.lesson.title + ' · Lexi Learn' : 'Practice';
  return { el: root, title: state.lesson ? state.lesson.title : 'Practice', nav: '', cleanup() { cleaned = true; document.removeEventListener('keydown', onKey); } };
}
