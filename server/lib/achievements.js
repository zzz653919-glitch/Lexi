/* Achievements and rewards. Every achievement is measured from real activity stored in the database (lessons, words, streaks, tests, levels ...);
   nothing is unlocked by a click or by a request from the browser. Unlocking happens on the server only: one row per (learner, achievement),
   created with INSERT OR IGNORE, so a reward can never be paid twice (the XP ledger and the token ledger refuse a repeated reference as well).
   Progress is stored per learner, so history survives a logout or a new device. */
const { now, addDays, int } = require('./util');

const CATEGORIES = ['learning', 'streak', 'performance', 'level', 'special', 'milestone'];
const RARITIES = ['common', 'rare', 'epic', 'legendary', 'mythic'];
const LANGS = ['uz', 'ru', 'en'];
/* the requirements an achievement can be built from */
const METRICS = ['lessons', 'words', 'grammar', 'ielts_lessons', 'streak', 'perfect_tests', 'quizzes', 'test_run', 'fast_lessons', 'accuracy', 'morning', 'evening',
  'comeback', 'topics', 'languages', 'xp', 'perfect_lessons', 'goal_days', 'review_correct', 'levels_done'];
const FAST = { seconds: 180, questions: 8, accuracy: 80 };      // Fast Learner: a lesson of at least 8 questions in under 3 minutes with 80% or better
const ACCURACY = { answers: 100, pct: 90 };                      // Consistency King: 90% or better over the last 100 first-try answers
const baseMetric = (m) => (String(m).startsWith('level:') ? 'level' : String(m));
const validMetric = (m) => METRICS.includes(m) || /^level:[A-Za-z0-9]{1,8}$/.test(String(m));

