/* Loading animations. Each one is shown ONLY while something is really loading, and each has a clear "taking longer than usual"
   fallback with a retry button, so a loader can never spin for ever. Progress bars are determinate only when the caller passes
   a real fraction; otherwise they are an indeterminate shimmer without any percentage.
   kinds: vocab | lesson | quiz | progress | import | generic */
import { h } from './ui.js';
import { t, n } from './i18n.js';
import { enabled } from './motion.js';

const WORDS = ['Learn', 'Improve', 'Discover', 'Practice'];
const svg = (markup) => { const tpl = document.createElement('template'); tpl.innerHTML = markup.trim(); return tpl.content.firstElementChild; };
const STAR = '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z"/>';
const star = (cls, style) => svg(`<svg class="ld-star ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true" style="${style || ''}">${STAR}</svg>`);

function artVocab() {
  const wrap = h('div', { class: 'ld-art ld-vocab' });
  WORDS.forEach((w, i) => wrap.append(h('span', { class: 'ld-word', 'aria-hidden': 'true', lang: 'en', style: { '--i': i } }, w)));
  const typed = h('div', { class: 'ld-typed', 'aria-hidden': 'true', lang: 'en' });
  wrap.append(typed);
  // letters appear one by one to form the words (stops by itself when the loader leaves the page)
  let wi = 0, ci = 0;
  const first = WORDS[0];
  if (!enabled()) typed.textContent = first;
  else {
    const timer = setInterval(() => {
      if (!typed.isConnected) { clearInterval(timer); return; }
      const word = WORDS[wi];
      if (ci <= word.length) typed.textContent = word.slice(0, ci++);
      else if (ci++ > word.length + 6) { wi = (wi + 1) % WORDS.length; ci = 0; }
    }, 130);
  }
  return wrap;
}
function artLesson() {
  const book = svg(`<svg class="ld-book" viewBox="0 0 140 100" aria-hidden="true">
    <path class="bk-shadow" d="M16 88h108" />
    <g class="bk-left"><path d="M70 22v58C52 72 32 70 14 74V18c20-4 40-2 56 4z"/><path class="bk-line" d="M26 34c10-2 21-1 32 3M26 46c10-2 21-1 32 3M26 58c10-2 21-1 32 3"/></g>
    <g class="bk-right"><path d="M70 22v58c18-8 38-10 56-6V18c-20-4-40-2-56 4z"/><path class="bk-line" d="M82 37c11-4 22-5 32-3M82 49c11-4 22-5 32-3M82 61c11-4 22-5 32-3"/></g>
  </svg>`);
  const wrap = h('div', { class: 'ld-art ld-lesson' }, book);
  [['ld-s1', 'left:18%;top:8%'], ['ld-s2', 'left:48%;top:0%'], ['ld-s3', 'right:16%;top:12%']].forEach(([c, st]) => wrap.append(star(c, st)));
  return wrap;
}
function artQuiz() {
  const wrap = h('div', { class: 'ld-art ld-quiz' });
  const letters = h('div', { class: 'ld-letters', 'aria-hidden': 'true' });
  ['Q', 'U', 'I', 'Z'].forEach((c, i) => letters.append(h('span', { class: 'ld-letter', style: { '--i': i, '--from': (i % 2 ? 1 : -1) * (40 + i * 18) + 'px' } }, c)));
  const cards = h('div', { class: 'ld-cards', 'aria-hidden': 'true' }, [0, 1, 2].map((i) => h('span', { class: 'ld-ans', style: { '--i': i } })));
  wrap.append(letters, cards, h('span', { class: 'ld-q ld-q1', 'aria-hidden': 'true' }, '?'), h('span', { class: 'ld-q ld-q2', 'aria-hidden': 'true' }, '?'));
  return wrap;
}
function artProgress() {
  const wrap = h('div', { class: 'ld-art ld-path' });
  wrap.append(svg(`<svg viewBox="0 0 240 110" aria-hidden="true">
    <path class="pt-base" d="M14 88C58 88 56 30 104 36S150 92 196 62 226 22 226 22" />
    <path class="pt-draw" pathLength="1" d="M14 88C58 88 56 30 104 36S150 92 196 62 226 22 226 22" />
    <circle class="pt-dot d1" cx="14" cy="88" r="7"/><circle class="pt-dot d2" cx="104" cy="36" r="7"/><circle class="pt-dot d3" cx="172" cy="78" r="7"/>
    <g class="pt-star s1" transform="translate(94 4) scale(1.1)">${STAR}</g><g class="pt-star s2" transform="translate(212 0) scale(1.3)">${STAR}</g>
  </svg>`));
  return wrap;
}
function artImport(count) {
  const wrap = h('div', { class: 'ld-art ld-import' });
  const stack = h('div', { class: 'ld-stack', 'aria-hidden': 'true' }, ['word', 'mot', 'слово', 'so‘z'].map((w, i) => h('span', { class: 'ld-card', style: { '--i': i } }, w)));
  wrap.append(stack);
  if (Number.isFinite(count)) wrap.append(h('div', { class: 'ld-count', 'aria-hidden': 'true' }, String(count)));
  return wrap;
}
function artGeneric() { return h('div', { class: 'ld-art ld-generic' }, h('span', { class: 'ld-dot', 'aria-hidden': 'true' }), h('span', { class: 'ld-dot', 'aria-hidden': 'true' }), h('span', { class: 'ld-dot', 'aria-hidden': 'true' })); }

