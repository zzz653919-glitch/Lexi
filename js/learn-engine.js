/* Pure learning logic (no DOM): spaced repetition, lesson building, exercise generation,
   XP, streaks, levels and achievements. Everything is computed from real stored activity. */
VL.srs = (function () {
  const MIN = 60 * 1000, DAY = 24 * 60 * MIN;
  // Review interval for each box. Box 0 = "just failed / brand new": see it again within the lesson / in 10 minutes.
  const INTERVALS = [10 * MIN, 1 * DAY, 3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY];
  const MAX_BOX = INTERVALS.length - 1;
  const NEW_PER_LESSON = 5;

  /* Moves a word on its schedule after the first attempt in a lesson.
     Correct: one box up (a never-seen word lands in box 1). Wrong: two boxes down, so it returns sooner. */
  function schedule(w, correct, now) {
    const t = now || Date.now();
    if (correct) w.box = w.reps === 0 ? 1 : Math.min(MAX_BOX, w.box + 1);
    else { w.box = Math.max(0, w.box - 2); w.lapses = (w.lapses || 0) + 1; }
    w.reps = (w.reps || 0) + 1;
    w.due = t + INTERVALS[w.box];
  }

  // new -> learning (box 0-2) -> reviewing (box 3) -> known (box 4-5)
  function level(w) {
    if (!w.reps) return 'new';
    if (w.box >= 4) return 'known';
    if (w.box === 3) return 'reviewing';
    return 'learning';
  }
  const isLearned = (w) => (w.box || 0) >= 3;
  const isDue = (w, now) => !!w.reps && w.due != null && w.due <= (now || Date.now());
  // five mastery states shown to the user: new, learning, partial, good, due (time to review)
  function state(w, now) {
    if (!w.reps) return 'new';
    if (isDue(w, now)) return 'due';
    if ((w.box || 0) >= 4) return 'good';
    if ((w.box || 0) >= 2) return 'partial';
    return 'learning';
  }
  // words that were missed often look "more overdue", so they come back sooner
  const urgency = (w) => (w.due || 0) - (w.lapses || 0) * 6 * 3600 * 1000;

  /* Chooses which words go into a lesson of `size` words:
     1) words that are due (most overdue first), 2) up to NEW_PER_LESSON new words, 3) more new words,
     4) words that will be due soonest (extra practice). */
  function pick(words, size, now) {
    const t = now || Date.now();
    const due = words.filter((w) => isDue(w, t)).sort((a, b) => urgency(a) - urgency(b));
    const fresh = VL.util.shuffle(words.filter((w) => !w.reps));
    const later = words.filter((w) => w.reps && !isDue(w, t)).sort((a, b) => urgency(a) - urgency(b));
    const out = [];
    const take = (list, max) => { for (const w of list) { if (out.length >= size || max <= 0) break; if (!out.includes(w)) { out.push(w); max--; } } };
    take(due, size);
    take(fresh, Math.min(NEW_PER_LESSON, size));
    take(fresh, size);
    take(later, size);
    return out;
  }

  // Words worth a dedicated review: due for review, or hard (missed and not yet recovered).
  function reviewPool(words, now) {
    const t = now || Date.now();
    return words.filter((w) => isDue(w, t) || VL.store.status(w) === 'difficult');
  }

  return { INTERVALS, MAX_BOX, NEW_PER_LESSON, schedule, level, state, isLearned, isDue, pick, reviewPool };
})();

