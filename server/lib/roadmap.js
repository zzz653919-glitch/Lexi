/* What the dashboard shows for the roadmap: current level and its progress, the four skills, recent test results and weak areas. */
const MODULES = ['listening', 'reading', 'writing', 'speaking', 'vocabulary', 'grammar'];

function make(db) {
  /* share of first-try correct answers per skill over everything the learner has answered in the course */
  async function skills(userId, courseId) {
    const rows = await db.all(`SELECT e.module m, COUNT(*) n, SUM(r.is_correct) ok FROM exercise_responses r JOIN exercises e ON e.id = r.exercise_id
      JOIN lessons l ON l.id = e.lesson_id JOIN units u ON u.id = l.unit_id JOIN levels lv ON lv.id = u.level_id
      WHERE r.user_id = ? AND r.is_retry = 0 AND e.module IS NOT NULL AND lv.course_id = ? GROUP BY e.module`, userId, courseId);
    const by = Object.fromEntries(rows.map((r) => [r.m, r]));
    return Object.fromEntries(MODULES.map((m) => [m, { answered: by[m] ? by[m].n : 0, pct: by[m] && by[m].n ? Math.round(100 * by[m].ok / by[m].n) : null }]));
  }
  async function summary(user, path) {
    if (!path || !path.course || !path.course.strict) return null;
    const levels = path.levels.map((l) => ({ code: l.code, title: l.title, state: l.comingSoon ? 'soon' : l.completed ? 'completed' : l.unlocked ? 'open' : 'locked' }));
    // the current level: the first unlocked level whose examination has not been passed
    const cur = path.levels.find((l) => l.code === path.selectedLevel && !l.comingSoon) || path.levels.find((l) => l.unlocked && !l.completed && !l.comingSoon) || path.levels.find((l) => !l.comingSoon) || path.levels[0];
    const curState = levels.find((l) => l.code === cur.code);
    if (curState) curState.state = cur.completed ? 'completed' : 'current';
    const sk = await skills(user.id, path.course.id);
    const tests = (await db.all(`SELECT x.kind, x.score_pct, x.pass_pct, x.passed, x.created_at, l.title FROM exam_results x JOIN lessons l ON l.id = x.lesson_id
      JOIN units u ON u.id = l.unit_id JOIN levels lv ON lv.id = u.level_id WHERE x.user_id = ? AND lv.course_id = ? ORDER BY x.id DESC LIMIT 10`, user.id, path.course.id))
      .map((x) => ({ kind: x.kind, title: x.title, score: x.score_pct, passPct: x.pass_pct, passed: !!x.passed, at: x.created_at }));
    // vocabulary progress by level: words practised (box >= 1) and mastered (box >= 3) among the published words of each level
    const codes = path.levels.map((l) => l.code);
    const vrows = codes.length ? await db.all(`SELECT v.cefr c, COUNT(*) total, SUM(CASE WHEN ri.box >= 1 THEN 1 ELSE 0 END) practised, SUM(CASE WHEN ri.box >= 3 THEN 1 ELSE 0 END) mastered
      FROM vocabulary v LEFT JOIN review_items ri ON ri.vocabulary_id = v.id AND ri.user_id = ? WHERE v.status = 'published' AND v.cefr IN (${codes.map(() => '?').join(',')}) GROUP BY v.cefr`, user.id, ...codes) : [];
    const vby = Object.fromEntries(vrows.map((r) => [r.c, r]));
    const vlevels = codes.map((c) => ({ code: c, total: vby[c] ? vby[c].total : 0, practised: vby[c] ? vby[c].practised || 0 : 0, mastered: vby[c] ? vby[c].mastered || 0 : 0 }));
    const vocab = { total: vlevels.reduce((a, x) => a + x.total, 0), practised: vlevels.reduce((a, x) => a + x.practised, 0), mastered: vlevels.reduce((a, x) => a + x.mastered, 0), levels: vlevels };
    const weak = MODULES.filter((m) => sk[m].answered >= 5 && sk[m].pct < 70);
    const total = path.totals;
    return { levels, level: { code: cur.code, title: cur.title, pct: cur.pct, requiredDone: cur.requiredDone, requiredTotal: cur.requiredTotal, examPassPct: cur.examPassPct, exam: cur.exam, completed: !!cur.completed },
      lessons: { done: total.done, total: total.lessons, remaining: Math.max(0, total.lessons - total.done) }, skills: sk, tests, weak, vocab };
  }
  return { summary, skills };
}
module.exports = { make };
