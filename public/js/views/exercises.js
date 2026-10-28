/* Exercise renderers. Each returns { el, answer(), lock(), reveal(feedback), focus() } and calls ctx.changed() when the
   learner's answer becomes (in)complete and ctx.submit() when Enter should check it. The browser never receives the answer. */
import { h, icon, speak, canSpeak } from '../ui.js';
import { session } from '../api.js';
import { t } from '../i18n.js';

/* the instruction shown above an exercise: the authored text if there is one, else the default for its type (in the interface language) */
export function instruction(ex) {
  if (ex.prompt) return ex.prompt;
  const tl = (session.user && session.user.translationLanguage) || 'uz';
  switch (ex.type) {
    case 'translation_choice': return t(ex.direction === 'uz-en' ? 'ex.instr.translation_choice_reverse' : 'ex.instr.translation_choice');
    case 'translate_type': return ex.direction === 'uz-en' ? t('ex.instr.translate_to_english') : t('ex.instr.translate_to_' + (tl === 'ru' ? 'ru' : 'uz'));
    default: return t('ex.instr.' + ex.type);
  }
}

const speakBtns = (audio) => {
  if (!audio) return null;
  if (!audio.url && !canSpeak()) return h('div', { class: 'notice' }, t('ex.no_audio') + ' ', h('b', {}, audio.text));
  return h('div', { class: 'row' },
    h('button', { type: 'button', class: 'speak', 'aria-label': t('ex.play'), title: t('ex.play'), onclick: () => speak(audio) }, icon('volume')),
    h('button', { type: 'button', class: 'speak slow', 'aria-label': t('ex.play_slow'), title: t('ex.play_slow'), onclick: () => speak(audio, true) }, icon('slow')));
};

function choices(ex, ctx, { header }) {
  let chosen = null, locked = false;
  const buttons = ex.options.map((o, i) => h('button', { type: 'button', class: 'option', 'data-id': String(o.id), 'aria-pressed': 'false', onclick: () => pick(o.id) }, h('span', { class: 'key', 'aria-hidden': 'true' }, String(i + 1)), h('span', {}, o.text)));
  function pick(id) {
    if (locked) return;
    chosen = id;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.id) === id)));
    ctx.changed(true);
  }
  const el = h('div', {}, header, h('div', { class: 'options', role: 'group', 'aria-label': t('ex.options') }, buttons));
  return {
    el, answer: () => chosen, lock() { locked = true; buttons.forEach((b) => { b.disabled = true; }); },
    key(e) { const num = Number(e.key); if (num >= 1 && num <= buttons.length) { pick(ex.options[num - 1].id); return true; } return false; },
    reveal(fb) { buttons.forEach((b) => { const id = Number(b.dataset.id); const txt = b.textContent.slice(1); if (id === chosen) b.classList.add(fb.correct ? 'right' : 'wrong'); else if (!fb.correct && fb.correctAnswer && txt === fb.correctAnswer) b.classList.add('right'); }); },
    focus() { buttons[0] && buttons[0].focus(); },
  };
}

function textInput(ex, ctx, { header, placeholder }) {
  const input = h('input', { class: 'input answer-input', type: 'text', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': t('ex.your_answer'), placeholder: placeholder || t('ex.type_answer') });
  input.addEventListener('input', () => ctx.changed(input.value.trim().length > 0));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ctx.submit(); } });
  return { el: h('div', {}, header, input), answer: () => (input.value.trim() ? input.value.trim() : null), lock() { input.disabled = true; }, reveal(fb) { input.classList.add(fb.correct ? 'right' : 'wrong'); }, focus() { input.focus(); } };
}