const ART = { vocab: artVocab, lesson: artLesson, quiz: artQuiz, progress: artProgress, import: artImport, generic: artGeneric };
const LABEL = { vocab: 'load.vocab', lesson: 'load.lesson', quiz: 'load.quiz', progress: 'load.progress', import: 'load.import', generic: 'load.generic' };

export function loader(kind = 'generic', { label, count, progress, onRetry, slowAfter = 15000, compact = false } = {}) {
  const art = (ART[kind] || artGeneric)(count);
  const known = typeof progress === 'number' && progress >= 0 && progress <= 1;
  const bar = h('div', { class: 'ld-bar' + (known ? '' : ' indeterminate'), role: 'progressbar', 'aria-label': label || t(LABEL[kind] || LABEL.generic), ...(known ? { 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(progress * 100) } : {}) }, h('i', { style: known ? { width: Math.round(progress * 100) + '%' } : {} }));
  const text = kind === 'import' && Number.isFinite(count) ? n('load.import_n', count) : (label || t(LABEL[kind] || LABEL.generic));
  const el = h('div', { class: `ld ld-${kind}${compact ? ' compact' : ''}`, role: 'status', 'aria-live': 'polite' }, art, h('p', { class: 'ld-text' }, text), bar);
  // never an endless loader: after a while say so and offer a retry
  if (slowAfter) {
    setTimeout(() => {
      if (!el.isConnected) return;
      el.append(h('div', { class: 'ld-slow' }, h('p', { class: 'muted small' }, t('load.slow')), onRetry ? h('button', { type: 'button', class: 'btn secondary small', onclick: onRetry }, t('common.try_again')) : null));
    }, slowAfter);
  }
  return el;
}

/* puts a loader into `host` after a short delay (quick requests never flash a loader) and returns stop() which removes it */
export function showLoader(host, kind, opts = {}, delay = 140) {
  let el = null, stopped = false;
  const timer = setTimeout(() => { if (!stopped) { el = loader(kind, opts); host.replaceChildren(el); } }, delay);
  return () => { stopped = true; clearTimeout(timer); if (el && el.parentNode === host) el.remove(); };
}

/* a full-screen loader on top of the current page (used while a lesson or quiz is being created); returns stop() */
export function overlay(kind, opts = {}, delay = 140) {
  let box = null, stopped = false;
  const timer = setTimeout(() => {
    if (stopped) return;
    box = h('div', { class: 'ld-overlay' }, loader(kind, { ...opts, slowAfter: 0 }));
    document.body.append(box);
    requestAnimationFrame(() => box && box.classList.add('in'));
  }, delay);
  return () => { stopped = true; clearTimeout(timer); if (box) { const b = box; box = null; b.classList.remove('in'); setTimeout(() => b.remove(), enabled() ? 160 : 0); } };
}
