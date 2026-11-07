/* Avatar Studio, the shop and the rules that connect them to learning: starter items, validation of looks and outfits, purchases,
   earned items (pets for achievements), LEXIO TOKENS for lessons, topics, tests, levels, streaks and daily missions, badges. */
const A = require('./avatar-spec');
const { now, int, clean, HttpError, bad, localDate, addDays } = require('./util');

const MISSIONS = [['lessons', 2], ['words', 10], ['vocab_test', 1], ['listening', 5], ['speaking', 1], ['streak', 2]];   // [code, needed]
const TESTS = ['topic_test', 'exam', 'practice_test'];

function make({ db, settings, tokens }) {
  const S = () => settings.all();
  const dayOf = (user) => localDate(new Date(), user.timezone);

  /* ---------- items and ownership ---------- */
  async function ensureStarter(userId) {
    await db.run("INSERT OR IGNORE INTO avatar_owned (user_id, item_id, source, price_paid, acquired_at) SELECT ?, id, 'starter', 0, ? FROM avatar_items WHERE starter = 1", userId, now());
  }
  const ownedRows = (userId) => db.all('SELECT i.*, o.source, o.acquired_at FROM avatar_owned o JOIN avatar_items i ON i.id = o.item_id WHERE o.user_id = ?', userId);

  /* ---------- looks and outfits ---------- */
  function cleanLook(input) {
    const out = { ...A.DEFAULT_LOOK };
    for (const k of Object.keys(A.LOOK)) { if (input && input[k] !== undefined) { const n = int(input[k], -1); if (n < 0 || n >= A.LOOK[k]) throw bad('err.fix_fields', { look: 'val.avatar_look' }); out[k] = n; } }
    return out;
  }
  /* equipped: { slot: slug }; every item must exist, fit the slot and belong to the user */
  async function cleanEquipped(userId, input) {
    const out = {};
    if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
    const owned = new Map((await ownedRows(userId)).map((r) => [r.slug, r]));
    for (const [slot, slug] of Object.entries(input)) {
      if (!slug) continue;
      if (!A.SLOTS.includes(slot)) throw bad('err.fix_fields', { equipped: 'val.avatar_slot' });
      const it = owned.get(String(slug));
      if (!it || it.slot !== slot) throw bad('err.fix_fields', { equipped: 'val.avatar_not_owned' });
      out[slot] = it.slug;
    }
    return out;
  }
  const cleanName = (v) => { const n = clean(v, 24); if (n.length < 1) throw bad('err.fix_fields', { name: 'val.avatar_name' }); return n; };
  const tidyLook = (l) => { for (const k of Object.keys(A.LOOK)) if (!(l[k] >= 0 && l[k] < A.LOOK[k])) l[k] = k === 'hairStyle' ? 1 : (A.DEFAULT_LOOK[k] || 0); return l; };
  const shape = (a) => ({ id: a.id, name: a.name, style: A.STYLES.includes(a.style) ? a.style : 'cartoon', look: tidyLook(JSON.parse(a.look || '{}')), equipped: JSON.parse(a.equipped || '{}'), petName: a.pet_name, petPose: a.pet_pose, favorite: !!a.favorite, updatedAt: a.updated_at });

  /* ---------- what the learner has done (for earned items) ---------- */
  async function playerStats(user) {
    const [lessons, streak, levels, words, tok, missions] = await Promise.all([
      db.get('SELECT COUNT(*) n FROM user_progress WHERE user_id = ?', user.id), db.get('SELECT longest_streak FROM user_streaks WHERE user_id = ?', user.id),
      db.get(`SELECT COUNT(*) n FROM levels lv WHERE (SELECT COUNT(*) FROM lessons l JOIN units u ON u.id = l.unit_id WHERE u.level_id = lv.id AND l.status = 'published') > 0
        AND (SELECT COUNT(*) FROM lessons l JOIN units u ON u.id = l.unit_id WHERE u.level_id = lv.id AND l.status = 'published') = (SELECT COUNT(*) FROM lessons l JOIN units u ON u.id = l.unit_id JOIN user_progress p ON p.lesson_id = l.id AND p.user_id = ? WHERE u.level_id = lv.id AND l.status = 'published')`, user.id),
      db.get('SELECT COUNT(*) n FROM review_items WHERE user_id = ?', user.id), tokens.wallet(user.id), db.get("SELECT COUNT(*) n FROM token_transactions WHERE user_id = ? AND reason = 'mission'", user.id)]);
    return { lessons: lessons.n, streak: streak ? streak.longest_streak : 0, xp: user.xp_total, levels: levels.n, words: words.n, tokens: tok.earned, missions: missions.n };
  }
  const RULE_FIELD = { lessons: 'lessons', streak: 'streak', xp: 'xp', levels: 'levels', words: 'words', tokens: 'tokens', missions: 'missions' };
  function parseRule(rule) { const [type, v] = String(rule || '').split(':'); return A.EARN_TYPES.includes(type) && int(v, 0) > 0 ? { type, need: int(v, 0) } : null; }
  const progressOf = (rule, st) => { const r = parseRule(rule); return r ? { type: r.type, need: r.need, have: Math.min(st[RULE_FIELD[r.type]] || 0, r.need), done: (st[RULE_FIELD[r.type]] || 0) >= r.need } : null; };

  /* items earned by learning (pets for achievements and so on) are given as soon as the rule is met */
  async function grantEarned(user, st) {
    const rules = await db.all("SELECT i.* FROM avatar_items i WHERE i.earn_rule != '' AND NOT EXISTS (SELECT 1 FROM avatar_owned o WHERE o.user_id = ? AND o.item_id = i.id)", user.id);
    if (!rules.length) return [];
    st = st || await playerStats(user);
    const got = rules.filter((i) => progressOf(i.earn_rule, st) && progressOf(i.earn_rule, st).done);
    if (got.length) await db.batch(got.map((i) => ({ sql: "INSERT OR IGNORE INTO avatar_owned (user_id, item_id, source, price_paid, acquired_at) VALUES (?,?,'reward',0,?)", args: [user.id, i.id, now()] })));
    return got;
  }

  /* ---------- badges ---------- */
  async function syncBadges(user) {
    const [have, owned, avatars, eq, wal, miss] = await Promise.all([db.all('SELECT code FROM avatar_badges WHERE user_id = ?', user.id), ownedRows(user.id), db.get('SELECT COUNT(*) n FROM avatars WHERE user_id = ?', user.id),
      db.get("SELECT COUNT(*) n FROM avatars WHERE user_id = ? AND equipped LIKE '%\"pet\"%'", user.id), tokens.wallet(user.id), db.get("SELECT COUNT(*) n FROM token_transactions WHERE user_id = ? AND reason = 'mission'", user.id)]);
    const has = new Set(have.map((b) => b.code)), bought = owned.filter((o) => o.source === 'shop').length, rank = (r) => A.RARITIES.indexOf(r);
    const want = { first_purchase: bought >= 1, collector_5: owned.length >= 5, collector_10: owned.length >= 10, collector_25: owned.length >= 25, rare_find: owned.some((o) => rank(o.rarity) >= 2), legendary: owned.some((o) => o.rarity === 'legendary'),
      pet_friend: eq.n > 0, stylist: avatars.n >= 3, first_mission: miss.n >= 1, tokens_100: wal.earned >= 100, tokens_500: wal.earned >= 500, tokens_1000: wal.earned >= 1000 };
    const fresh = Object.keys(want).filter((k) => want[k] && !has.has(k));
    if (fresh.length) await db.batch(fresh.map((k) => ({ sql: 'INSERT OR IGNORE INTO avatar_badges (user_id, code, earned_at) VALUES (?,?,?)', args: [user.id, k, now()] })));
    return fresh;
  }
  const BADGE_CODES = ['first_purchase', 'collector_5', 'collector_10', 'collector_25', 'rare_find', 'legendary', 'pet_friend', 'stylist', 'first_mission', 'mission_master', 'tokens_100', 'tokens_500', 'tokens_1000'];

  /* ---------- daily missions (connected to the English-learning system) ---------- */
  async function missionProgress(user) {
    const today = dayOf(user);
    const since = new Date(Date.now() - 40 * 3600000).toISOString();
    const [dayRow, streak, resp, tests, kids] = await Promise.all([
      db.get('SELECT lessons, review_correct FROM user_days WHERE user_id = ? AND local_date = ?', user.id, today), db.get('SELECT current_streak, last_active_date FROM user_streaks WHERE user_id = ?', user.id),
      db.all('SELECT r.created_at, r.is_correct, r.is_retry, e.type, e.module, e.vocabulary_id FROM exercise_responses r JOIN exercises e ON e.id = r.exercise_id WHERE r.user_id = ? AND r.created_at >= ?', user.id, since),
      db.all('SELECT created_at, passed FROM exam_results WHERE user_id = ? AND passed = 1 AND created_at >= ?', user.id, since), db.get('SELECT speaks FROM kids_days WHERE user_id = ? AND local_date = ?', user.id, today)]);
    const isToday = (iso) => localDate(new Date(iso), user.timezone) === today;
    const mine = resp.filter((r) => isToday(r.created_at));
    const words = new Set(mine.filter((r) => r.is_correct && !r.is_retry && r.vocabulary_id).map((r) => r.vocabulary_id)).size;
    const listening = mine.filter((r) => r.is_correct && (String(r.type).startsWith('listen') || r.module === 'listening')).length;
    const speaking = mine.filter((r) => r.type === 'speaking').length + (kids ? kids.speaks : 0);
    const vocabTests = tests.filter((r) => isToday(r.created_at)).length + (dayRow && dayRow.review_correct >= 10 ? 1 : 0);
    const streakNow = streak && streak.last_active_date === today ? streak.current_streak : 0;
    const have = { lessons: dayRow ? dayRow.lessons : 0, words, vocab_test: vocabTests, listening, speaking, streak: streakNow };
    return { today, list: MISSIONS.map(([code, need]) => ({ code, need, have: Math.min(have[code], need), done: have[code] >= need })) };
  }
  /* pays the token for every finished mission once per day (the ref carries the date and the mission) */
  async function syncMissions(user) {
    const p = await missionProgress(user), amount = S().token_mission;
    const paid = [];
    for (const m of p.list) if (m.done) { const r = await tokens.earn(user.id, { ref: `mission:${p.today}:${m.code}`, amount, reason: 'mission', meta: { code: m.code } }); if (r.paid) paid.push(m.code); }
    const rows = new Set((await db.all("SELECT ref FROM token_transactions WHERE user_id = ? AND ref LIKE ?", user.id, `mission:${p.today}:%`)).map((r) => r.ref));
    if (p.list.every((m) => m.done)) await db.run("INSERT OR IGNORE INTO avatar_badges (user_id, code, earned_at) VALUES (?, 'mission_master', ?)", user.id, now());
    return { today: p.today, tokens: amount, missions: p.list.map((m) => ({ ...m, claimed: m.done && (rows.has(`mission:${p.today}:${m.code}`) || amount === 0) })), paid };
  }

  /* ---------- learning events ---------- */
  /* called when a lesson / test attempt is finished: rewards only after a real completion, each once */
  async function onLearning(user, { lessonId, kind, attemptKind, passed } = {}) {
    const s = S();
    if (lessonId) {
      const test = TESTS.includes(kind);
      if (test ? passed : attemptKind === 'lesson') await tokens.earn(user.id, { ref: `${test ? 'test' : 'lesson'}:${lessonId}`, amount: test ? s.token_test : s.token_lesson, reason: test ? 'test' : 'lesson', meta: { lessonId } });
      if (test ? passed : attemptKind === 'lesson') {
        const u = await db.get(`SELECT u.id unit_id, u.level_id,
          (SELECT COUNT(*) FROM lessons x WHERE x.unit_id = u.id AND x.status = 'published') ut, (SELECT COUNT(*) FROM lessons x JOIN user_progress p ON p.lesson_id = x.id AND p.user_id = ? WHERE x.unit_id = u.id AND x.status = 'published') ud,
          (SELECT COUNT(*) FROM lessons x JOIN units y ON y.id = x.unit_id WHERE y.level_id = u.level_id AND x.status = 'published') lt, (SELECT COUNT(*) FROM lessons x JOIN units y ON y.id = x.unit_id JOIN user_progress p ON p.lesson_id = x.id AND p.user_id = ? WHERE y.level_id = u.level_id AND x.status = 'published') ld
          FROM lessons l JOIN units u ON u.id = l.unit_id WHERE l.id = ?`, user.id, user.id, lessonId);
        if (u && u.ut > 0 && u.ud >= u.ut) await tokens.earn(user.id, { ref: `topic:${u.unit_id}`, amount: s.token_topic, reason: 'topic', meta: { unitId: u.unit_id } });
        if (u && u.lt > 0 && u.ld >= u.lt) await tokens.earn(user.id, { ref: `level:${u.level_id}`, amount: s.token_level, reason: 'level', meta: { levelId: u.level_id } });
      }
    }
    const st = await db.get('SELECT current_streak, last_active_date FROM user_streaks WHERE user_id = ?', user.id);
    if (st && st.current_streak > 0 && st.current_streak % 7 === 0 && st.last_active_date) {
      const start = addDays(st.last_active_date, -(st.current_streak - 1));
      await tokens.earn(user.id, { ref: `streak:${st.current_streak}:${start}`, amount: s.token_streak7, reason: 'streak', meta: { days: st.current_streak } });
    }
    return touch(user);
  }
  /* missions, earned items and badges after any learning activity */
  async function touch(user) {
    await syncMissions(user);
    const st = await playerStats(user);
    await grantEarned(user, st); await syncBadges(user);
    return { balance: (await tokens.wallet(user.id)).balance };
  }

  /* the chips of every page call this: missions finished by other activities are paid soon, but never more than once every 45 seconds per account */
  const lastSync = new Map();
  async function maybeSync(user) {
    const t = Date.now();
    if (t - (lastSync.get(user.id) || 0) < 45000) return null;
    lastSync.set(user.id, t);
    if (lastSync.size > 5000) lastSync.clear();
    return touch(user);
  }

  /* ---------- the shop ---------- */
  async function buy(user, slug) {
    const item = await db.get('SELECT * FROM avatar_items WHERE slug = ?', String(slug));
    if (!item || item.status !== 'active') throw new HttpError(404, 'err.item_not_found');
    if (item.earn_rule || item.starter) throw bad('err.item_not_for_sale');
    const result = await db.tx(async () => {
      if (await db.get('SELECT 1 x FROM avatar_owned WHERE user_id = ? AND item_id = ?', user.id, item.id)) throw new HttpError(409, 'err.item_owned');
      const r = await tokens.spend(user.id, { ref: `buy:${item.id}`, amount: item.price, meta: { slug: item.slug, name: item.name_en } });
      if (!r.ok) { if (r.error === 'insufficient') throw bad('err.tokens_insufficient'); throw new HttpError(409, 'err.item_owned'); }
      await db.run("INSERT INTO avatar_owned (user_id, item_id, source, price_paid, acquired_at) VALUES (?,?,'shop',?,?)", user.id, item.id, item.price, now());
      return r;
    });
    await syncBadges(user);
    return { balance: result.balance, slug: item.slug };
  }

  return { ensureStarter, ownedRows, cleanLook, cleanEquipped, cleanName, shape, playerStats, progressOf, parseRule, grantEarned, syncBadges, BADGE_CODES, missionProgress, syncMissions, onLearning, touch, maybeSync, buy, MISSIONS };
}
module.exports = { make, MISSIONS };
