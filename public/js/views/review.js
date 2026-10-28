import { h, icon, speak, canSpeak, toast, spinner } from '../ui.js';
import { get, post, ApiError } from '../api.js';
import { refreshStats } from '../app.js';

const MODE_NAMES = { flashcards: 'Flashcards', choice: 'Multiple choice', typed: 'Typed answers', spelling: 'Spelling' };

export default async function review({ query }) {
  const box = h('div', { class: 'stack' });
  const mode0 = MODE_NAMES[query.get('mode')] ? query.get('mode') : 'choice';
  let difficultOnly = query.get('difficult') === '1';
  const summary = await get('/review/summary');

  function home(mode) {
    box.replaceChildren(
      h('div', { class: 'page-head' }, h('h1', {}, 'Review words')),
      h('div', { class: 'card' }, h('div', { class: 'chips' }, h('span', { class: 'chip warn' }, `${summary.due} due now`), h('span', { class: 'chip' }, `${summary.total} words scheduled`), h('span', { class: 'chip bad' }, icon('flag'), `${summary.difficult} difficult`)),
        h('p', { class: 'muted', style: { marginTop: '10px' } }, 'Words come back on a schedule: a right answer moves a word to a longer interval, a wrong one brings it back soon. Difficult words are asked first.'),
        h('div', { class: 'field' }, h('label', {}, h('span', { class: 'label' }, 'Mode'), h('select', { class: 'input', id: 'mode', onchange: (e) => { mode = e.target.value; } }, Object.entries(MODE_NAMES).map(([v, l]) => h('option', { value: v, selected: v === mode }, l))))),
        h('label', { class: 'switch field' }, h('input', { type: 'checkbox', checked: difficultOnly, onchange: (e) => { difficultOnly = e.target.checked; } }), h('span', {}, 'Only my difficult words')),
        h('button', { class: 'btn block', type: 'button', disabled: !summary.due && !summary.difficult, onclick: () => start() }, 'Start review'),
        !summary.due ? h('p', { class: 'muted small', style: { marginTop: '10px' } }, summary.total ? 'Nothing is due yet — come back later, or mark words as difficult to practise them now.' : 'Finish a lesson or add words from the Vocabulary page to start reviewing.') : null));
  }
  let mode = mode0;

  async function start() {
    box.replaceChildren(spinner());
    let s;
    try { s = await post('/review/session', { mode, size: 10, difficultOnly }); } catch (e) { toast(e.message, 'error'); return home(mode); }
    if (!s.cards.length) { toast('No words to review right now.', 'info'); summary.due = 0; return home(mode); }
    runCards(s.cards);
  }

  function runCards(cards) {
    let i = 0, correct = 0, xp = 0, hearts = 0;
    const bar = h('i', { style: { width: '0%' } });
    function show() {
      if (i >= cards.length) return done();
      const c = cards[i];
      bar.style.width = Math.round(100 * i / cards.length) + '%';
      const body = h('div', { class: 'stack' });
      const feedback = h('div', { 'aria-live': 'polite', role: 'status' });
      const next = h('button', { class: 'btn block', type: 'button', hidden: true, onclick: () => { i++; show(); } }, i + 1 >= cards.length ? 'Finish' : 'Continue');
      const submit = async (answer, extra = {}) => {
        try {
          const r = await post('/review/answer', { vocabularyId: c.vocabularyId, mode: c.mode, direction: c.direction, answer, ...extra });
          if (r.correct) correct++; xp += r.xp; if (r.heartEarned) hearts++;
          summary.due = r.counts.due; summary.total = r.counts.total; summary.difficult = r.counts.difficult;
          feedback.replaceChildren(h('div', { class: 'card', style: { borderColor: r.correct ? 'var(--ok)' : 'var(--danger)' } }, h('b', { style: { color: r.correct ? 'var(--ok)' : 'var(--danger)' } }, r.correct ? 'Correct!' : 'Not quite'), !r.correct || c.mode === 'flashcards' ? h('p', { style: { margin: '4px 0 0' } }, r.correctAnswer) : null, r.xp ? h('span', { class: 'chip warn' }, icon('bolt'), `+${r.xp} XP`) : null));
          next.hidden = false; next.focus();
          return r;
        } catch (e) { toast(e instanceof ApiError ? e.message : 'Could not save the answer.', 'error'); }
      };
      if (c.mode === 'flashcards') {
        let flipped = false;
        const card = h('button', { type: 'button', class: 'flash-inner', 'aria-label': 'Flip card' });
        const face = () => card.replaceChildren(flipped ? h('div', {}, h('div', { class: 'big' }, c.back), c.example ? h('p', { class: 'muted', lang: 'en' }, c.example) : null) : h('div', {}, h('div', { class: 'big', lang: 'en' }, c.front), h('p', { class: 'muted' }, 'Tap to see the translation')));
        face();
        const row = h('div', { class: 'row', hidden: true }, h('button', { class: 'btn danger', style: { flex: 1 }, type: 'button', onclick: async (e) => { row.hidden = true; await submit(false); } }, 'Again'), h('button', { class: 'btn', style: { flex: 1 }, type: 'button', onclick: async () => { row.hidden = true; await submit(true); } }, 'I knew it'));
        card.addEventListener('click', () => { flipped = !flipped; face(); if (flipped && !row.hidden === false && next.hidden) row.hidden = false; });
        body.append(h('div', { class: 'flash' }, card), (canSpeak() || c.audio.url) ? h('button', { class: 'btn secondary small', type: 'button', onclick: () => speak(c.audio) }, icon('volume'), 'Hear it') : null, row, feedback, next);
      } else if (c.options) {
        let done1 = false;
        const opts = c.options.map((o, k) => h('button', { type: 'button', class: 'option', onclick: async (e) => { if (done1) return; done1 = true; opts.forEach((b) => { b.disabled = true; }); const r = await submit(o); if (!r) { done1 = false; opts.forEach((b) => { b.disabled = false; }); return; } e.currentTarget.classList.add(r.correct ? 'right' : 'wrong'); if (!r.correct) opts.find((b) => b.lastChild.textContent === r.correctAnswer)?.classList.add('right'); } }, h('span', { class: 'key', 'aria-hidden': 'true' }, String(k + 1)), h('span', {}, o)));
        body.append(h('h1', { class: 'q-title' }, c.direction === 'uz-en' ? 'Select the English word.' : 'Select the translation.'), h('div', { class: 'q-sentence' }, h('span', { lang: c.direction === 'uz-en' ? 'uz' : 'en' }, c.prompt)), h('div', { class: 'options' }, opts), feedback, next);
      } else {
        const input = h('input', { class: 'input answer-input', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Your answer' });
        const go = h('button', { class: 'btn block', type: 'button', onclick: async () => { if (!input.value.trim() || input.disabled) return; input.disabled = true; go.hidden = true; const r = await submit(input.value.trim()); if (!r) { input.disabled = false; go.hidden = false; } else input.classList.add(r.correct ? 'right' : 'wrong'); } }, 'Check');
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go.click(); } });
        const title = c.mode === 'spelling' ? 'Listen and spell the English word.' : c.direction === 'uz-en' ? 'Translate into English.' : 'Translate into Uzbek.';
        body.append(h('h1', { class: 'q-title' }, title), h('div', { class: 'q-sentence' }, c.mode === 'spelling' ? h('button', { type: 'button', class: 'speak', 'aria-label': 'Play audio', onclick: () => speak(c.audio) }, icon('volume')) : null, h('span', { lang: c.direction === 'uz-en' || c.mode === 'spelling' ? 'uz' : 'en' }, c.prompt), c.mode === 'spelling' ? h('span', { class: 'muted small' }, `${c.length} letters`) : null), input, go, feedback, next);
        setTimeout(() => input.focus(), 50);
        if (c.mode === 'spelling') setTimeout(() => speak(c.audio), 300);
      }
      box.replaceChildren(h('div', { class: 'row' }, h('div', { class: 'progress', style: { flex: 1 }, role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': cards.length, 'aria-valuenow': i }, bar), h('button', { class: 'btn ghost small', type: 'button', onclick: done }, 'Stop')), body);
    }
    function done() {
      refreshStats();
      box.replaceChildren(h('div', { class: 'card center' }, h('img', { src: '/img/mascot.svg', alt: '', width: 110, height: 110 }), h('h1', {}, 'Review finished'), h('p', {}, `${correct} of ${i >= cards.length ? cards.length : i} correct`), h('div', { class: 'chips', style: { justifyContent: 'center' } }, h('span', { class: 'chip warn' }, icon('bolt'), `+${xp} XP`), hearts ? h('span', { class: 'chip heart' }, icon('heart'), `+${hearts} heart`) : null),
        h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '16px' } }, h('button', { class: 'btn', onclick: () => { if (summary.due) start(); else home(mode); } }, summary.due ? 'More words' : 'Done'), h('a', { class: 'btn secondary', href: '/vocabulary' }, 'Vocabulary list'))));
    }
    show();
  }
  home(mode);
  return { el: box, title: 'Review', nav: 'review' };
}
