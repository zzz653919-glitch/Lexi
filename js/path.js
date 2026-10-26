/* The learning path ("O'rganish xaritasi"): levels -> units (topics) -> lessons, built from the vocabulary data in
   js/data. Nothing here is stored except the progress of each lesson (see store.completeLesson).

   Rules (the same ones the map shows):
   - a lesson holds 6-8 words of one topic and one level (A1, A2, B1, B2, C1); words of a topic that has fewer than
     3 words at a level are collected in the unit "Aralash so'zlar";
   - the IELTS level is made of the academic topic and the B2/C1 words of related topics;
   - inside a unit the lessons are sequential: lesson 2 opens when lesson 1 is finished (60% right answers or more);
   - a level opens when 40% of the lessons of the previous level are finished; the first level is always open;
   - "free practice" (Settings) opens everything.
   Lesson states: locked, available, inprogress, done, review (finished but some of its words are due again). */
VL.path = (function () {
  const SIZE = 6;          // words per lesson
  const MAX = 8;           // a short remainder is merged into the last lesson (up to 8 words)
  const OPEN_NEXT_LEVEL = 0.4;
  const LEVELS = [
    { id: 'A1', short: 'A1', name: 'Beginner A1', sub: 'Boshlang‘ich', emoji: '🌱' },
    { id: 'A2', short: 'A2', name: 'Elementary A2', sub: 'Asosiy', emoji: '🌿' },
    { id: 'B1', short: 'B1', name: 'Intermediate B1', sub: 'O‘rta', emoji: '🌳' },
    { id: 'B2', short: 'B2', name: 'Upper-Intermediate B2', sub: 'O‘rtadan yuqori', emoji: '🚀' },
    { id: 'C1', short: 'C1', name: 'Advanced C1', sub: 'Ilg‘or', emoji: '🏔️' },
    { id: 'IELTS', short: 'IELTS', name: 'IELTS tayyorgarligi', sub: 'Akademik lug‘at', emoji: '🎯' },
  ];
  const IELTS_ACADEMIC = ['t055'];
  const IELTS_RELATED = ['t103', 't104', 't110', 't036', 't039', 't045', 't046', 't077', 't081', 't082', 't113', 't106'];

  let cache = null;
  const rowsOf = (id) => VL.vocabWords[id] || [];
  const entry = (r) => ({ en: r[0], uz: r[1], pos: r[2], level: r[3], ex: r[4], exUz: r[5] });
  const posName = (code) => VL.POS_CODES[code] || 'other';

  function chunk(rows) {
    if (!rows.length) return [];
    const out = [];
    let i = 0;
    while (i < rows.length) {
      const rest = rows.length - i;
      const take = rest <= MAX ? rest : (rest - SIZE < 3 ? rest : SIZE);
      out.push(rows.slice(i, i + take)); i += take;
    }
    return out;
  }

  function build() {
    if (cache) return cache;
    const levels = LEVELS.map((lv, index) => ({ id: lv.id, index, def: lv, units: [] }));
    const lessonsById = {};
    const addUnit = (lv, unitId, topicId, name, emoji, rows) => {
      const parts = chunk(rows);
      if (!parts.length) return;
      const unit = { id: unitId, levelId: lv.id, topicId, name, emoji, lessons: [] };
      parts.forEach((p, k) => {
        const lesson = { id: lv.id + '.' + unitId + '.' + (k + 1), levelId: lv.id, unitId, topicId, n: k + 1, of: parts.length, rows: p, unit };
        unit.lessons.push(lesson); lessonsById[lesson.id] = lesson;
      });
      lv.units.push(unit);
    };
    LEVELS.slice(0, 5).forEach((def, li) => {
      const lv = levels[li];
      const leftovers = [];
      VL.vocabTopics.forEach((tp) => {
        const rows = rowsOf(tp.id).filter((r) => r[3] === def.id).map((r) => Object.assign([].concat(r), { topicId: tp.id }));
        if (rows.length >= 3) addUnit(lv, tp.id, tp.id, tp, tp.emoji, rows);
        else leftovers.push(...rows);
      });
      if (leftovers.length) addUnit(lv, 'mix', null, { uz: 'Aralash so‘zlar', en: 'Mixed words', ru: 'Разные слова' }, '🎲', leftovers);
    });
    const ie = levels[5];
    IELTS_ACADEMIC.concat(IELTS_RELATED).forEach((tid) => {
      const tp = VL.vocabTopics.find((x) => x.id === tid);
      if (!tp) return;
      const rows = rowsOf(tid).filter((r) => IELTS_ACADEMIC.includes(tid) || r[3] === 'B2' || r[3] === 'C1').map((r) => Object.assign([].concat(r), { topicId: tid }));
      if (rows.length >= 3) addUnit(ie, tid, tid, tp, tp.emoji, rows);
    });
    cache = { levels, lessonsById, order: [].concat(...levels.map((lv) => [].concat(...lv.units.map((u) => u.lessons)))) };
    return cache;
  }

  /* ---------- progress and states ---------- */
  const rec = (id) => VL.store.state.path.lessons[id] || null;
  const isDone = (id) => !!(rec(id) && rec(id).done);
  const free = () => !!VL.store.state.settings.freePath;

  function levelStats(lv) {
    const all = [].concat(...lv.units.map((u) => u.lessons));
    const done = all.filter((l) => isDone(l.id)).length;
    return { total: all.length, done, pct: all.length ? Math.round(done / all.length * 100) : 0 };
  }
  function levelOpen(lv) {
    if (free() || lv.index === 0) return true;
    const prev = build().levels[lv.index - 1];
    const st = levelStats(prev);
    return !st.total || st.done / st.total >= OPEN_NEXT_LEVEL;
  }
  function unitStats(unit) {
    const done = unit.lessons.filter((l) => isDone(l.id)).length;
    return { total: unit.lessons.length, done, pct: Math.round(done / unit.lessons.length * 100) };
  }

  // the stored words that belong to a lesson (matched by English spelling), for the "needs review" state
  function installedWords(lesson) {
    return lesson.rows.map((r) => VL.store.wordByEn(r[0])).filter(Boolean);
  }
  function needsReview(lesson) {
    if (!isDone(lesson.id)) return false;
    const now = Date.now();
    return installedWords(lesson).some((w) => VL.srs.isDue(w, now));
  }

  function isOpen(lesson) {
    if (free()) return true;
    const lv = build().levels.find((x) => x.id === lesson.levelId);
    if (!levelOpen(lv)) return false;
    if (lesson.n === 1) return true;
    return isDone(lesson.unit.lessons[lesson.n - 2].id);
  }
  function status(lesson) {
    const l = VL.store.state.lesson;
    if (l && l.pathLesson === lesson.id) return 'inprogress';
    if (isDone(lesson.id)) return needsReview(lesson) ? 'review' : 'done';
    return isOpen(lesson) ? 'available' : 'locked';
  }
  function lockReason(lesson) {
    const lv = build().levels.find((x) => x.id === lesson.levelId);
    if (!levelOpen(lv)) return 'path.lockLevel';
    return 'path.lockLesson';
  }

  // the lesson to offer on "Continue": the paused one, else the first open unfinished one, else the first needing review
  function next() {
    const b = build();
    const paused = VL.store.state.lesson && VL.store.state.lesson.pathLesson;
    if (paused && b.lessonsById[paused]) return b.lessonsById[paused];
    for (const l of b.order) if (!isDone(l.id) && isOpen(l)) return l;
    for (const l of b.order) if (isDone(l.id) && needsReview(l)) return l;
    return null;
  }
  // the lesson after `lesson` in the path (for "Davom ettirish" on the results page)
  function after(lesson) {
    const b = build();
    const i = b.order.findIndex((l) => l.id === lesson.id);
    for (let k = i + 1; k < b.order.length; k++) if (isOpen(b.order[k])) return b.order[k];
    return next();
  }

  function totals() {
    const b = build();
    const done = b.order.filter((l) => isDone(l.id)).length;
    return { lessons: b.order.length, done, pct: b.order.length ? Math.round(done / b.order.length * 100) : 0 };
  }

  /* ---------- words of a lesson ---------- */
  const unitName = (unit) => (unit.name[VL.i18n.lang] || unit.name.uz || unit.name.en);
  // Adds the lesson's words to the user's vocabulary (only those not there yet) and returns the word objects.
  async function ensureWords(lesson) {
    const store = VL.store;
    const missing = lesson.rows.filter((r) => !store.wordByEn(r[0]));
    if (missing.length) {
      const byTopic = {};
      missing.forEach((r) => { (byTopic[r.topicId || lesson.topicId || 'mix'] = byTopic[r.topicId || lesson.topicId || 'mix'] || []).push(r); });
      for (const tid of Object.keys(byTopic)) {
        const tp = VL.vocabTopics.find((x) => x.id === tid);
        const col = await store.ensureDeckCollection('topic.' + tid, tp ? (tp.uz) : 'Lug‘at');
        await store.importWords(byTopic[tid].map((r) => { const e = entry(r); return { en: e.en, uz: e.uz, example: e.ex, exUz: e.exUz, pos: posName(e.pos), level: e.level, collectionId: col.id }; }));
      }
    }
    return lesson.rows.map((r) => store.wordByEn(r[0])).filter(Boolean);
  }

  async function start(root, lessonId, hooks, opts) {
    const lesson = build().lessonsById[lessonId];
    if (!lesson) return false;
    const st = status(lesson);
    if (st === 'locked') { VL.ui.toast(VL.t(lockReason(lesson)), 'info', 2600); return false; }
    const cur = VL.store.state.lesson;
    if (cur && cur.pathLesson !== lessonId && !(opts && opts.replace)) {
      const ok = await VL.ui.confirm({ title: VL.t('cs.replaceTitle'), message: VL.t('cs.replaceMsg'), confirmLabel: VL.t('cs.replaceYes'), danger: true });
      if (!ok) return false;
    }
    if (cur && cur.pathLesson === lessonId && !(opts && opts.restart)) return VL.player.resume(root, hooks);
    const words = await ensureWords(lesson);
    if (words.length < 2) { VL.ui.toast(VL.t('les.empty'), 'error'); return false; }
    await VL.player.start(root, { type: 'path', words, pathLesson: lesson.id, pathTitle: lessonTitle(lesson) }, hooks);
    return true;
  }
  const lessonTitle = (lesson) => unitName(lesson.unit) + ' · ' + VL.t('path.lessonN', { n: lesson.n });

  return { LEVELS, build, levelStats, levelOpen, unitStats, status, lockReason, isOpen, isDone, needsReview, next, after, totals, ensureWords, start, unitName, lessonTitle, rec, entry, posName };
})();