/* tile builder (letters or words): tiles move between the bank and the answer line */
function tiles(ex, ctx, { header, letters, needAll }) {
  const placed = [];                       // tile ids in answer order
  const bank = h('div', { class: 'tile-area', role: 'group', 'aria-label': t(letters ? 'ex.letters_available' : 'ex.words_available') });
  const line = h('div', { class: 'tile-area answer', role: 'group', 'aria-label': t('ex.your_answer') });
  const btn = {};
  ex.tiles.forEach((tile) => { btn[tile.id] = h('button', { type: 'button', class: 'tile' + (letters ? ' letter' : ''), onclick: () => toggle(tile.id) }, tile.text); bank.append(btn[tile.id]); });
  let locked = false;
  const clones = {};
  function toggle(id) {
    if (locked) return;
    const i = placed.indexOf(id);
    if (i >= 0) { placed.splice(i, 1); clones[id].remove(); delete clones[id]; btn[id].classList.remove('used'); btn[id].disabled = false; }
    else { placed.push(id); const c = h('button', { type: 'button', class: 'tile' + (letters ? ' letter' : ''), 'aria-label': t('ex.remove_tile', { text: btn[id].textContent }), onclick: () => toggle(id) }, btn[id].textContent); clones[id] = c; line.append(c); btn[id].classList.add('used'); btn[id].disabled = true; }
    ctx.changed(needAll ? placed.length === ex.tiles.length : placed.length > 0);
  }
  const el = h('div', {}, header, line, bank);
  return {
    el, answer: () => (needAll ? (placed.length === ex.tiles.length ? placed.slice() : null) : (placed.length ? placed.slice() : null)),
    lock() { locked = true; }, reveal(fb) { line.classList.add(fb.correct ? 'right' : 'wrong'); },
    key(e) {
      if (e.key === 'Backspace' && placed.length) { toggle(placed[placed.length - 1]); return true; }
      if (letters && e.key.length === 1 && /\p{L}/u.test(e.key)) { const tile = ex.tiles.find((x) => !placed.includes(x.id) && x.text.toLowerCase() === e.key.toLowerCase()); if (tile) { toggle(tile.id); return true; } }
      return false;
    },
    focus() { const f = bank.querySelector('button:not(:disabled)'); f && f.focus(); },
  };
}

function matchPairs(ex, ctx, { header }) {
  const pairs = new Map();                // left id -> right id
  let selLeft = null, locked = false;
  const colors = ['#2f7de1', '#e8590c', '#8b5cf6', '#0e9aa7', '#d6336c', '#5c940d'];
  const L = {}, R = {};
  const tag = (b, num) => { const old = b.querySelector('.key'); if (old) old.remove(); if (num != null) b.prepend(h('span', { class: 'key', 'aria-hidden': 'true', style: { background: colors[num % 6], color: '#fff', borderColor: colors[num % 6] } }, String(num + 1))); };
  function redraw() {
    const order = Array.from(pairs.keys());
    ex.left.forEach((l) => { const rId = pairs.get(l.id); const i = order.indexOf(l.id); tag(L[l.id], rId !== undefined ? i : null); L[l.id].classList.toggle('selected', selLeft === l.id); L[l.id].setAttribute('aria-pressed', String(selLeft === l.id || rId !== undefined)); });
    ex.right.forEach((r) => { const left = Array.from(pairs.entries()).find(([, v]) => v === r.id); tag(R[r.id], left ? order.indexOf(left[0]) : null); R[r.id].setAttribute('aria-pressed', String(!!left)); });
    ctx.changed(pairs.size === ex.left.length);
  }
  const pickLeft = (id) => { if (locked) return; if (pairs.has(id)) { pairs.delete(id); selLeft = null; } else selLeft = selLeft === id ? null : id; redraw(); };
  const pickRight = (id) => {
    if (locked) return;
    const owner = Array.from(pairs.entries()).find(([, v]) => v === id);
    if (owner) { pairs.delete(owner[0]); selLeft = null; return redraw(); }
    if (selLeft === null) return;
    pairs.set(selLeft, id); selLeft = null; redraw();
  };
  const lc = h('div', { class: 'col' }, ex.left.map((l) => (L[l.id] = h('button', { type: 'button', class: 'option', onclick: () => pickLeft(l.id) }, l.text))));
  const rc = h('div', { class: 'col' }, ex.right.map((r) => (R[r.id] = h('button', { type: 'button', class: 'option', onclick: () => pickRight(r.id) }, r.text))));
  return {
    el: h('div', {}, header, h('p', { class: 'q-sub' }, t('ex.match_hint')), h('div', { class: 'match' }, lc, rc)),
    answer: () => (pairs.size === ex.left.length ? Array.from(pairs.entries()).map(([left, right]) => ({ left, right })) : null),
    lock() { locked = true; Object.values(L).concat(Object.values(R)).forEach((b) => { b.disabled = true; }); },
    reveal(fb) { Object.values(L).concat(Object.values(R)).forEach((b) => b.classList.add(fb.correct ? 'done' : 'bad')); },
    focus() { const f = lc.querySelector('button'); f && f.focus(); },
  };
}

