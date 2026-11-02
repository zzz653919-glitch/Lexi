/* One-time conversion of the Uzbek content already stored in a database to the new Uzbek Latin alphabet
   (o‘ → ö, g‘ → ğ, sh → ş, ch → ç; see shared/uz-alphabet.js).  Run with:  npm run uz-alphabet  [-- --dry-run]
   Only fields that hold Uzbek text are touched:
     - vocabulary.uz / example_uz, the "uz" entry of the translations JSON of courses, levels, units, lessons and grammar points,
     - exercise fields in the translation language (translation; the Uzbek side of translation_choice, translate_type,
       scramble_letters, order_words and match_pairs; the part after "” — " in an explanation),
     - administrator overrides of Uzbek interface texts.
   English words that appear inside Uzbek text (she, should, wish …) are kept: every word known from the English interface texts,
   the vocabulary and the row's own English fields is left as it is. The conversion is idempotent (running it twice changes nothing). */
const path = require('node:path');
const fs = require('node:fs');
const UZ = require('../../shared/uz-alphabet');

const WORD = /(\p{L}[\p{L}‘ʻ'`’ʼ]*)/u;
const wordsOf = (s, set) => { for (const w of String(s || '').split(/[^A-Za-z]+/)) if (w) set.add(w.toLowerCase()); return set; };

function englishWords() {
  const set = new Set();
  try { const en = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'locales', 'en.json'), 'utf8')); for (const v of Object.values(en)) wordsOf(JSON.stringify(v), set); } catch (_) { /* no file */ }
  return set;
}

/* converts Uzbek text word by word, keeping the words of `keep` (English) */
function convertText(text, keep) {
  if (text == null || text === '') return text;
  return String(text).split(WORD).map((t, i) => (i % 2 && !keep.has(t.toLowerCase()) ? UZ.toNew(t) : t)).join('');
}
const parse = (s) => { try { const v = JSON.parse(s || '{}'); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } };

async function convertDatabase(db, { dryRun = false } = {}) {
  const keep = englishWords();
  for (const r of await db.all('SELECT en, example FROM vocabulary')) { wordsOf(r.en, keep); wordsOf(r.example, keep); }
  const stats = { vocabulary: 0, content: 0, grammar: 0, exercises: 0, options: 0, overrides: 0, skipped: 0 };
  const write = async (sql, ...args) => { if (!dryRun) return db.run(sql, ...args); return { changes: 1 }; };

  // vocabulary (en + uz is unique: a word that already exists in the new spelling is left alone and reported)
  for (const r of await db.all('SELECT id, en, uz, example, example_uz FROM vocabulary')) {
    const own = wordsOf(r.en + ' ' + r.example, new Set(keep));
    const uz = convertText(r.uz, own), ex = convertText(r.example_uz, own);
    if (uz === r.uz && ex === r.example_uz) continue;
    const res = await write('UPDATE OR IGNORE vocabulary SET uz = ?, example_uz = ? WHERE id = ?', uz, ex, r.id);
    if (res.changes) stats.vocabulary++; else stats.skipped++;
  }

  // translated titles and descriptions of the course structure
  for (const table of ['courses', 'levels', 'units', 'lessons']) {
    for (const r of await db.all(`SELECT id, title, description, translations FROM ${table}`)) {
      const tr = parse(r.translations); if (!tr.uz) continue;
      const own = wordsOf(r.title + ' ' + r.description, new Set(keep));
      const next = { ...tr, uz: Object.fromEntries(Object.entries(tr.uz).map(([k, v]) => [k, typeof v === 'string' ? convertText(v, own) : v])) };
      if (JSON.stringify(next) === JSON.stringify(tr)) continue;
      await write(`UPDATE ${table} SET translations = ? WHERE id = ?`, JSON.stringify(next), r.id); stats.content++;
    }
  }

  // grammar points: the Uzbek title and explanation keep the English grammar words (am, is, she, should …)
  for (const r of await db.all('SELECT id, title, explanation, examples, practice, translations FROM grammar_points')) {
    const tr = parse(r.translations); if (!tr.uz) continue;
    const own = wordsOf([r.title, r.explanation, r.examples, r.practice].join(' '), new Set(keep));
    const next = { ...tr, uz: { ...tr.uz, title: convertText(tr.uz.title, own), explanation: convertText(tr.uz.explanation, own) } };
    if (JSON.stringify(next) === JSON.stringify(tr)) continue;
    await write('UPDATE grammar_points SET translations = ? WHERE id = ?', JSON.stringify(next), r.id); stats.grammar++;
  }

  // exercises: only the fields that are in the translation language
  for (const e of await db.all('SELECT id, type, direction, prompt, answer, sentence, passage, audio_text, translation, explanation FROM exercises')) {
    const enUz = e.direction !== 'uz-en';
    const scramble = e.type === 'scramble_letters';   // its sentence is the Uzbek hint and its answer the English word
    const own = wordsOf([enUz && !scramble ? e.sentence : '', e.passage, e.audio_text, !enUz || scramble ? e.answer : ''].join(' '), new Set(keep));
    const c = (v) => convertText(v, own);
    const next = { ...e };
    next.translation = c(e.translation);
    if (e.type === 'order_words') next.prompt = c(e.prompt);
    if (scramble || (e.type === 'translation_choice' && !enUz) || (e.type === 'translate_type' && !enUz)) next.sentence = c(e.sentence);
    if (e.type === 'translate_type' && enUz) next.answer = c(e.answer);
    const m = /^(.*” — )(.*)$/s.exec(e.explanation || ''); if (m) next.explanation = m[1] + c(m[2]);
    const fields = ['prompt', 'answer', 'sentence', 'translation', 'explanation'].filter((f) => next[f] !== e[f]);
    if (fields.length) { await write(`UPDATE exercises SET ${fields.map((f) => f + ' = ?').join(', ')} WHERE id = ?`, ...fields.map((f) => next[f]), e.id); stats.exercises++; }

    for (const o of await db.all('SELECT id, text, match_text FROM exercise_options WHERE exercise_id = ?', e.id)) {
      const text = e.type === 'translation_choice' && enUz ? c(o.text) : o.text;
      const match = e.type === 'match_pairs' ? convertText(o.match_text, wordsOf(o.text, new Set(keep))) : o.match_text;
      if (text === o.text && match === o.match_text) continue;
      await write('UPDATE exercise_options SET text = ?, match_text = ? WHERE id = ?', text, match, o.id); stats.options++;
    }
  }

  // the administrator's edits of Uzbek interface texts (the names of the other languages stay as they are)
  for (const r of await db.all("SELECT key, value FROM translation_overrides WHERE lang = 'uz'")) {
    if (r.key.startsWith('lang.native.') && r.key !== 'lang.native.uz') continue;
    let v; try { v = JSON.parse(r.value); } catch (_) { continue; }
    const next = typeof v === 'string' ? UZ.toNew(v) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, UZ.toNew(x)])) : v;
    if (JSON.stringify(next) === r.value) continue;
    await write("UPDATE translation_overrides SET value = ? WHERE lang = 'uz' AND key = ?", JSON.stringify(next), r.key); stats.overrides++;
  }
  return stats;
}

module.exports = { convertDatabase, convertText };