VL.learn = (function () {
  const TYPES = ['choose', 'type', 'translate', 'fill', 'match', 'reverse', 'review'];
  const XP = { choose: 8, type: 12, translate: 12, reverse: 12, fill: 10, matchPair: 4, retryFactor: 0.5, comboEvery: 5, comboBonus: 5, finish: 10 };
  const LESSON_SIZES = [10, 15, 20];

  const primary = (text) => VL.quiz.acceptedAnswers(text)[0] || String(text);
  const letters = (s) => (String(s).match(/\p{L}/gu) || []).length;

  /* ---------- exercise generation ---------- */
  // Four answer options for "choose the translation": the right one plus three different, plausible wrong ones.
  function choices(word, allWords) {
    const correct = primary(word.uz);
    const correctKey = VL.quiz.normalize(correct, true);
    const sameSet = allWords.filter((w) => w.id !== word.id && w.collectionId === word.collectionId);
    const others = allWords.filter((w) => w.id !== word.id && w.collectionId !== word.collectionId);
    const used = new Set([correctKey]);
    const wrong = [];
    for (const w of VL.util.shuffle(sameSet).concat(VL.util.shuffle(others))) {
      const text = primary(w.uz);
      const k = VL.quiz.normalize(text, true);
      if (used.has(k) || VL.quiz.check(text, word.uz, true)) continue;
      used.add(k); wrong.push(text);
      if (wrong.length === 3) break;
    }
    if (wrong.length < 3) return null; // not enough different words for a 4-option question
    return VL.util.shuffle([correct].concat(wrong)).map((text) => ({ text, correct: VL.quiz.normalize(text, true) === correctKey }));
  }

  // "B _ _ k": hides about 40% of the letters (never the first letter of a word). Returns null for very short words.
  function maskWord(en) {
    const chars = Array.from(en);
    const candidates = [];
    let atWordStart = true;
    chars.forEach((ch, i) => {
      if (/\p{L}/u.test(ch)) { if (!atWordStart) candidates.push(i); atWordStart = false; } else atWordStart = true;
    });
    if (letters(en) < 3 || candidates.length < 1) return null;
    const hideCount = Math.max(1, Math.min(candidates.length, Math.round(candidates.length * 0.45)));
    const hidden = new Set(VL.util.shuffle(candidates).slice(0, hideCount));
    return chars.map((ch, i) => (hidden.has(i) ? '_' : ch));
  }

  /* An exercise item: { id, type, wordIds, dir, options?, mask? }.
     `fallback` is used when the requested type is impossible with the available words. */
  function makeItem(type, word, allWords, opts) {
    const base = { id: VL.util.uid(), type, wordIds: [word.id], dir: 'en-uz', retry: !!(opts && opts.retry) };
    if (type === 'choose') {
      const options = choices(word, allWords);
      if (options) return Object.assign(base, { options });
      return makeItem('translate', word, allWords, opts);
    }
    if (type === 'fill') {
      const mask = maskWord(word.en);
      if (mask) return Object.assign(base, { mask });
      return makeItem('translate', word, allWords, opts);
    }
    if (type === 'reverse') return Object.assign(base, { dir: 'uz-en' });
    if (type === 'type') return Object.assign(base, { dir: Math.random() < 0.5 ? 'en-uz' : 'uz-en' });
    return base; // translate (English -> Uzbek typing)
  }

  function makeMatch(words) {
    const pairs = words.map((w) => ({ wordId: w.id, en: w.en, uz: primary(w.uz) }));
    return { id: VL.util.uid(), type: 'match', wordIds: words.map((w) => w.id), dir: 'en-uz', pairs, retry: false };
  }

  // Which exercise suits a word at its current strength (mixed lessons).
  function typeFor(w, allWords) {
    const pool = ['choose', 'fill', 'translate', 'type', 'reverse'];
    const weights = (w.box || 0) <= 1 ? { choose: 4, fill: 2, translate: 2, type: 1, reverse: 0 }
      : (w.box || 0) <= 3 ? { choose: 1, fill: 2, translate: 3, type: 2, reverse: 2 }
        : { choose: 0, fill: 2, translate: 1, type: 3, reverse: 3 };
    const bag = [];
    pool.forEach((t) => { for (let i = 0; i < weights[t]; i++) bag.push(t); });
    return bag[Math.floor(Math.random() * bag.length)];
  }

  /* Builds the lesson queue. config: { type: one of TYPES | 'mixed', size, words (pool) }.
     Never-seen words get a "meet the word" card first. Returns { items, wordCount, newCount }. */
  function buildLesson(config, allWords) {
    const pool = config.words;
    let chosen;
    if (config.type === 'review') chosen = VL.srs.pick(VL.srs.reviewPool(pool), config.size);
    else chosen = VL.srs.pick(pool, config.size);
    const items = [];
    let newCount = 0;
    const type = config.type;

    if (type === 'match') {
      for (let i = 0; i < chosen.length; i += 5) {
        const group = chosen.slice(i, i + 5);
        if (group.length >= 2) items.push(makeMatch(group)); else if (items.length) items[items.length - 1].pairs.push({ wordId: group[0].id, en: group[0].en, uz: primary(group[0].uz) }), items[items.length - 1].wordIds.push(group[0].id);
      }
      newCount = chosen.filter((w) => !w.reps).length;
      return { items, wordCount: chosen.length, newCount };
    }

    let matchWords = [];
    if ((type === 'mixed' || type === 'review') && chosen.length >= 8) matchWords = chosen.slice(-4);
    chosen.forEach((w) => {
      if (matchWords.includes(w)) return;
      if (!w.reps) { items.push({ id: VL.util.uid(), type: 'intro', wordIds: [w.id], dir: 'en-uz', retry: false }); newCount++; }
      const t = (type === 'mixed' || type === 'review') ? typeFor(w, allWords) : (type === 'type' ? 'type' : type);
      items.push(makeItem(t, w, allWords));
    });
    if (matchWords.length) items.splice(Math.min(items.length, Math.max(2, Math.floor(items.length / 2))), 0, makeMatch(matchWords));
    return { items, wordCount: chosen.length, newCount };
  }

  /* ---------- checking ---------- */
  function expectedFor(item, word) { return item.dir === 'en-uz' ? word.uz : word.en; }
  function promptFor(item, word) { return item.dir === 'en-uz' ? word.en : (item.prompt || word.uz); }

  // Result of a typed answer: { correct, closeCall } — closeCall = one typo away (still wrong, but we say so).
  function checkTyped(input, expected, lenient) {
    if (VL.quiz.check(input, expected, lenient)) return { correct: true, closeCall: false };
    const typed = VL.quiz.normalize(input, lenient);
    const near = VL.quiz.acceptedAnswers(expected).some((a) => {
      const k = VL.quiz.normalize(a, lenient);
      return k.length >= 5 && typed.length >= 4 && editDistance(typed, k) === 1;
    });
    return { correct: false, closeCall: near };
  }

  function editDistance(a, b) {
    const m = a.length, n = b.length;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }

  /* ---------- XP ---------- */
  const XP_BY_TYPE = { learn: 6, chooseRev: 8, choose: 8, cloze: 8, fill: 10, scramble: 10, listen: 10, order: 12, type: 12, translate: 12, reverse: 12, sentEnUz: 14, sentUzEn: 15, intro: 6 };
  function xpFor(type, correct, isRetry) {
    if (!correct) return 0;
    const base = XP_BY_TYPE[type] || XP.type;
    return isRetry ? Math.round(base * XP.retryFactor) : base;
  }

  /* ---------- levels, streaks, achievements (derived from stored activity) ---------- */
  const totalXp = (days) => days.reduce((a, d) => a + (d.xp || 0), 0);
  const xpForLevel = (lvl) => 40 * (lvl - 1) * (lvl - 1); // total XP needed to reach `lvl`
  function levelInfo(xp) {
    const lvl = Math.floor(Math.sqrt(xp / 40)) + 1;
    const from = xpForLevel(lvl), to = xpForLevel(lvl + 1);
    return { level: lvl, xp, from, to, pct: Math.round(((xp - from) / (to - from)) * 100) };
  }
  const levelTier = (lvl) => (lvl >= 12 ? 'master' : lvl >= 8 ? 'scholar' : lvl >= 5 ? 'learner' : lvl >= 3 ? 'explorer' : 'novice');

  const active = (d) => d && (d.sessions > 0 || d.answers > 0);
  function streaks(days, now) {
    const set = new Set(days.filter(active).map((d) => d.date));
    const dayMs = 86400000;
    let cursor = new Date(now || Date.now());
    const key = (d) => VL.util.dayKey(d.getTime());
    let current = 0;
    if (!set.has(key(cursor))) cursor = new Date(cursor.getTime() - dayMs);
    while (set.has(key(cursor))) { current++; cursor = new Date(cursor.getTime() - dayMs); }
    const sorted = Array.from(set).sort();
    let best = 0, run = 0, prev = null;
    sorted.forEach((k) => {
      const t = new Date(k + 'T12:00:00').getTime();
      run = prev !== null && Math.round((t - prev) / dayMs) === 1 ? run + 1 : 1;
      prev = t; best = Math.max(best, run);
    });
    return { current, best, todayDone: set.has(key(new Date(now || Date.now()))) };
  }

  const ACHIEVEMENTS = [
    { id: 'pathFirst', icon: 'flag', target: 1, value: (c) => c.pathLessons },
    { id: 'path10', icon: 'flag', target: 10, value: (c) => c.pathLessons },
    { id: 'path50', icon: 'flag', target: 50, value: (c) => c.pathLessons },
    { id: 'firstLesson', icon: 'target', target: 1, value: (c) => c.lessons },
    { id: 'lessons10', icon: 'target', target: 10, value: (c) => c.lessons },
    { id: 'streak3', icon: 'flame', target: 3, value: (c) => c.bestStreak },
    { id: 'streak7', icon: 'flame', target: 7, value: (c) => c.bestStreak },
    { id: 'streak30', icon: 'flame', target: 30, value: (c) => c.bestStreak },
    { id: 'words10', icon: 'book', target: 10, value: (c) => c.learned },
    { id: 'words50', icon: 'book', target: 50, value: (c) => c.learned },
    { id: 'words100', icon: 'book', target: 100, value: (c) => c.learned },
    { id: 'correct100', icon: 'check', target: 100, value: (c) => c.correct },
    { id: 'correct500', icon: 'check', target: 500, value: (c) => c.correct },
    { id: 'xp500', icon: 'star', target: 500, value: (c) => c.xp },
    { id: 'xp2000', icon: 'star', target: 2000, value: (c) => c.xp },
    { id: 'perfect', icon: 'star', target: 1, value: (c) => c.perfect },
    { id: 'goal1', icon: 'flag', target: 1, value: (c) => c.goalDays },
    { id: 'goal7', icon: 'flag', target: 7, value: (c) => c.goalDays },
  ];

  function stats(state, now) {
    const days = state.days;
    const lessons = state.sessions.filter((s) => s.kind === 'lesson');
    const st = streaks(days, now);
    const xp = totalXp(days);
    return {
      xp, level: levelInfo(xp), streak: st, lessons: lessons.length,
      perfect: lessons.filter((s) => s.wrong === 0 && s.total >= 8).length,
      correct: days.reduce((a, d) => a + (d.correct || 0), 0),
      answers: days.reduce((a, d) => a + (d.answers || 0), 0),
      learned: state.words.filter(VL.srs.isLearned).length,
      goalDays: days.filter((d) => d.goalMet).length,
      bestStreak: st.best,
      pathLessons: Object.keys((state.path && state.path.lessons) || {}).filter((k) => state.path.lessons[k].done).length,
    };
  }

  function achievements(state, now) {
    const c = stats(state, now);
    return ACHIEVEMENTS.map((a) => {
      const v = a.value(c);
      return { id: a.id, icon: a.icon, target: a.target, value: Math.min(v, a.target), unlocked: v >= a.target };
    });
  }

  return { TYPES, XP, LESSON_SIZES, primary, letters, choices, maskWord, makeItem, makeMatch, buildLesson, expectedFor, promptFor, checkTyped, editDistance, xpFor, totalXp, levelInfo, levelTier, streaks, stats, achievements };
})();