const title = (ex) => h('h1', { class: 'q-title' }, instruction(ex));
const sentenceBox = (text, audio) => h('div', { class: 'q-sentence' }, audio ? h('button', { type: 'button', class: 'speak', 'aria-label': t('ex.play'), title: t('ex.play'), onclick: () => speak(audio) }, icon('volume')) : null, h('span', { lang: audio ? 'en' : undefined }, text));

/* a teaching card (a new word or a grammar point): nothing to answer, the learner just reads it and continues */
function card(ex, ctx) {
  const c = ex.card;
  ctx.changed(true);
  const el = h('div', { class: 'info-card' + (c.grammar ? ' grammar' : '') },
    h('span', { class: 'eyebrow' }, t(c.grammar ? 'daily.card_grammar' : 'daily.card_word')),
    h('h1', { class: 'q-title', lang: c.grammar ? undefined : 'en' }, c.title, c.grammar ? null : h('button', { type: 'button', class: 'speak', 'aria-label': t('ex.play'), title: t('ex.play'), onclick: () => speak({ text: c.audio || c.title }) }, icon('volume'))),
    h('p', { class: 'info-body' }, c.body),
    c.examples && c.examples.length ? h('ul', { class: 'info-examples', lang: 'en' }, c.examples.map((x) => h('li', {}, x))) : null,
    c.note ? h('p', { class: 'muted small' }, c.note) : null);
  return { el, answer: () => true, lock() {}, focus() {} };
}

export const RENDERERS = {
  card,
  multiple_choice: (ex, ctx) => choices(ex, ctx, { header: title(ex) }),
  translation_choice: (ex, ctx) => choices(ex, ctx, { header: h('div', {}, title(ex), sentenceBox(ex.sentence, ex.direction === 'uz-en' ? null : { text: ex.sentence })) }),
  reading: (ex, ctx) => choices(ex, ctx, { header: h('div', {}, h('p', { class: 'q-sub' }, t('ex.read_passage')), h('div', { class: 'passage', lang: 'en' }, ex.passage), title(ex)) }),
  listen_choice: (ex, ctx) => choices(ex, ctx, { header: h('div', {}, title(ex), speakBtns(ex.audio), h('div', { style: { height: '14px' } })) }),
  listen_type: (ex, ctx) => textInput(ex, ctx, { header: h('div', {}, title(ex), speakBtns(ex.audio), h('div', { style: { height: '14px' } })), placeholder: t('ex.type_what_you_hear') }),
  fill_blank: (ex, ctx) => {
    const parts = ex.sentence.split(/_{3,}/);
    const s = h('div', { class: 'q-sentence', lang: 'en' }, h('span', {}, parts[0], h('span', { class: 'blank', 'aria-label': t('ex.blank') }, '   '), parts[1] || ''));
    return textInput(ex, ctx, { header: h('div', {}, title(ex), s) });
  },
  translate_type: (ex, ctx) => textInput(ex, ctx, { header: h('div', {}, title(ex), sentenceBox(ex.sentence, ex.direction === 'en-uz' ? { text: ex.sentence } : null)), placeholder: ex.direction === 'en-uz' ? t('ex.type_translation') : t('ex.type_in_english') }),
  fix_spelling: (ex, ctx) => {
    const r = textInput(ex, ctx, { header: h('div', {}, title(ex), h('div', { class: 'q-sentence', lang: 'en' }, ex.sentence)) });
    const input = r.el.querySelector('input'); input.value = ex.sentence; input.addEventListener('focus', () => input.select(), { once: true });
    const orig = r.answer; r.answer = () => { const v = orig(); return v && v !== ex.sentence ? v : null; };
    input.addEventListener('input', () => ctx.changed(input.value.trim().length > 0 && input.value.trim() !== ex.sentence));
    return r;
  },
  scramble_letters: (ex, ctx) => tiles(ex, ctx, { header: h('div', {}, title(ex), ex.sentence ? h('div', { class: 'q-sentence' }, ex.sentence) : null), letters: true, needAll: true }),
  order_words: (ex, ctx) => tiles(ex, ctx, { header: h('div', {}, h('h1', { class: 'q-title' }, t('ex.instr.order_words')), h('div', { class: 'q-sentence' }, ex.prompt)), letters: false, needAll: false }),
  match_pairs: (ex, ctx) => matchPairs(ex, ctx, { header: title(ex) }),
};
