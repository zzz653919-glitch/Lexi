/* Learning logic shared by the API routes: hearts, XP, streaks, achievements and the learning path with its unlock rules.
   Everything that changes progress runs on the server inside a transaction. */
const { now, localDate, addDays, weekStart } = require('./util');

const ACHIEVEMENTS = [
  { code: 'first_lesson', title: 'First step', description: 'Complete your first lesson.', icon: 'flag' },
  { code: 'lessons_10', title: 'Getting going', description: 'Complete 10 lessons.', icon: 'path' },
  { code: 'lessons_25', title: 'Dedicated learner', description: 'Complete 25 lessons.', icon: 'path' },
  { code: 'perfect_lesson', title: 'Flawless', description: 'Finish a lesson without a single mistake.', icon: 'star' },
  { code: 'streak_3', title: 'Three in a row', description: 'Reach a 3-day streak.', icon: 'flame' },
  { code: 'streak_7', title: 'One week strong', description: 'Reach a 7-day streak.', icon: 'flame' },
  { code: 'streak_30', title: 'Unstoppable', description: 'Reach a 30-day streak.', icon: 'flame' },
  { code: 'xp_100', title: '100 XP', description: 'Earn 100 XP.', icon: 'bolt' },
  { code: 'xp_500', title: '500 XP', description: 'Earn 500 XP.', icon: 'bolt' },
  { code: 'xp_2000', title: '2000 XP', description: 'Earn 2000 XP.', icon: 'bolt' },
  { code: 'daily_goal', title: 'Goal reached', description: 'Reach your daily XP goal.', icon: 'target' },
  { code: 'first_review', title: 'Word keeper', description: 'Answer 10 vocabulary review questions correctly.', icon: 'cards' },
  { code: 'reviews_100', title: 'Memory master', description: 'Answer 100 vocabulary review questions correctly.', icon: 'cards' },
  { code: 'level_complete', title: 'Level complete', description: 'Finish every lesson of a level.', icon: 'trophy' },
];

