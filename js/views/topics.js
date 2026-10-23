/* Vocabulary topics ("Lug'at mavzulari"): 120 topics in 10 categories, each with real words, translations,
   example sentences and levels (data in js/data). Opening a topic lists its words; learning installs the words
   into the user's own vocabulary (once - a word that already exists is reused), so progress is stored per
   word and per user in the same database as everything else. */
VL.views.topics = (function () {
  const { esc, pct } = VL.util;
  const { icon } = VL.ui;
  const t = VL.t, n = VL.n;
  const store = VL.store;
  let root = null, off = null;
  let topicId = null;
  const f = { q: '', cat: 'all', level: 'all', status: 'all' };           // list filters
  const g = { q: '', level: 'all', status: 'all', selected: new Set(), limit: 60 }; // topic page filters

  const lang = () => VL.i18n.lang;
  const nameOf = (o) => o[lang()] || o.en;
  const rowsOf = (id) => VL.vocabWords[id] || [];
  const keyOf = (en) => VL.quiz.normalize(en, false);
  const posName = (code) => VL.POS_CODES[code] || 'other';
  const entry = (r) => ({ en: r[0], uz: r[1], pos: r[2], level: r[3], ex: r[4], exUz: r[5], syn: r[6] || '' });

  function wordMap() {
    const m = new Map();
    store.state.words.forEach((w) => { const k = keyOf(w.en); if (!m.has(k)) m.set(k, w); });
    return m;
  }

  function stats(tp, map) {
    const rows = rowsOf(tp.id);
    let learned = 0, hard = 0, started = 0;
    rows.forEach((r) => {
      const w = map.get(keyOf(r[0]));
      if (!w) return;
      started++;
      if (VL.srs.isLearned(w)) learned++;
      if (w.hard) hard++;
    });
    return { total: rows.length, learned, hard, started, pct: rows.length ? Math.round(learned / rows.length * 100) : 0 };
  }

  // short description made from the topic's real words
  function describe(tp) {
    const rows = rowsOf(tp.id);
    if (!rows.length) return t('tp.soon');
    return rows.slice(0, 4).map((r) => r[0]).join(', ') + '…';
  }

  /* =============== list of topics =============== */
  function matchesLevel(rows, level) { return level === 'all' || rows.some((r) => r[3] === level); }

  function drawList() {
    const map = wordMap();
    const q = f.q.trim().toLowerCase();
    const topics = VL.vocabTopics.filter((tp) => {
      const rows = rowsOf(tp.id);
      if (f.cat !== 'all' && tp.cat !== f.cat) return false;
      if (!matchesLevel(rows, f.level)) return false;
      const st = stats(tp, map);
      if (f.status === 'unlearned' && st.learned >= st.total) return false;
      if (f.status === 'hard' && !st.hard) return false;
      if (f.status === 'learned' && !st.learned) return false;
      if (q && ![tp.uz, tp.en, tp.ru].some((x) => x.toLowerCase().includes(q)) && !rows.some((r) => r[0].toLowerCase().includes(q) || r[1].toLowerCase().includes(q))) return false;
      return true;
    });
    const totalWords = VL.vocabTopics.reduce((a, tp) => a + rowsOf(tp.id).length, 0);
    let wordHits = '';
    if (q.length >= 2) {
      const hits = [];
      VL.vocabTopics.forEach((tp) => rowsOf(tp.id).forEach((r) => {
        if ((r[0].toLowerCase().includes(q) || r[1].toLowerCase().includes(q)) && (f.level === 'all' || r[3] === f.level)) hits.push({ tp, r });
      }));
      if (hits.length) {
        wordHits = '<section class="card tp-hits"><h2 class="card-title">' + esc(t('tp.foundWords', { n: hits.length })) + '</h2><ul class="word-list">' +
          hits.slice(0, 40).map((h) => '<li><div class="wl-main"><span class="wl-en">' + esc(h.r[0]) + VL.speech.button(h.r[0]) + '</span><span class="wl-uz">' + esc(h.r[1]) + '</span></div>' +
            '<a class="chip" href="#/topics?t=' + h.tp.id + '">' + esc(h.tp.emoji + ' ' + nameOf(h.tp)) + '</a></li>').join('') + '</ul>' + (hits.length > 40 ? '<p class="muted small">' + esc(t('tp.more', { n: hits.length - 40 })) + '</p>' : '') + '</section>';
      }
    }
    const cats = VL.vocabCategories;
    let html = '';
    cats.forEach((c) => {
      const list = topics.filter((tp) => tp.cat === c.id);
      if (!list.length) return;
      html += '<section class="tp-cat" aria-labelledby="cat-' + c.id + '"><h2 class="section-title" id="cat-' + c.id + '">' + esc(c.emoji + ' ' + nameOf(c)) + ' <span class="muted small">' + list.length + '</span></h2><div class="tp-grid">' +
        list.map((tp) => cardHtml(tp, stats(tp, map))).join('') + '</div></section>';
    });
    root.querySelector('#tp-body').innerHTML = wordHits + (html || '<section class="card"><p class="muted">' + esc(t('tp.none')) + '</p></section>');
    root.querySelector('#tp-count').textContent = t('tp.summary', { t: topics.length, w: totalWords });
  }

  function cardHtml(tp, st) {
    const empty = !st.total;
    return '<article class="card tp-card" data-topic="' + tp.id + '"><div class="tp-top"><span class="tp-emoji" aria-hidden="true">' + tp.emoji + '</span>' +
      '<div class="tp-name"><h3><a href="#/topics?t=' + tp.id + '">' + esc(nameOf(tp)) + '</a></h3><p class="muted small">' + esc(describe(tp)) + '</p></div></div>' +
      '<ul class="tp-facts"><li><b>' + st.total + '</b> ' + esc(t('tp.words')) + '</li><li><b>' + st.learned + '</b> ' + esc(t('tp.learned')) + '</li><li><b>' + st.pct + '%</b> ' + esc(t('tp.done')) + '</li></ul>' +
      '<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + st.pct + '" aria-label="' + esc(nameOf(tp)) + '"><span style="width:' + st.pct + '%"></span></div>' +
      '<div class="btn-row"><button class="btn btn-primary btn-sm" data-action="tp-start"' + (empty ? ' disabled' : '') + '>' + icon('play') + esc(t('tp.start')) + '</button>' +
      '<a class="btn btn-sm btn-ghost" href="#/topics?t=' + tp.id + '">' + esc(t('tp.open')) + '</a></div></article>';
  }

  function mountList() {
    root.innerHTML =
      '<header class="page-head"><div><h1>' + esc(t('nav.topics')) + '</h1><p class="muted">' + esc(t('tp.sub')) + '</p></div></header>' +
      '<section class="card tp-tools"><div class="field tp-search"><label for="tp-q">' + esc(t('tp.search')) + '</label><input id="tp-q" type="search" autocomplete="off" placeholder="' + esc(t('tp.searchPh')) + '" value="' + esc(f.q) + '"></div>' +
      '<div class="field"><label for="tp-cat">' + esc(t('tp.category')) + '</label><select id="tp-cat"><option value="all">' + esc(t('tp.allCats')) + '</option>' + VL.vocabCategories.map((c) => '<option value="' + c.id + '"' + (f.cat === c.id ? ' selected' : '') + '>' + esc(c.emoji + ' ' + nameOf(c)) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="tp-level">' + esc(t('tp.level')) + '</label><select id="tp-level"><option value="all">' + esc(t('tp.allLevels')) + '</option>' + VL.VOCAB_LEVELS.map((l) => '<option' + (f.level === l ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="tp-status">' + esc(t('tp.show')) + '</label><select id="tp-status">' + [['all', 'tp.fAll'], ['unlearned', 'tp.fUnlearned'], ['learned', 'tp.fLearned'], ['hard', 'tp.fHard']].map((o) => '<option value="' + o[0] + '"' + (f.status === o[0] ? ' selected' : '') + '>' + esc(t(o[1])) + '</option>').join('') + '</select></div></section>' +
      '<p class="muted small" id="tp-count" aria-live="polite"></p><div id="tp-body"></div>';
    drawList();
  }

  /* =============== one topic =============== */
  function entriesFiltered(tp, map) {
    const q = g.q.trim().toLowerCase();
    return rowsOf(tp.id).map(entry).map((e) => Object.assign(e, { word: map.get(keyOf(e.en)) || null })).filter((e) => {
      if (g.level !== 'all' && e.level !== g.level) return false;
      if (q && !e.en.toLowerCase().includes(q) && !e.uz.toLowerCase().includes(q)) return false;
      const learned = e.word && VL.srs.isLearned(e.word);
      if (g.status === 'unlearned' && learned) return false;
      if (g.status === 'learned' && !learned) return false;
      if (g.status === 'hard' && !(e.word && e.word.hard)) return false;
      return true;
    });
  }

  function statusChip(e) {
    if (!e.word) return '<span class="chip">' + esc(t('st.new')) + '</span>';
    const s = store.status(e.word);
    return '<span class="chip chip-' + s + '">' + esc(t('st.' + s)) + '</span>';
  }

  function drawWords() {
    const tp = VL.vocabTopics.find((x) => x.id === topicId);
    const map = wordMap();
    const st = stats(tp, map);
    const list = entriesFiltered(tp, map);
    const shown = list.slice(0, g.limit);
    root.querySelector('#tp-head-stats').innerHTML = '<span><b>' + st.total + '</b> ' + esc(t('tp.words')) + '</span><span><b>' + st.learned + '</b> ' + esc(t('tp.learned')) + '</span><span><b>' + st.pct + '%</b> ' + esc(t('tp.done')) + '</span><span><b>' + st.hard + '</b> ' + esc(t('tp.hardN')) + '</span>';
    root.querySelector('#tp-bar').style.width = st.pct + '%';
    root.querySelector('#tp-sel').textContent = t('tp.selected', { n: g.selected.size });
    root.querySelector('[data-action="tp-start-sel"]').disabled = !g.selected.size;
    root.querySelector('#tp-words').innerHTML = shown.length
      ? shown.map((e) => {
        const k = keyOf(e.en);
        const learned = e.word && VL.srs.isLearned(e.word);
        return '<li class="tp-word" data-k="' + esc(k) + '"><label class="tp-pick"><input type="checkbox" data-action="tp-pick"' + (g.selected.has(k) ? ' checked' : '') + ' aria-label="' + esc(e.en) + '"></label>' +
          '<div class="tp-wmain"><div class="tp-wtop"><span class="wl-en">' + esc(e.en) + VL.speech.button(e.en) + '</span><span class="wl-uz">' + esc(e.uz) + '</span></div>' +
          '<div class="tp-chips"><span class="chip">' + esc(t('pos.' + posName(e.pos))) + '</span><span class="chip">' + esc(e.level) + '</span>' + statusChip(e) + (e.word && e.word.hard ? '<span class="chip chip-hard">' + esc(t('tp.hard')) + '</span>' : '') + '</div>' +
          '<p class="tp-ex"><span lang="en">' + esc(e.ex) + '</span>' + VL.speech.button(e.ex) + '<br><span class="muted" lang="uz">' + esc(e.exUz) + '</span></p>' +
          (e.syn ? '<p class="muted small">' + esc(t('tp.syn')) + ': ' + esc(e.syn) + '</p>' : '') + '</div>' +
          '<div class="tp-wact"><button type="button" class="icon-btn' + (e.word && e.word.hard ? ' on' : '') + '" data-action="tp-hard" aria-pressed="' + !!(e.word && e.word.hard) + '" aria-label="' + esc(t('tp.markHard')) + '" title="' + esc(t('tp.markHard')) + '">' + icon('flag') + '</button>' +
          '<button type="button" class="icon-btn' + (learned ? ' on' : '') + '" data-action="tp-known" aria-pressed="' + !!learned + '" aria-label="' + esc(t('tp.markKnown')) + '" title="' + esc(t('tp.markKnown')) + '"' + (learned ? ' disabled' : '') + '>' + icon('check') + '</button></div></li>';
      }).join('')
      : '<li class="muted">' + esc(t('tp.noWords')) + '</li>';
    root.querySelector('#tp-more').hidden = list.length <= g.limit;
    root.querySelector('#tp-more').textContent = t('tp.showMore', { n: list.length - g.limit });
    root.querySelector('#tp-shown').textContent = t('tp.showing', { a: Math.min(g.limit, list.length), b: list.length });
  }

  function mountTopic() {
    const tp = VL.vocabTopics.find((x) => x.id === topicId);
    const cat = VL.vocabCategories.find((c) => c.id === tp.cat);
    root.innerHTML =
      '<header class="page-head"><div><p class="small"><a href="#/topics">← ' + esc(t('nav.topics')) + '</a> · <span class="muted">' + esc(cat.emoji + ' ' + nameOf(cat)) + '</span></p><h1><span aria-hidden="true">' + tp.emoji + '</span> ' + esc(nameOf(tp)) + '</h1></div></header>' +
      '<section class="card tp-head"><div class="tp-hstats" id="tp-head-stats"></div><div class="bar"><span id="tp-bar"></span></div>' +
      '<div class="btn-row"><button class="btn btn-primary" data-action="tp-start"' + (rowsOf(tp.id).length ? '' : ' disabled') + '>' + icon('play') + esc(t('tp.start')) + '</button>' +
      '<button class="btn" data-action="tp-start-sel" disabled>' + esc(t('tp.startSel')) + '</button>' +
      '<button class="btn" data-action="tp-session">' + icon('plus') + esc(t('cs.new')) + '</button></div>' +
      '<p class="hint">' + esc(t('tp.unreviewed')) + '</p></section>' +
      '<section class="card tp-tools"><div class="field tp-search"><label for="tp-wq">' + esc(t('tp.searchWords')) + '</label><input id="tp-wq" type="search" autocomplete="off" placeholder="' + esc(t('tp.searchWordsPh')) + '" value="' + esc(g.q) + '"></div>' +
      '<div class="field"><label for="tp-wlevel">' + esc(t('tp.level')) + '</label><select id="tp-wlevel"><option value="all">' + esc(t('tp.allLevels')) + '</option>' + VL.VOCAB_LEVELS.map((l) => '<option' + (g.level === l ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="tp-wstatus">' + esc(t('tp.show')) + '</label><select id="tp-wstatus">' + [['all', 'tp.fAll'], ['unlearned', 'tp.fUnlearned'], ['learned', 'tp.fLearned'], ['hard', 'tp.fHard']].map((o) => '<option value="' + o[0] + '"' + (g.status === o[0] ? ' selected' : '') + '>' + esc(t(o[1])) + '</option>').join('') + '</select></div></section>' +
      '<section class="card"><div class="tp-listbar"><label class="check"><input type="checkbox" id="tp-all"><span>' + esc(t('tp.selectShown')) + '</span></label><span class="muted small" id="tp-sel"></span><span class="muted small" id="tp-shown"></span></div>' +
      '<ul class="tp-words" id="tp-words"></ul><button class="btn btn-ghost" id="tp-more" data-action="tp-more" hidden></button></section>';
    drawWords();
  }

  /* =============== installing and starting =============== */
  // Adds the topic's words that the user does not have yet (matched by English spelling) and returns word objects.
  async function ensureWords(tp, keys) {
    const rows = rowsOf(tp.id).map(entry).filter((e) => !keys || keys.has(keyOf(e.en)));
    const missing = rows.filter((e) => !store.wordByEn(e.en));
    if (missing.length) {
      const col = await store.ensureDeckCollection('topic.' + tp.id, nameOf(tp));
      await store.importWords(missing.map((e) => ({ en: e.en, uz: e.uz, example: e.ex, exUz: e.exUz, pos: posName(e.pos), level: e.level, collectionId: col.id })));
    }
    return rows.map((e) => store.wordByEn(e.en)).filter(Boolean);
  }

  async function startMix(tp, keys, hooks) {
    const words = await ensureWords(tp, keys);
    if (!words.length) return;
    if (store.state.lesson && !(await VL.ui.confirm({ title: t('cs.replaceTitle'), message: t('cs.replaceMsg'), confirmLabel: t('cs.replaceYes'), danger: true }))) return;
    await VL.player.start(root, { type: 'mix6', words, words_n: Math.min(words.length, store.state.settings.mixedWords || 10) }, hooks);
  }

  const hooksBack = () => ({ onExit: () => mount(root, new URLSearchParams(topicId ? 't=' + topicId : '')) });

  /* =============== events =============== */
  async function onClick(e) {
    if (VL.player.active()) return;
    const a = e.target.closest('[data-action]');
    if (!a) return;
    const card = a.closest('[data-topic]');
    const tp = VL.vocabTopics.find((x) => x.id === (card ? card.dataset.topic : topicId));
    switch (a.dataset.action) {
      case 'tp-start': await startMix(tp, null, hooksBack()); break;
      case 'tp-start-sel': await startMix(tp, new Set(g.selected), hooksBack()); break;
      case 'tp-session': {
        const keys = g.selected.size ? g.selected : null;
        const words = await ensureWords(tp, keys);
        await VL.custom.create(root, hooksBack(), { name: nameOf(tp), topicLabel: nameOf(tp), source: 'specific', ids: words.map((w) => w.id) });
        mount(root, new URLSearchParams('t=' + topicId));
        break;
      }
      case 'tp-more': g.limit += 60; drawWords(); break;
      case 'tp-hard': case 'tp-known': {
        const k = a.closest('[data-k]').dataset.k;
        const words = await ensureWords(tp, new Set([k]));
        if (!words.length) break;
        if (a.dataset.action === 'tp-hard') await store.setHard([words[0].id], !words[0].hard); else await store.markKnown([words[0].id]);
        drawWords();
        break;
      }
    }
  }

  function onInput(e) {
    const id = e.target.id;
    if (id === 'tp-q') { f.q = e.target.value; drawList(); }
    else if (id === 'tp-wq') { g.q = e.target.value; g.limit = 60; drawWords(); }
    else if (e.target.dataset && e.target.dataset.action === 'tp-pick') {
      const k = e.target.closest('[data-k]').dataset.k;
      if (e.target.checked) g.selected.add(k); else g.selected.delete(k);
      root.querySelector('#tp-sel').textContent = t('tp.selected', { n: g.selected.size });
      root.querySelector('[data-action="tp-start-sel"]').disabled = !g.selected.size;
    }
  }

  function onChange(e) {
    if (VL.player.active()) return;
    const id = e.target.id;
    if (id === 'tp-cat') { f.cat = e.target.value; drawList(); }
    else if (id === 'tp-level') { f.level = e.target.value; drawList(); }
    else if (id === 'tp-status') { f.status = e.target.value; drawList(); }
    else if (id === 'tp-wlevel') { g.level = e.target.value; g.limit = 60; drawWords(); }
    else if (id === 'tp-wstatus') { g.status = e.target.value; g.limit = 60; drawWords(); }
    else if (id === 'tp-all') {
      const tp = VL.vocabTopics.find((x) => x.id === topicId);
      entriesFiltered(tp, wordMap()).slice(0, g.limit).forEach((en) => { if (e.target.checked) g.selected.add(keyOf(en.en)); else g.selected.delete(keyOf(en.en)); });
      drawWords();
    }
  }

  function redraw() {
    if (VL.player.active() || !root) return;
    if (topicId) drawWords(); else drawList();
  }

  function mount(el, params) {
    root = el;
    const want = params.get('t');
    const newTopic = want && VL.vocabTopics.some((x) => x.id === want) ? want : null;
    if (newTopic !== topicId) { g.q = ''; g.level = 'all'; g.status = 'all'; g.selected = new Set(); g.limit = 60; }
    topicId = newTopic;
    if (topicId) mountTopic(); else mountList();
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
    if (!off) off = store.onChange(redraw);
  }

  function unmount() {
    if (off) { off(); off = null; }
    if (root) { root.removeEventListener('click', onClick); root.removeEventListener('input', onInput); root.removeEventListener('change', onChange); }
    VL.player.detach();
  }

  return { mount, unmount, ensureWords, stats };
})();
