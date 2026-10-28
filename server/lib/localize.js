/* Translated course content.
   * Navigation texts (course / level / unit / lesson titles and descriptions) follow the learner's INTERFACE language.
   * Exercise content that depends on the translation (options, answers, clues, translations, explanations) and vocabulary translations
     follow the learner's TRANSLATION language. The base columns hold the original text; `translations` (JSON) holds the variants. */
const parse = (j) => { if (j && typeof j === 'object') return j; try { const v = JSON.parse(j || '{}'); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } };

function text(row, name, lang) {
  const v = parse(row.translations)[lang];
  return v && typeof v[name] === 'string' && v[name].trim() ? v[name] : row[name];
}

/* an exercise (row + option rows) as it should be shown / graded for a translation language */
function exercise(row, options, lang) {
  const v = parse(row.translations)[lang];
  if (!v) return { row, options };
  const out = { ...row };
  for (const f of ['prompt', 'answer', 'sentence', 'passage', 'translation', 'explanation', 'hint', 'audio_text']) if (typeof v[f] === 'string' && v[f].trim()) out[f] = v[f];
  let opts = options;
  if (Array.isArray(v.options) && v.options.length === options.length) opts = options.map((o, i) => ({ ...o, text: (v.options[i] && v.options[i].text) || o.text, match_text: (v.options[i] && v.options[i].match_text) || o.match_text }));
  return { row: out, options: opts };
}

/* the translation of a vocabulary row in a language: { word, example } (falls back to the base Uzbek columns) */
function vocab(v, lang) {
  const t = parse(v.translations);
  if (lang === 'ru') return { word: (t.ru || '').trim() || v.uz, example: (t.ru_example || '').trim() || v.example_uz, language: (t.ru || '').trim() ? 'ru' : 'uz' };
  return { word: v.uz, example: v.example_uz, language: 'uz' };
}
/* SQL expression for the translated word of a vocabulary alias (used in lists and distractor queries) */
const vocabWordSql = (lang, alias = 'v') => (lang === 'ru' ? `COALESCE(NULLIF(TRIM(json_extract(${alias}.translations, '$.ru')), ''), ${alias}.uz)` : `${alias}.uz`);

module.exports = { parse, text, exercise, vocab, vocabWordSql };
