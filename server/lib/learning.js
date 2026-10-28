/* A learner's level and skills after the placement test: level changes (and their history), per-skill evidence while learning,
   automatic level-up, the reassessment recommendation and the personalised plan. */
const LV = require('./levels');
const IRT = require('./irt');
const { now } = require('./util');

const PATH_MIN = 1, PATH_MAX = 5;   // the sample course has A1..C1; Pre-A1 learners start on A1 and C2 learners on C1
const pathLevel = (code) => LV.code(Math.max(PATH_MIN, Math.min(PATH_MAX, LV.index(code))));
const round2 = (n) => Math.round(n * 100) / 100;

function make(db, settings) {
  const S = () => settings.all();

  async function setLevel(userId, level, source, { note = '', assessmentId = null } = {}) {
    if (!LV.valid(level)) throw new Error('unknown level ' + level);
    const u = await db.get('SELECT cefr_level FROM users WHERE id = ?', userId);
    const t = now();
    await db.run('UPDATE users SET cefr_level = ?, level_source = ?, level_changed_at = ?, start_level = ?, onboarded = 1 WHERE id = ?', level, source, t, pathLevel(level), userId);
    await db.run('INSERT INTO user_level_history (user_id, level, previous, source, note, assessment_id, created_at) VALUES (?,?,?,?,?,?,?)', userId, level, u ? u.cefr_level : null, source, note, assessmentId, t);
  }

  /* called when a placement test or a reassessment finishes */
  async function applyAssessment(userId, assessmentId, level, result, kind) {
    await setLevel(userId, level, kind, { assessmentId });
    const t = now();
    for (const g of LV.TRACKED) {
      const s = result.skills[g];
      // a skill with too few answers keeps the overall estimate
      const score = s && s.theta !== null && s.theta !== undefined ? s.theta : result.theta;
      await db.run(`INSERT INTO user_skills (user_id, skill, score, samples, updated_at) VALUES (?,?,?,?,?)
        ON CONFLICT(user_id, skill) DO UPDATE SET score = excluded.score, samples = excluded.samples, updated_at = excluded.updated_at`, userId, g, score, s ? s.asked : 0, t);
    }
    await buildPlan(userId, level, result);
  }

  async function skills(userId, fallbackLevel) {
    const rows = Object.fromEntries((await db.all('SELECT * FROM user_skills WHERE user_id = ?', userId)).map((r) => [r.skill, r]));
    const base = Math.max(0, LV.index(fallbackLevel || 'A1'));
    const cut = S().placement_cutoffs;
    return LV.TRACKED.map((g) => { const r = rows[g]; const score = r ? r.score : base; return { skill: g, score: round2(score), level: LV.code(IRT.levelIndexFor(score, cut)), samples: r ? r.samples : 0 }; });
  }

  /* one graded answer in a lesson / daily lesson / review is evidence for the skill it trains */
  async function recordEvidence(userId, skill, level, correct, source, attemptId) {
    const g = LV.TRACKED_OF[skill] || skill;
    if (!LV.TRACKED.includes(g) || !LV.valid(level)) return;
    const t = now();
    await db.run('INSERT INTO skill_evidence (user_id, skill, level, correct, source, attempt_id, created_at) VALUES (?,?,?,?,?,?,?)', userId, g, level, correct ? 1 : 0, source, attemptId || null, t);
    const cur = await db.get('SELECT * FROM user_skills WHERE user_id = ? AND skill = ?', userId, g);
    const base = cur ? cur.score : Math.max(0, LV.index((await db.get('SELECT cefr_level FROM users WHERE id = ?', userId)).cefr_level || 'A1'));
    const n = cur ? cur.samples : 0;
    // Elo-style update: expected result at the current score, step shrinks as evidence accumulates (never below 0.04)
    const expected = IRT.pCorrect(base, LV.index(level));
    const k = Math.max(0.04, 0.5 / Math.sqrt(n + 1));
    const score = Math.max(0, Math.min(6, base + k * ((correct ? 1 : 0) - expected)));
    await db.run(`INSERT INTO user_skills (user_id, skill, score, samples, updated_at) VALUES (?,?,?,?,?)
      ON CONFLICT(user_id, skill) DO UPDATE SET score = excluded.score, samples = user_skills.samples + 1, updated_at = excluded.updated_at`, userId, g, score, 1, t);
  }

  /* performance at the learner's current level since they reached it */
  async function recent(userId, user) {
    const s = S();
    const since = user.level_changed_at || user.created_at;
    const rows = await db.all('SELECT correct FROM skill_evidence WHERE user_id = ? AND created_at >= ? AND level IN (?, ?) ORDER BY id DESC LIMIT ?', userId, since, user.cefr_level, LV.code(LV.index(user.cefr_level) + 1), Math.max(10, s.adapt_min_answers));
    const answers = rows.length, correct = rows.reduce((a, r) => a + r.correct, 0);
    const lessons = (await db.get("SELECT COUNT(*) n FROM lesson_attempts WHERE user_id = ? AND status = 'completed' AND started_at >= ?", userId, since)).n;
    const days = Math.floor((Date.now() - Date.parse(since)) / 86400000);
    return { answers, accuracy: answers ? Math.round(100 * correct / answers) : null, lessons, days };
  }

  /* moves a learner up one level when they have clearly outgrown theirs. Never lowers a level automatically (that is only
     recommended via a reassessment) and never touches a level the learner chose by hand within the observation window. */
  async function maybeLevelUp(userId) {
    const s = S();
    if (!s.adapt_enabled) return null;
    const user = await db.get('SELECT * FROM users WHERE id = ?', userId);
    if (!user || !user.cefr_level || LV.index(user.cefr_level) >= LV.LEVELS.length - 1) return null;
    const r = await recent(userId, user);
    if (r.answers < s.adapt_min_answers || r.lessons < s.adapt_min_lessons || r.days < s.adapt_min_days || r.accuracy < s.adapt_up_accuracy) return null;
    const next = LV.code(LV.index(user.cefr_level) + 1);
    await setLevel(userId, next, 'auto', { note: `accuracy ${r.accuracy}% over ${r.answers} answers` });
    return { from: user.cefr_level, to: next };
  }

  async function recommendation(user) {
    const s = S();
    const last = await db.get("SELECT completed_at FROM assessments WHERE user_id = ? AND status = 'completed' ORDER BY id DESC LIMIT 1", user.id);
    const r = await recent(user.id, user);
    if (!last && user.level_source !== 'legacy') return { reassess: true, reason: 'never' };
    if (r.answers >= Math.min(20, s.adapt_min_answers) && r.accuracy !== null && r.accuracy < s.adapt_low_accuracy) return { reassess: true, reason: 'struggling', accuracy: r.accuracy };
    if (last && Date.now() - Date.parse(last.completed_at) > s.placement_valid_days * 86400000) return { reassess: true, reason: 'old', days: s.placement_valid_days };
    if (!last) return { reassess: false, reason: 'legacy' };
    return { reassess: false, reason: null };
  }

  /* the plan is data (keys and parameters); the interface turns it into text in the learner's language */
  async function buildPlan(userId, level, result) {
    const user = await db.get('SELECT daily_goal_xp, lesson_length FROM users WHERE id = ?', userId);
    const idx = LV.index(level), weak = (result && result.weaknesses) || [], strong = (result && result.strengths) || [];
    const next = idx < LV.LEVELS.length - 1 ? LV.code(idx + 1) : null;
    const plan = {
      level, next, focus: weak.length ? weak : ['vocabulary', 'grammar'], strengths: strong,
      steps: [
        { key: 'daily', params: { items: S()['daily_items_' + (user.lesson_length || 'normal')] || 18 } },
        { key: 'review', params: {} },
        ...(weak.length ? [{ key: 'weak', params: { skills: weak } }] : []),
        ...(next ? [{ key: 'next', params: { level: next, days: Math.max(7, S().adapt_min_days) } }] : [{ key: 'maintain', params: {} }]),
        { key: 'retest', params: { days: S().placement_valid_days } },
      ],
    };
    await db.run('INSERT INTO learning_plans (user_id, level, plan, generated_at) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET level = excluded.level, plan = excluded.plan, generated_at = excluded.generated_at', userId, level, JSON.stringify(plan), now());
    return plan;
  }
  async function plan(user) {
    const row = await db.get('SELECT * FROM learning_plans WHERE user_id = ?', user.id);
    if (row && row.level === user.cefr_level) return JSON.parse(row.plan);
    return buildPlan(user.id, user.cefr_level || 'A1', await lastResult(user.id));
  }
  async function lastResult(userId) {
    const a = await db.get("SELECT result FROM assessments WHERE user_id = ? AND status = 'completed' ORDER BY id DESC LIMIT 1", userId);
    return a ? JSON.parse(a.result) : { weaknesses: [], strengths: [] };
  }

  async function history(userId) {
    return (await db.all('SELECT id, level, previous, source, note, assessment_id, created_at FROM user_level_history WHERE user_id = ? ORDER BY id DESC LIMIT 30', userId))
      .map((h) => ({ id: h.id, level: h.level, previous: h.previous, source: h.source, assessmentId: h.assessment_id, at: h.created_at }));
  }

  /* everything the dashboard / profile need to know about the learner's level */
  async function status(user) {
    const full = await db.get('SELECT * FROM users WHERE id = ?', user.id);
    const last = await db.get("SELECT id, kind, asked, correct, result_level, result, completed_at FROM assessments WHERE user_id = ? AND status = 'completed' ORDER BY id DESC LIMIT 1", user.id);
    const sk = await skills(user.id, full.cefr_level);
    const overall = LV.index(full.cefr_level || 'A1');
    const weak = sk.filter((x) => x.samples > 0 && overall - x.score >= 0.7).map((x) => x.skill);
    const strong = sk.filter((x) => x.samples > 0 && x.score - overall >= 0.7).map((x) => x.skill);
    return {
      level: full.cefr_level, source: full.level_source, changedAt: full.level_changed_at, onboarded: !!full.onboarded, lessonLength: full.lesson_length,
      assessment: last ? { id: last.id, kind: last.kind, level: last.result_level, asked: last.asked, correct: last.correct, completedAt: last.completed_at, result: JSON.parse(last.result) } : null,
      skills: sk, strengths: strong, weaknesses: weak, progress: await recent(user.id, full), recommendation: await recommendation(full),
      plan: await plan(full), history: await history(user.id),
    };
  }

  return { setLevel, applyAssessment, recordEvidence, maybeLevelUp, recommendation, buildPlan, plan, status, skills, history, pathLevel };
}

module.exports = { make, pathLevel };
