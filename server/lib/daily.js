/* The personalised daily lesson. It is built when the learner starts it (from their level, weak skills, due vocabulary and grammar
   they have not met yet) and stored with the attempt, so reloading shows the same lesson and answers are graded on the server.
   Order: review of due words -> new words (card, then questions) -> grammar (explanation card, then practice) -> sentence building
   -> reading -> final quiz. */
const LV = require('./levels');
const X = require('./exercises');
const L10N = require('./localize');
const { now, HttpError, bad, shuffled, rng } = require('./util');

const SHARE = { review: 0.25, newWords: 0.2, grammar: 0.1, build: 0.1, reading: 0.1 };

function make(db, settings, core, review, learning) {
  const S = () => settings.all();
  const lengths = { short: 'daily_items_short', normal: 'daily_items_normal', long: 'daily_items_long' };

  async function translationOf(v, tl) { return L10N.vocab(v, tl); }

  /* wrong translations for a word: words of the same level first, never a duplicate of the right answer */
  async function wrongTranslations(v, tl, n, seed, reverse) {
    const pool = await db.all("SELECT * FROM vocabulary WHERE status = 'published' AND id != ? ORDER BY (cefr = ?) DESC, id LIMIT 80", v.id, v.cefr || '');
    const own = reverse ? v.en : L10N.vocab(v, tl).word;
    const seen = new Set([X.norm(own)]), out = [];
    for (const w of shuffled(pool, seed)) {
      const text = reverse ? w.en : L10N.vocab(w, tl).word;
      const k = X.norm(text);
      if (text && !seen.has(k)) { seen.add(k); out.push(text); if (out.length === n) break; }
    }
    return out;
  }
  const choiceOf = (correct, wrong, seed) => { const all = shuffled([{ text: correct, ok: true }].concat(wrong.map((text) => ({ text, ok: false }))), seed); return { options: all.map((o, i) => ({ id: i, text: o.text })), correctId: all.findIndex((o) => o.ok) }; };

  async function seenKeys(userId, prefix, days) {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    return new Set((await db.all('SELECT item_key FROM item_responses WHERE user_id = ? AND item_key LIKE ? AND created_at >= ?', userId, prefix + '%', since)).map((r) => r.item_key));
  }

  async function build(user, tl) {
    const s = S(), level = user.cefr_level || user.start_level || 'A1';
    const total = s[lengths[user.lesson_length] || lengths.normal] || 18;
    const seed = 1 + Math.floor(Math.random() * 1e6), rand = rng(seed);
    const skills = await learning.skills(user.id, level);
    const weakest = skills.slice().sort((a, b) => a.score - b.score)[0].skill;
    const items = [];
    const push = (it) => items.push({ level, ...it });
    const nReview = Math.round(total * SHARE.review), nNew = Math.max(2, Math.round(total * SHARE.newWords / 2)), nBuild = total >= 18 ? 1 : 0;

    // 1. review of words that are due (spaced repetition)
    const due = await review.dueItems(user, nReview, false);
    for (const [i, v] of due.entries()) {
      const tr = await translationOf(v, tl);
      if (v.box >= 3 && i % 2 === 0) push({ kind: 'review', type: 'type', skill: 'vocabulary', vocabId: v.id, prompt: tr.word, accepted: v.en, explanation: `${v.en} — ${tr.word}`, level: v.cefr || level });
      else { const c = choiceOf(tr.word, await wrongTranslations(v, tl, 3, seed + i, false), seed + v.id); push({ kind: 'review', type: 'choice', style: 'translation', skill: 'vocabulary', vocabId: v.id, prompt: v.en, ...c, explanation: `${v.en} — ${tr.word}`, level: v.cefr || level }); }
    }

    // 2. new words: a card that teaches the word, then a question about it
    const known = new Set((await db.all('SELECT vocabulary_id id FROM review_items WHERE user_id = ?', user.id)).map((r) => r.id));
    const fresh = (await db.all("SELECT * FROM vocabulary WHERE status = 'published' AND cefr = ? ORDER BY id", level)).filter((v) => !known.has(v.id)).slice(0, nNew + 6);
    const chosen = shuffled(fresh, seed).slice(0, nNew);
    for (const [i, v] of chosen.entries()) {
      const tr = await translationOf(v, tl);
      push({ kind: 'new', type: 'card', skill: 'vocabulary', vocabId: v.id, card: { title: v.en, body: tr.word, examples: v.example ? [v.example] : [], note: tr.example || '', audio: v.en } });
      if (i % 2 === 0) { const c = choiceOf(tr.word, await wrongTranslations(v, tl, 3, seed + 50 + i, false), seed + v.id); push({ kind: 'new', type: 'choice', style: 'translation', skill: 'vocabulary', vocabId: v.id, prompt: v.en, ...c, explanation: `${v.en} — ${tr.word}` }); }
      else push({ kind: 'new', type: 'type', skill: 'vocabulary', vocabId: v.id, prompt: tr.word, accepted: v.en, explanation: `${v.en} — ${tr.word}` });
    }

    // 3. grammar: the point the learner has met least at their level
    const points = await db.all("SELECT g.*, COALESCE(ug.seen, 0) seen, COALESCE(ug.wrong, 0) wrong FROM grammar_points g LEFT JOIN user_grammar ug ON ug.grammar_id = g.id AND ug.user_id = ? WHERE g.status = 'published' AND g.level = ? ORDER BY seen ASC, wrong DESC, g.position", user.id, level);
    const gp = points[0];
    if (gp) {
      const lang = user.ui_language, tr = L10N.parse(gp.translations)[lang] || {};
      push({ kind: 'grammar', type: 'card', skill: 'grammar', grammarId: gp.id, card: { title: tr.title || gp.title, body: tr.explanation || gp.explanation, examples: JSON.parse(gp.examples), note: '', grammar: true } });
      const practice = JSON.parse(gp.practice);
      for (const [i, p] of practice.slice(0, 2).entries()) { const c = choiceOf(p[1], p.slice(2), seed + gp.id + i); push({ kind: 'grammar', type: 'choice', style: 'plain', skill: 'grammar', grammarId: gp.id, prompt: p[0], ...c, explanation: gp.title }); }
    }

    // 4. sentence building from example sentences of the level's vocabulary
    if (nBuild) {
      const withEx = (await db.all("SELECT v.* FROM vocabulary v WHERE v.status = 'published' AND v.cefr = ? AND v.example != ''", level)).filter((v) => { const n = X.tokensOf(v.example).length; return n >= 4 && n <= 9; });
      const v = shuffled(withEx, seed)[0];
      if (v) { const tr = await translationOf(v, tl); push({ kind: 'build', type: 'order', skill: 'grammar', vocabId: v.id, prompt: tr.example || '', sentence: v.example, explanation: v.example }); }
    }

    // questions from the question bank (never the same one twice within two weeks while unseen ones exist)
    const seen = await seenKeys(user.id, 'q:', 14);
    const bank = (await db.all("SELECT * FROM assessment_questions WHERE status = 'published' AND level = ?", level)).map((q) => ({ q, fresh: !seen.has('q:' + q.id) }));
    const ofSkills = (list) => bank.filter((b) => list.includes(b.q.skill));
    const pickQ = (cands, n, salt) => { const f = cands.filter((b) => b.fresh), rest = cands.filter((b) => !b.fresh); return shuffled(f, seed + salt).concat(shuffled(rest, seed + salt)).slice(0, n).map((b) => b.q); };
    const qItem = async (q, kind) => {
      const opts = q.format === 'choice' ? await db.all('SELECT text, is_correct FROM assessment_options WHERE question_id = ? ORDER BY position', q.id) : [];
      const base = { kind, skill: q.skill, qid: q.id, explanation: q.explanation || '' };
      if (q.format === 'type') return { ...base, type: 'type', style: 'completion', prompt: q.prompt, accepted: q.answer };
      const c = choiceOf(opts.find((o) => o.is_correct).text, opts.filter((o) => !o.is_correct).map((o) => o.text), seed + q.id);
      return { ...base, type: 'choice', style: q.skill === 'reading' ? 'reading' : q.skill === 'listening' ? 'listening' : 'plain', prompt: q.prompt, passage: q.passage, audio: q.audio_text, ...c };
    };
    // 5. reading
    const reading = pickQ(ofSkills(['reading']), 1, 7)[0];
    if (reading) push(await qItem(reading, 'reading'));

    // 6. final quiz: weighted towards the weakest skill, with one listening question
    const used = items.filter((i) => i.type !== 'card').length;
    const nQuiz = Math.max(3, total - used);
    const focus = LV.REPORT_GROUPS[weakest] || [weakest];
    const quiz = [];
    quiz.push(...pickQ(ofSkills(focus.filter((x) => x !== 'reading' && x !== 'listening')), Math.ceil(nQuiz * 0.4), 11));
    const listening = pickQ(ofSkills(['listening']), 1, 13);
    quiz.push(...listening);
    const taken = new Set(quiz.map((q) => q.id).concat(reading ? [reading.id] : []));
    quiz.push(...pickQ(ofSkills(['vocabulary', 'grammar', 'usage', 'completion', 'expressions']).filter((b) => !taken.has(b.q.id)), nQuiz, 17).filter((q) => !taken.has(q.id)));
    for (const q of quiz.filter((q, i, a) => a.findIndex((z) => z.id === q.id) === i).slice(0, nQuiz)) push(await qItem(q, 'quiz'));
    if (!items.some((i) => i.type !== 'card')) throw new HttpError(409, 'err.daily_unavailable');
    return { items, seed, total };
  }

  /* what the browser receives for an item: shaped like an ordinary exercise so the lesson player can show it */
  function toExercise(item, slot, seed) {
    const ex = { id: slot, hint: '', difficulty: 1, direction: 'en-uz' };
    if (item.type === 'card') return { ...ex, type: 'card', prompt: '', card: item.card };
    if (item.type === 'order') {
      const tiles = X.tokensOf(item.sentence).map((text, i) => ({ id: i, text }));
      return { ...ex, type: 'order_words', prompt: item.prompt || '', tiles: shuffled(tiles, seed + slot) };
    }
    if (item.type === 'type') {
      if (item.style === 'completion') return { ...ex, type: 'fill_blank', prompt: '', sentence: item.prompt };
      return { ...ex, type: 'translate_type', prompt: '', sentence: item.prompt, direction: 'uz-en' };
    }
    const options = item.options.map((o) => ({ id: o.id, text: o.text }));
    if (item.style === 'reading') return { ...ex, type: 'reading', prompt: item.prompt, passage: item.passage, options };
    if (item.style === 'listening') return { ...ex, type: 'listen_choice', prompt: item.prompt, audio: { text: item.audio }, options };
    if (item.style === 'translation') return { ...ex, type: 'translation_choice', prompt: '', sentence: item.prompt, options };
    return { ...ex, type: 'multiple_choice', prompt: item.prompt, options };
  }

  async function view(attemptId, user) {
    const a = await db.get('SELECT * FROM lesson_attempts WHERE id = ?', attemptId);
    const queue = JSON.parse(a.queue), scored = queue.filter((i) => i.type !== 'card').length;
    const v = { attemptId: a.id, kind: 'daily', status: a.status, lesson: { id: null, title: null }, position: a.position, queueLength: queue.length, totalPlanned: scored, correct: a.correct, incorrect: a.incorrect,
      progress: queue.length ? Math.round(100 * Math.min(a.position, queue.length) / queue.length) : 0, hearts: 0, maxHearts: 0, heartsEnabled: false, exercise: null };
    if (a.status === 'in_progress' && a.position < queue.length) v.exercise = toExercise(queue[a.position], a.position, a.seed);
    if (a.status !== 'in_progress') v.result = await result(a, queue);
    return v;
  }

  async function result(a, queue) {
    const total = queue.filter((i) => i.type !== 'card').length;
    const rows = await db.all('SELECT slot, is_correct FROM item_responses WHERE attempt_id = ? ORDER BY slot', a.id);
    const missed = rows.filter((r) => !r.is_correct).map((r) => queue[r.slot]).filter(Boolean);
    return { outcome: a.status, correct: a.correct, incorrect: a.incorrect, total, accuracy: total ? Math.round(100 * a.correct / total) : 0, xp: a.xp_awarded,
      mistakes: missed.map((m) => ({ type: m.type === 'choice' ? 'multiple_choice' : m.type === 'order' ? 'order_words' : 'translate_type', prompt: m.prompt, answer: answerText(m) })), words: [] };
  }
  function answerText(item) {
    if (item.type === 'choice') return item.options[item.correctId].text;
    if (item.type === 'order') return item.sentence;
    return X.alternatives(item.accepted)[0] || '';
  }

  async function start(user) {
    return db.tx(async () => {
      let a = await db.get("SELECT * FROM lesson_attempts WHERE user_id = ? AND variant = 'daily' AND status = 'in_progress'", user.id);
      if (!a) {
        const full = await core.userById(user.id);
        const { items, seed } = await build(full, full.translation_language);
        const r = await db.run("INSERT INTO lesson_attempts (user_id, lesson_id, kind, variant, queue, total_planned, started_at, seed) VALUES (?,?,?,?,?,?,?,?)", user.id, null, 'lesson', 'daily', JSON.stringify(items), items.filter((i) => i.type !== 'card').length, now(), seed);
        a = await db.get('SELECT * FROM lesson_attempts WHERE id = ?', r.id);
      }
      return view(a.id, user);
    });
  }

  async function getAttempt(user, id) {
    const a = await db.get("SELECT * FROM lesson_attempts WHERE id = ? AND user_id = ? AND variant = 'daily'", id, user.id);
    if (!a) throw new HttpError(404, 'err.attempt_not_found');
    return view(a.id, user);
  }

  function grade(item, answer) {
    if (item.type === 'card') return { correct: true, correctAnswer: '' };
    if (item.type === 'choice') {
      const id = Number(answer);
      if (!Number.isInteger(id) || !item.options.some((o) => o.id === id)) return { invalid: true };
      return { correct: id === item.correctId, correctAnswer: item.options[item.correctId].text };
    }
    if (item.type === 'order') {
      if (!Array.isArray(answer)) return { invalid: true };
      const toks = X.tokensOf(item.sentence), ids = answer.map(Number);
      if (ids.some((i) => !Number.isInteger(i) || i < 0 || i >= toks.length) || new Set(ids).size !== ids.length) return { invalid: true };
      return { correct: X.norm(ids.map((i) => toks[i]).join(' ')) === X.norm(item.sentence), correctAnswer: item.sentence };
    }
    if (typeof answer !== 'string') return { invalid: true };
    const u = X.norm(answer), alts = X.alternatives(item.accepted);
    if (!u) return { invalid: true };
    let correct = alts.some((a) => X.norm(a) === u), typo = false;
    if (!correct) { typo = alts.some((a) => { const n = X.norm(a); return n.length >= 6 && X.editDistance(u, n) === 1; }); correct = typo; }
    return { correct, typo, correctAnswer: alts[0] };
  }

  async function answer(user, attemptId, body) {
    const slot = Number(body && body.exerciseId);
    if (!Number.isInteger(slot)) throw bad('err.missing_exercise');
    return db.tx(async () => {
      const a = await db.get("SELECT * FROM lesson_attempts WHERE id = ? AND user_id = ? AND variant = 'daily'", attemptId, user.id);
      if (!a) throw new HttpError(404, 'err.attempt_not_found');
      const queue = JSON.parse(a.queue);
      if (a.status !== 'in_progress' || slot !== a.position) {
        const prev = await db.get('SELECT * FROM item_responses WHERE attempt_id = ? AND slot = ?', a.id, slot);
        if (!prev) throw new HttpError(409, 'err.exercise_not_current');
        return { feedback: { ...JSON.parse(prev.feedback), replayed: true }, state: await view(a.id, user) };
      }
      const item = queue[slot], g = grade(item, body.answer);
      if (g.invalid) throw bad('err.invalid_answer');
      const full = await core.userById(user.id), s = S();
      const key = item.qid ? 'q:' + item.qid : item.vocabId ? 'v:' + item.vocabId : item.grammarId ? 'g:' + item.grammarId : 'i:' + slot;
      const fb = { correct: g.correct, typo: !!g.typo, correctAnswer: g.correctAnswer, explanation: item.type === 'card' ? '' : item.explanation || '', exerciseId: slot, xp: 0 };
      const ins = await db.run('INSERT INTO item_responses (attempt_id, user_id, item_key, slot, answer, is_correct, is_retry, feedback, xp, created_at) VALUES (?,?,?,?,?,?,0,?,0,?)', a.id, user.id, key, slot, JSON.stringify(body.answer == null ? null : body.answer).slice(0, 400), g.correct ? 1 : 0, '{}', now());
      let xp = 0, correct = a.correct, incorrect = a.incorrect;
      if (item.type !== 'card') {
        if (g.correct) { xp = await core.awardXp(full, s.xp_per_correct, 'exercise', 'daily_item', a.id * 1000 + slot); correct++; } else incorrect++;
        await core.bumpDay(full, { answers: 1, correct: g.correct ? 1 : 0 });
        await learning.recordEvidence(user.id, item.skill, item.level, g.correct, 'daily', a.id);
        if (item.vocabId && (item.kind === 'review' || item.kind === 'new')) await review.schedule(user.id, item.vocabId, g.correct);
        if (item.grammarId) await db.run(`INSERT INTO user_grammar (user_id, grammar_id, seen, correct, wrong, last_seen_at) VALUES (?,?,0,?,?,?)
          ON CONFLICT(user_id, grammar_id) DO UPDATE SET correct = correct + excluded.correct, wrong = wrong + excluded.wrong, last_seen_at = excluded.last_seen_at`, user.id, item.grammarId, g.correct ? 1 : 0, g.correct ? 0 : 1, now());
        if (item.qid) await db.run('UPDATE assessment_questions SET times_asked = times_asked + 1, times_correct = times_correct + ? WHERE id = ?', g.correct ? 1 : 0, item.qid);
      } else {
        if (item.grammarId) await db.run(`INSERT INTO user_grammar (user_id, grammar_id, seen, last_seen_at) VALUES (?,?,1,?)
          ON CONFLICT(user_id, grammar_id) DO UPDATE SET seen = seen + 1, last_seen_at = excluded.last_seen_at`, user.id, item.grammarId, now());
        if (item.vocabId) await db.run('INSERT OR IGNORE INTO review_items (user_id, vocabulary_id, box, due_at) VALUES (?,?,0,?)', user.id, item.vocabId, new Date(Date.now() + 86400000).toISOString());
      }
      fb.xp = xp;
      await db.run('UPDATE item_responses SET feedback = ?, xp = ? WHERE id = ?', JSON.stringify(fb), xp, ins.id);
      const position = a.position + 1;
      await db.run('UPDATE lesson_attempts SET position = ?, correct = ?, incorrect = ?, xp_awarded = xp_awarded + ? WHERE id = ?', position, correct, incorrect, xp, a.id);
      let celebrate = null;
      if (position >= queue.length) celebrate = await finish(user, a.id);
      return { feedback: fb, state: await view(a.id, user), celebrate };
    });
  }

  async function finish(user, attemptId) {
    const a = await db.get('SELECT * FROM lesson_attempts WHERE id = ?', attemptId);
    if (a.status === 'completed') return null;
    const full = await core.userById(user.id), s = S();
    const bonus = await core.awardXp(full, s.xp_daily_bonus, 'daily_bonus', 'daily:' + core.todayFor(full), user.id);   // once per local day
    await core.bumpDay(full, { lessons: 1 });
    await core.markStreakDay(full);
    await db.run("UPDATE lesson_attempts SET status = 'completed', completed_at = ?, xp_awarded = xp_awarded + ? WHERE id = ?", now(), bonus, a.id);
    const earned = await core.checkAchievements(user.id);
    const levelUp = await learning.maybeLevelUp(user.id);
    await db.run('UPDATE users SET last_active_at = ? WHERE id = ?', now(), user.id);
    return { earned, levelUp };
  }

  async function abandon(user, id) {
    const a = await db.get("SELECT * FROM lesson_attempts WHERE id = ? AND user_id = ? AND variant = 'daily'", id, user.id);
    if (!a) throw new HttpError(404, 'err.attempt_not_found');
    if (a.status === 'in_progress') await db.run("UPDATE lesson_attempts SET status = 'abandoned', completed_at = ? WHERE id = ?", now(), a.id);
    return { ok: true };
  }

  /* for the dashboard */
  async function summary(user) {
    const full = await core.userById(user.id);
    const open = await db.get("SELECT id, position, queue FROM lesson_attempts WHERE user_id = ? AND variant = 'daily' AND status = 'in_progress'", user.id);
    const day = core.todayFor(full);
    const done = (await db.all("SELECT completed_at FROM lesson_attempts WHERE user_id = ? AND variant = 'daily' AND status = 'completed' ORDER BY id DESC LIMIT 5", user.id)).some((r) => require('./util').localDate(new Date(r.completed_at), full.timezone) === day);
    const dueNow = (await review.counts(full)).due;
    return { items: S()[lengths[full.lesson_length] || lengths.normal], length: full.lesson_length, inProgress: open ? { attemptId: open.id, position: open.position, total: JSON.parse(open.queue).length } : null, completedToday: done, reviewDue: dueNow };
  }

  return { start, getAttempt, answer, abandon, summary, build };
}

module.exports = { make };
