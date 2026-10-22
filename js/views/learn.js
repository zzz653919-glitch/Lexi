/* Word Lessons: Duolingo-style exercises, spaced repetition, XP, streak and awards.
   Hub tabs (exercises, collections, ready-made decks, word knowledge, awards) + the lesson player. */
VL.views.learn = (function () {
  const { esc, pct, dayKey } = VL.util;
  const { icon } = VL.ui;
  const t = VL.t, n = VL.n;
  const store = VL.store, E = VL.learn;
  const GUARD_MS = 250;
  const EX_META = {
    mixed: { icon: 'zap', color: 'blue' }, choose: { icon: 'list', color: 'violet' }, type: { icon: 'edit', color: 'teal' },
    translate: { icon: 'book', color: 'orange' }, fill: { icon: 'type', color: 'pink' }, match: { icon: 'link', color: 'green' },
    reverse: { icon: 'refresh', color: 'red' }, review: { icon: 'clock', color: 'blue' },
  };
  const TABS = ['practice', 'collections', 'decks', 'words', 'achievements'];

  let root, off, keyHandler, timer;
  let tab = 'practice';
  let mode = 'hub';             // 'hub' | 'lesson' | 'result'
  let L = null;                 // lesson being played (persisted through store.saveLesson)
  let cur = null;               // transient state of the item on screen
  let chain = Promise.resolve();
  let expanded = new Set(), deckLevel = 'A1', deckOpen = new Set(), wordFilter = 'all', wordLimit = 100;

  const queue = (fn) => { chain = chain.then(fn).catch((e) => console.error(e)); return chain; };

  /* ---------- helpers ---------- */
  function selectedIds() {
    const ids = (store.state.settings.learnSelected || []).filter((id) => store.collection(id));
    return ids;
  }
  function poolWords() {
    const ids = selectedIds();
    return ids.length ? store.state.words.filter((w) => ids.includes(w.collectionId)) : store.state.words;
  }
  const todayRecord = () => store.state.days.find((d) => d.date === dayKey(Date.now())) || { xp: 0 };
  const fmtTime = (ms) => { const s = Math.max(1, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const fmtDate = (ts) => new Date(ts).toLocaleDateString(VL.i18n.locale, { day: 'numeric', month: 'short' });

  function ring(value, total, size, label) {
    const R = 22, C = 2 * Math.PI * R, p = Math.min(1, total ? value / total : 0);
    return '<span class="mini-ring" style="width:' + size + 'px;height:' + size + 'px" role="img" aria-label="' + esc(label) + '"><svg viewBox="0 0 54 54"><circle class="ring-bg" cx="27" cy="27" r="' + R + '"/><circle class="ring-fg" cx="27" cy="27" r="' + R + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - p)).toFixed(1) + '"/></svg></span>';
  }

  /* =====================================================================
     HUB
     ===================================================================== */
  function drawHub() {
    mode = 'hub';
    document.body.classList.remove('focus-mode');
    const s = E.stats(store.state);
    const goal = store.state.settings.dailyGoal;
    const today = todayRecord().xp;
    const tier = E.levelTier(s.level.level);
    root.innerHTML =
      '<header class="page-head"><div><h1>' + esc(t('learn.title')) + '</h1><p class="muted">' + esc(t('learn.sub')) + '</p></div></header>' +
      '<section class="strip" aria-label="' + esc(t('stat.aria')) + '">' +
      '<div class="strip-item"><span class="strip-ico flame">' + icon('flame') + '</span><div><b>' + esc(n('n.day', s.streak.current)) + '</b><span>' + esc(t('strip.streak')) + '</span></div></div>' +
      '<div class="strip-item">' + ring(today, goal, 44, t('res.goal', { a: today, b: goal })) + '<div><b>' + today + ' / ' + goal + '</b><span>' + esc(t('strip.today')) + '</span></div></div>' +
      '<div class="strip-item"><span class="strip-ico star">' + icon('star') + '</span><div><b>' + esc(t('strip.level', { n: s.level.level })) + '</b><span>' + esc(t('tier.' + tier)) + ' · ' + s.xp + ' XP</span></div></div>' +
      '<div class="strip-item"><span class="strip-ico book">' + icon('book') + '</span><div><b>' + s.learned + '</b><span>' + esc(t('strip.learned')) + ' ' + esc(t('strip.learnedOf', { b: store.state.words.length })) + '</span></div></div>' +
      '</section>' +
      '<nav class="tabs" role="tablist" aria-label="' + esc(t('tab.aria')) + '">' +
      TABS.map((k) => '<button type="button" role="tab" class="tab' + (tab === k ? ' active' : '') + '" aria-selected="' + (tab === k) + '" data-tab="' + k + '">' + esc(t('tab.' + k)) + '</button>').join('') + '</nav>' +
      '<div id="tab-body" role="tabpanel"></div>';
    drawTab();
  }

  function drawTab() {
    const host = root.querySelector('#tab-body');
    if (!host) return;
    host.innerHTML = ({ practice: tabPractice, collections: tabCollections, decks: tabDecks, words: tabWords, achievements: tabAchievements })[tab]();
  }

  /* ----- tab: exercises ----- */
  function exerciseAvailability(type, pool, due) {
    const all = store.state.words;
    if (!pool.length) return t('ex.needWords');
    if (type === 'choose' && all.length < 4) return t('ex.needFour');
    if (type === 'match' && pool.length < 2) return t('ex.needTwo');
    if (type === 'review' && !due) return t('ex.nothingDue');
    return '';
  }

  function tabPractice() {
    const pool = poolWords();
    const ids = selectedIds();
    const due = VL.srs.reviewPool(pool).length;
    const fresh = pool.filter((w) => !w.reps).length;
    const size = store.state.settings.lessonSize || 10;
    let html = '';
    if (store.state.lesson) {
      const sl = store.state.lesson;
      html += '<section class="card resume"><div><h2 class="card-title">' + icon('pause') + esc(t('resume.title')) + '</h2><p class="muted">' + esc(t('resume.text', { type: t('ex.' + sl.type), i: Math.min(sl.index, sl.items.length), n: sl.items.length })) + '</p></div>' +
        '<div class="btn-row"><button class="btn btn-primary" data-action="resume">' + icon('play') + esc(t('btn.resume')) + '</button><button class="btn" data-action="discard">' + esc(t('btn.discard')) + '</button></div></section>';
    }
    html += '<section class="card source"><div class="source-main"><h2 class="card-title">' + esc(t('src.title')) + '</h2>' +
      '<p><b>' + esc(ids.length ? t('src.some', { n: ids.length }) : t('src.all')) + '</b> · ' + esc(n('n.word', pool.length)) + ' · ' + esc(t('src.due', { n: due })) + ' · ' + esc(t('src.new', { n: fresh })) + '</p>' +
      '<p class="hint">' + esc(t('src.hint')) + '</p></div>' +
      '<div class="source-side"><button class="btn btn-sm" data-tab="collections">' + icon('folder') + esc(t('src.change')) + '</button>' +
      '<div class="field"><label for="lesson-size">' + esc(t('size.label')) + '</label><select id="lesson-size">' +
      E.LESSON_SIZES.map((v) => '<option value="' + v + '"' + (v === size ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></div></div></section>';
    html += '<div class="ex-grid">' + ['mixed', 'choose', 'type', 'translate', 'fill', 'match', 'reverse', 'review'].map((k) => {
      const m = EX_META[k];
      const block = exerciseAvailability(k, pool, due);
      return '<button type="button" class="ex-card c-' + m.color + (k === 'mixed' ? ' ex-featured' : '') + '" data-action="start" data-type="' + k + '"' + (block ? ' disabled' : '') + '>' +
        '<span class="ex-ico">' + icon(m.icon) + '</span><span class="ex-text"><b>' + esc(t('ex.' + k)) + '</b><span>' + esc(t('exd.' + k)) + '</span></span>' +
        (block ? '<em class="ex-block">' + esc(block) + '</em>' : (k === 'review' ? '<em class="ex-badge">' + esc(t('ex.dueBadge', { n: due })) + '</em>' : '<em class="ex-go">' + icon('arrow') + '</em>')) + '</button>';
    }).join('') + '</div>';
    return html;
  }

  /* ----- tab: my collections ----- */
  function tabCollections() {
    const cols = store.state.collections;
    const ids = selectedIds();
    let html = '<section class="card"><div class="tab-head"><p class="muted">' + esc(t('colt.intro')) + '</p><div class="btn-row">' +
      '<button class="btn btn-sm" data-action="select-all">' + esc(t('colt.selectAll')) + '</button><button class="btn btn-sm" data-action="select-none">' + esc(t('colt.clear')) + '</button>' +
      '<button class="btn btn-primary btn-sm" data-action="new-col">' + icon('plus') + esc(t('colt.new')) + '</button></div></div></section><div class="col-grid">';
    cols.forEach((c) => {
      const words = store.wordsIn(c.id);
      const sum = { learned: words.filter(VL.srs.isLearned).length, due: words.filter((w) => VL.srs.isDue(w)).length };
      const lv = { known: 0, reviewing: 0, learning: 0, new: 0 };
      words.forEach((w) => { lv[VL.srs.level(w)]++; });
      const open = expanded.has(c.id);
      html += '<article class="card col-card' + (ids.includes(c.id) ? ' selected' : '') + '" data-col="' + esc(c.id) + '">' +
        '<div class="col-top"><label class="switch"><input type="checkbox" data-action="toggle-col" aria-label="' + esc(t('colt.practiseAria', { name: c.name })) + '"' + (ids.includes(c.id) ? ' checked' : '') + '><span class="switch-ui"></span><span class="switch-text">' + esc(t('colt.include')) + '</span></label>' +
        '<span class="col-actions"><button class="icon-btn" data-action="rename-col" aria-label="' + esc(t('col.renameAria', { name: c.name })) + '">' + icon('edit') + '</button>' +
        '<button class="icon-btn danger" data-action="delete-col" aria-label="' + esc(t('col.deleteAria', { name: c.name })) + '">' + icon('trash') + '</button></span></div>' +
        '<h3 class="col-name">' + esc(c.name) + '</h3><p class="muted small">' + esc(n('n.word', words.length)) + ' · ' + esc(t('colt.learned', { n: sum.learned })) + ' · ' + esc(t('colt.due', { n: sum.due })) + '</p>' +
        '<div class="stack lv-stack" role="img" aria-label="' + esc(t('wk.summaryAria')) + '">' + ['known', 'reviewing', 'learning'].map((k) => '<span class="seg lv-' + k + '" style="width:' + pct(lv[k], words.length) + '%"></span>').join('') + '</div>' +
        '<div class="btn-row"><button class="btn btn-sm" data-action="add-word">' + icon('plus') + esc(t('btn.addWord')) + '</button>' +
        '<button class="btn btn-sm btn-ghost" data-action="toggle-words" aria-expanded="' + open + '">' + esc(t(open ? 'colt.hide' : 'colt.show')) + '</button></div>' +
        (open ? collectionWords(words) : '') + '</article>';
    });
    return html + '</div>';
  }

  function collectionWords(words) {
    if (!words.length) return '<p class="muted small col-empty">' + esc(t('colt.empty')) + '</p>';
    return '<ul class="word-list">' + words.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 200).map((w) =>
      '<li data-id="' + esc(w.id) + '"><div class="wl-main"><span class="wl-en">' + esc(w.en) + VL.speech.button(w.en) + '</span><span class="wl-uz">' + esc(w.uz) + '</span>' +
      (w.example ? '<span class="word-example">' + esc(w.example) + '</span>' : '') + '</div>' +
      '<span class="row-actions"><button class="icon-btn" data-action="edit-word" aria-label="' + esc(t('vocab.editAria', { w: w.en })) + '">' + icon('edit') + '</button>' +
      '<button class="icon-btn danger" data-action="delete-word" aria-label="' + esc(t('vocab.deleteAria', { w: w.en })) + '">' + icon('trash') + '</button></span></li>').join('') + '</ul>';
  }

  /* ----- tab: ready-made decks ----- */
  const topicName = (id) => VL.deckTopics[id][VL.i18n.lang] || VL.deckTopics[id].en;
  function deckState(levelId, topicId) {
    const col = store.state.collections.find((c) => c.deckKey === levelId + '.' + topicId);
    const deck = VL.decks[levelId][topicId];
    if (!col) return { col: null, have: 0, total: deck.length };
    const keys = new Set(store.wordsIn(col.id).map((w) => VL.quiz.normalize(w.en, false)));
    return { col, have: deck.filter(([en]) => keys.has(VL.quiz.normalize(en, false))).length, total: deck.length };
  }

  function tabDecks() {
    const lvl = VL.deckLevels.find((l) => l.id === deckLevel);
    const lang = VL.i18n.lang;
    let html = '<section class="card"><p class="muted">' + esc(t('deck.intro')) + '</p><p class="notice">' + icon('alert') + '<span>' + esc(t('deck.note')) + '</span></p>' +
      '<div class="segmented level-pills" role="group" aria-label="' + esc(t('deck.levelsAria')) + '">' +
      VL.deckLevels.map((l) => '<button type="button" class="pill' + (l.id === deckLevel ? ' active' : '') + '" data-action="deck-level" data-level="' + l.id + '" aria-pressed="' + (l.id === deckLevel) + '"><b>' + l.id + '</b><span>' + esc(l.name[lang] || l.name.en) + '</span></button>').join('') + '</div></section>' +
      '<div class="tab-head slim"><h2 class="card-title">' + esc(lvl.id + ' — ' + (lvl.name[lang] || lvl.name.en)) + '</h2><button class="btn btn-sm" data-action="deck-add-level">' + icon('download') + esc(t('deck.addLevel', { id: lvl.id })) + '</button></div><div class="deck-grid">';
    Object.keys(VL.deckTopics).forEach((tid) => {
      const st = deckState(lvl.id, tid);
      const key = lvl.id + '.' + tid;
      const done = st.have === st.total;
      const open = deckOpen.has(key);
      html += '<article class="card deck-card' + (done ? ' deck-done' : '') + '" data-level="' + lvl.id + '" data-topic="' + tid + '">' +
        '<h3>' + esc(topicName(tid)) + '</h3><p class="muted small">' + esc(n('n.word', st.total)) + (st.have ? ' · ' + esc(t('deck.added', { a: st.have, b: st.total })) : '') + '</p>' +
        '<div class="bar"><span style="width:' + pct(st.have, st.total) + '%"></span></div>' +
        '<div class="btn-row">' + (done ? '<span class="chip chip-mastered">' + icon('check') + esc(t('deck.done')) + '</span>' : '<button class="btn btn-primary btn-sm" data-action="deck-add">' + esc(t(st.have ? 'deck.update' : 'deck.add')) + '</button>') +
        '<button class="btn btn-sm btn-ghost" data-action="deck-preview" aria-expanded="' + open + '">' + esc(t(open ? 'deck.hide' : 'deck.preview')) + '</button></div>' +
        (open ? '<ul class="word-list compact">' + VL.decks[lvl.id][tid].map(([en, uz]) => '<li><div class="wl-main"><span class="wl-en">' + esc(en) + VL.speech.button(en) + '</span><span class="wl-uz">' + esc(uz) + '</span></div></li>').join('') + '</ul>' : '') + '</article>';
    });
    return html + '</div>';
  }

  async function installTopic(levelId, topicId) {
    const col = await store.ensureDeckCollection(levelId + '.' + topicId, levelId + ' · ' + topicName(topicId));
    const r = await store.importWords(VL.decks[levelId][topicId].map(([en, uz]) => ({ en, uz, collectionId: col.id })));
    return { col, added: r.added };
  }

  /* ----- tab: word knowledge ----- */
  function wordRank(w) {
    if (VL.srs.isDue(w)) return 0;
    return { learning: 1, new: 2, reviewing: 3, known: 4 }[VL.srs.level(w)];
  }
  function tabWords() {
    const all = store.state.words;
    if (!all.length) return VL.ui.empty(t('tab.words'), t('wk.noWords'));
    const counts = { new: 0, learning: 0, reviewing: 0, known: 0 };
    all.forEach((w) => { counts[VL.srs.level(w)]++; });
    const filters = [['all', t('wk.all'), all.length], ['due', t('wk.due'), all.filter((w) => VL.srs.isDue(w)).length], ['difficult', t('st.difficult'), store.difficultWords().length],
      ['new', t('lv.new'), counts.new], ['learning', t('lv.learning'), counts.learning], ['reviewing', t('lv.reviewing'), counts.reviewing], ['known', t('lv.known'), counts.known]];
    const match = (w) => wordFilter === 'all' ? true : wordFilter === 'due' ? VL.srs.isDue(w) : wordFilter === 'difficult' ? store.status(w) === 'difficult' : VL.srs.level(w) === wordFilter;
    const list = all.filter(match).sort((a, b) => wordRank(a) - wordRank(b) || (a.due || 0) - (b.due || 0) || a.en.localeCompare(b.en));
    const shown = list.slice(0, wordLimit);
    let html = '<section class="card"><p class="muted">' + esc(t('wk.intro')) + '</p>' +
      '<div class="stack big-stack" role="img" aria-label="' + esc(t('wk.summaryAria')) + '">' + ['known', 'reviewing', 'learning', 'new'].map((k) => '<span class="seg lv-' + k + '" style="width:' + pct(counts[k], all.length) + '%"></span>').join('') + '</div>' +
      '<div class="legend">' + ['known', 'reviewing', 'learning', 'new'].map((k) => '<span><i class="dot lv-' + k + '"></i>' + esc(t('lv.' + k)) + ' · ' + counts[k] + '</span>').join('') + '</div></section>' +
      '<section class="card"><div class="chip-filters" role="group" aria-label="' + esc(t('wk.filterAria')) + '">' +
      filters.map((f) => '<button type="button" class="filter-chip' + (wordFilter === f[0] ? ' active' : '') + '" data-action="word-filter" data-filter="' + f[0] + '" aria-pressed="' + (wordFilter === f[0]) + '">' + esc(f[1]) + ' <b>' + f[2] + '</b></button>').join('') + '</div>';
    if (wordFilter === 'difficult') html += '<p class="small"><a href="#/difficult">' + esc(t('wk.difficultLink')) + '</a></p>';
    if (!list.length) return html + '<p class="muted">' + esc(t('wk.empty')) + '</p></section>';
    html += '<div class="table-wrap"><table class="words"><thead><tr><th scope="col">' + esc(t('th.english')) + '</th><th scope="col">' + esc(t('th.uzbek')) + '</th><th scope="col">' + esc(t('wk.strength')) + '</th><th scope="col" class="hide-sm">' + esc(t('wk.next')) + '</th><th scope="col" class="hide-sm">' + esc(t('th.accuracy')) + '</th></tr></thead><tbody>' +
      shown.map((w) => {
        const strength = w.reps ? Math.max(0, Math.min(5, w.box)) : 0;
        const nxt = !w.reps ? t('wk.notStarted') : (w.due <= Date.now() ? t('wk.now') : fmtDate(w.due));
        const tries = w.correct + w.wrong;
        return '<tr><td class="strong"><span class="word-cell">' + esc(w.en) + VL.speech.button(w.en) + '</span></td><td>' + esc(w.uz) + '</td>' +
          '<td><span class="meter" role="img" aria-label="' + esc(t('wk.strengthAria', { n: strength })) + '">' + [1, 2, 3, 4, 5].map((i) => '<i class="' + (i <= strength ? 'on lv-' + VL.srs.level(w) : '') + '"></i>').join('') + '</span></td>' +
          '<td class="hide-sm">' + esc(nxt) + '</td><td class="hide-sm">' + (tries ? pct(w.correct, tries) + '%' : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      (list.length > shown.length ? '<div class="list-foot"><button class="btn btn-sm" data-action="word-more">' + esc(t('btn.showMore')) + '</button></div>' : '');
    return html + '</section>';
  }

  /* ----- tab: awards ----- */
  function tabAchievements() {
    const s = E.stats(store.state);
    const goal = store.state.settings.dailyGoal;
    const today = todayRecord().xp;
    const li = s.level;
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const rec = store.state.days.find((x) => x.date === dayKey(d.getTime()));
      days.push({ label: d.toLocaleDateString(VL.i18n.locale, { day: 'numeric' }), wd: d.toLocaleDateString(VL.i18n.locale, { weekday: 'short' }), xp: rec ? rec.xp : 0, met: !!(rec && rec.goalMet) });
    }
    const max = Math.max(goal, ...days.map((d) => d.xp), 1);
    const ach = E.achievements(store.state);
    return '<div class="two-col"><section class="card level-card"><div class="level-badge" aria-hidden="true">' + li.level + '</div><div class="level-body"><h2 class="card-title">' + esc(t('strip.level', { n: li.level })) + ' · ' + esc(t('tier.' + E.levelTier(li.level))) + '</h2>' +
      '<div class="bar"><span style="width:' + li.pct + '%"></span></div><p class="muted small">' + esc(t('ach.xpTo', { a: li.xp - li.from, b: li.to - li.from, n: li.level + 1 })) + '</p><p class="muted small">' + esc(t('ach.totalXp')) + ': <b>' + li.xp + '</b></p></div></section>' +
      '<section class="card"><h2 class="card-title">' + esc(t('ach.goalTitle')) + '</h2><div class="goal-row">' + ring(today, goal, 64, t('ach.today', { a: today, b: goal })) +
      '<div><p><b>' + esc(t('ach.today', { a: today, b: goal })) + '</b></p><div class="field"><label for="goal-select">' + esc(t('ach.goalText')) + '</label><select id="goal-select" aria-label="' + esc(t('ach.goalAria')) + '">' +
      [20, 50, 100, 150, 200].map((v) => '<option value="' + v + '"' + (v === goal ? ' selected' : '') + '>' + v + ' XP</option>').join('') + '</select></div></div></div></section></div>' +
      '<section class="card"><h2 class="card-title">' + esc(t('ach.history')) + '</h2><div class="xp-chart" role="img" aria-label="' + esc(t('ach.historyAria')) + '">' +
      '<div class="goal-line" style="bottom:calc(40px + ' + pct(goal, max) + 'px * 1.7)"><span>' + esc(t('ach.goalLine')) + ' ' + goal + '</span></div>' +
      days.map((d) => '<div class="col"><div class="col-bar"><span class="' + (d.met ? 'good' : '') + '" style="height:' + (d.xp ? Math.max(5, pct(d.xp, max)) : 0) + '%"></span></div><div class="col-val">' + d.xp + '</div><div class="col-label">' + esc(d.label) + '</div></div>').join('') + '</div></section>' +
      '<section class="card"><h2 class="card-title">' + esc(t('ach.list')) + '</h2><div class="ach-grid">' + ach.map((a) =>
        '<article class="ach' + (a.unlocked ? ' unlocked' : '') + '"><span class="ach-ico">' + icon(a.icon) + '</span><div><b>' + esc(t('ach.' + a.id + '.t')) + '</b><p class="small muted">' + esc(t('ach.' + a.id + '.d')) + '</p>' +
        (a.unlocked ? '<span class="chip chip-mastered">' + esc(t('ach.unlocked')) + '</span>' : '<div class="bar"><span style="width:' + pct(a.value, a.target) + '%"></span></div><span class="small muted">' + a.value + ' / ' + a.target + '</span>') + '</div></article>').join('') + '</div></section>';
  }

  /* =====================================================================
     LESSON PLAYER
     ===================================================================== */
  async function startLesson(type) {
    const pool = poolWords();
    const size = store.state.settings.lessonSize || 10;
    const built = E.buildLesson({ type, size, words: pool }, store.state.words);
    if (!built.items.length) { VL.ui.toast(t('les.empty'), 'error'); return; }
    const before = E.achievements(store.state).filter((a) => a.unlocked).map((a) => a.id);
    L = {
      v: 1, type, size, items: built.items, index: 0, correct: 0, wrong: 0, answers: 0, xp: 0, comboBonus: 0, combo: 0, bestCombo: 0,
      results: [], attempted: {}, retried: {}, wordCount: built.wordCount, newCount: built.newCount, activeMs: 0, tick: Date.now(),
      achBefore: before, levelBefore: E.stats(store.state).level.level,
    };
    queue(() => store.saveLesson(JSON.parse(JSON.stringify(L))));
    mode = 'lesson';
    renderItem();
  }

  function resumeLesson() {
    const saved = store.state.lesson;
    if (!saved) return;
    L = JSON.parse(JSON.stringify(saved));
    L.items = L.items.map((it) => {
      if (it.type === 'match') { it.pairs = it.pairs.filter((p) => store.word(p.wordId)); it.wordIds = it.pairs.map((p) => p.wordId); return it; }
      return it;
    }).filter((it) => (it.type === 'match' ? it.pairs.length >= 2 : !!store.word(it.wordIds[0])));
    L.tick = Date.now();
    if (L.index >= L.items.length) { finish(true); return; }
    mode = 'lesson';
    renderItem();
  }

  const sayWord = (w) => { if (store.state.settings.autoSpeak && VL.speech.supported) VL.speech.speak(w.en); };

  function topBar() {
    const total = L.items.length;
    return '<div class="lesson-top"><button type="button" class="icon-btn" data-action="pause" aria-label="' + esc(t('les.pauseAria')) + '">' + icon('x') + '</button>' +
      '<div class="lesson-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + L.index + '" aria-label="' + esc(t('les.progressAria')) + '"><span style="width:' + pct(L.index, total) + '%"></span></div>' +
      '<span class="combo' + (L.combo >= 2 ? ' on' : '') + '">' + (L.combo >= 2 ? icon('flame') + esc(t('les.combo', { n: L.combo })) : '') + '</span></div>';
  }

  function renderItem() {
    clearTimeout(timer);
    document.body.classList.add('focus-mode');
    const item = L.items[L.index];
    if (!item) { finish(true); return; }
    const words = item.wordIds.map((id) => store.word(id)).filter(Boolean);
    if (!words.length) { L.items.splice(L.index, 1); renderItem(); return; }
    cur = { item, answered: false, blockUntil: 0 };
    L.tick = Date.now();
    const w = words[0];
    let body = '';
    if (item.type === 'intro') body = introHtml(w);
    else if (item.type === 'choose') body = chooseHtml(item, w);
    else if (item.type === 'fill') body = fillHtml(item, w);
    else if (item.type === 'match') body = matchHtml(item);
    else body = typeHtml(item, w);
    root.innerHTML = '<div class="lesson">' + topBar() + '<section class="lesson-card" id="lcard">' + body + '</section><div id="lfeedback" class="lesson-feedback" hidden aria-live="assertive"></div></div>';
    bindItem(item, w);
  }

  const exampleHtml = (w) => (w.example ? '<p class="lesson-example"><b>' + esc(t('les.example')) + ':</b> ' + esc(w.example) + '</p>' : '');

  function introHtml(w) {
    return '<span class="chip chip-new-word">' + icon('star') + esc(t('les.newWord')) + '</span>' +
      '<p class="q-word">' + esc(w.en) + VL.speech.button(w.en, 'big') + '</p><p class="intro-uz">' + esc(w.uz) + '</p>' + exampleHtml(w) + '<p class="muted">' + esc(t('les.newWordHint')) + '</p>' +
      '<div class="lesson-actions"><button type="button" class="btn btn-primary btn-lg" id="btn-intro">' + esc(t('btn.continue')) + icon('arrow') + '</button></div>';
  }

  function chooseHtml(item, w) {
    return '<p class="lesson-type">' + esc(t('ex.choose')) + '</p><p class="q-label">' + esc(t('quiz.q')) + '</p>' +
      '<p class="q-word" lang="en">' + esc(w.en) + VL.speech.button(w.en, 'big') + '</p>' +
      '<div class="options" role="group" aria-label="' + esc(t('ex.choose')) + '">' + item.options.map((o, i) =>
        '<button type="button" class="option" data-index="' + i + '"><kbd>' + (i + 1) + '</kbd><span>' + esc(o.text) + '</span></button>').join('') + '</div>';
  }

  function typeHtml(item, w) {
    const toUz = item.dir === 'en-uz';
    const label = item.type === 'type' ? t('ex.type') : item.type === 'translate' ? t('ex.translate') : t('ex.reverse');
    const prompt = toUz ? w.en : w.uz;
    return '<p class="lesson-type">' + esc(label) + '</p><p class="q-label">' + esc(t(toUz ? 'q.typeUz' : 'q.typeEn')) + '</p>' +
      '<p class="q-word" lang="' + (toUz ? 'en' : 'uz') + '">' + esc(prompt) + (toUz ? VL.speech.button(w.en, 'big') : '') + '</p>' + answerForm(toUz ? 'quiz.phUz' : 'quiz.phEn', toUz ? 'quiz.ariaUz' : 'quiz.ariaEn');
  }

  function fillHtml(item, w) {
    const letters = item.mask.map((ch) => (ch === ' ' ? '<span class="gap"></span>' : '<span class="ch' + (ch === '_' ? ' blank' : '') + '">' + (ch === '_' ? '' : esc(ch)) + '</span>')).join('');
    return '<p class="lesson-type">' + esc(t('ex.fill')) + '</p><p class="q-label">' + esc(t('q.fill')) + '</p>' +
      '<p class="mask" aria-label="' + esc(item.mask.join(' ')) + '">' + letters + '</p><p class="fill-hint">' + esc(t('q.fillHint', { t: E.primary(w.uz) })) + '</p>' + answerForm('q.fillPh', 'quiz.ariaEn');
  }

  function answerForm(phKey, ariaKey) {
    return '<form id="lform" autocomplete="off" novalidate><label class="sr-only" for="lans">' + esc(t(ariaKey)) + '</label>' +
      '<input id="lans" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="' + esc(t(phKey)) + '">' +
      '<div class="quiz-buttons"><button type="submit" class="btn btn-primary" id="btn-check">' + esc(t('btn.check')) + '</button>' +
      '<button type="button" class="btn btn-ghost" id="btn-skip">' + esc(t('btn.dontKnow')) + '</button></div></form>';
  }

  function matchHtml(item) {
    const left = VL.util.shuffle(item.pairs), right = VL.util.shuffle(item.pairs);
    cur.match = { done: new Set(), mistakes: {}, selL: null, selR: null, total: item.pairs.length };
    return '<p class="lesson-type">' + esc(t('ex.match')) + '</p><p class="q-label">' + esc(t('match.hint')) + '</p><div class="match-board">' +
      '<div class="match-col" role="group" aria-label="' + esc(t('match.enAria')) + '">' + left.map((p) => '<button type="button" class="tile" data-side="l" data-id="' + esc(p.wordId) + '">' + esc(p.en) + '</button>').join('') + '</div>' +
      '<div class="match-col" role="group" aria-label="' + esc(t('match.uzAria')) + '">' + right.map((p) => '<button type="button" class="tile" data-side="r" data-id="' + esc(p.wordId) + '">' + esc(p.uz) + '</button>').join('') + '</div></div>';
  }

  function bindItem(item, w) {
    if (item.type === 'intro') {
      root.querySelector('#btn-intro').addEventListener('click', () => { cur.answered = true; cur.blockUntil = 0; next(true); });
      root.querySelector('#btn-intro').focus();
      sayWord(w);
      return;
    }
    if (item.type === 'choose') { sayWord(w); return; }
    if (item.type === 'match') return;
    const input = root.querySelector('#lans');
    input.focus();
    root.querySelector('#lform').addEventListener('submit', (e) => { e.preventDefault(); submitTyped(input.value, false); });
    root.querySelector('#btn-skip').addEventListener('click', () => submitTyped('', true));
    if (item.dir === 'en-uz' && item.type !== 'fill') sayWord(w);
  }

  /* ----- grading ----- */
  function grade(item, w, correct, info) {
    cur.answered = true;
    cur.blockUntil = Date.now() + GUARD_MS;
    const first = !L.attempted[w.id];
    L.attempted[w.id] = true;
    const xp = E.xpFor(item.type, correct, item.retry);
    let bonus = 0;
    if (correct) { L.combo++; L.bestCombo = Math.max(L.bestCombo, L.combo); if (L.combo % E.XP.comboEvery === 0) bonus = E.XP.comboBonus; } else L.combo = 0;
    L.answers++;
    if (correct) L.correct++; else L.wrong++;
    L.xp += xp; L.comboBonus += bonus;
    L.activeMs += Math.min(Date.now() - L.tick, 120000);
    L.results.push({ wordId: w.id, type: item.type, correct, expected: info.expected, typed: info.typed || '' });
    let retry = false;
    if (!correct && !L.retried[w.id]) {
      L.retried[w.id] = true; retry = true;
      L.items.push(E.makeItem(item.type === 'choose' ? 'translate' : 'choose', w, store.state.words, { retry: true }));
    }
    const snapshot = JSON.parse(JSON.stringify(Object.assign({}, L, { index: L.index + 1 })));
    queue(async () => {
      await store.recordLearn(w.id, correct, first && !item.retry);
      const r = await store.logLearn({ xp: xp + bonus, answers: 1, correct: correct ? 1 : 0 });
      if (r.goalJustMet) VL.ui.toast(t('goal.reached'), 'success', 3500);
      await store.saveLesson(snapshot);
    });
    return { xp, bonus, retry };
  }

  function showFeedback(ok, titleKey, lines, xp, bonus, isLast) {
    const fb = root.querySelector('#lfeedback');
    fb.className = 'lesson-feedback ' + (ok ? 'ok' : 'bad');
    fb.hidden = false;
    fb.innerHTML = '<div class="fb-inner"><span class="fb-ico">' + icon(ok ? 'check' : 'x') + '</span><div class="fb-text"><strong>' + esc(t(titleKey)) + '</strong>' +
      lines.map((l) => '<div>' + l + '</div>').join('') + '</div>' +
      (ok && xp ? '<span class="xp-pop">' + esc(t('fb.xp', { n: xp })) + '</span>' : '') +
      '<button type="button" class="btn btn-lg ' + (ok ? 'btn-ok' : 'btn-bad') + '" id="btn-next">' + esc(t(isLast ? 'btn.finishLesson' : 'btn.continue')) + icon('arrow') + '</button></div>' +
      (bonus ? '<div class="fb-bonus">' + icon('flame') + esc(t('fb.combo', { n: bonus })) + '</div>' : '');
    const btn = fb.querySelector('#btn-next');
    btn.addEventListener('click', () => next(false));
    btn.focus();
    const card = root.querySelector('#lcard');
    card.classList.add(ok ? 'is-correct' : 'is-wrong');
    const top = root.querySelector('.combo');
    if (top) { top.className = 'combo' + (L.combo >= 2 ? ' on' : ''); top.innerHTML = L.combo >= 2 ? icon('flame') + esc(t('les.combo', { n: L.combo })) : ''; }
    if (ok && store.state.settings.autoAdvance) timer = setTimeout(() => next(false), 1300);
  }

  const isLastItem = () => L.index >= L.items.length - 1;

  function exampleLine(w) { return w.example ? esc(t('les.example')) + ': ' + esc(w.example) : ''; }

  function chooseAnswer(index) {
    if (cur.answered) return;
    const item = cur.item, w = store.word(item.wordIds[0]);
    const chosen = item.options[index];
    const correct = !!chosen.correct;
    const res = grade(item, w, correct, { expected: w.uz, typed: chosen.text });
    root.querySelectorAll('.option').forEach((b, i) => {
      b.disabled = true;
      if (item.options[i].correct) b.classList.add('right');
      else if (i === index) b.classList.add('wrong');
    });
    const lines = [];
    if (!correct) { lines.push(esc(t('fb.rightIs', { a: w.uz }))); lines.push(esc(t('fb.meaning', { en: w.en, uz: E.primary(w.uz) }))); }
    else if (VL.quiz.acceptedAnswers(w.uz).length > 1) lines.push(esc(t('fb.allAccepted', { a: w.uz })));
    if (w.example) lines.push(exampleLine(w));
    if (res.retry) lines.push(esc(t('fb.comesBack')));
    showFeedback(correct, correct ? 'fb.correct' : 'fb.notQuite', lines, res.xp, res.bonus, isLastItem());
  }

  function submitTyped(text, giveUp) {
    if (cur.answered) return;
    const item = cur.item, w = store.word(item.wordIds[0]);
    const typed = text.trim();
    if (!typed && !giveUp) {
      const input = root.querySelector('#lans');
      input.classList.add('shake'); setTimeout(() => input.classList.remove('shake'), 400);
      return;
    }
    const expected = item.type === 'fill' ? w.en : E.expectedFor(item, w);
    const lenient = store.state.settings.lenient;
    const r = typed ? E.checkTyped(typed, expected, lenient) : { correct: false, closeCall: false };
    const res = grade(item, w, r.correct, { expected, typed });
    root.querySelector('#lans').readOnly = true;
    const form = root.querySelector('#lform .quiz-buttons');
    if (form) form.remove();
    const lines = [];
    const speakBtn = item.dir === 'uz-en' || item.type === 'fill' ? VL.speech.button(w.en) : '';
    if (r.correct) {
      if (VL.quiz.acceptedAnswers(expected).length > 1) lines.push(esc(t('fb.allAccepted', { a: expected })));
      if (speakBtn) lines.push(esc(w.en) + speakBtn);
    } else {
      if (r.closeCall) lines.push(esc(t('fb.close')));
      lines.push(esc(t('fb.rightIs', { a: expected })) + speakBtn);
      if (typed) lines.push(esc(t('fb.youTyped', { x: typed })));
      if (item.type === 'fill') lines.push(esc(t('fb.fullWord', { w: w.en })));
      lines.push(esc(t('fb.meaning', { en: w.en, uz: E.primary(w.uz) })));
    }
    if (w.example) lines.push(exampleLine(w));
    if (res.retry) lines.push(esc(t('fb.comesBack')));
    showFeedback(r.correct, r.correct ? 'fb.correct' : (typed ? 'fb.notQuite' : 'fb.noProblem'), lines, res.xp, res.bonus, isLastItem());
  }

  /* ----- match board ----- */
  function matchPick(btn) {
    if (cur.answered || btn.disabled) return;
    const m = cur.match, side = btn.dataset.side, id = btn.dataset.id;
    const key = side === 'l' ? 'selL' : 'selR';
    root.querySelectorAll('.tile[data-side="' + side + '"]').forEach((b) => b.classList.remove('selected'));
    if (m[key] === id) { m[key] = null; return; }
    m[key] = id;
    btn.classList.add('selected');
    if (m.selL && m.selR) matchCheck();
  }

  function matchCheck() {
    const m = cur.match;
    const lBtn = root.querySelector('.tile[data-side="l"][data-id="' + m.selL + '"]');
    const rBtn = root.querySelector('.tile[data-side="r"][data-id="' + m.selR + '"]');
    if (m.selL === m.selR) {
      [lBtn, rBtn].forEach((b) => { b.classList.remove('selected'); b.classList.add('matched'); b.disabled = true; });
      m.done.add(m.selL);
      m.selL = m.selR = null;
      if (m.done.size === m.total) matchFinish();
    } else {
      m.mistakes[m.selL] = (m.mistakes[m.selL] || 0) + 1;
      [lBtn, rBtn].forEach((b) => { b.classList.remove('selected'); b.classList.add('miss'); });
      m.selL = m.selR = null;
      setTimeout(() => root.querySelectorAll('.tile.miss').forEach((b) => b.classList.remove('miss')), 450);
    }
  }

  function matchFinish() {
    const item = cur.item, m = cur.match;
    cur.answered = true;
    cur.blockUntil = Date.now() + GUARD_MS;
    let xp = 0, bonus = 0, wrongTries = 0;
    const weak = [];
    const logs = [];
    item.pairs.forEach((p) => {
      const mistakes = m.mistakes[p.wordId] || 0;
      const ok = mistakes === 0;
      wrongTries += mistakes;
      const first = !L.attempted[p.wordId];
      L.attempted[p.wordId] = true;
      const gained = ok ? E.XP.matchPair : Math.round(E.XP.matchPair / 2);
      xp += gained;
      if (ok) { L.combo++; L.bestCombo = Math.max(L.bestCombo, L.combo); if (L.combo % E.XP.comboEvery === 0) bonus += E.XP.comboBonus; } else { L.combo = 0; weak.push(p.en); }
      L.answers++;
      if (ok) L.correct++; else L.wrong++;
      L.results.push({ wordId: p.wordId, type: 'match', correct: ok, expected: p.uz, typed: '' });
      logs.push({ id: p.wordId, ok, first });
    });
    L.xp += xp; L.comboBonus += bonus;
    L.activeMs += Math.min(Date.now() - L.tick, 120000);
    const snapshot = JSON.parse(JSON.stringify(Object.assign({}, L, { index: L.index + 1 })));
    queue(async () => {
      for (const l of logs) await store.recordLearn(l.id, l.ok, l.first);
      const r = await store.logLearn({ xp: xp + bonus, answers: logs.length, correct: logs.filter((l) => l.ok).length });
      if (r.goalJustMet) VL.ui.toast(t('goal.reached'), 'success', 3500);
      await store.saveLesson(snapshot);
    });
    const lines = [esc(t('fb.matchAll'))];
    if (wrongTries) lines.push(esc(t('fb.matchMistakes', { n: wrongTries })));
    if (weak.length) lines.push(esc(t('fb.matchWeak', { w: weak.join(', ') })));
    showFeedback(true, 'fb.correct', lines, xp, bonus, isLastItem());
  }

  /* ----- navigation inside the lesson ----- */
  function next(fromIntro) {
    if (!cur || !cur.answered || Date.now() < cur.blockUntil) return;
    clearTimeout(timer);
    L.index++;
    if (fromIntro) {
      const snapshot = JSON.parse(JSON.stringify(L));
      queue(() => store.saveLesson(snapshot));
    }
    if (L.index >= L.items.length) finish(true); else renderItem();
  }

  async function pauseDialog() {
    if (!L) return;
    const v = await VL.ui.modal({
      title: t('pause.title'), body: '<p class="modal-text">' + esc(t('pause.text')) + '</p>',
      buttons: [{ label: t('btn.keepGoing'), value: 'keep', kind: 'primary' }, { label: t('pause.save'), value: 'save' }, { label: t('pause.end'), value: 'end', kind: 'ghost' }],
    });
    if (v === 'save') {
      const savedIndex = cur && cur.answered ? L.index + 1 : L.index;
      const snapshot = JSON.parse(JSON.stringify(Object.assign({}, L, { index: savedIndex })));
      await chain;
      await store.saveLesson(snapshot);
      L = null; cur = null;
      VL.ui.toast(t('pause.saved'), 'success', 3500);
      drawHub();
    } else if (v === 'end') {
      if (cur && cur.answered) L.index++;
      finish(false);
    }
  }

  /* ----- results ----- */
  async function finish(completed) {
    clearTimeout(timer);
    await chain;
    const done = L;
    document.body.classList.remove('focus-mode');
    if (!done.answers) { await store.saveLesson(null); L = null; cur = null; drawHub(); return; }
    const finishBonus = completed ? E.XP.finish : 0;
    if (finishBonus) {
      const r = await store.logLearn({ xp: finishBonus });
      if (r.goalJustMet) VL.ui.toast(t('goal.reached'), 'success', 3500);
    }
    const totalXp = done.xp + done.comboBonus + finishBonus;
    const missedIds = Array.from(new Set(done.results.filter((r) => !r.correct).map((r) => r.wordId)));
    await store.addSession({ kind: 'lesson', mode: done.type, scope: 'lesson', direction: 'en-uz', total: done.answers, correct: done.correct, wrong: done.wrong, xp: totalXp, missedIds, newWords: done.newCount, durationMs: done.activeMs });
    await store.saveLesson(null);
    const after = E.stats(store.state);
    const newAch = E.achievements(store.state).filter((a) => a.unlocked && !done.achBefore.includes(a.id));
    L = null; cur = null;
    renderResult({ done, completed, finishBonus, totalXp, missedIds, after, newAch });
  }

  function renderResult(R) {
    mode = 'result';
    const { done, after } = R;
    const p = pct(done.correct, done.answers);
    const goal = store.state.settings.dailyGoal, today = todayRecord().xp;
    const Rr = 52, C = 2 * Math.PI * Rr;
    const missed = [];
    const seen = new Set();
    done.results.filter((r) => !r.correct).forEach((r) => { if (seen.has(r.wordId)) return; seen.add(r.wordId); const w = store.word(r.wordId); if (w) missed.push(w); });
    root.innerHTML =
      '<header class="page-head"><div><h1>' + esc(t(R.completed ? 'res.title' : 'res.ended')) + '</h1><p class="muted">' + esc(t('ex.' + done.type)) + '</p></div></header>' +
      '<section class="card summary"><div class="ring" role="img" aria-label="' + esc(t('sum.ringAria', { p })) + '"><svg viewBox="0 0 120 120"><circle class="ring-bg" cx="60" cy="60" r="' + Rr + '"/><circle class="ring-fg" cx="60" cy="60" r="' + Rr + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - p / 100)).toFixed(1) + '"/></svg><div class="ring-text">' + p + '%</div></div>' +
      '<div class="res-main"><h2>' + esc(t(p === 100 ? 'sum.m100' : p >= 80 ? 'sum.m80' : p >= 50 ? 'sum.m50' : 'sum.m0')) + '</h2>' +
      '<p class="muted">' + esc(t('sum.line', { c: done.correct, w: done.wrong, q: n('n.question', done.answers) })) + '</p>' +
      '<div class="res-stats"><div><b class="xp-total">+' + R.totalXp + '</b><span>' + esc(t('res.xp')) + '</span></div><div><b>' + fmtTime(done.activeMs) + '</b><span>' + esc(t('res.time')) + '</span></div>' +
      '<div><b>' + done.wordCount + '</b><span>' + esc(t('res.words')) + '</span></div><div><b>' + done.newCount + '</b><span>' + esc(t('res.newWords')) + '</span></div><div><b>×' + done.bestCombo + '</b><span>' + esc(t('res.bestCombo')) + '</span></div></div>' +
      '<p class="small muted">' + (done.comboBonus ? esc(t('res.bonusCombo', { n: done.comboBonus })) + ' · ' : '') + (R.finishBonus ? esc(t('res.bonusFinish', { n: R.finishBonus })) : '') + '</p>' +
      '<div class="btn-row"><button class="btn btn-primary" data-action="again" data-type="' + esc(done.type) + '">' + icon('refresh') + esc(t('res.again')) + '</button><button class="btn" data-action="hub">' + esc(t('res.hub')) + '</button></div></div></section>' +
      '<section class="card res-progress"><div class="res-row">' + icon('flame') + '<span>' + esc(t('res.streak', { n: after.streak.current })) + '</span></div>' +
      '<div class="res-row">' + icon('flag') + '<span>' + esc(t('res.goal', { a: Math.min(today, goal), b: goal })) + '</span><div class="bar"><span style="width:' + Math.min(100, pct(today, goal)) + '%"></span></div></div>' +
      (after.level.level > done.levelBefore ? '<div class="res-row level-up">' + icon('star') + '<b>' + esc(t('res.levelUp', { n: after.level.level })) + '</b></div>' : '') + '</section>' +
      (R.newAch.length ? '<section class="card"><h2 class="card-title">' + esc(t('res.newAch')) + '</h2><div class="ach-grid">' + R.newAch.map((a) => '<article class="ach unlocked"><span class="ach-ico">' + icon(a.icon) + '</span><div><b>' + esc(t('ach.' + a.id + '.t')) + '</b><p class="small muted">' + esc(t('ach.' + a.id + '.d')) + '</p></div></article>').join('') + '</div></section>' : '') +
      (missed.length
        ? '<section class="card"><h2 class="card-title">' + esc(t('res.review')) + '</h2><ul class="word-list">' + missed.map((w) => '<li><div class="wl-main"><span class="wl-en">' + esc(w.en) + VL.speech.button(w.en) + '</span><span class="wl-uz">' + esc(w.uz) + '</span>' + (w.example ? '<span class="word-example">' + esc(w.example) + '</span>' : '') + '</div></li>').join('') + '</ul></section>'
        : '<section class="card"><p>' + esc(t('res.noMistakes')) + '</p></section>');
    const again = root.querySelector('[data-action="again"]');
    if (again) again.focus();
  }

  /* =====================================================================
     EVENTS
     ===================================================================== */
  async function onClick(e) {
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn && mode === 'hub') { tab = tabBtn.dataset.tab; drawHub(); return; }
    if (mode === 'lesson') {
      const opt = e.target.closest('.option');
      if (opt) return chooseAnswer(Number(opt.dataset.index));
      const tile = e.target.closest('.tile');
      if (tile) return matchPick(tile);
      if (e.target.closest('[data-action="pause"]')) return pauseDialog();
      return;
    }
    const a = e.target.closest('[data-action]');
    if (!a) return;
    const card = a.closest('[data-col]');
    const colId = card ? card.dataset.col : null;
    const row = a.closest('li[data-id]');
    switch (a.dataset.action) {
      case 'start': startLesson(a.dataset.type); break;
      case 'again': startLesson(a.dataset.type); break;
      case 'hub': drawHub(); break;
      case 'resume': resumeLesson(); break;
      case 'discard':
        if (await VL.ui.confirm({ title: t('btn.discard'), message: t('pause.title'), confirmLabel: t('btn.discard'), danger: true })) { await store.saveLesson(null); drawHub(); }
        break;
      case 'select-all': await store.setSetting('learnSelected', store.state.collections.map((c) => c.id)); break;
      case 'select-none': await store.setSetting('learnSelected', []); break;
      case 'new-col': await VL.wd.collectionDialog(null); break;
      case 'rename-col': await VL.wd.collectionDialog(colId); break;
      case 'delete-col': await VL.wd.deleteCollectionDialog(colId); expanded.delete(colId); break;
      case 'add-word': await VL.wd.wordDialog({ collectionId: colId }); break;
      case 'toggle-words': if (expanded.has(colId)) expanded.delete(colId); else expanded.add(colId); drawTab(); break;
      case 'edit-word': await VL.wd.wordDialog({ id: row.dataset.id }); break;
      case 'delete-word': await VL.wd.confirmDeleteWord(row.dataset.id); break;
      case 'deck-level': deckLevel = a.dataset.level; drawTab(); break;
      case 'deck-preview': {
        const k = card0(a); if (deckOpen.has(k)) deckOpen.delete(k); else deckOpen.add(k); drawTab(); break;
      }
      case 'deck-add': {
        const d = a.closest('.deck-card');
        const r = await installTopic(d.dataset.level, d.dataset.topic);
        VL.ui.toast(r.added ? t('deck.toast', { n: n('n.word', r.added), name: r.col.name }) : t('deck.toastNone', { name: r.col.name }), r.added ? 'success' : 'info', 3500);
        break;
      }
      case 'deck-add-level': {
        let words = 0, topics = 0;
        for (const tid of Object.keys(VL.deckTopics)) { const r = await installTopic(deckLevel, tid); words += r.added; topics++; }
        VL.ui.toast(t('deck.toastLevel', { w: n('n.word', words), t: topics }), words ? 'success' : 'info', 3500);
        break;
      }
      case 'word-filter': wordFilter = a.dataset.filter; wordLimit = 100; drawTab(); break;
      case 'word-more': wordLimit += 100; drawTab(); break;
    }
  }
  const card0 = (a) => { const d = a.closest('.deck-card'); return d.dataset.level + '.' + d.dataset.topic; };

  async function onChange(e) {
    const el = e.target;
    if (el.id === 'lesson-size') await store.setSetting('lessonSize', Number(el.value));
    else if (el.id === 'goal-select') await store.setSetting('dailyGoal', Number(el.value));
    else if (el.dataset && el.dataset.action === 'toggle-col') {
      const id = el.closest('[data-col]').dataset.col;
      const cur2 = selectedIds();
      await store.setSetting('learnSelected', el.checked ? cur2.concat(id) : cur2.filter((x) => x !== id));
    }
  }

  function onKey(e) {
    if (mode !== 'lesson' || !cur || document.querySelector('dialog[open]') || e.isComposing) return;
    if (!cur.answered && cur.item.type === 'choose' && /^[1-4]$/.test(e.key)) {
      const idx = Number(e.key) - 1;
      if (cur.item.options[idx]) { e.preventDefault(); chooseAnswer(idx); }
      return;
    }
    if (cur.answered && e.key === 'Enter' && !/^(BUTTON|A|TEXTAREA|SELECT)$/.test(e.target.tagName)) { e.preventDefault(); next(cur.item.type === 'intro'); }
  }

  function redraw() {
    if (mode === 'hub') drawHub();
  }

  return {
    mount(el, params) {
      root = el;
      mode = 'hub'; L = null; cur = null;
      const want = params.get('tab');
      if (TABS.includes(want)) tab = want;
      drawHub();
      root.addEventListener('click', onClick);
      root.addEventListener('change', onChange);
      keyHandler = onKey;
      document.addEventListener('keydown', keyHandler);
      off = store.onChange(redraw);
    },
    unmount() {
      clearTimeout(timer);
      if (off) off();
      if (root) { root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); }
      document.removeEventListener('keydown', keyHandler);
      document.body.classList.remove('focus-mode');
      L = null; cur = null; mode = 'hub';   // an unfinished lesson stays saved and can be resumed
    },
  };
})();
