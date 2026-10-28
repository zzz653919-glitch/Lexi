/* Exercise types: validation of authored content, the payload sent to learners (never contains the answer),
   and server-side grading. */
const { shuffled, clean, cleanMultiline } = require('./util');
const I18N = require('../../shared/i18n-core');

// the labels and default instructions of the types are interface texts (locales: ex.type.<id>, ex.instr.<id>)
const TYPES = Object.fromEntries(['multiple_choice', 'translation_choice', 'fill_blank', 'translate_type', 'scramble_letters', 'order_words', 'match_pairs', 'listen_choice', 'listen_type', 'reading', 'fix_spelling'].map((id) => [id, {}]));
const TYPE_IDS = Object.keys(TYPES);
const CHOICE = new Set(['multiple_choice', 'translation_choice', 'listen_choice', 'reading']);

/* ---------- normalisation ---------- */
const CONTRACTIONS = [["i'm", 'i am'], ["you're", 'you are'], ["he's", 'he is'], ["she's", 'she is'], ["it's", 'it is'], ["we're", 'we are'], ["they're", 'they are'], ["that's", 'that is'], ["there's", 'there is'], ["don't", 'do not'], ["doesn't", 'does not'], ["didn't", 'did not'], ["can't", 'cannot'], ["won't", 'will not'], ["isn't", 'is not'], ["aren't", 'are not'], ["wasn't", 'was not'], ["weren't", 'were not'], ["haven't", 'have not'], ["hasn't", 'has not'], ["i've", 'i have'], ["i'll", 'i will'], ["i'd", 'i would']];
function norm(text) {
  let s = String(text == null ? '' : text).normalize('NFKC').toLowerCase()
    .replace(/[‘’ʻʼʹ`´]/g, "'")        // every apostrophe-like mark (also Uzbek o‘ g‘) becomes '
    .replace(/[.,!?;:"“”()\[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [a, b] of CONTRACTIONS) s = s.split(a).join(b);
  return s.replace(/\bcan not\b/g, 'cannot').replace(/\s+/g, ' ').trim();
}
const alternatives = (answer) => String(answer || '').split('|').map((x) => x.trim()).filter(Boolean);
function editDistance(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
const tokensOf = (sentence) => String(sentence).replace(/[.!?]+$/, '').split(/\s+/).filter(Boolean);

/* ---------- validation of authored exercises (used by the admin editor, import and publishing) ---------- */
const VARIANT_TEXT = { prompt: 300, answer: 500, sentence: 400, passage: 3000, translation: 400, explanation: 600, hint: 200, audio_text: 300 };
/* translated variants of an exercise: { ru: { sentence, answer, ..., options: [{ text, match_text }] } } (only known languages and fields) */
function cleanVariants(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const lang of I18N.CODES) {
    const v = raw[lang]; if (!v || typeof v !== 'object') continue;
    const o = {};
    for (const [f, max] of Object.entries(VARIANT_TEXT)) { const t = f === 'passage' ? cleanMultiline(v[f], max) : clean(v[f], max); if (t) o[f] = f === 'answer' ? t.replace(/\n+/g, '|') : t; }
    if (Array.isArray(v.options)) o.options = v.options.slice(0, 12).map((x) => ({ text: clean(x && x.text, 200), match_text: clean(x && x.match_text, 200) }));
    if (Object.keys(o).length) out[lang] = o;
  }
  return out;
}
function normalizeInput(raw) {
  return {
    translations: cleanVariants(raw.translations),
    type: clean(raw.type, 40),
    prompt: clean(raw.prompt, 300),
    answer: cleanMultiline(raw.answer, 500).replace(/\n+/g, '|'),
    sentence: clean(raw.sentence, 400),
    passage: cleanMultiline(raw.passage, 3000),
    audio_text: clean(raw.audio_text, 300),
    audio_url: clean(raw.audio_url, 200),
    translation: clean(raw.translation, 400),
    explanation: clean(raw.explanation, 600),
    hint: clean(raw.hint, 200),
    direction: raw.direction === 'uz-en' ? 'uz-en' : 'en-uz',
    skill: ['vocabulary', 'grammar', 'reading', 'listening'].includes(raw.skill) ? raw.skill : null,
    difficulty: Math.min(5, Math.max(1, Number.parseInt(raw.difficulty, 10) || 1)),
    status: raw.status === 'draft' ? 'draft' : 'published',
    vocabulary_id: Number.parseInt(raw.vocabulary_id, 10) || null,
    options: (Array.isArray(raw.options) ? raw.options : []).slice(0, 12).map((o) => ({ text: clean(o && o.text, 200), match_text: clean(o && o.match_text, 200), is_correct: !!(o && o.is_correct) })),
  };
}
/* -> array of { field, message } (empty = valid) */
function validate(ex) {
  const errs = [];
  const need = (field, msg, params) => errs.push({ field, message: msg, params });
  if (!TYPES[ex.type]) { need('type', 'val.type_required'); return errs; }
  const opts = ex.options.filter((o) => o.text);
  for (const [lang, v] of Object.entries(ex.translations || {})) if (v.options && v.options.filter((o) => o.text).length !== opts.length) need('translations', 'val.variant_options', { language: lang });
  const hasAudio = ex.audio_text || ex.audio_url;
  if (ex.audio_url && !/^\/uploads\/[A-Za-z0-9_-]{6,40}$/.test(ex.audio_url)) need('audio_url', 'val.audio_upload_only');
  if (CHOICE.has(ex.type)) {
    if (opts.length < 2) need('options', 'val.options_min');
    if (opts.length > 6) need('options', 'val.options_max');
    if (opts.filter((o) => o.is_correct).length !== 1) need('options', 'val.options_one_correct');
    if (new Set(opts.map((o) => norm(o.text))).size !== opts.length) need('options', 'val.options_unique');
  }
  if (ex.type === 'multiple_choice' && !ex.prompt) need('prompt', 'val.question_required');
  if (ex.type === 'translation_choice' && !ex.sentence) need('sentence', 'val.word_to_translate_required');
  if (ex.type === 'reading') { if (!ex.passage || ex.passage.length < 20) need('passage', 'val.passage_required'); if (!ex.prompt) need('prompt', 'val.passage_question_required'); }
  if (ex.type === 'listen_choice' && !hasAudio) need('audio_text', 'val.audio_required');
  if (ex.type === 'listen_type') { if (!hasAudio) need('audio_text', 'val.audio_required'); if (!alternatives(ex.answer).length) need('answer', 'val.listen_answer_required'); }
  if (ex.type === 'fill_blank') {
    if ((ex.sentence.match(/_{3,}/g) || []).length !== 1) need('sentence', 'val.blank_exactly_one');
    if (!alternatives(ex.answer).length) need('answer', 'val.blank_answer_required');
  }
  if (ex.type === 'translate_type') { if (!ex.sentence) need('sentence', 'val.text_to_translate_required'); if (!alternatives(ex.answer).length) need('answer', 'val.translation_required'); }
  if (ex.type === 'scramble_letters') {
    const w = alternatives(ex.answer)[0] || '';
    if (!/^\p{L}{3,14}$/u.test(w)) need('answer', 'val.scramble_word');
    if (!ex.sentence && !ex.prompt) need('sentence', 'val.scramble_clue');
  }
  if (ex.type === 'order_words') {
    const t = tokensOf(ex.sentence);
    if (t.length < 3 || t.length > 14) need('sentence', 'val.order_sentence');
    if (!ex.prompt) need('prompt', 'val.order_prompt_required');
  }
  if (ex.type === 'match_pairs') {
    const pairs = opts.filter((o) => o.match_text);
    if (pairs.length < 3 || pairs.length > 6 || pairs.length !== opts.length) need('options', 'val.pairs_count');
    if (new Set(pairs.map((o) => norm(o.text))).size !== pairs.length || new Set(pairs.map((o) => norm(o.match_text))).size !== pairs.length) need('options', 'val.pairs_unique');
  }
  if (ex.type === 'fix_spelling') {
    if (!ex.sentence) need('sentence', 'val.spelling_text_required');
    if (!alternatives(ex.answer).length) need('answer', 'val.spelling_answer_required');
    else if (norm(ex.sentence) === norm(alternatives(ex.answer)[0])) need('answer', 'val.spelling_must_differ');
  }
  return errs;
}

/* ---------- what a learner receives (no answers) ---------- */
function payload(ex, options, seed) {
  const s = seed + ex.id;
  const p = { id: ex.id, type: ex.type, prompt: ex.prompt, hint: ex.hint, difficulty: ex.difficulty, direction: ex.direction };
  if (CHOICE.has(ex.type)) p.options = shuffled(options, s).map((o) => ({ id: o.id, text: o.text }));
  if (ex.type === 'translation_choice') p.sentence = ex.sentence;
  if (ex.type === 'reading') p.passage = ex.passage;
  if (ex.type === 'listen_choice' || ex.type === 'listen_type') p.audio = ex.audio_url ? { url: ex.audio_url } : { text: ex.audio_text };
  if (ex.type === 'fill_blank' || ex.type === 'translate_type' || ex.type === 'fix_spelling') p.sentence = ex.sentence;
  if (ex.type === 'scramble_letters') {
    p.sentence = ex.sentence;
    const letters = Array.from(alternatives(ex.answer)[0].toUpperCase());
    let t = shuffled(letters.map((c, i) => ({ id: i, text: c })), s);
    for (let k = 1; k < 6 && t.every((x, i) => x.id === i) && letters.length > 1; k++) t = shuffled(letters.map((c, i) => ({ id: i, text: c })), s + k * 7919);
    p.tiles = t;
  }
  if (ex.type === 'order_words') {
    const toks = tokensOf(ex.sentence).map((text, i) => ({ id: i, text }));
    const extra = options.map((o, i) => ({ id: toks.length + i, text: o.text }));   // optional distractor words
    p.tiles = shuffled(toks.concat(extra), s);
  }
  if (ex.type === 'match_pairs') {
    p.left = options.map((o, i) => ({ id: i, text: o.text }));
    p.right = shuffledPerm(options.length, s).map((src, j) => ({ id: j, text: options[src].match_text }));
  }
  return p;
}
function shuffledPerm(n, seed) {
  const idx = Array.from({ length: n }, (_, i) => i);
  let p = shuffled(idx, seed);
  for (let k = 1; k < 6 && n > 1 && p.every((v, i) => v === i); k++) p = shuffled(idx, seed + k * 104729);
  return p;
}

/* ---------- grading ---------- */
/* -> { correct, typo, correctAnswer (text to display), invalid } */
function grade(ex, options, answer, seed) {
  const s = seed + ex.id;
  const alts = alternatives(ex.answer);
  const res = (correct, correctAnswer, extra) => Object.assign({ correct, typo: false, correctAnswer }, extra);
  const typed = (user, accepted, tolerant) => {
    const u = norm(user);
    if (!u) return { correct: false };
    for (const a of accepted) if (u === norm(a)) return { correct: true };
    if (tolerant) for (const a of accepted) { const n = norm(a); if (n.length >= 6 && editDistance(u, n) === 1) return { correct: true, typo: true }; }
    return { correct: false };
  };
  switch (ex.type) {
    case 'multiple_choice': case 'translation_choice': case 'listen_choice': case 'reading': {
      const right = options.find((o) => o.is_correct);
      const id = Number(answer);
      if (!Number.isInteger(id) || !options.some((o) => o.id === id)) return { invalid: true };
      return res(right && right.id === id, right ? right.text : '');
    }
    case 'fill_blank': case 'listen_type': case 'translate_type': {
      if (typeof answer !== 'string') return { invalid: true };
      const r = typed(answer, alts, true);
      return res(r.correct, alts[0], { typo: !!r.typo });
    }
    case 'fix_spelling': {
      if (typeof answer !== 'string') return { invalid: true };
      return res(typed(answer, alts, false).correct, alts[0]);
    }
    case 'scramble_letters': {
      if (!Array.isArray(answer)) return { invalid: true };
      const letters = Array.from(alts[0].toUpperCase());
      const ids = answer.map(Number);
      if (ids.some((i) => !Number.isInteger(i) || i < 0 || i >= letters.length) || new Set(ids).size !== ids.length) return { invalid: true };
      const built = ids.map((i) => letters[i]).join('');
      return res(norm(built) === norm(alts[0]) || alts.some((a) => norm(a) === norm(built)), alts[0]);
    }
    case 'order_words': {
      if (!Array.isArray(answer)) return { invalid: true };
      const toks = tokensOf(ex.sentence);
      const extra = options.length;
      const ids = answer.map(Number);
      if (ids.some((i) => !Number.isInteger(i) || i < 0 || i >= toks.length + extra) || new Set(ids).size !== ids.length) return { invalid: true };
      const all = toks.concat(options.map((o) => o.text));
      const built = ids.map((i) => all[i]).join(' ');
      const accepted = [ex.sentence].concat(alts);
      return res(accepted.some((a) => norm(a) === norm(built)), ex.sentence);
    }
    case 'match_pairs': {
      if (!Array.isArray(answer)) return { invalid: true };
      const perm = shuffledPerm(options.length, s);
      const seen = new Set();
      let ok = answer.length === options.length;
      for (const pr of answer) {
        const l = Number(pr && pr.left), r = Number(pr && pr.right);
        if (!Number.isInteger(l) || !Number.isInteger(r) || l < 0 || r < 0 || l >= options.length || r >= options.length || seen.has(l)) return { invalid: true };
        seen.add(l);
        if (perm[r] !== l) ok = false;
      }
      return res(ok, options.map((o) => `${o.text} = ${o.match_text}`).join('; '));
    }
    default: return { invalid: true };
  }
}

module.exports = { TYPES, TYPE_IDS, CHOICE, normalizeInput, validate, payload, grade, norm, alternatives, editDistance, tokensOf };
