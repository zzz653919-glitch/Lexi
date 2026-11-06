/* LEXIO KIDS, part 2: what a child can earn (stickers, animals, accessories, backgrounds, characters, places), the daily missions, and the
   figures behind the child's progress page and the parent dashboard.  Rewards are only ever EARNED by learning: there is nothing to buy. */
const crypto = require('node:crypto');
const K = require('./kids');
const { STORIES } = require('../seed/kids/stories');
const { now, localDate, addDays } = require('./util');

const GAMES = [
  { code: 'catcher', emoji: '🧺', color: '#ff8a1f', quiz: true }, { code: 'match', emoji: '🧩', color: '#35a7ff' }, { code: 'bubbles', emoji: '🫧', color: '#4cc9f0', quiz: true },
  { code: 'memory', emoji: '🃏', color: '#9b5de5' }, { code: 'sounds', emoji: '🔊', color: '#2ec27e', quiz: true }, { code: 'colorhunt', emoji: '🔍', color: '#ff6fb5' },
  { code: 'builder', emoji: '🔤', color: '#ffb703' }, { code: 'puzzle', emoji: '🧠', color: '#ef476f', quiz: true },
];
const CHARACTERS = [['lion', 0], ['fox', 0], ['bunny', 0], ['cat', 6], ['dino', 15], ['robot', 30]];
const ACCESSORIES = [['hat', '🎩', { type: 'stars', n: 5 }], ['glasses', '🕶️', { type: 'stars', n: 10 }], ['bow', '🎀', { type: 'lessons', n: 3 }], ['scarf', '🧣', { type: 'streak', n: 3 }], ['headphones', '🎧', { type: 'games', n: 3 }], ['crown', '👑', { type: 'stars', n: 40 }]];
const BACKGROUNDS = [['sky', '☁️', { type: 'free' }], ['meadow', '🌿', { type: 'stars', n: 8 }], ['space', '🌌', { type: 'stars', n: 25 }], ['sea', '🌊', { type: 'stars', n: 45 }], ['candy', '🍭', { type: 'stories', n: 3 }], ['forest', '🌲', { type: 'stars', n: 70 }]];
const PLACES = [['house', '🏠', 0], ['garden', '🌻', 5], ['zoo', '🦁', 15], ['playground', '🎠', 30], ['space', '🚀', 50], ['forest', '🍄', 75]];
/* decorations grow each place: [place, emoji, stars needed, left %, top %] */
const DECOR = [
  ['house', '🌷', 2, 18, 74], ['house', '🖼️', 4, 52, 28], ['house', '🛋️', 6, 76, 72],
  ['garden', '🌷', 7, 20, 72], ['garden', '🦋', 10, 62, 30], ['garden', '⛲', 13, 76, 68],
  ['zoo', '🌴', 17, 14, 60], ['zoo', '🎪', 21, 78, 52], ['zoo', '🍌', 25, 48, 78],
  ['playground', '⚽', 32, 22, 76], ['playground', '🎈', 36, 66, 26], ['playground', '🚲', 40, 78, 72],
  ['space', '🛰️', 52, 24, 28], ['space', '🪐', 58, 72, 30], ['space', '👽', 64, 50, 74],
  ['forest', '🍄', 77, 22, 76], ['forest', '🦄', 83, 60, 52], ['forest', '🧚', 90, 76, 26],
];
const MISSIONS = [['words', 'newwords', 5], ['lesson', 'lessons', 1], ['game', 'games', 1], ['listen', 'listens', 3], ['quiz', 'quizzes', 1]];
const LIMITS = { events: 60, seconds: 1800 };

const split = K.split;
const activeSql = '(lessons + games + quizzes + speaks + arts) > 0 OR seconds > 0';

async function ensureProfile(db, userId) {
  await db.run('INSERT OR IGNORE INTO kids_profile (user_id, updated_at) VALUES (?, ?)', userId, now());
  return db.get('SELECT * FROM kids_profile WHERE user_id = ?', userId);
}
/* adds to today's counters (whitelisted columns only) */
async function bump(db, user, add) {
  const cols = Object.keys(add).filter((c) => ['lessons', 'stars', 'games', 'listens', 'quizzes', 'newwords', 'speaks', 'arts', 'seconds'].includes(c) && add[c]);
  const today = localDate(new Date(), user.timezone);
  await db.run('INSERT OR IGNORE INTO kids_days (user_id, local_date) VALUES (?, ?)', user.id, today);
  if (cols.length) await db.run(`UPDATE kids_days SET ${cols.map((c) => `${c} = ${c} + ?`).join(', ')} WHERE user_id = ? AND local_date = ?`, ...cols.map((c) => Math.max(0, Math.floor(add[c]))), user.id, today);
  return today;
}
/* learning words: the child knows a word once it has been through a finished lesson or answered right in a game */
async function learn(db, userId, wordIds) {
  const ids = [...new Set((wordIds || []).map(Number).filter((x) => Number.isInteger(x) && x > 0))].slice(0, 200);
  if (!ids.length) return 0;
  const t = now();
  const r = await db.run(`INSERT OR IGNORE INTO kids_known (user_id, word_id, first_at) SELECT ?, id, ? FROM kids_words WHERE id IN (${ids.map(() => '?').join(',')})`, userId, t, ...ids);
  return r.changes || 0;
}

