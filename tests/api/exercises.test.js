const test = require('node:test');
const assert = require('node:assert');
const X = require('../../server/lib/exercises');
const { startServer } = require('./helpers');

const base = (over) => ({ id: 7, lesson_id: 1, position: 0, difficulty: 1, prompt: '', answer: '', sentence: '', passage: '', audio_text: '', audio_url: '', translation: '', explanation: '', hint: '', direction: 'en-uz', status: 'published', ...over });
const opt = (text, is_correct, match_text = '', id) => ({ id, text, is_correct: is_correct ? 1 : 0, match_text });

test('normalisation: case, punctuation, apostrophes, contractions', () => {
  assert.strictEqual(X.norm('  Don’t   GO!  '), 'do not go');
  assert.strictEqual(X.norm("O‘rta"), "o'rta"); assert.strictEqual(X.norm("o`rta"), "o'rta");
  assert.strictEqual(X.editDistance('kitten', 'sitting'), 3);
});

test('choice types are graded by option id; invalid ids are rejected', () => {
  const o = [opt('a', 0, '', 1), opt('b', 1, '', 2), opt('c', 0, '', 3)];
  for (const type of ['multiple_choice', 'translation_choice', 'listen_choice', 'reading']) {
    const ex = base({ type, prompt: 'q', sentence: 's', passage: 'p'.repeat(30), audio_text: 'a' });
    assert.strictEqual(X.grade(ex, o, 2, 1).correct, true, type); assert.strictEqual(X.grade(ex, o, 1, 1).correct, false, type);
    assert.strictEqual(X.grade(ex, o, 2, 1).correctAnswer, 'b');
    assert.ok(X.grade(ex, o, 99, 1).invalid && X.grade(ex, o, 'x', 1).invalid && X.grade(ex, o, null, 1).invalid);
  }
});

test('typed types: alternatives, case/punctuation, one-letter typo tolerance only where intended', () => {
  const fill = base({ type: 'fill_blank', sentence: 'I ____ tea.', answer: 'drink|have' });
  assert.ok(X.grade(fill, [], 'Drink', 1).correct && X.grade(fill, [], ' have. ', 1).correct); assert.ok(!X.grade(fill, [], 'eat', 1).correct);
  assert.ok(X.grade(fill, [], 'dirnk', 1).correct === false, 'short words get no typo tolerance');
  const long = base({ type: 'translate_type', sentence: 'uy', answer: 'beautiful' });
  const t = X.grade(long, [], 'beautifull', 1); assert.ok(t.correct && t.typo, 'one letter off on a long word is accepted and flagged');
  assert.ok(!X.grade(long, [], 'beutifull', 1).correct);
  const spell = base({ type: 'fix_spelling', sentence: 'I lern English.', answer: 'I learn English.' });
  assert.ok(X.grade(spell, [], 'i learn english', 1).correct); assert.ok(!X.grade(spell, [], 'I lern English.', 1).correct); assert.ok(!X.grade(spell, [], 'I learnn English.', 1).correct, 'spelling exercises are exact');
  assert.ok(X.grade(fill, [], 42, 1).invalid, 'non-text answers are invalid');
  const contraction = base({ type: 'translate_type', sentence: 'x', answer: 'I do not know' });
  assert.ok(X.grade(contraction, [], "I don't know", 1).correct);
});

test('tile exercises: letters, words and distractors', () => {
  const sc = base({ type: 'scramble_letters', answer: 'hello', sentence: 'salom' });
  assert.ok(X.grade(sc, [], [0, 1, 2, 3, 4], 1).correct); assert.ok(!X.grade(sc, [], [1, 0, 2, 3, 4], 1).correct);
  assert.ok(X.grade(sc, [], [0, 0, 1, 2, 3], 1).invalid, 'a tile cannot be used twice'); assert.ok(X.grade(sc, [], [0, 1, 2, 3, 9], 1).invalid); assert.ok(X.grade(sc, [], 'hello', 1).invalid);
  const ord = base({ type: 'order_words', sentence: 'I am a student.', prompt: 'Men talabaman.', answer: 'Am I a student' });
  const dist = [opt('banana', 0, '', 1)];
  assert.ok(X.grade(ord, [], [0, 1, 2, 3], 1).correct); assert.ok(!X.grade(ord, [], [3, 2, 1, 0], 1).correct);
  assert.ok(X.grade(ord, [], [1, 0, 2, 3], 1).correct, 'an alternative accepted order (from the answer field) is correct too');
  assert.ok(X.grade(ord, dist, [0, 1, 2, 3], 1).correct, 'distractor words may stay unused'); assert.ok(!X.grade(ord, dist, [0, 1, 2, 4, 3], 1).correct, 'using a distractor is wrong');
});

test('matching is checked against the server-side shuffle', () => {
  const o = [opt('a', 1, 'A'), opt('b', 1, 'B'), opt('c', 1, 'C')];
  const ex = base({ type: 'match_pairs' });
  const p = X.payload(ex, o, 5);
  assert.strictEqual(p.left.length, 3); assert.strictEqual(p.right.length, 3);
  const good = p.left.map((l) => ({ left: l.id, right: p.right.find((r) => r.text === o[l.id].match_text).id }));
  assert.ok(X.grade(ex, o, good, 5).correct);
  const swapped = [{ left: 0, right: good[1].right }, { left: 1, right: good[0].right }, good[2]];
  assert.ok(!X.grade(ex, o, swapped, 5).correct);
  assert.ok(X.grade(ex, o, good.slice(0, 2), 5).correct === false);
  assert.ok(X.grade(ex, o, [good[0], good[0], good[2]], 5).invalid, 'one left item twice is invalid');
});

