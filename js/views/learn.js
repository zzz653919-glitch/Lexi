/* Word Lessons: Duolingo-style exercises, spaced repetition, XP, streak and awards.
   Hub tabs (exercises, collections, ready-made decks, word knowledge, awards) + the lesson player. */
VL.views.learn = (function () {
  const { esc, pct, dayKey } = VL.util;
  const { icon } = VL.ui;
  const t = VL.t, n = VL.n;
  const store = VL.store, E = VL.learn;
  const EX_META = {
    choose: { icon: 'list', color: 'violet' }, type: { icon: 'edit', color: 'teal' }, translate: { icon: 'book', color: 'orange' },
    fill: { icon: 'type', color: 'pink' }, match: { icon: 'link', color: 'green' }, reverse: { icon: 'refresh', color: 'red' },
    review: { icon: 'clock', color: 'blue' }, scramble: { icon: 'shuffle', color: 'orange' }, listen: { icon: 'volume', color: 'blue' },
    sentEnUz: { icon: 'book', color: 'teal' }, sentUzEn: { icon: 'refresh', color: 'violet' }, order: { icon: 'list', color: 'green' }, cloze: { icon: 'type', color: 'pink' },
  };
  const SINGLE_TYPES = ['choose', 'scramble', 'listen', 'type', 'translate', 'reverse', 'fill', 'match', 'sentEnUz', 'sentUzEn', 'order', 'cloze', 'review'];
  const TABS = ['practice', 'collections', 'decks', 'words', 'achievements'];

  let root, off;
  let tab = 'practice';
  let expanded = new Set(), deckLevel = 'A1', deckOpen = new Set(), wordFilter = 'all', wordLimit = 100;

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
    if (type === 'listen' && !VL.speech.supported) return t('ex.noSpeech');
    if (type === 'scramble' && !pool.some((w) => /^\p{L}{3,12}$/u.test(w.en.trim()))) return t('ex.needLetters');
    return '';
  }

  function tabPractice() {
    const pool = poolWords();
    const ids = selectedIds();
    const due = VL.srs.reviewPool(pool).length;
    const fresh = pool.filter((w) => !w.reps).length;
    const length = store.state.settings.lessonLength || 12;
    const focus = Math.min(pool.length, length <= 10 ? 3 : length <= 12 ? 4 : 5);
    let html = '';
    if (store.state.lesson) {
      const sl = store.state.lesson;
      html += '<section class="card resume"><div><h2 class="card-title">' + icon('pause') + esc(t('resume.title')) + '</h2><p class="muted">' + esc(t('resume.text', { type: t('ex.' + sl.type), i: Math.min(sl.index, sl.items.length), n: sl.items.length })) + '</p></div>' +
        '<div class="btn-row"><button class="btn btn-primary" data-action="resume">' + icon('play') + esc(t('btn.resume')) + '</button><button class="btn" data-action="discard">' + esc(t('btn.discard')) + '</button></div></section>';
    }
    html += '<section class="card today"><div class="today-main"><span class="today-ico">' + icon('zap') + '</span><div><h2 class="card-title">' + esc(t('lesson.today')) + '</h2>' +
      '<p class="muted">' + esc(t('lesson.intro')) + '</p>' +
      '<p class="today-plan"><b>' + esc(pool.length ? t('lesson.plan', { s: length, w: n('n.word', focus) }) : t('ex.needWords')) + '</b> · ' + esc(t('src.new', { n: fresh })) + ' · ' + esc(t('src.due', { n: due })) + '</p></div></div>' +
      '<div class="today-side"><div class="field"><label for="lesson-length">' + esc(t('lesson.length')) + '</label><select id="lesson-length">' +
      E.GUIDED_LENGTHS.map((v) => '<option value="' + v + '"' + (v === length ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></div>' +
      '<button class="btn btn-primary btn-xl" data-action="start" data-type="guided"' + (pool.length ? '' : ' disabled') + '>' + icon('play') + esc(t('lesson.start')) + '</button></div></section>';
    html += '<section class="card source"><div class="source-main"><h2 class="card-title">' + esc(t('src.title')) + '</h2>' +
      '<p><b>' + esc(ids.length ? t('src.some', { n: ids.length }) : t('src.all')) + '</b> · ' + esc(n('n.word', pool.length)) + '</p>' +
      '<p class="hint">' + esc(t('src.hint')) + '</p></div>' +
      '<div class="source-side"><button class="btn btn-sm" data-tab="collections">' + icon('folder') + esc(t('src.change')) + '</button></div></section>';
    html += '<h2 class="section-title">' + esc(t('lesson.only')) + '</h2><div class="ex-grid">' + SINGLE_TYPES.map((k) => {
      const m = EX_META[k];
      const block = exerciseAvailability(k, pool, due);
      return '<button type="button" class="ex-card c-' + m.color + '" data-action="start" data-type="' + k + '"' + (block ? ' disabled' : '') + '>' +
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
      '<a class="btn btn-sm" href="#/bulk">' + icon('list') + esc(t('bulk.entry')) + '</a>' +
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
     EVENTS
     ===================================================================== */
  async function onClick(e) {
    if (VL.player.active()) return;   // the lesson player handles its own clicks
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) { tab = tabBtn.dataset.tab; drawHub(); return; }
    const a = e.target.closest('[data-action]');
    if (!a) return;
    const card = a.closest('[data-col]');
    const colId = card ? card.dataset.col : null;
    const row = a.closest('li[data-id]');
    switch (a.dataset.action) {
      case 'start': VL.player.start(root, { type: a.dataset.type, words: poolWords() }, { onExit: drawHub }); break;
      case 'resume': VL.player.resume(root, { onExit: drawHub }); break;
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
    if (VL.player.active()) return;
    if (el.id === 'lesson-length') await store.setSetting('lessonLength', Number(el.value));
    else if (el.id === 'goal-select') await store.setSetting('dailyGoal', Number(el.value));
    else if (el.dataset && el.dataset.action === 'toggle-col') {
      const id = el.closest('[data-col]').dataset.col;
      const cur2 = selectedIds();
      await store.setSetting('learnSelected', el.checked ? cur2.concat(id) : cur2.filter((x) => x !== id));
    }
  }

  function redraw() {
    if (!VL.player.active()) drawHub();
  }

  return {
    mount(el, params) {
      root = el;
      const want = params.get('tab');
      if (TABS.includes(want)) tab = want;
      drawHub();
      root.addEventListener('click', onClick);
      root.addEventListener('change', onChange);
      off = store.onChange(redraw);
    },
    unmount() {
      if (off) off();
      if (root) { root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); }
      VL.player.detach();   // an unfinished lesson stays saved and can be resumed
    },
  };
})();
