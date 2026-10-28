/* Lesson attempts: start / resume, grade one answer, finish. All progress and XP is decided here, on the server. */
const { now, HttpError, bad, randomToken, rng } = require('./util');
const X = require('./exercises');
const L10N = require('./localize');
const LV = require('./levels');

function make(db, settings, core, learning) {
  const S = () => settings.all();
  const exerciseRow = async (id) => await db.get('SELECT * FROM exercises WHERE id = ?', id);
  const optionsOf = async (id) => await db.all('SELECT * FROM exercise_options WHERE exercise_id = ? ORDER BY position, id', id);

  /* Exercises the learner got wrong on the first try and has not since answered correctly in a fresh lesson run or a mistakes review
     (a right answer on the automatic retry inside the same lesson does not clear a mistake). Newest mistakes first. */
  async function mistakeIds(userId, limit) {
    return (await db.all(`SELECT e.id FROM exercises e
      JOIN lessons l ON l.id = e.lesson_id AND l.status = 'published' JOIN units u ON u.id = l.unit_id JOIN levels lv ON lv.id = u.level_id JOIN courses c ON c.id = lv.course_id AND c.status = 'published'
      WHERE e.status = 'published' AND EXISTS (SELECT 1 FROM exercise_responses r WHERE r.user_id = ? AND r.exercise_id = e.id AND r.is_correct = 0 AND r.is_retry = 0
        AND NOT EXISTS (SELECT 1 FROM exercise_responses r2 JOIN lesson_attempts a2 ON a2.id = r2.attempt_id WHERE r2.user_id = r.user_id AND r2.exercise_id = r.exercise_id AND r2.is_correct = 1 AND r2.id > r.id AND (r2.is_retry = 0 OR a2.kind = 'mistakes')))
      ORDER BY (SELECT MAX(r4.id) FROM exercise_responses r4 WHERE r4.user_id = ? AND r4.exercise_id = e.id AND r4.is_correct = 0) DESC LIMIT ?`, userId, userId, limit)).map((r) => r.id);
  }
  const translationLanguage = async (user) => (await core.userById(user.id)).translation_language;
  // the exercise as this learner should see (and be graded on) it: variants for their translation language are applied
  const localized = async (id, tl) => L10N.exercise(await exerciseRow(id), await optionsOf(id), tl);
  async function exercisePayload(attempt, id, tl) {
    const { row, options } = await localized(id, tl);
    return X.payload(row, options, attempt.seed);
  }

  /* the screen the learner should see right now */
  async function view(attemptId, user, lang) {
    const a = await db.get('SELECT * FROM lesson_attempts WHERE id = ?', attemptId);
    const queue = JSON.parse(a.queue);
    const hearts = core.heartState(await core.userById(user.id));
    const lessonRow = a.lesson_id ? await db.get('SELECT id, title, translations FROM lessons WHERE id = ?', a.lesson_id) : null;
    const lesson = lessonRow ? { id: lessonRow.id, title: L10N.text(lessonRow, 'title', lang) } : null;
    const tl = await translationLanguage(user);
    const v = {
      attemptId: a.id, kind: a.kind, status: a.status, lesson, position: a.position, queueLength: queue.length, totalPlanned: a.total_planned,
      correct: a.correct, incorrect: a.incorrect, progress: queue.length ? Math.round(100 * Math.min(a.position, queue.length) / queue.length) : 0,
      hearts: hearts.hearts, maxHearts: hearts.max, heartsEnabled: hearts.enabled && a.kind === 'lesson', exercise: null,
    };
    if (a.status === 'in_progress' && a.position < queue.length) v.exercise = await exercisePayload(a, queue[a.position], tl);
    if (a.status !== 'in_progress') v.result = await result(a, user, tl);
    return v;
  }

  async function start(user, lessonId, lang) {
    const acc = await core.lessonAccess(user, lessonId, lang);
    if (!acc.ok) throw new HttpError(acc.status, acc.key, null, acc.params);
    return await db.tx(async () => {
      const st = await core.syncHearts(user.id);
      let a = await db.get("SELECT * FROM lesson_attempts WHERE user_id = ? AND lesson_id = ? AND kind = 'lesson' AND status = 'in_progress'", user.id, lessonId);
      if (!a) {
        if (st.enabled && st.hearts <= 0) throw Object.assign(new HttpError(403, 'err.out_of_hearts'), { extra: { nextHeartAt: st.nextAt } });
        const ids = (await db.all("SELECT id FROM exercises WHERE lesson_id = ? AND status = 'published' ORDER BY position, id", lessonId)).map((r) => r.id);
        if (!ids.length) throw new HttpError(409, 'err.lesson_empty');
        const r = await db.run('INSERT INTO lesson_attempts (user_id, lesson_id, kind, queue, total_planned, started_at, seed) VALUES (?,?,?,?,?,?,?)', user.id, lessonId, 'lesson', JSON.stringify(ids), ids.length, now(), 1 + Math.floor(Math.random() * 1e6));
        a = await db.get('SELECT * FROM lesson_attempts WHERE id = ?', r.id);
      }
      return await view(a.id, user, lang);
    });
  }

  /* a short run made of exercises the learner answered wrongly (and has not answered correctly since) */
  async function startMistakes(user, lang) {
    return await db.tx(async () => {
      let a = await db.get("SELECT * FROM lesson_attempts WHERE user_id = ? AND kind = 'mistakes' AND status = 'in_progress'", user.id);
      if (!a) {
        const ids = await mistakeIds(user.id, 8);
        if (!ids.length) throw new HttpError(409, 'err.no_mistakes');
        const r = await db.run('INSERT INTO lesson_attempts (user_id, lesson_id, kind, queue, total_planned, started_at, seed) VALUES (?,?,?,?,?,?,?)', user.id, null, 'mistakes', JSON.stringify(ids), ids.length, now(), 1 + Math.floor(Math.random() * 1e6));
        a = await db.get('SELECT * FROM lesson_attempts WHERE id = ?', r.id);
      }
      return await view(a.id, user, lang);
    });
  }

  async function answer(user, attemptId, body, lang) {
    const exerciseId = Number(body && body.exerciseId);
    if (!Number.isInteger(exerciseId)) throw bad('err.missing_exercise');
    return await db.tx(async () => {
      const a = await db.get('SELECT * FROM lesson_attempts WHERE id = ? AND user_id = ? AND variant IS NULL', attemptId, user.id);
      if (!a) throw new HttpError(404, 'err.attempt_not_found');
      const queue = JSON.parse(a.queue);
      // a repeated submit of an exercise that was already graded returns the stored feedback and awards nothing
      if (a.status !== 'in_progress' || queue[a.position] !== exerciseId) {
        const prev = await db.get('SELECT * FROM exercise_responses WHERE attempt_id = ? AND exercise_id = ? ORDER BY slot DESC LIMIT 1', a.id, exerciseId);
        if (!prev) throw new HttpError(409, 'err.exercise_not_current');
        return { feedback: { ...JSON.parse(prev.feedback), replayed: true }, state: await view(a.id, user, lang) };
      }
      const { row: ex, options } = await localized(exerciseId, await translationLanguage(user));
      const g = X.grade(ex, options, body.answer, a.seed);
      if (g.invalid) throw bad('err.invalid_answer');
      const slot = a.position;
      const isRetry = !!await db.get('SELECT 1 x FROM exercise_responses WHERE attempt_id = ? AND exercise_id = ?', a.id, exerciseId);
      const s = S();
      const full = await core.userById(user.id);
      let xp = 0;
      const fb = { correct: g.correct, typo: !!g.typo, correctAnswer: g.correctAnswer, explanation: ex.explanation, translation: ex.translation, exerciseId };
      const ins = await db.run('INSERT INTO exercise_responses (attempt_id, user_id, exercise_id, slot, answer, is_correct, is_retry, feedback, xp, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
        a.id, user.id, exerciseId, slot, JSON.stringify(body.answer).slice(0, 600), g.correct ? 1 : 0, isRetry ? 1 : 0, '{}', 0, now());
      if (g.correct) {
        const per = a.kind === 'mistakes' ? s.xp_per_mistake_review : isRetry ? s.xp_per_retry : s.xp_per_correct;
        xp = await core.awardXp(full, per, a.kind === 'mistakes' ? 'mistakes' : 'exercise', 'response', ins.id);
      }
      await core.bumpDay(full, { answers: 1, correct: g.correct ? 1 : 0 });
      if (!isRetry) await noteEvidence(user.id, ex, a.id, g.correct);
      fb.xp = xp;
      await db.run('UPDATE exercise_responses SET feedback = ?, xp = ? WHERE id = ?', JSON.stringify(fb), xp, ins.id);
      let newQueue = queue, status = 'in_progress';
      const upd = { correct: a.correct, incorrect: a.incorrect, xp_awarded: a.xp_awarded + xp };
      if (!isRetry) { if (g.correct) upd.correct++; else upd.incorrect++; }
      if (!g.correct) {
        if (!isRetry) newQueue = queue.concat(exerciseId);                  // one more chance at the end of the lesson
        if (a.kind === 'lesson') {
          const h = await core.changeHearts(user.id, -1);
          if (h.enabled && h.hearts <= 0) status = 'out_of_hearts';
        }
        if (g.correct === false && ex.vocabulary_id) await noteVocabMiss(user.id, ex.vocabulary_id);
      }
      const position = a.position + 1;
      await db.run('UPDATE lesson_attempts SET queue = ?, position = ?, correct = ?, incorrect = ?, xp_awarded = ?, status = ? WHERE id = ?', JSON.stringify(newQueue), position, upd.correct, upd.incorrect, upd.xp_awarded, status, a.id);
      let celebrate = null;
      if (status === 'in_progress' && position >= newQueue.length) celebrate = await finish(user, a.id);
      else if (status === 'out_of_hearts') await db.run('UPDATE lesson_attempts SET completed_at = ? WHERE id = ?', now(), a.id);
      const state = await view(a.id, user, lang);
      return { feedback: fb, state, celebrate };
    });
  }

  /* every first-try answer is evidence about one skill at the level of the lesson it belongs to */
  async function noteEvidence(userId, ex, attemptId, correct) {
    const skill = ex.skill || LV.SKILL_OF_TYPE[ex.type];
    const lv = await db.get('SELECT lv.code FROM exercises e JOIN lessons l ON l.id = e.lesson_id JOIN units u ON u.id = l.unit_id JOIN levels lv ON lv.id = u.level_id WHERE e.id = ?', ex.id);
    if (skill && lv && LV.valid(lv.code)) await learning.recordEvidence(userId, skill, lv.code, correct, 'lesson', attemptId);
  }
  async function noteVocabMiss(userId, vocabId) {
    const t = now();
    await db.run(`INSERT INTO review_items (user_id, vocabulary_id, box, due_at, reps, lapses, correct, wrong, is_difficult, last_result, last_reviewed_at)
      VALUES (?,?,0,?,1,1,0,1,0,0,?) ON CONFLICT(user_id, vocabulary_id) DO UPDATE SET box = 0, due_at = excluded.due_at, lapses = lapses + 1, wrong = wrong + 1, last_result = 0, last_reviewed_at = excluded.last_reviewed_at,
      is_difficult = CASE WHEN lapses + 1 >= 2 OR (wrong + 1 >= 3 AND wrong + 1 >= correct) THEN 1 ELSE is_difficult END`, userId, vocabId, t, t);
  }

  /* completes the attempt: bonus XP, lesson progress, streak, review schedule, achievements (runs once, inside the answer transaction) */
  async function finish(user, attemptId) {
    const a = await db.get('SELECT * FROM lesson_attempts WHERE id = ?', attemptId);
    if (a.status === 'completed') return null;
    const full = await core.userById(user.id), s = S();
    const accuracy = a.total_planned ? Math.round(100 * a.correct / a.total_planned) : 0;
    let bonus = 0, perfect = 0;
    if (a.kind === 'lesson') {
      const lesson = await db.get('SELECT * FROM lessons WHERE id = ?', a.lesson_id);
      bonus += await core.awardXp(full, lesson.xp_reward, 'lesson_complete', 'attempt', a.id);
      if (a.incorrect === 0) perfect = await core.awardXp(full, s.xp_perfect_bonus, 'perfect_bonus', 'attempt', a.id);
      const prog = await db.get('SELECT * FROM user_progress WHERE user_id = ? AND lesson_id = ?', user.id, a.lesson_id);
      if (prog) await db.run('UPDATE user_progress SET completions = completions + 1, best_accuracy = MAX(best_accuracy, ?), last_completed_at = ? WHERE user_id = ? AND lesson_id = ?', accuracy, now(), user.id, a.lesson_id);
      else await db.run('INSERT INTO user_progress (user_id, lesson_id, completions, best_accuracy, first_completed_at, last_completed_at) VALUES (?,?,1,?,?,?)', user.id, a.lesson_id, accuracy, now(), now());
      await core.bumpDay(full, { lessons: 1 });
      // the lesson's own vocabulary joins the review schedule (due tomorrow); words missed above are already due now
      for (const v of await db.all("SELECT id FROM vocabulary WHERE lesson_id = ? AND status = 'published'", a.lesson_id))
        await db.run('INSERT OR IGNORE INTO review_items (user_id, vocabulary_id, box, due_at) VALUES (?,?,0,?)', user.id, v.id, new Date(Date.now() + 86400000).toISOString());
    } else {
      await core.bumpDay(full, { lessons: 0 });
    }
    await core.markStreakDay(full);
    await db.run("UPDATE lesson_attempts SET status = 'completed', completed_at = ?, xp_awarded = xp_awarded + ? WHERE id = ?", now(), bonus + perfect, a.id);
    const earned = await core.checkAchievements(user.id);
    const levelUp = await learning.maybeLevelUp(user.id);
    await db.run('UPDATE users SET last_active_at = ? WHERE id = ?', now(), user.id);
    return { earned, levelUp };
  }

  async function result(a, user, tl) {
    const total = a.total_planned;
    const missed = await db.all(`SELECT DISTINCT e.id, e.type, e.prompt, e.sentence, e.answer, e.vocabulary_id FROM exercise_responses r JOIN exercises e ON e.id = r.exercise_id
      WHERE r.attempt_id = ? AND r.is_correct = 0 AND r.is_retry = 0`, a.id);
    const words = [];
    const seen = new Set();
    for (const m of missed) {
      if (m.vocabulary_id && !seen.has(m.vocabulary_id)) { const v = await db.get('SELECT id, en, uz, example, example_uz, translations FROM vocabulary WHERE id = ?', m.vocabulary_id); if (v) { seen.add(v.id); const t = L10N.vocab(v, tl); words.push({ id: v.id, en: v.en, translation: t.word, example: v.example }); } }
    }
    const mistakes = [];
    for (const m of missed) { const { row } = await localized(m.id, tl); mistakes.push({ type: row.type, prompt: row.prompt || row.sentence, answer: (row.answer || '').split('|')[0] }); }
    const fresh = JSON.parse((await db.get('SELECT feedback FROM exercise_responses WHERE attempt_id = ? ORDER BY id DESC LIMIT 1', a.id))?.feedback || '{}');
    return {
      outcome: a.status, correct: a.correct, incorrect: a.incorrect, total, accuracy: total ? Math.round(100 * a.correct / total) : 0, xp: a.xp_awarded,
      mistakes, words,
      lastFeedback: fresh,
    };
  }

  async function getAttempt(user, id, lang) {
    const a = await db.get('SELECT * FROM lesson_attempts WHERE id = ? AND user_id = ? AND variant IS NULL', id, user.id);
    if (!a) throw new HttpError(404, 'err.attempt_not_found');
    return await view(a.id, user, lang);
  }
  async function abandon(user, id) {
    const a = await db.get('SELECT * FROM lesson_attempts WHERE id = ? AND user_id = ?', id, user.id);
    if (!a) throw new HttpError(404, 'err.attempt_not_found');
    if (a.status === 'in_progress') await db.run("UPDATE lesson_attempts SET status = 'abandoned', completed_at = ? WHERE id = ?", now(), a.id);
    return { ok: true };
  }

  return { start, startMistakes, mistakeIds, answer, getAttempt, abandon, view, noteVocabMiss };
}

module.exports = { make };