function make(db, settings) {
  const S = () => settings.all();
  const userById = (id) => db.get('SELECT * FROM users WHERE id = ?', id);
  const todayFor = (user) => localDate(new Date(), user.timezone);

  /* ---------- hearts ---------- */
  function heartState(user) {
    const s = S();
    if (!s.hearts_enabled) return { enabled: false, hearts: s.max_hearts, max: s.max_hearts, nextAt: null };
    const regen = s.heart_regen_minutes * 60000;
    let h = Math.min(user.hearts, s.max_hearts), base = Date.parse(user.hearts_updated_at) || Date.now();
    if (h < s.max_hearts) {
      const gained = Math.floor((Date.now() - base) / regen);
      if (gained > 0) { h = Math.min(s.max_hearts, h + gained); base = h >= s.max_hearts ? Date.now() : base + gained * regen; }
    } else base = Date.now();
    return { enabled: true, hearts: h, max: s.max_hearts, nextAt: h < s.max_hearts ? new Date(base + regen).toISOString() : null, baseAt: new Date(base).toISOString() };
  }
  function syncHearts(userId) {
    const u = userById(userId), st = heartState(u);
    if (st.enabled && (st.hearts !== u.hearts || st.baseAt !== u.hearts_updated_at)) db.run('UPDATE users SET hearts = ?, hearts_updated_at = ? WHERE id = ?', st.hearts, st.baseAt, userId);
    return st;
  }
  function changeHearts(userId, delta) {
    const st = syncHearts(userId);
    if (!st.enabled) return st;
    const h = Math.max(0, Math.min(st.max, st.hearts + delta));
    const at = st.hearts >= st.max && h < st.max ? now() : st.baseAt;   // the regeneration clock starts when the first heart is lost
    db.run('UPDATE users SET hearts = ?, hearts_updated_at = ? WHERE id = ?', h, at, userId);
    return heartState(userById(userId));
  }

  /* ---------- XP, days, streaks ---------- */
  function awardXp(user, amount, reason, refType, refId) {
    if (amount <= 0) return 0;
    const date = todayFor(user);
    const r = db.run('INSERT OR IGNORE INTO xp_transactions (user_id, amount, reason, ref_type, ref_id, local_date, created_at) VALUES (?,?,?,?,?,?,?)', user.id, amount, reason, refType, refId, date, now());
    if (!r.changes) return 0;                 // already paid for this activity
    db.run('UPDATE users SET xp_total = xp_total + ? WHERE id = ?', amount, user.id);
    db.run('INSERT INTO user_days (user_id, local_date, xp) VALUES (?,?,?) ON CONFLICT(user_id, local_date) DO UPDATE SET xp = xp + excluded.xp', user.id, date, amount);
    return amount;
  }
  function bumpDay(user, { answers = 0, correct = 0, lessons = 0, reviewCorrect = 0 }) {
    db.run('INSERT INTO user_days (user_id, local_date, answers, correct, lessons, review_correct) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id, local_date) DO UPDATE SET answers = answers + excluded.answers, correct = correct + excluded.correct, lessons = lessons + excluded.lessons, review_correct = review_correct + excluded.review_correct', user.id, todayFor(user), answers, correct, lessons, reviewCorrect);
  }
  /* A day counts for the streak when the learner COMPLETES an activity that day: a lesson, a mistakes review, or 5 correct
     vocabulary-review answers. Days are calendar days in the learner's own time zone. */
  function markStreakDay(user) {
    const today = todayFor(user);
    const s = db.get('SELECT * FROM user_streaks WHERE user_id = ?', user.id) || { current_streak: 0, longest_streak: 0, last_active_date: null };
    if (s.last_active_date === today) return s;
    const cur = s.last_active_date === addDays(today, -1) ? s.current_streak + 1 : 1;
    const longest = Math.max(s.longest_streak, cur);
    db.run('INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_active_date) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET current_streak = excluded.current_streak, longest_streak = excluded.longest_streak, last_active_date = excluded.last_active_date', user.id, cur, longest, today);
    return { current_streak: cur, longest_streak: longest, last_active_date: today };
  }
  function streakInfo(user) {
    const s = db.get('SELECT * FROM user_streaks WHERE user_id = ?', user.id);
    const today = todayFor(user);
    if (!s) return { current: 0, longest: 0, activeToday: false, lastActiveDate: null };
    const alive = s.last_active_date === today || s.last_active_date === addDays(today, -1);
    return { current: alive ? s.current_streak : 0, longest: s.longest_streak, activeToday: s.last_active_date === today, lastActiveDate: s.last_active_date };
  }
  const dayInfo = (user) => {
    const d = db.get('SELECT xp, lessons, answers, correct FROM user_days WHERE user_id = ? AND local_date = ?', user.id, todayFor(user)) || { xp: 0, lessons: 0, answers: 0, correct: 0 };
    return { ...d, goal: user.daily_goal_xp, goalMet: d.xp >= user.daily_goal_xp };
  };
  function weekDays(user) {
    const today = todayFor(user), out = [];
    const rows = db.all('SELECT local_date, xp FROM user_days WHERE user_id = ? AND local_date >= ?', user.id, addDays(today, -6));
    const m = Object.fromEntries(rows.map((r) => [r.local_date, r.xp]));
    for (let i = 6; i >= 0; i--) { const d = addDays(today, -i); out.push({ date: d, xp: m[d] || 0 }); }
    return out;
  }

  /* ---------- achievements ---------- */
  function checkAchievements(userId) {
    const u = userById(userId);
    const have = new Set(db.all('SELECT code FROM user_achievements WHERE user_id = ?', userId).map((r) => r.code));
    const lessons = db.get('SELECT COUNT(*) n FROM user_progress WHERE user_id = ?', userId).n;
    const perfect = db.get("SELECT COUNT(*) n FROM lesson_attempts WHERE user_id = ? AND kind = 'lesson' AND status = 'completed' AND incorrect = 0", userId).n;
    const st = db.get('SELECT longest_streak FROM user_streaks WHERE user_id = ?', userId) || { longest_streak: 0 };
    const rev = db.get('SELECT COALESCE(SUM(correct),0) n FROM review_items WHERE user_id = ?', userId).n;
    const today = dayInfo(u);
    const checks = {
      first_lesson: lessons >= 1, lessons_10: lessons >= 10, lessons_25: lessons >= 25, perfect_lesson: perfect >= 1,
      streak_3: st.longest_streak >= 3, streak_7: st.longest_streak >= 7, streak_30: st.longest_streak >= 30,
      xp_100: u.xp_total >= 100, xp_500: u.xp_total >= 500, xp_2000: u.xp_total >= 2000,
      daily_goal: today.goalMet, first_review: rev >= 10, reviews_100: rev >= 100,
      level_complete: lessons > 0 && anyLevelComplete(u),
    };
    const earned = [];
    for (const a of ACHIEVEMENTS) {
      if (checks[a.code] && !have.has(a.code)) { db.run('INSERT OR IGNORE INTO user_achievements (user_id, code, earned_at) VALUES (?,?,?)', userId, a.code, now()); earned.push(a); }
    }
    return earned;
  }
  function anyLevelComplete(user) {
    const rows = db.all(`SELECT lv.id, COUNT(l.id) total, SUM(CASE WHEN p.lesson_id IS NOT NULL THEN 1 ELSE 0 END) done
      FROM levels lv JOIN courses c ON c.id = lv.course_id AND c.status = 'published'
      JOIN units un ON un.level_id = lv.id JOIN lessons l ON l.unit_id = un.id AND l.status = 'published'
      LEFT JOIN user_progress p ON p.lesson_id = l.id AND p.user_id = ?
      GROUP BY lv.id`, user.id);
    return rows.some((r) => r.total > 0 && r.done === r.total);
  }
  const achievementList = (userId) => {
    const got = Object.fromEntries(db.all('SELECT code, earned_at FROM user_achievements WHERE user_id = ?', userId).map((r) => [r.code, r.earned_at]));
    return ACHIEVEMENTS.map((a) => ({ ...a, earnedAt: got[a.code] || null }));
  };

  /* ---------- learning path ---------- */
  function courseFor(user, courseId) {
    const wanted = courseId || user.course_id;
    let c = wanted ? db.get("SELECT * FROM courses WHERE id = ? AND status = 'published'", wanted) : null;
    if (!c) c = db.get("SELECT * FROM courses WHERE status = 'published' ORDER BY (track = 'general') DESC, position, id LIMIT 1");
    return c || null;
  }
  /* Course -> levels -> units -> lessons with a state for every lesson: completed | available | locked.
     Rules: a level opens when the previous level has `unlock_threshold_pct` % of its lessons finished (or its rule is "open", or
     it is at/below the learner's chosen start level); inside a level a "sequential" lesson opens when the previous lesson is
     finished, an "open" lesson is always open, a "prerequisite" lesson opens when its chosen lesson is finished. */
  function buildPath(user, course) {
    const levels = db.all('SELECT * FROM levels WHERE course_id = ? ORDER BY position, id', course.id);
    const units = db.all('SELECT u.* FROM units u JOIN levels l ON l.id = u.level_id WHERE l.course_id = ? ORDER BY u.position, u.id', course.id);
    const lessons = db.all("SELECT l.*, u.level_id FROM lessons l JOIN units u ON u.id = l.unit_id JOIN levels lv ON lv.id = u.level_id WHERE lv.course_id = ? AND l.status = 'published' ORDER BY l.position, l.id", course.id);
    const prog = Object.fromEntries(db.all('SELECT * FROM user_progress WHERE user_id = ?', user.id).map((p) => [p.lesson_id, p]));
    const counts = Object.fromEntries(db.all("SELECT lesson_id, COUNT(*) n FROM exercises WHERE status = 'published' GROUP BY lesson_id").map((r) => [r.lesson_id, r.n]));
    const open = db.all("SELECT lesson_id FROM lesson_attempts WHERE user_id = ? AND status = 'in_progress' AND lesson_id IS NOT NULL", user.id).map((r) => r.lesson_id);
    const startPos = (levels.find((l) => l.code === user.start_level) || levels[0] || { position: 0 }).position;
    const out = { course: { id: course.id, slug: course.slug, title: course.title, description: course.description, track: course.track }, levels: [] };
    let prevLevel = null, order = [];
    for (const lv of levels) {
      const lvUnits = units.filter((u) => u.level_id === lv.id).map((u) => ({ ...u, lessons: lessons.filter((l) => l.unit_id === u.id) })).filter((u) => u.lessons.length);
      if (!lvUnits.length) continue;
      const flat = [].concat(...lvUnits.map((u) => u.lessons));
      const done = flat.filter((l) => prog[l.id]).length;
      let unlocked = lv.unlock_rule === 'open' || !prevLevel || lv.position <= startPos;
      if (!unlocked) unlocked = prevLevel.total === 0 || Math.round(100 * prevLevel.done / prevLevel.total) >= lv.unlock_threshold_pct;
      const lvOut = { id: lv.id, code: lv.code, title: lv.title, description: lv.description, unlocked, total: flat.length, done, pct: Math.round(100 * done / flat.length), threshold: lv.unlock_threshold_pct, units: [] };
      flat.forEach((l, i) => {
        let state = 'locked', reason = '';
        if (prog[l.id]) state = 'completed';
        else if (!unlocked) reason = `Finish ${lv.unlock_threshold_pct}% of the previous level to open ${lv.code}.`;
        else if (l.unlock_rule === 'open') state = 'available';
        else if (l.unlock_rule === 'prerequisite' && l.prerequisite_lesson_id) {
          if (prog[l.prerequisite_lesson_id]) state = 'available';
          else { const pre = db.get('SELECT title FROM lessons WHERE id = ?', l.prerequisite_lesson_id); reason = `Finish “${pre ? pre.title : 'the required lesson'}” first.`; }
        } else if (i === 0 || prog[flat[i - 1].id]) state = 'available';
        else reason = `Finish “${flat[i - 1].title}” first.`;
        l._state = state; l._reason = reason;
      });
      for (const u of lvUnits) {
        const uDone = u.lessons.filter((l) => prog[l.id]).length;
        lvOut.units.push({ id: u.id, title: u.title, description: u.description, total: u.lessons.length, done: uDone, lessons: u.lessons.map((l) => ({
          id: l.id, title: l.title, description: l.description, state: l._state, lockReason: l._reason, xp: l.xp_reward, exercises: counts[l.id] || 0,
          inProgress: open.includes(l.id), accuracy: prog[l.id] ? prog[l.id].best_accuracy : null, completions: prog[l.id] ? prog[l.id].completions : 0,
        })) });
        u.lessons.forEach((l) => order.push({ lesson: l, level: lvOut, unit: u }));
      }
      out.levels.push(lvOut);
      prevLevel = { total: flat.length, done };
    }
    // recommendation: the lesson in progress, else the first available unfinished lesson
    const states = out.levels.flatMap((lv) => lv.units.flatMap((u) => u.lessons.map((l) => ({ l, lv, u }))));
    const rec = states.find((x) => x.l.inProgress && x.l.state !== 'locked') || states.find((x) => x.l.state === 'available');
    out.recommended = rec ? { lessonId: rec.l.id, title: rec.l.title, unit: rec.u.title, unitId: rec.u.id, level: rec.lv.code, resume: rec.l.inProgress } : null;
    out.totals = { lessons: states.length, done: states.filter((x) => x.l.state === 'completed').length };
    return out;
  }
  function lessonAccess(user, lessonId) {
    const row = db.get("SELECT l.*, c.id course_id, c.status course_status FROM lessons l JOIN units u ON u.id = l.unit_id JOIN levels lv ON lv.id = u.level_id JOIN courses c ON c.id = lv.course_id WHERE l.id = ?", lessonId);
    if (!row || row.status !== 'published' || row.course_status !== 'published') return { ok: false, status: 404, message: 'Lesson not found.' };
    const path = buildPath(user, db.get('SELECT * FROM courses WHERE id = ?', row.course_id));
    const hit = path.levels.flatMap((lv) => lv.units.flatMap((u) => u.lessons)).find((l) => l.id === lessonId);
    if (!hit) return { ok: false, status: 404, message: 'Lesson not found.' };
    if (hit.state === 'locked') return { ok: false, status: 403, message: hit.lockReason || 'This lesson is locked.' };
    return { ok: true, lesson: row };
  }

  return { ACHIEVEMENTS, userById, todayFor, heartState, syncHearts, changeHearts, awardXp, bumpDay, markStreakDay, streakInfo, dayInfo, weekDays, checkAchievements, achievementList, courseFor, buildPath, lessonAccess, weekStart };
}

module.exports = { make, ACHIEVEMENTS };
