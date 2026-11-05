/* Small constructors for hand-written exercises (examination items, practice tests). */
const opts = (c, w) => [{ text: c, is_correct: true }].concat(w.map((text) => ({ text, is_correct: false })));
const mc = (q, c, w1, w2, module, expl = '') => ({ type: 'multiple_choice', status: 'published', difficulty: 2, module, prompt: q, explanation: expl, options: opts(c, [w1, w2]) });
const listen = (text, q, c, w1, w2, expl = '') => ({ type: 'listen_choice', status: 'published', difficulty: 2, module: 'listening', prompt: q, audio_text: text, explanation: expl, options: opts(c, [w1, w2]) });
const note = (text, sentence, answer, expl = '') => ({ type: 'fill_blank', status: 'published', difficulty: 3, module: 'listening', prompt: 'Write NO MORE THAN TWO WORDS OR A NUMBER.', audio_text: text, sentence, answer, explanation: expl });
const read = (passage, q, c, w1, w2, expl = '') => ({ type: 'reading', status: 'published', difficulty: 2, module: 'reading', passage, prompt: q, explanation: expl, options: opts(c, [w1, w2]) });
const tfng = (passage, statement, answer, expl = '') => read(passage, 'True, False or Not Given? ' + statement, answer, ...['True', 'False', 'Not Given'].filter((x) => x !== answer), expl);
const pairs = (prompt, list, module = 'reading') => ({ type: 'match_pairs', status: 'published', difficulty: 3, module, prompt, options: list.map(([text, match_text]) => ({ text, match_text, is_correct: true })) });
const writing = (prompt, answer, min, model, passage = '') => ({ type: 'writing', status: 'published', difficulty: 3, module: 'writing', prompt, passage, answer, min_words: min, translation: model });
const speaking = (prompt, model, passage = '') => ({ type: 'speaking', status: 'published', difficulty: 3, module: 'speaking', prompt, passage, translation: model });
module.exports = { opts, mc, listen, note, read, tfng, pairs, writing, speaking };
