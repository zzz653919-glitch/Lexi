/* Vocabulary review with a simple spaced-repetition schedule (Leitner boxes). */
const { now, HttpError, bad, shuffled, clamp, escapeLike } = require('./util');
const X = require('./exercises');
const L10N = require('./localize');

const BOX_DAYS = [0, 1, 2, 4, 8, 16, 32];          // days until the next review after a correct answer, by box
const MODES = ['flashcards', 'choice', 'typed', 'spelling'];

function make(db, settings, core) {
  const S = () => settings.all();
  const published = "v.status = 'published'";

  async function counts(user) {
    const t = now();
    const r = await db.get(`SELECT COUNT(*) total, SUM(CASE WHEN ri.due_at <= ? THEN 1 ELSE 0 END) due, SUM(ri.is_difficult) difficult
      FROM review_items ri JOIN vocabulary v ON v.id = ri.vocabulary_id AND ${published} WHERE ri.user_id = ?`, t, user.id);
    return { total: r.total || 0, due: r.due || 0, difficult: r.difficult || 0 };
  }

  /* due words first; difficult and often-missed words before the rest, then the oldest due date */
  async function dueItems(user, limit, onlyDifficult) {
    return await db.all(`SELECT v.*, ri.box, ri.due_at, ri.correct rc, ri.wrong rw, ri.is_difficult
      FROM review_items ri JOIN vocabulary v ON v.id = ri.vocabulary_id AND ${published}
      WHERE ri.user_id = ? AND (${onlyDifficult ? 'ri.is_difficult = 1' : 'ri.due_at <= ?'})
      ORDER BY ri.is_difficult DESC, (CAST(ri.wrong AS REAL) / (ri.correct + ri.wrong + 1)) DESC, ri.due_at ASC LIMIT ?`,
      ...(onlyDifficult ? [user.id, limit] : [user.id, now(), limit]));
  }

  /* wrong options for a vocabulary card: other published words of the same course, as English words or as translations */
  async function distractors(v, kind, tl, n, seed) {
    const expr = kind === 'en' ? 'en' : L10N.vocabWordSql(tl, 'vocabulary');
    const own = kind === 'en' ? v.en : L10N.vocab(v, tl).word;
    const pool = await db.all(`SELECT ${expr} AS t FROM vocabulary WHERE status = 'published' AND id != ? AND LOWER(${expr}) != LOWER(?) ${v.course_id ? 'AND course_id = ?' : ''} LIMIT 60`, ...[v.id, own].concat(v.course_id ? [v.course_id] : []));
    const seen = new Set([X.norm(own)]);
    const out = [];
    for (const r of shuffled(pool, seed)) { const k = X.norm(r.t); if (!seen.has(k)) { seen.add(k); out.push(r.t); if (out.length === n) break; } }
    return out;
  }

  async function session(user, body) {
    const mode = MODES.includes(body.mode) ? body.mode : 'choice';
    const size = clamp(Number.parseInt(body.size, 10) || 10, 1, 30);
    const tl = (await core.userById(user.id)).translation_language;      // cards show translations in the learner's translation language
    const items = await dueItems(user, size, !!body.difficultOnly);
    const seed = Math.floor(Math.random() * 1e6);
    const cards = [];
    for (const [i, v] of items.entries()) {
      const tr = L10N.vocab(v, tl);
      const reverse = mode === 'typed' || mode === 'choice' ? (v.id + seed) % 2 === 0 : false;   // sometimes translation -> English
      const c = { vocabularyId: v.id, mode, box: v.box, difficult: !!v.is_difficult, pos: v.pos };
      if (mode === 'flashcards') { c.front = v.en; c.back = tr.word; c.example = v.example; c.exampleTranslation = tr.example; c.audio = v.audio_url ? { url: v.audio_url } : { text: v.en }; }
      else if (mode === 'choice') {
        const kind = reverse ? 'en' : 'tr';
        const wrong = await distractors(v, kind, tl, 3, seed + i);
        c.direction = reverse ? 'tr-en' : 'en-tr'; c.prompt = reverse ? tr.word : v.en;
        c.options = shuffled([reverse ? v.en : tr.word].concat(wrong), seed + v.id);
        if (c.options.length < 2) { c.mode = 'typed'; delete c.options; }
      } else if (mode === 'typed') { c.direction = reverse ? 'tr-en' : 'en-tr'; c.prompt = reverse ? tr.word : v.en; }
      if (mode === 'spelling') { c.prompt = tr.word; c.audio = v.audio_url ? { url: v.audio_url } : { text: v.en }; c.length = v.en.length; }
      if (c.mode === 'typed' && !c.direction) { c.direction = 'en-tr'; c.prompt = v.en; }
      c.translationLanguage = tl;
      cards.push(c);
    }
    return { mode, cards, counts: await counts(user) };
  }

  async function schedule(userId, vocabId, ok) {
    const t = new Date(), cur = await db.get('SELECT * FROM review_items WHERE user_id = ? AND vocabulary_id = ?', userId, vocabId) || { box: 0, correct: 0, wrong: 0, reps: 0, lapses: 0, is_difficult: 0 };
    let box = cur.box, due, lapses = cur.lapses, wrong = cur.wrong, correct = cur.correct, diff = cur.is_difficult;
    if (ok) { box = Math.min(BOX_DAYS.length - 1, box + 1); due = new Date(t.getTime() + BOX_DAYS[box] * 86400000); correct++; }
    else { box = 0; due = new Date(t.getTime() + 10 * 60000); lapses++; wrong++; if (lapses >= 2 || (wrong >= 3 && wrong >= correct)) diff = 1; }
    await db.run(`INSERT INTO review_items (user_id, vocabulary_id, box, due_at, reps, lapses, correct, wrong, is_difficult, last_result, last_reviewed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(user_id, vocabulary_id) DO UPDATE SET box = excluded.box, due_at = excluded.due_at, reps = reps + 1, lapses = excluded.lapses, correct = excluded.correct, wrong = excluded.wrong, is_difficult = excluded.is_difficult, last_result = excluded.last_result, last_reviewed_at = excluded.last_reviewed_at`,
      userId, vocabId, box, due.toISOString(), cur.reps + 1, lapses, correct, wrong, diff, ok ? 1 : 0, t.toISOString());
  }

  async function answer(user, body) {
    const vid = Number(body.vocabularyId);
    const mode = MODES.includes(body.mode) ? body.mode : null;
    if (!Number.isInteger(vid) || !mode) throw bad('err.invalid_review_answer');
    return await db.tx(async () => {
      const v = await db.get("SELECT * FROM vocabulary WHERE id = ? AND status = 'published'", vid);
      if (!v) throw new HttpError(404, 'err.word_not_found');
      const item = await db.get('SELECT * FROM review_items WHERE user_id = ? AND vocabulary_id = ?', user.id, vid);
      const wasDue = !item || item.due_at <= now();
      let ok, shown;
      if (mode === 'flashcards') { ok = body.answer === true || body.answer === 'known'; shown = `${v.en} — ${L10N.vocab(v, (await core.userById(user.id)).translation_language).word}`; }
      else {
        const reverse = body.direction === 'tr-en' && mode !== 'spelling';
        const target = mode === 'spelling' ? v.en : reverse ? v.en : L10N.vocab(v, (await core.userById(user.id)).translation_language).word;
        if (typeof body.answer !== 'string' || !body.answer.trim()) throw bad('err.write_answer');
        const accepted = target.split(/[;,\/]/).map((x) => x.trim()).filter(Boolean).concat([target]);
        const u = X.norm(body.answer);
        ok = accepted.some((a) => X.norm(a) === u) || (mode !== 'spelling' && accepted.some((a) => { const n = X.norm(a); return n.length >= 6 && X.editDistance(u, n) === 1; }));
        shown = target;
      }
      const full = await core.userById(user.id), s = S();
      await schedule(user.id, vid, ok);
      await core.bumpDay(full, { answers: 1, correct: ok ? 1 : 0, reviewCorrect: ok ? 1 : 0 });
      let xp = 0, heart = false;
      if (ok && mode !== 'flashcards' && wasDue) {       // flashcards are self-graded, so they never pay XP; each word pays at most once a day
        const day = core.todayFor(full);
        const earnedToday = (await db.get("SELECT COALESCE(SUM(amount),0) n FROM xp_transactions WHERE user_id = ? AND reason = 'review' AND local_date = ?", user.id, day)).n;
        if (earnedToday + s.xp_per_review <= s.xp_review_daily_cap) xp = await core.awardXp(full, s.xp_per_review, 'review', 'review:' + day, vid);
      }
      const rc = (await db.get('SELECT review_correct n FROM user_days WHERE user_id = ? AND local_date = ?', user.id, core.todayFor(full))).n;
      if (ok && rc >= 5) await core.markStreakDay(full);
      if (ok && rc > 0 && rc % 10 === 0 && s.hearts_enabled) { await core.changeHearts(user.id, +1); heart = true; }   // practising earns a heart back
      const earned = await core.checkAchievements(user.id);
      return { correct: ok, correctAnswer: shown, xp, heartEarned: heart, earned, counts: await counts(full) };
    });
  }

  async function setDifficult(user, vocabId, flag) {
    const v = await db.get("SELECT id FROM vocabulary WHERE id = ? AND status = 'published'", vocabId);
    if (!v) throw new HttpError(404, 'err.word_not_found');
    await db.run(`INSERT INTO review_items (user_id, vocabulary_id, box, due_at, is_difficult) VALUES (?,?,0,?,?)
      ON CONFLICT(user_id, vocabulary_id) DO UPDATE SET is_difficult = excluded.is_difficult`, user.id, vocabId, now(), flag ? 1 : 0);
    return await counts(user);
  }
  async function addToReview(user, vocabIds) {
    await db.tx(async () => { for (const id of vocabIds) if (await db.get("SELECT 1 x FROM vocabulary WHERE id = ? AND status = 'published'", id)) await db.run('INSERT OR IGNORE INTO review_items (user_id, vocabulary_id, box, due_at) VALUES (?,?,0,?)', user.id, id, now()); });
    return await counts(user);
  }

  return { counts, session, answer, setDifficult, addToReview, dueItems, MODES, BOX_DAYS };
}

module.exports = { make, BOX_DAYS };