/* everything the reward rules look at */
async function stats(db, user) {
  const cats = await db.all("SELECT c.*, (SELECT COUNT(*) FROM kids_words w WHERE w.category_id = c.id AND w.status = 'published') n FROM kids_categories c WHERE c.status = 'published' ORDER BY c.position, c.id");
  const prog = await db.all('SELECT * FROM kids_progress WHERE user_id = ?', user.id);
  const catsDone = new Set(); let lessonStars = 0, lessons = 0, partsTotal = 0;
  for (const c of cats.filter((x) => x.n)) {
    const sp = split(c.n); partsTotal += sp.parts;
    const mine = prog.filter((p) => p.category_id === c.id && p.part <= sp.parts);
    lessonStars += mine.reduce((a, p) => a + p.stars, 0); lessons += mine.filter((p) => p.stars > 0).length;
    if (mine.filter((p) => p.stars > 0).length === sp.parts) catsDone.add(c.slug);
  }
  const g = await db.all('SELECT * FROM kids_games WHERE user_id = ?', user.id);
  const st = await db.all('SELECT * FROM kids_story_progress WHERE user_id = ?', user.id);
  const days = await db.all('SELECT * FROM kids_days WHERE user_id = ?', user.id);
  const known = await db.all('SELECT w.id, w.en, c.slug FROM kids_known k JOIN kids_words w ON w.id = k.word_id JOIN kids_categories c ON c.id = w.category_id WHERE k.user_id = ?', user.id);
  const active = new Map(days.filter((d) => d.lessons + d.games + d.quizzes + d.speaks + d.arts > 0 || d.seconds > 0).map((d) => [d.local_date, d]));
  let day = localDate(new Date(), user.timezone); if (!active.has(day)) day = addDays(day, -1);
  let streak = 0; while (active.has(day)) { streak++; day = addDays(day, -1); }
  const gameStars = g.reduce((a, x) => a + x.stars, 0), storyStars = st.reduce((a, x) => a + x.stars, 0);
  return { cats, partsTotal, catsDone, lessonStars, lessons, games: new Set(g.filter((x) => x.plays > 0).map((x) => x.game)), gameStars, stories: new Set(st.filter((x) => x.reads > 0).map((x) => x.slug)), storyStars,
    stars: lessonStars + gameStars + storyStars, maxStars: partsTotal * 3 + GAMES.length * 3 + STORIES.length * 3, wordsKnown: known.length, knownByCat: known, streak,
    missionsDays: days.filter((d) => d.bonus).length, speaks: days.reduce((a, d) => a + d.speaks, 0), arts: days.reduce((a, d) => a + d.arts, 0), days };
}

