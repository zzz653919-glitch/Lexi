/* Vocabulary review with a simple spaced-repetition schedule (Leitner boxes). */
const { now, HttpError, bad, shuffled, clamp, escapeLike } = require('./util');
const X = require('./exercises');

const BOX_DAYS = [0, 1, 2, 4, 8, 16, 32];          // days until the next review after a correct answer, by box
const MODES = ['flashcards', 'choice', 'typed', 'spelling'];

function make(db, settings, core) {
  const S = () => settings.all();
  const published = "v.status = 'published'";

  function counts(user) {
    const t = now();
    const r = db.get(`SELECT COUNT(*) total, SUM(CASE WHEN ri.due_at <= ? THEN 1 ELSE 0 END) due, SUM(ri.is_difficult) difficult
      FROM review_items ri JOIN vocabulary v ON v.id = ri.vocabulary_id AND ${published} WHERE ri.user_id = ?`, t, user.id);
    return { total: r.total || 0, due: r.due || 0, difficult: r.difficult || 0 };
  }

  /* due words first; difficult and often-missed words before the rest, then the oldest due date */
  function dueItems(user, limit, onlyDifficult) {
    return db.all(`SELECT v.*, ri.box, ri.due_at, ri.correct rc, ri.wrong rw, ri.is_difficult
      FROM review_items ri JOIN vocabulary v ON v.id = ri.vocabulary_id AND ${published}
      WHERE ri.user_id = ? AND (${onlyDifficult ? 'ri.is_difficult = 1' : 'ri.due_at <= ?'})
      ORDER BY ri.is_difficult DESC, (CAST(ri.wrong AS REAL) / (ri.correct + ri.wrong + 1)) DESC, ri.due_at ASC LIMIT ?`,
      ...(onlyDifficult ? [user.id, limit] : [user.id, now(), limit]));
  }

  function distractors(v, field, n, seed) {
    const pool = db.all(`SELECT ${field} AS t FROM vocabulary WHERE status = 'published' AND id != ? AND LOWER(${field}) != LOWER(?) ${v.course_id ? 'AND course_id = ?' : ''} LIMIT 60`, ...[v.id, v[field]].concat(v.course_id ? [v.course_id] : []));
    const seen = new Set([X.norm(v[field])]);
    const out = [];
    for (const r of shuffled(pool, seed)) { const k = X.norm(r.t); if (!seen.has(k)) { seen.add(k); out.push(r.t); if (out.length === n) break; } }
    return out;
  }

  function session(user, body) {
    const mode = MODES.includes(body.mode) ? body.mode : 'choice';
    const size = clamp(Number.parseInt(body.size, 10) || 10, 1, 30);
    const items = dueItems(user, size, !!body.difficultOnly);
    const seed = Math.floor(Math.random() * 1e6);
    const cards = items.map((v, i) => {
      const reverse = mode === 'typed' || mode === 'choice' ? (v.id + seed) % 2 === 0 : false;   // sometimes Uzbek -> English
      const c = { vocabularyId: v.id, mode, box: v.box, difficult: !!v.is_difficult, pos: v.pos };
      if (mode === 'flashcards') { c.front = v.en; c.back = v.uz; c.example = v.example; c.exampleUz = v.example_uz; c.audio = v.audio_url ? { url: v.audio_url } : { text: v.en }; }
      else if (mode === 'choice') {
        const field = reverse ? 'en' : 'uz';
        const wrong = distractors(v, field, 3, seed + i);
        c.direction = reverse ? 'uz-en' : 'en-uz'; c.prompt = reverse ? v.uz : v.en;
        c.options = shuffled([v[field]].concat(wrong), seed + v.id);
        if (c.options.length < 2) { c.mode = 'typed'; delete c.options; }
      } else if (mode === 'typed') { c.direction = reverse ? 'uz-en' : 'en-uz'; c.prompt = reverse ? v.uz : v.en; }
      if (mode === 'spelling') { c.prompt = v.uz; c.audio = v.audio_url ? { url: v.audio_url } : { text: v.en }; c.length = v.en.length; }
      if (c.mode === 'typed' && !c.direction) { c.direction = 'en-uz'; c.prompt = v.en; }
      return c;
    });
    return { mode, cards, counts: counts(user) };
  }

  function schedule(userId, vocabId, ok) {
    const t = new Date(), cur = db.get('SELECT * FROM review_items WHERE user_id = ? AND vocabulary_id = ?', userId, vocabId) || { box: 0, correct: 0, wrong: 0, reps: 0, lapses: 0, is_difficult: 0 };
    let box = cur.box, due, lapses = cur.lapses, wrong = cur.wrong, correct = cur.correct, diff = cur.is_difficult;
    if (ok) { box = Math.min(BOX_DAYS.length - 1, box + 1); due = new Date(t.getTime() + BOX_DAYS[box] * 86400000); correct++; }
    else { box = 0; due = new Date(t.getTime() + 10 * 60000); lapses++; wrong++; if (lapses >= 2 || (wrong >= 3 && wrong >= correct)) diff = 1; }
    db.run(`INSERT INTO review_items (user_id, vocabulary_id, box, due_at, reps, lapses, correct, wrong, is_difficult, last_result, last_reviewed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(user_id, vocabulary_id) DO UPDATE SET box = excluded.box, due_at = excluded.due_at, reps = reps + 1, lapses = excluded.lapses, correct = excluded.correct, wrong = excluded.wrong, is_difficult = excluded.is_difficult, last_result = excluded.last_result, last_reviewed_at = excluded.last_reviewed_at`,
      userId, vocabId, box, due.toISOString(), cur.reps + 1, lapses, correct, wrong, diff, ok ? 1 : 0, t.toISOString());
  }

  function answer(user, body) {
    const vid = Number(body.vocabularyId);
    const mode = MODES.includes(body.mode) ? body.mode : null;
    if (!Number.isInteger(vid) || !mode) throw bad('Invalid review answer.');
    return db.tx(() => {
      const v = db.get("SELECT * FROM vocabulary WHERE id = ? AND status = 'published'", vid);
      if (!v) throw new HttpError(404, 'Word not found.');
      const item = db.get('SELECT * FROM review_items WHERE user_id = ? AND vocabulary_id = ?', user.id, vid);
      const wasDue = !item || item.due_at <= now();
      let ok, shown;
      if (mode === 'flashcards') { ok = body.answer === true || body.answer === 'known'; shown = `${v.en} — ${v.uz}`; }
      else {
        const reverse = body.direction === 'uz-en' && mode !== 'spelling';
        const target = mode === 'spelling' ? v.en : reverse ? v.en : v.uz;
        if (typeof body.answer !== 'string' || !body.answer.trim()) throw bad('Write an answer.');
        const accepted = target.split(/[;,\/]/).map((x) => x.trim()).filter(Boolean).concat([target]);
        const u = X.norm(body.answer);
        ok = accepted.some((a) => X.norm(a) === u) || (mode !== 'spelling' && accepted.some((a) => { const n = X.norm(a); return n.length >= 6 && X.editDistance(u, n) === 1; }));
        shown = target;
      }
      const full = core.userById(user.id), s = S();
      schedule(user.id, vid, ok);
      core.bumpDay(full, { answers: 1, correct: ok ? 1 : 0, reviewCorrect: ok ? 1 : 0 });
      let xp = 0, heart = false;
      if (ok && mode !== 'flashcards' && wasDue) {       // flashcards are self-graded, so they never pay XP; each word pays at most once a day
        const day = core.todayFor(full);
        const earnedToday = db.get("SELECT COALESCE(SUM(amount),0) n FROM xp_transactions WHERE user_id = ? AND reason = 'review' AND local_date = ?", user.id, day).n;
        if (earnedToday + s.xp_per_review <= s.xp_review_daily_cap) xp = core.awardXp(full, s.xp_per_review, 'review', 'review:' + day, vid);
      }
      const rc = db.get('SELECT review_correct n FROM user_days WHERE user_id = ? AND local_date = ?', user.id, core.todayFor(full)).n;
      if (ok && rc >= 5) core.markStreakDay(full);
      if (ok && rc > 0 && rc % 10 === 0 && s.hearts_enabled) { core.changeHearts(user.id, +1); heart = true; }   // practising earns a heart back
      const earned = core.checkAchievements(user.id);
      return { correct: ok, correctAnswer: shown, xp, heartEarned: heart, earned, counts: counts(full) };
    });
  }

  function setDifficult(user, vocabId, flag) {
    const v = db.get("SELECT id FROM vocabulary WHERE id = ? AND status = 'published'", vocabId);
    if (!v) throw new HttpError(404, 'Word not found.');
    db.run(`INSERT INTO review_items (user_id, vocabulary_id, box, due_at, is_difficult) VALUES (?,?,0,?,?)
      ON CONFLICT(user_id, vocabulary_id) DO UPDATE SET is_difficult = excluded.is_difficult`, user.id, vocabId, now(), flag ? 1 : 0);
    return counts(user);
  }
  function addToReview(user, vocabIds) {
    db.tx(() => { for (const id of vocabIds) if (db.get("SELECT 1 x FROM vocabulary WHERE id = ? AND status = 'published'", id)) db.run('INSERT OR IGNORE INTO review_items (user_id, vocabulary_id, box, due_at) VALUES (?,?,0,?)', user.id, id, now()); });
    return counts(user);
  }

  return { counts, session, answer, setDifficult, addToReview, dueItems, MODES, BOX_DAYS };
}

module.exports = { make, BOX_DAYS };