function make({ db, core, tokens }) {
  const one = async (sql, ...a) => ((await db.get(sql, ...a)) || {}).n || 0;
  const pick = (def, lang) => (def['title_' + lang] || def.title_en);

  /* ---------- the measurements ---------- */
  const completedWhere = `FROM lessons l JOIN units un ON un.id = l.unit_id JOIN levels lv ON lv.id = un.level_id JOIN courses c ON c.id = lv.course_id AND c.status = 'published'
    LEFT JOIN user_progress p ON p.lesson_id = l.id AND p.user_id = ? WHERE l.status = 'published'`;
  const METRIC = {
    lessons: (u) => one('SELECT COUNT(*) n FROM user_progress WHERE user_id = ?', u.id),
    words: (u) => one('SELECT COUNT(*) n FROM review_items WHERE user_id = ? AND correct >= 1', u.id),
    grammar: async (u) => {                       // every lesson that trains grammar; the goal follows the lessons that exist
      const r = await db.get(`SELECT COUNT(*) total, COALESCE(SUM(CASE WHEN p.lesson_id IS NOT NULL THEN 1 ELSE 0 END), 0) done ${completedWhere} AND l.kind = 'lesson'
        AND EXISTS (SELECT 1 FROM exercises e WHERE e.lesson_id = l.id AND e.module = 'grammar' AND e.status = 'published')`, u.id);
      return r.total ? { have: r.done, need: r.total } : { have: 0, need: 1 };
    },
    ielts_lessons: (u) => one(`SELECT COUNT(*) n ${completedWhere} AND lv.code = 'IELTS' AND p.lesson_id IS NOT NULL`, u.id),
    streak: async (u) => ((await db.get('SELECT longest_streak n FROM user_streaks WHERE user_id = ?', u.id)) || {}).n || 0,
    perfect_tests: (u) => one('SELECT COUNT(*) n FROM exam_results WHERE user_id = ? AND score_pct >= 100', u.id),
    quizzes: (u) => one('SELECT COUNT(*) n FROM exam_results WHERE user_id = ?', u.id),
    test_run: async (u) => { let best = 0, run = 0; for (const r of await db.all('SELECT passed FROM exam_results WHERE user_id = ? ORDER BY id', u.id)) { run = r.passed ? run + 1 : 0; best = Math.max(best, run); } return best; },
    fast_lessons: (u) => one(`SELECT COUNT(*) n FROM lesson_attempts WHERE user_id = ? AND kind = 'lesson' AND status = 'completed' AND completed_at IS NOT NULL AND total_planned >= ?
      AND (julianday(completed_at) - julianday(started_at)) * 86400 <= ? AND correct + incorrect > 0 AND correct * 100 >= ? * (correct + incorrect)`, u.id, FAST.questions, FAST.seconds, FAST.accuracy),
    accuracy: async (u) => {
      const rows = await db.all('SELECT is_correct FROM exercise_responses WHERE user_id = ? AND is_retry = 0 ORDER BY id DESC LIMIT ?', u.id, ACCURACY.answers);
      const ok = rows.reduce((a, r) => a + (r.is_correct ? 1 : 0), 0), enough = rows.length >= ACCURACY.answers, good = enough && ok * 100 >= ACCURACY.pct * rows.length;
      return { have: enough && !good ? ACCURACY.answers - 1 : rows.length, need: ACCURACY.answers, ok: good || !enough, note: { accuracy: rows.length ? Math.round(100 * ok / rows.length) : 0 } };
    },
    morning: (u) => one("SELECT COUNT(*) n FROM user_time_marks WHERE user_id = ? AND mark = 'morning'", u.id),
    evening: (u) => one("SELECT COUNT(*) n FROM user_time_marks WHERE user_id = ? AND mark = 'evening'", u.id),
    comeback: async (u) => {                      // the longest break between two days of study (days away, not counting the two study days)
      const d = (await db.all('SELECT local_date FROM user_days WHERE user_id = ? ORDER BY local_date', u.id)).map((r) => r.local_date);
      let away = 0; for (let i = 1; i < d.length; i++) away = Math.max(away, Math.round((Date.parse(d[i]) - Date.parse(d[i - 1])) / 86400000) - 1);
      return away;
    },
    topics: (u) => one('SELECT COUNT(DISTINCT l.unit_id) n FROM user_progress p JOIN lessons l ON l.id = p.lesson_id WHERE p.user_id = ?', u.id),
    languages: (u) => one('SELECT COUNT(*) n FROM user_ui_languages WHERE user_id = ?', u.id),
    xp: (u) => u.xp_total || 0,
    perfect_lessons: (u) => one("SELECT COUNT(*) n FROM lesson_attempts WHERE user_id = ? AND kind = 'lesson' AND status = 'completed' AND incorrect = 0", u.id),
    goal_days: (u) => one('SELECT COUNT(*) n FROM user_days WHERE user_id = ? AND xp >= ?', u.id, Math.max(1, u.daily_goal_xp || 1)),
    review_correct: (u) => one('SELECT COALESCE(SUM(correct), 0) n FROM review_items WHERE user_id = ?', u.id),
    levels_done: async (u) => (await db.all(`SELECT lv.id, COUNT(l.id) total, SUM(CASE WHEN p.lesson_id IS NOT NULL THEN 1 ELSE 0 END) done ${completedWhere} GROUP BY lv.id`, u.id)).filter((r) => r.total > 0 && r.done === r.total).length,
    level: async (u, code) => {
      const r = await db.get(`SELECT COUNT(*) total, COALESCE(SUM(CASE WHEN p.lesson_id IS NOT NULL THEN 1 ELSE 0 END), 0) done ${completedWhere} AND lv.code = ?`, u.id, code);
      return r.total ? { have: r.done, need: r.total } : { have: 0, need: 1 };
    },
  };
  async function measure(u, metric, memo) {
    if (memo.has(metric)) return memo.get(metric);
    const isLevel = metric.startsWith('level:'), fn = isLevel ? METRIC.level : METRIC[metric];
    const raw = fn ? await fn(u, isLevel ? metric.slice(6) : undefined) : 0;
    const r = typeof raw === 'number' ? { have: raw } : raw;
    memo.set(metric, r);
    return r;
  }

  /* ---------- what gets recorded while the learner studies ---------- */
  function hourOf(u) {
    try { return Number(new Intl.DateTimeFormat('en-GB', { timeZone: u.timezone || 'UTC', hour: 'numeric', hourCycle: 'h23' }).format(new Date())); }
    catch (_) { return new Date().getUTCHours(); }
  }
  async function markTime(u) {
    const h = hourOf(u), mark = h >= 5 && h < 11 ? 'morning' : h >= 20 || h < 4 ? 'evening' : null;
    if (mark) await db.run('INSERT OR IGNORE INTO user_time_marks (user_id, mark, local_date) VALUES (?,?,?)', u.id, mark, core.todayFor(u));
  }
  async function recordLanguage(userId, lang) {
    if (!LANGS.includes(lang)) return [];
    await db.run('INSERT OR IGNORE INTO user_ui_languages (user_id, lang, first_used_at) VALUES (?,?,?)', userId, lang, now());
    return evaluate(userId, { activity: false, only: ['languages'] });
  }

  /* ---------- cards ---------- */
  const itemCard = (it, lang) => (it ? { slug: it.slug, name: lang === 'uz' ? it.name_uz || it.name_en : lang === 'ru' ? it.name_ru || it.name_en : it.name_en, kind: it.kind, slot: it.slot, rarity: it.rarity, art: JSON.parse(it.art || '{}'), image: it.image_url || '' } : null);
  async function itemsBySlug(slugs) {
    const list = [...new Set(slugs.filter(Boolean))];
    if (!list.length) return new Map();
    return new Map((await db.all(`SELECT * FROM avatar_items WHERE slug IN (${list.map(() => '?').join(',')})`, ...list)).map((i) => [i.slug, i]));
  }
  const card = (def, lang, extra = {}) => ({ code: def.code, category: def.category, rarity: def.rarity, icon: def.icon, title: pick(def, lang), description: def['desc_' + lang] || def.desc_en, xp: def.xp, tokens: def.tokens, badge: !!def.badge, ...extra });

  /* ---------- unlocking ---------- */
  /* pays what the unlock row says (the amounts were fixed when it unlocked); every payment is idempotent, so a repeat or a retry after a crash never pays twice */
  async function settle(u, code) {
    const row = await db.get('SELECT * FROM user_achievements WHERE user_id = ? AND code = ?', u.id, code);
    if (!row || row.rewarded) return row;
    if (row.xp_awarded > 0) { const d = await db.get('SELECT rowid r FROM achievement_defs WHERE code = ?', code); if (d) await core.awardXp(u, row.xp_awarded, 'achievement', 'achievement', d.r); }
    if (row.tokens_awarded > 0) await tokens.earn(u.id, { ref: 'ach:' + code, amount: row.tokens_awarded, reason: 'achievement', meta: { code } });
    if (row.item_slug) await db.run("INSERT OR IGNORE INTO avatar_owned (user_id, item_id, source, price_paid, acquired_at) SELECT ?, id, 'reward', 0, ? FROM avatar_items WHERE slug = ?", u.id, now(), row.item_slug);
    await db.run('UPDATE user_achievements SET rewarded = 1 WHERE user_id = ? AND code = ?', u.id, code);
    return row;
  }
  async function unlock(u, def, need) {
    const r = await db.run('INSERT OR IGNORE INTO user_achievements (user_id, code, earned_at, xp_awarded, tokens_awarded, item_slug, seen, rewarded) VALUES (?,?,?,?,?,?,0,0)', u.id, def.code, now(), def.xp, def.tokens, def.item_slug || '');
    if (!r.changes) return null;                  // already unlocked (another request got there first)
    await db.run('INSERT INTO user_achievement_progress (user_id, code, progress, target, updated_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id, code) DO UPDATE SET progress = excluded.progress, target = excluded.target, updated_at = excluded.updated_at', u.id, def.code, need, need, now());
    await settle(u, def.code);
    return def;
  }

  /* looks at every active achievement the learner has not unlocked yet and unlocks the ones whose requirement is met by the stored activity.
     `only` limits the work to some measurements (a vocabulary answer does not need the level checks). Returns the cards of what was just unlocked. */
  async function evaluate(userId, { activity = true, only = null } = {}) {
    const u = await core.userById(userId);
    if (!u) return [];
    if (activity) await markTime(u);
    const lang = LANGS.includes(u.ui_language) ? u.ui_language : 'en';
    const [defs, have, prog] = await Promise.all([db.all("SELECT * FROM achievement_defs WHERE status = 'active' ORDER BY position, code"), db.all('SELECT code, rewarded FROM user_achievements WHERE user_id = ?', userId), db.all('SELECT code, progress, target FROM user_achievement_progress WHERE user_id = ?', userId)]);
    const got = new Map(have.map((r) => [r.code, r])), seen = new Map(prog.map((r) => [r.code, r])), memo = new Map(), won = [], writes = [];
    for (const def of defs) {
      if (got.has(def.code)) { if (!got.get(def.code).rewarded) await settle(u, def.code); continue; }   // finish a payment that was interrupted
      if (only && !only.includes(baseMetric(def.metric))) continue;
      const m = await measure(u, def.metric, memo), need = Math.max(1, m.need || def.target), progress = Math.max(0, Math.min(need, int(m.have, 0)));
      const was = seen.get(def.code);
      if (!was || was.progress !== progress || was.target !== need) writes.push({ sql: 'INSERT INTO user_achievement_progress (user_id, code, progress, target, updated_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id, code) DO UPDATE SET progress = excluded.progress, target = excluded.target, updated_at = excluded.updated_at', args: [userId, def.code, progress, need, now()] });
      if (int(m.have, 0) >= need && m.ok !== false) { const d = await unlock(u, def, need); if (d) won.push(d); }
    }
    for (const w of writes) await db.run(w.sql, ...w.args);   // not db.batch: this also runs inside the lesson's transaction
    const items = await itemsBySlug(won.map((d) => d.item_slug));
    return won.map((d) => card(d, lang, { item: itemCard(items.get(d.item_slug), lang), earnedAt: now() }));
  }

  /* ---------- reading ---------- */
  async function list(userId, lang, { refresh = true } = {}) {
    if (refresh) await evaluate(userId, { activity: false });
    const [defs, got, prog] = await Promise.all([db.all('SELECT * FROM achievement_defs ORDER BY position, code'), db.all('SELECT * FROM user_achievements WHERE user_id = ?', userId), db.all('SELECT code, progress, target FROM user_achievement_progress WHERE user_id = ?', userId)]);
    const earned = new Map(got.map((r) => [r.code, r])), pg = new Map(prog.map((r) => [r.code, r]));
    const visible = defs.filter((d) => d.status === 'active' || earned.has(d.code));
    const items = await itemsBySlug(visible.map((d) => d.item_slug));
    const out = visible.map((d) => {
      const e = earned.get(d.code), p = pg.get(d.code), target = e ? (p ? p.target : d.target) : (p ? p.target : d.target), progress = e ? target : p ? p.progress : 0;
      return card(d, lang, { target, progress, percent: Math.min(100, Math.round(100 * progress / target)), unlocked: !!e, earnedAt: e ? e.earned_at : null, earnedXp: e ? e.xp_awarded : 0, earnedTokens: e ? e.tokens_awarded : 0,
        item: itemCard(items.get(d.item_slug), lang), hidden: d.status !== 'active' });
    });
    const unlocked = out.filter((a) => a.unlocked);
    const by = (key, values) => Object.fromEntries(values.map((v) => [v, { total: out.filter((a) => a[key] === v).length, unlocked: unlocked.filter((a) => a[key] === v).length }]));
    return { items: out, summary: { total: out.length, unlocked: unlocked.length, percent: out.length ? Math.round(100 * unlocked.length / out.length) : 0, xp: unlocked.reduce((a, x) => a + x.earnedXp, 0), tokens: unlocked.reduce((a, x) => a + x.earnedTokens, 0), rarity: by('rarity', RARITIES), category: by('category', CATEGORIES) } };
  }
  const rank = (r) => RARITIES.indexOf(r);
  /* the badges on a profile: the rarest unlocked achievements first */
  let defCount = { n: 0, at: 0 };   // the number of active achievements changes rarely: one lookup a minute is enough
  async function featured(userId, lang, limit = 6) {
    const [rows, total] = await Promise.all([db.all('SELECT d.*, a.earned_at FROM user_achievements a JOIN achievement_defs d ON d.code = a.code WHERE a.user_id = ?', userId),
      Date.now() - defCount.at < 60000 ? defCount.n : db.get("SELECT COUNT(*) n FROM achievement_defs WHERE status = 'active'").then((r) => { defCount = { n: r.n, at: Date.now() }; return r.n; })]);
    const shown = rows.filter((d) => d.badge === 1).sort((a, b) => rank(b.rarity) - rank(a.rarity) || (a.earned_at < b.earned_at ? 1 : -1));
    return { unlocked: rows.length, total, badges: shown.slice(0, limit).map((d) => card(d, lang, { earnedAt: d.earned_at })) };
  }
  /* what was unlocked and not celebrated yet. Before answering, it catches up on achievements the stored activity already satisfies (an achievement an
     administrator added later, a level that was completed elsewhere): at most once every 5 minutes per learner on this server instance. */
  const caughtUp = new Map();
  async function unseen(userId, lang, { catchUp = false } = {}) {
    if (catchUp && Date.now() - (caughtUp.get(userId) || 0) > 300000) { caughtUp.set(userId, Date.now()); if (caughtUp.size > 5000) caughtUp.clear(); await evaluate(userId, { activity: false }); }
    const rows = await db.all('SELECT d.*, a.earned_at, a.xp_awarded, a.tokens_awarded, a.item_slug earned_item FROM user_achievements a JOIN achievement_defs d ON d.code = a.code WHERE a.user_id = ? AND a.seen = 0 ORDER BY a.earned_at LIMIT 30', userId);
    const items = await itemsBySlug(rows.map((d) => d.earned_item));
    return rows.map((d) => card(d, lang, { xp: d.xp_awarded, tokens: d.tokens_awarded, item: itemCard(items.get(d.earned_item), lang), earnedAt: d.earned_at }));
  }
  const markSeen = (userId, codes) => (codes && codes.length
    ? db.run(`UPDATE user_achievements SET seen = 1 WHERE user_id = ? AND seen = 0 AND code IN (${codes.map(() => '?').join(',')})`, userId, ...codes)
    : db.run('UPDATE user_achievements SET seen = 1 WHERE user_id = ? AND seen = 0', userId));
  /* the short list other parts of the app use (dashboard, admin user view) */
  async function earnedBrief(userId, lang) {
    const rows = await db.all('SELECT d.*, a.earned_at FROM user_achievements a JOIN achievement_defs d ON d.code = a.code WHERE a.user_id = ? ORDER BY a.earned_at DESC', userId);
    return rows.map((d) => card(d, lang, { earnedAt: d.earned_at }));
  }
  const install = (c) => { c.checkAchievements = (userId, opts) => evaluate(userId, opts); c.achievementList = (userId, lang) => earnedBrief(userId, lang || 'en'); };

  return { evaluate, list, featured, unseen, markSeen, earnedBrief, recordLanguage, install, itemCard, itemsBySlug, validMetric, CATEGORIES, RARITIES, METRICS, FAST, ACCURACY };
}
module.exports = { make, CATEGORIES, RARITIES, METRICS, validMetric, baseMetric, LANGS };