/* the catalogue of rewards; `test` decides from the child's stats whether it is earned */
async function catalogue(db, lang) {
  const cats = (await db.all("SELECT * FROM kids_categories WHERE status = 'published' ORDER BY position, id"));
  const animals = await db.all("SELECT w.en, w.pic, w.image_url FROM kids_words w JOIN kids_categories c ON c.id = w.category_id WHERE c.slug = 'animals' AND w.status = 'published' ORDER BY w.position, w.id");
  const L = [];
  const add = (kind, code, emoji, need, test, extra = {}) => L.push({ kind, code, emoji, need, test, ...extra });
  for (const c of cats) add('sticker', 'cat_' + c.slug, c.emoji, { type: 'category', name: K.pickTitle(c, lang) }, (s) => s.catsDone.has(c.slug), { name: K.pickTitle(c, lang) });
  for (const g of GAMES) add('sticker', 'game_' + g.code, g.emoji, { type: 'game', code: g.code }, (s) => s.games.has(g.code));
  for (const st of STORIES) add('sticker', 'story_' + st.slug, st.emoji, { type: 'story', code: st.slug }, (s) => s.stories.has(st.slug));
  add('sticker', 'star_10', '⭐', { type: 'stars', n: 10 }, (s) => s.stars >= 10); add('sticker', 'star_30', '🌠', { type: 'stars', n: 30 }, (s) => s.stars >= 30); add('sticker', 'star_60', '💫', { type: 'stars', n: 60 }, (s) => s.stars >= 60);
  add('sticker', 'missions', '🎯', { type: 'missions' }, (s) => s.missionsDays >= 1); add('sticker', 'speaker', '🎤', { type: 'speak' }, (s) => s.speaks >= 1); add('sticker', 'artist', '🖍️', { type: 'art' }, (s) => s.arts >= 1);
  add('sticker', 'streak3', '🔥', { type: 'streak', n: 3 }, (s) => s.streak >= 3); add('sticker', 'streak7', '🌈', { type: 'streak', n: 7 }, (s) => s.streak >= 7);
  for (const a of animals) add('animal', a.en.toLowerCase().replace(/[^a-z]+/g, '-'), a.pic || '🐾', { type: 'word', word: a.en }, (s) => s.knownByCat.some((k) => k.slug === 'animals' && k.en === a.en), { name: a.en, image: a.image_url });
  const needTest = (n) => (n.type === 'free' ? () => true : n.type === 'stars' ? (s) => s.stars >= n.n : n.type === 'lessons' ? (s) => s.lessons >= n.n : n.type === 'streak' ? (s) => s.streak >= n.n : n.type === 'games' ? (s) => s.games.size >= n.n : (s) => s.stories.size >= n.n);
  for (const [c, emoji, n] of ACCESSORIES) add('accessory', c, emoji, n, needTest(n));
  for (const [c, emoji, n] of BACKGROUNDS) add('background', c, emoji, n, needTest(n));
  for (const [c, n] of CHARACTERS) add('character', c, '', n ? { type: 'stars', n } : { type: 'free' }, n ? (s) => s.stars >= n : () => true);
  for (const [c, emoji, n] of PLACES) add('place', c, emoji, n ? { type: 'stars', n } : { type: 'free' }, (s) => s.stars >= n);
  for (const [p, emoji, n, x, y] of DECOR) add('decor', `${p}_${n}`, emoji, { type: 'stars', n }, (s) => s.stars >= n, { place: p, x, y });
  return L;
}
/* earned rewards are remembered: a reward that was earned stays, even if the content changes later */
async function sync(db, user, lang) {
  const [cat, s] = [await catalogue(db, lang), null];
  const st = s || await stats(db, user);
  const have = new Set((await db.all('SELECT kind, code FROM kids_rewards WHERE user_id = ?', user.id)).map((r) => r.kind + ':' + r.code));
  const t = now(), fresh = [];
  for (const r of cat) {
    const key = r.kind + ':' + r.code;
    if (!have.has(key) && r.test(st)) { await db.run('INSERT OR IGNORE INTO kids_rewards (user_id, kind, code, earned_at) VALUES (?,?,?,?)', user.id, r.kind, r.code, t); fresh.push({ kind: r.kind, code: r.code, emoji: r.emoji, name: r.name || null }); have.add(key); }
  }
  return { fresh, earned: have, catalogue: cat, stats: st };
}

function missionsOf(row) {
  row = row || {};
  return MISSIONS.map(([code, col, need]) => ({ code, have: Math.min(row[col] || 0, need), need, done: (row[col] || 0) >= need }));
}
/* when all five missions are done for the first time today the day is marked (the "missions" sticker follows) */
async function settleMissions(db, user) {
  const today = localDate(new Date(), user.timezone);
  const row = await db.get('SELECT * FROM kids_days WHERE user_id = ? AND local_date = ?', user.id, today);
  const missions = missionsOf(row);
  if (row && !row.bonus && missions.every((m) => m.done)) await db.run('UPDATE kids_days SET bonus = 1 WHERE user_id = ? AND local_date = ?', user.id, today);
  return { missions, allDone: missions.every((m) => m.done) };
}

/* parent verification: a grown-up sum (or the PIN, when one is set); the proof is a signed token that expires */
const hmac = (key, text) => crypto.createHmac('sha256', String(key)).update(text).digest('hex');
const parentToken = (session, minutes = 20) => { const exp = Date.now() + minutes * 60000; return `${exp}.${hmac(session.token_hash, 'parent:' + exp)}`; };
function parentOk(session, token) {
  const [exp, sig] = String(token || '').split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const want = hmac(session.token_hash, 'parent:' + exp);
  return want.length === sig.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig));
}
const challengeSig = (session, a, b) => hmac(session.token_hash, `sum:${a}:${b}`);

module.exports = { GAMES, CHARACTERS, ACCESSORIES, BACKGROUNDS, PLACES, DECOR, MISSIONS, LIMITS, STORIES, ensureProfile, bump, learn, stats, catalogue, sync, missionsOf, settleMissions, parentToken, parentOk, challengeSig, activeSql };