test('payloads never reveal the answer and are stable for one attempt', () => {
  const o = [opt('a', 0, '', 1), opt('b', 1, '', 2)];
  const mc = X.payload(base({ type: 'multiple_choice', prompt: 'q' }), o, 3);
  assert.ok(!JSON.stringify(mc).includes('is_correct') && !('answer' in mc));
  const ord = X.payload(base({ type: 'order_words', sentence: 'I am a student.', prompt: 'x' }), [], 3);
  assert.ok(!('sentence' in ord)); assert.deepStrictEqual(ord.tiles, X.payload(base({ type: 'order_words', sentence: 'I am a student.', prompt: 'x' }), [], 3).tiles, 'same seed, same order');
  const sc = X.payload(base({ type: 'scramble_letters', answer: 'hello', sentence: 'salom' }), [], 3);
  assert.ok(!('answer' in sc) && sc.tiles.length === 5); assert.ok(sc.tiles.some((t, i) => t.id !== i), 'letters are shuffled');
  const fb = X.payload(base({ type: 'fill_blank', sentence: 'I ____ tea.', answer: 'drink' }), [], 3); assert.ok(!('answer' in fb));
});

test('validation rejects incomplete exercises for every type', () => {
  const v = (over) => X.validate(X.normalizeInput(over));
  const two = [{ text: 'a', is_correct: true }, { text: 'b', is_correct: false }];
  assert.ok(v({ type: 'nope' }).length);
  assert.ok(v({ type: 'multiple_choice', prompt: '', options: two }).some((e) => e.field === 'prompt'));
  assert.ok(v({ type: 'multiple_choice', prompt: 'q', options: [{ text: 'a', is_correct: true }] }).some((e) => e.field === 'options'));
  assert.ok(v({ type: 'multiple_choice', prompt: 'q', options: [{ text: 'a', is_correct: false }, { text: 'b', is_correct: false }] }).length, 'exactly one correct option is required');
  assert.ok(v({ type: 'multiple_choice', prompt: 'q', options: [{ text: 'a', is_correct: true }, { text: 'A', is_correct: false }] }).length, 'duplicate options rejected');
  assert.strictEqual(v({ type: 'multiple_choice', prompt: 'q', options: two }).length, 0);
  assert.ok(v({ type: 'fill_blank', sentence: 'no blank', answer: 'x' }).length); assert.ok(v({ type: 'fill_blank', sentence: 'two ____ ____', answer: 'x' }).length); assert.strictEqual(v({ type: 'fill_blank', sentence: 'one ____ here', answer: 'x' }).length, 0);
  assert.ok(v({ type: 'scramble_letters', answer: 'two words', sentence: 'c' }).length); assert.strictEqual(v({ type: 'scramble_letters', answer: 'word', sentence: 'c' }).length, 0);
  assert.ok(v({ type: 'order_words', sentence: 'too short', prompt: 'x' }).length); assert.strictEqual(v({ type: 'order_words', sentence: 'This is fine.', prompt: 'x' }).length, 0);
  assert.ok(v({ type: 'match_pairs', options: [{ text: 'a', match_text: 'b' }, { text: 'c', match_text: 'd' }] }).length, 'at least three pairs');
  assert.strictEqual(v({ type: 'match_pairs', options: [{ text: 'a', match_text: 'A' }, { text: 'b', match_text: 'B' }, { text: 'c', match_text: 'C' }] }).length, 0);
  assert.ok(v({ type: 'listen_type', answer: 'x' }).length, 'needs audio text or file'); assert.strictEqual(v({ type: 'listen_type', answer: 'x', audio_text: 'x' }).length, 0);
  assert.ok(v({ type: 'listen_choice', options: two }).length); assert.ok(v({ type: 'listen_type', answer: 'x', audio_url: 'http://evil.example/a.mp3' }).length, 'only uploaded audio paths are accepted');
  assert.ok(v({ type: 'reading', passage: 'short', prompt: 'q', options: two }).length); assert.strictEqual(v({ type: 'reading', passage: 'A passage that is long enough.', prompt: 'q', options: two }).length, 0);
  assert.ok(v({ type: 'fix_spelling', sentence: 'Same.', answer: 'same' }).length, 'the correction must differ');
  assert.ok(v({ type: 'translate_type', sentence: 'x' }).length); assert.ok(v({ type: 'translation_choice', options: two }).length);
});

test('all 144 seeded exercises are valid, gradable and leak nothing', async () => {
  const s = await startServer();
  try {
    const rows = s.db.all('SELECT * FROM exercises');
    assert.strictEqual(rows.length, 144);
    const types = new Set();
    for (const r of rows) {
      const opts = s.db.all('SELECT * FROM exercise_options WHERE exercise_id = ? ORDER BY position, id', r.id);
      const ex = { ...r, options: opts.map((o) => ({ text: o.text, match_text: o.match_text, is_correct: !!o.is_correct })) };
      assert.deepStrictEqual(X.validate(ex), [], `exercise ${r.id} (${r.type})`);
      const p = X.payload(r, opts, 11); types.add(r.type);
      const j = JSON.stringify(p);
      assert.ok(!j.includes('is_correct'), 'no correctness flags');
      if (!['listen_type', 'listen_choice', 'translation_choice', 'multiple_choice', 'reading', 'match_pairs', 'fill_blank', 'translate_type', 'fix_spelling', 'order_words', 'scramble_letters'].includes(r.type)) assert.fail('unexpected type');
      if (r.type === 'order_words') assert.ok(!('sentence' in p));
    }
    assert.strictEqual(types.size, 11, 'every authored exercise type appears in the sample course');
  } finally { await s.stop(); }
});
