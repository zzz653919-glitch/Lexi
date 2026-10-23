/* The interactive lesson player: runs one lesson (a list of exercise items) one exercise at a time.
   Flow for every exercise: answer -> "Check" -> coloured result panel with explanation -> "Continue".
   Progress, XP, spaced repetition, pause/resume and the results page all live here;
   the exercises themselves are components from exercises.js. */
VL.player = (function () {
  const { esc, pct } = VL.util;
  const { icon } = VL.ui;
  const t = VL.t, n = VL.n;
  const store = VL.store, E = VL.learn;
  const GUARD_MS = 250;
  const SRS_TYPES = new Set(['choose', 'type', 'translate', 'reverse', 'fill', 'scramble']);

  let root = null, hooks = null, L = null, cur = null, timer = null, chain = Promise.resolve(), listening = false;

  const queue = (fn) => { chain = chain.then(fn).catch((e) => console.error(e)); return chain; };
  const active = () => !!root && listening;
  const fmtTime = (ms) => { const s = Math.max(1, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const snapshot = (extra) => clone(Object.assign({}, L, extra));
  const isSrsItem = (item) => SRS_TYPES.has(item.type) || (item.type === 'listen' && !item.sentenceId);

  /* ---------- starting, resuming, leaving ---------- */
  function attach(container, h) {
    root = container; hooks = h || {};
    if (!listening) {
      root.addEventListener('click', onClick);
      document.addEventListener('keydown', onKey);
      listening = true;
    }
  }
  function detach() {
    clearTimeout(timer);
    if (cur && cur.cleanup) cur.cleanup();
    if (listening && root) { root.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); }
    listening = false; cur = null; L = null;
    document.body.classList.remove('focus-mode');
  }
  function exit() { const h = hooks; detach(); if (h && h.onExit) h.onExit(); }

  /* config: { type: 'guided' | single exercise type, words (pool), length, items (ready-made list) } */
  async function start(container, config, h) {
    attach(container, h);
    const all = store.state.words;
    const pool = config.words || all;
    let built;
    if (config.items) built = { items: config.items, wordIds: [], newCount: 0 };
    else if (config.type === 'mix6') built = E.buildMixed({ words: VL.srs.pick(pool, Math.min(pool.length, config.words_n || store.state.settings.mixedWords || 10)) }, all);
    else if (config.type === 'session') built = E.buildCustom({ words: pool, count: config.count, types: config.types, speech: VL.speech.supported }, all);
    else if (config.type === 'guided') built = E.buildGuided({ words: pool, length: config.length || store.state.settings.lessonLength || 12, speech: VL.speech.supported, history: store.state.settings.sentenceHistory || [] }, all);
    else built = E.buildSingle(config.type, { words: pool, size: config.size || store.state.settings.lessonSize || 10, speech: VL.speech.supported, history: store.state.settings.sentenceHistory || [] }, all);
    if (!built.items.length) { VL.ui.toast(t('les.empty'), 'error'); exit(); return; }
    const stats = E.stats(store.state);
    L = {
      v: 2, type: config.type, items: built.items, index: 0, correct: 0, wrong: 0, answers: 0, xp: 0, comboBonus: 0, combo: 0, bestCombo: 0,
      results: [], attempted: {}, retried: {}, retryCount: 0, wordIds: built.wordIds || [], wordCount: (built.wordIds || []).length, newCount: built.newCount || 0,
      sentenceIds: built.sentenceIds || [], custom: config.custom || null, mixedWordIds: config.type === 'mix6' ? built.wordIds : null, mixed: config.type === 'mix6', noRetry: config.type === 'mix6', customMode: config.mode || '', activeMs: 0, tick: Date.now(), achBefore: E.achievements(store.state).filter((a) => a.unlocked).map((a) => a.id), levelBefore: stats.level.level,
    };
    queue(() => store.saveLesson(clone(L)));
    renderItem();
  }

  function resume(container, h) {
    const saved = store.state.lesson;
    if (!saved) return false;
    attach(container, h);
    L = clone(saved);
    L.retryCount = L.retryCount || 0; L.sentenceIds = L.sentenceIds || []; L.wordIds = L.wordIds || [];
    L.items = L.items.filter((it) => {
      if (it.type === 'match') { it.pairs = it.pairs.filter((p) => store.word(p.wordId)); it.wordIds = it.pairs.map((p) => p.wordId); return it.pairs.length >= 2; }
      if (it.sentenceId) return !!VL.sentenceById(it.sentenceId);
      return !!store.word(it.wordIds[0]);
    });
    L.tick = Date.now();
    if (L.index >= L.items.length) { finish(true); return true; }
    renderItem();
    return true;
  }

  /* ---------- rendering one exercise ---------- */
  function topBar() {
    const total = L.items.length;
    return '<div class="lesson-top"><button type="button" class="icon-btn" data-action="pause" aria-label="' + esc(t('les.pauseAria')) + '">' + icon('x') + '</button>' +
      '<div class="lesson-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + L.index + '" aria-label="' + esc(t('les.progressAria')) + '"><span id="lbar" style="width:' + pct(L.index, total) + '%"></span></div>' +
      '<span class="lesson-step" id="lstep" aria-label="' + esc(t('lesson.stepAria', { i: Math.min(L.index + 1, total), n: total })) + '">' + Math.min(L.index + 1, total) + ' / ' + total + '</span>' +
      '<span class="combo' + (L.combo >= 2 ? ' on' : '') + '" id="lcombo">' + (L.combo >= 2 ? icon('flame') + esc(t('les.combo', { n: L.combo })) : '') + '</span></div>';
  }

  function renderItem() {
    clearTimeout(timer);
    if (cur && cur.cleanup) cur.cleanup();
    document.body.classList.add('focus-mode');
    const item = L.items[L.index];
    if (!item) { finish(true); return; }
    const comp = VL.exercises.forItem(item);
    const words = (item.type === 'match' ? [] : (item.wordIds || []).map((id) => store.word(id)).filter(Boolean));
    const sentence = item.sentenceId ? VL.sentenceById(item.sentenceId) : null;
    if (!comp || (!sentence && item.type !== 'match' && !words.length)) { L.items.splice(L.index, 1); renderItem(); return; }
    const ctx = { item, words, word: words[0] || null, sentence, lesson: L };
    cur = { item, comp, ctx, ready: false, answered: false, blockUntil: 0, cleanup: null };
    L.tick = Date.now();
    root.innerHTML = '<div class="lesson">' + topBar() + '<section class="lesson-card" id="lcard">' + comp.render(ctx) + '</section>' +
      '<div class="lesson-bottom"><div id="lfeedback" class="lesson-feedback" hidden aria-live="assertive"></div>' +
      '<div class="lesson-actions-bar" id="lactions">' +
      (comp.selfChecked ? '<span class="muted small">' + esc(t('match.hint')) + '</span>' : '<button type="button" class="btn btn-ghost" data-action="skip">' + esc(t('btn.dontKnow')) + '</button><button type="button" class="btn btn-primary btn-lg" data-action="check" disabled>' + esc(t('btn.checkShort')) + '</button>') +
      '</div></div></div>';
    const card = root.querySelector('#lcard');
    const api = {
      ready(ok) { cur.ready = !!ok; const b = root.querySelector('[data-action="check"]'); if (b) b.disabled = !ok; },
      submit: check, skip: doSkip, finish: (res) => finalize(res),
    };
    cur.cleanup = comp.mount(card, ctx, api) || null;
    const spoken = comp.speakText ? comp.speakText(ctx) : null;
    if (spoken && VL.speech.supported && (item.type === 'listen' || store.state.settings.autoSpeak)) VL.speech.speak(spoken, item.type === 'listen' ? 0.95 : undefined);
  }

  /* ---------- checking ---------- */
  function check() {
    if (!cur || cur.answered) return;
    if (!cur.ready) {
      const card = root.querySelector('#lcard');
      card.classList.add('shake'); setTimeout(() => card.classList.remove('shake'), 400);
      return;
    }
    const card = root.querySelector('#lcard');
    finalize(cur.comp.evaluate(cur.comp.collect(card, cur.ctx), cur.ctx, {}));
  }
  function doSkip(opts) {
    if (!cur || cur.answered) return;
    finalize(cur.comp.evaluate(null, cur.ctx, Object.assign({ skipped: true }, opts)));
  }

  function finalize(res) {
    if (!cur || cur.answered) return;
    cur.answered = true;
    cur.blockUntil = Date.now() + GUARD_MS;
    const card = root.querySelector('#lcard');
    if (cur.comp.reveal) cur.comp.reveal(card, cur.ctx, res);
    const g = res.neutral ? neutral() : (cur.item.type === 'match' ? gradeMatch(res) : grade(res));
    showFeedback(res, g);
  }

  function neutral() {
    const snap = snapshot({ index: L.index + 1 });
    queue(() => store.saveLesson(snap));
    return { xp: 0, bonus: 0, retry: false, neutral: true };
  }

  function bumpCombo(ok) {
    let bonus = 0;
    if (ok) { L.combo++; L.bestCombo = Math.max(L.bestCombo, L.combo); if (L.combo % E.XP.comboEvery === 0) bonus = E.XP.comboBonus; } else L.combo = 0;
    return bonus;
  }

  function grade(res) {
    const { item, ctx } = cur;
    const w = ctx.word, ok = !!res.correct;
    const srs = isSrsItem(item) && w;
    const first = srs && !L.attempted[w.id] && !item.retry;
    if (srs) L.attempted[w.id] = true;
    const xp = E.xpFor(item.type, ok, item.retry);
    const bonus = bumpCombo(ok);
    L.answers++; if (ok) L.correct++; else L.wrong++;
    L.xp += xp; L.comboBonus += bonus;
    L.activeMs += Math.min(Date.now() - L.tick, 120000);
    L.results.push({ wordId: w ? w.id : null, sentenceId: item.sentenceId || null, type: item.type, correct: ok });
    let retry = false;
    if (!ok && item.type !== 'learn') {
      const key = item.sentenceId ? 's' + item.sentenceId : 'w' + (w && w.id);
      if (!L.noRetry && !L.retried[key] && L.retryCount < 3) {
        const r = E.reviewItemFor(item, store.state.words, VL.speech.supported);
        if (r) { L.retried[key] = true; L.retryCount++; E.insertReview(L.items, L.index, r); retry = true; }
      }
    }
    const snap = snapshot({ index: L.index + 1 });
    queue(async () => {
      if (srs) await store.recordLearn(w.id, ok, first);
      const r = await store.logLearn({ xp: xp + bonus, answers: 1, correct: ok ? 1 : 0 });
      if (r.goalJustMet) VL.ui.toast(t('goal.reached'), 'success', 3500);
      await store.saveLesson(snap);
    });
    return { xp, bonus, retry };
  }

  function gradeMatch(res) {
    const item = cur.item;
    let xp = 0, bonus = 0;
    const logs = [];
    // in the mixed exercise the matching step counts as ONE exercise, judged by its own word
    const focus = item.focusId ? res.pairs.find((p) => p.wordId === item.focusId) : null;
    res.pairs.forEach((p) => {
      const first = !L.attempted[p.wordId];
      L.attempted[p.wordId] = true;
      xp += p.ok ? E.XP.matchPair : Math.round(E.XP.matchPair / 2);
      bonus += bumpCombo(p.ok);
      if (!focus) { L.answers++; if (p.ok) L.correct++; else L.wrong++; L.results.push({ wordId: p.wordId, sentenceId: null, type: 'match', correct: p.ok }); }
      logs.push({ id: p.wordId, ok: p.ok, first });
    });
    if (focus) { L.answers++; if (focus.ok) L.correct++; else L.wrong++; L.results.push({ wordId: focus.wordId, sentenceId: null, type: 'match', correct: focus.ok }); }
    L.xp += xp; L.comboBonus += bonus;
    L.activeMs += Math.min(Date.now() - L.tick, 120000);
    const snap = snapshot({ index: L.index + 1 });
    queue(async () => {
      for (const l of logs) await store.recordLearn(l.id, l.ok, l.first);
      const r = await store.logLearn({ xp: xp + bonus, answers: logs.length, correct: logs.filter((l) => l.ok).length });
      if (r.goalJustMet) VL.ui.toast(t('goal.reached'), 'success', 3500);
      await store.saveLesson(snap);
    });
    return { xp, bonus, retry: false, item };
  }

  function showFeedback(res, g) {
    const fb = root.querySelector('#lfeedback');
    const ok = !!res.correct;
    const isLast = L.index >= L.items.length - 1;
    fb.className = 'lesson-feedback ' + (g.neutral ? 'neutral' : ok ? 'ok' : 'bad');
    fb.hidden = false;
    const lines = (res.lines || []).slice();
    if (g.retry) lines.push(esc(t('fb.comesBack')));
    fb.innerHTML = '<div class="fb-inner"><span class="fb-ico">' + icon(ok ? 'check' : g.neutral ? 'clock' : 'x') + '</span><div class="fb-text"><strong>' + esc(t(ok ? 'fb.correct' : g.neutral ? 'fb.noProblem' : (res.skipped ? 'fb.noProblem' : 'fb.notQuite'))) + '</strong>' +
      lines.map((l) => '<div>' + l + '</div>').join('') + '</div>' +
      (ok && g.xp ? '<span class="xp-pop">' + esc(t('fb.xp', { n: g.xp })) + '</span>' : '') +
      '<button type="button" class="btn btn-lg ' + (g.neutral ? 'btn-primary' : ok ? 'btn-ok' : 'btn-bad') + '" data-action="continue" id="btn-next">' + esc(t(isLast ? 'btn.finishLesson' : 'btn.continue')) + icon('arrow') + '</button></div>' +
      (g.bonus ? '<div class="fb-bonus">' + icon('flame') + esc(t('fb.combo', { n: g.bonus })) + '</div>' : '');
    root.querySelector('#lactions').hidden = true;
    const card = root.querySelector('#lcard');
    if (!g.neutral) card.classList.add(ok ? 'is-correct' : 'is-wrong');
    const bar = root.querySelector('#lbar');
    if (bar) bar.style.width = pct(L.index + 1, L.items.length) + '%';
    const combo = root.querySelector('#lcombo');
    if (combo) { combo.className = 'combo' + (L.combo >= 2 ? ' on' : ''); combo.innerHTML = L.combo >= 2 ? icon('flame') + esc(t('les.combo', { n: L.combo })) : ''; }
    fb.querySelector('#btn-next').focus();
    if (ok && store.state.settings.autoAdvance) timer = setTimeout(next, 1400);
  }

  function next() {
    if (!cur || !cur.answered || Date.now() < cur.blockUntil) return;
    clearTimeout(timer);
    L.index++;
    if (L.index >= L.items.length) finish(true); else renderItem();
  }

  /* ---------- pause / leave ---------- */
  async function pauseDialog() {
    if (!L) return;
    const v = await VL.ui.modal({
      title: t('pause.title'), body: '<p class="modal-text">' + esc(t('pause.text')) + '</p>',
      buttons: [{ label: t('btn.keepGoing'), value: 'keep', kind: 'primary' }, { label: t('pause.save'), value: 'save' }, { label: t('pause.end'), value: 'end', kind: 'ghost' }],
    });
    if (v === 'save') {
      const snap = snapshot({ index: cur && cur.answered ? L.index + 1 : L.index });
      await chain;
      await store.saveLesson(snap);
      VL.ui.toast(t('pause.saved'), 'success', 3500);
      exit();
    } else if (v === 'end') {
      if (cur && cur.answered) L.index++;
      finish(false);
    }
  }

  /* ---------- results ---------- */
  async function finish(completed) {
    clearTimeout(timer);
    if (cur && cur.cleanup) { cur.cleanup(); cur.cleanup = null; }
    await chain;
    const done = L;
    document.body.classList.remove('focus-mode');
    if (!done.answers) { await store.saveLesson(null); exit(); return; }
    const finishBonus = completed ? E.XP.finish : 0;
    if (finishBonus) {
      const r = await store.logLearn({ xp: finishBonus });
      if (r.goalJustMet) VL.ui.toast(t('goal.reached'), 'success', 3500);
    }
    const totalXp = done.xp + done.comboBonus + finishBonus;
    const missedWordIds = Array.from(new Set(done.results.filter((r) => !r.correct && r.wordId).map((r) => r.wordId)));
    const missedSentenceIds = Array.from(new Set(done.results.filter((r) => !r.correct && r.sentenceId).map((r) => r.sentenceId)));
    const goodWordIds = Array.from(new Set(done.results.filter((r) => r.wordId && r.type !== 'learn').map((r) => r.wordId))).filter((id) => !done.results.some((r) => r.wordId === id && !r.correct));
    await store.addSession(Object.assign({ kind: 'lesson', mode: done.type, scope: 'lesson', direction: 'en-uz', total: done.answers, correct: done.correct, wrong: done.wrong, xp: totalXp, missedIds: missedWordIds, newWords: done.newCount, durationMs: done.activeMs }, done.custom ? { customId: done.custom.id, customName: done.custom.name } : {}));
    if (done.custom) await store.recordCustomRun(done.custom.id, { ended: !completed, total: done.answers, correct: done.correct, wrong: done.wrong, pct: pct(done.correct, done.answers), missedIds: missedWordIds, goodIds: goodWordIds, mode: done.customMode });
    if (done.sentenceIds && done.sentenceIds.length) {
      const hist = (store.state.settings.sentenceHistory || []).concat(done.items.filter((i) => i.sentenceId).map((i) => i.sentenceId)).slice(-40);
      await store.setSetting('sentenceHistory', hist);
    }
    await store.saveLesson(null);
    const after = E.stats(store.state);
    const newAch = E.achievements(store.state).filter((a) => a.unlocked && !done.achBefore.includes(a.id));
    renderResult({ done, completed, finishBonus, totalXp, missedWordIds, missedSentenceIds, goodWordIds, after, newAch });
  }

  const wrongCount = (done, id) => done.results.filter((r) => r.wordId === id && !r.correct).length;
  function wordRow(w, wrong) {
    return '<li><div class="wl-main"><span class="wl-en">' + esc(w.en) + VL.speech.button(w.en) + '</span><span class="wl-uz">' + esc(w.uz) + '</span></div>' + (wrong ? '<span class="chip chip-learning">' + esc(t('mx.wrongN', { n: wrong })) + '</span>' : '') + '</li>';
  }

  function renderResult(R) {
    L = null; cur = null;
    const { done, after } = R;
    const p = pct(done.correct, done.answers);
    const todayRec = store.state.days.find((d) => d.date === VL.util.dayKey(Date.now())) || { xp: 0 };
    const goal = store.state.settings.dailyGoal;
    const Rr = 52, C = 2 * Math.PI * Rr;
    const missedWords = R.missedWordIds.map((id) => store.word(id)).filter(Boolean);
    const goodWords = R.goodWordIds.map((id) => store.word(id)).filter(Boolean);
    const missedSentences = R.missedSentenceIds.map((id) => VL.sentenceById(id)).filter(Boolean);
    root.innerHTML =
      '<header class="page-head"><div><h1>' + esc(t(R.completed ? 'res.title' : 'res.ended')) + '</h1><p class="muted">' + esc(done.custom ? done.custom.name + ' · ' + done.custom.topic : t('ex.' + done.type)) + '</p></div></header>' +
      '<section class="card summary"><div class="ring" role="img" aria-label="' + esc(t('sum.ringAria', { p })) + '"><svg viewBox="0 0 120 120"><circle class="ring-bg" cx="60" cy="60" r="' + Rr + '"/><circle class="ring-fg" cx="60" cy="60" r="' + Rr + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - p / 100)).toFixed(1) + '"/></svg><div class="ring-text">' + p + '%</div></div>' +
      '<div class="res-main"><h2>' + esc(t(p === 100 ? 'sum.m100' : p >= 80 ? 'sum.m80' : p >= 50 ? 'sum.m50' : 'sum.m0')) + '</h2>' +
      '<div class="res-stats"><div><b>' + done.answers + '</b><span>' + esc(t('res.exercises')) + '</span></div><div><b class="ok-text">' + done.correct + '</b><span>' + esc(t('res.correctN')) + '</span></div><div><b class="bad-text">' + done.wrong + '</b><span>' + esc(t('res.wrongN')) + '</span></div>' +
      '<div><b>' + p + '%</b><span>' + esc(t('stat.accuracy')) + '</span></div><div><b class="xp-total">+' + R.totalXp + '</b><span>' + esc(t('res.xp')) + '</span></div><div><b>' + fmtTime(done.activeMs) + '</b><span>' + esc(t('res.time')) + '</span></div>' +
      '<div><b>×' + done.bestCombo + '</b><span>' + esc(t('res.bestCombo')) + '</span></div></div>' +
      '<p class="small muted">' + (done.comboBonus ? esc(t('res.bonusCombo', { n: done.comboBonus })) + ' · ' : '') + (R.finishBonus ? esc(t('res.bonusFinish', { n: R.finishBonus })) : '') + '</p>' +
      '<div class="btn-row">' + (missedWords.length || missedSentences.length ? '<button class="btn btn-primary" data-action="review-mistakes">' + icon('refresh') + esc(t(done.mixed ? 'mx.reviewMistakes' : done.custom ? 'cs.onlyMistakes' : 'res.reviewMistakes')) + '</button>' : '') +
      (done.mixed
        ? '<button class="btn" data-action="mx-restart">' + icon('play') + esc(t('mx.restart')) + '</button><button class="btn" data-action="cs-new">' + icon('plus') + esc(t('cs.new')) + '</button>'
        : done.custom
        ? '<button class="btn' + (missedWords.length || missedSentences.length ? '' : ' btn-primary') + '" data-action="cs-restart">' + icon('play') + esc(t('cs.restart')) + '</button><button class="btn" data-action="cs-new">' + icon('plus') + esc(t('cs.new')) + '</button>'
        : '<button class="btn' + (missedWords.length || missedSentences.length ? '' : ' btn-primary') + '" data-action="next-lesson">' + icon('arrow') + esc(t('res.next')) + '</button>') +
      '<button class="btn btn-ghost" data-action="hub">' + esc(t(done.custom ? 'cs.toSessions' : 'res.hubLessons')) + '</button></div></div></section>' +
      '<section class="card res-progress"><div class="res-row">' + icon('flame') + '<span>' + esc(t('res.streak', { n: after.streak.current })) + '</span></div>' +
      '<div class="res-row">' + icon('flag') + '<span>' + esc(t('res.goal', { a: Math.min(todayRec.xp, goal), b: goal })) + '</span><div class="bar"><span style="width:' + Math.min(100, pct(todayRec.xp, goal)) + '%"></span></div></div>' +
      (after.level.level > done.levelBefore ? '<div class="res-row level-up">' + icon('star') + '<b>' + esc(t('res.levelUp', { n: after.level.level })) + '</b></div>' : '') + '</section>' +
      (R.newAch.length ? '<section class="card"><h2 class="card-title">' + esc(t('res.newAch')) + '</h2><div class="ach-grid">' + R.newAch.map((a) => '<article class="ach unlocked"><span class="ach-ico">' + icon(a.icon) + '</span><div><b>' + esc(t('ach.' + a.id + '.t')) + '</b><p class="small muted">' + esc(t('ach.' + a.id + '.d')) + '</p></div></article>').join('') + '</div></section>' : '') +
      '<div class="two-col"><section class="card"><h2 class="card-title">' + esc(t(done.custom ? 'cs.learnedWords' : 'res.good')) + '</h2>' + (goodWords.length ? '<ul class="word-list">' + goodWords.map((w) => wordRow(w)).join('') + '</ul>' : '<p class="muted">' + esc(t('res.noGood')) + '</p>') + '</section>' +
      '<section class="card"><h2 class="card-title">' + esc(t(done.mixed ? 'mx.hardWords' : done.custom ? 'cs.mistakenWords' : 'res.review')) + '</h2>' + (missedWords.length || missedSentences.length
        ? '<ul class="word-list">' + missedWords.slice().sort((a, b) => wrongCount(done, b.id) - wrongCount(done, a.id)).map((w) => done.mixed ? wordRow(w, wrongCount(done, w.id)) : wordRow(w)).join('') + missedSentences.map((s) => '<li><div class="wl-main"><span class="wl-en">' + esc(s.en) + VL.speech.button(s.en) + '</span><span class="wl-uz">' + esc(s.uz[0]) + '</span></div></li>').join('') + '</ul>'
        : '<p>' + esc(t('res.noMistakes')) + '</p>') + '</section></div>';
    root._result = R;
    const first = root.querySelector('[data-action="review-mistakes"], [data-action="next-lesson"]');
    if (first) first.focus();
  }

  // a short lesson made only of the words and sentences that went wrong
  function reviewMistakes(R) {
    const all = store.state.words;
    const speech = VL.speech.supported;
    const items = [];
    R.missedWordIds.forEach((id) => {
      const w = store.word(id);
      if (!w) return;
      const seen = new Set();
      for (let k = 0; k < 2; k++) {
        const it = E.reviewItemFor({ type: Array.from(seen).pop() || 'learn', wordIds: [id], sentenceId: null }, all, speech);
        if (it && !seen.has(it.type)) { seen.add(it.type); it.retry = false; items.push(it); }
      }
    });
    R.missedSentenceIds.forEach((id) => {
      const s = VL.sentenceById(id);
      if (!s) return;
      const seen = new Set();
      for (let k = 0; k < 2; k++) {
        const it = E.reviewItemFor({ type: Array.from(seen).pop() || 'none', wordIds: [], sentenceId: id }, all, speech);
        if (it && !seen.has(it.type)) { seen.add(it.type); it.retry = false; items.push(it); }
      }
    });
    const ordered = E.sequence([], items.slice(0, 15));
    const cu = R.done.custom;
    if (cu && R.missedWordIds.length) return start(root, { type: 'session', mode: 'mistakes', words: R.missedWordIds.map((id) => store.word(id)).filter(Boolean), count: Math.max(5, R.missedWordIds.length * 2), types: (store.customSession(cu.id) || {}).types, custom: cu }, hooks);
    return start(root, { type: 'review', items: ordered }, hooks);
  }

  /* ---------- events ---------- */
  function onClick(e) {
    const a = e.target.closest('[data-action]');
    if (!a) return;
    switch (a.dataset.action) {
      case 'pause': pauseDialog(); break;
      case 'check': check(); break;
      case 'skip': doSkip(); break;
      case 'continue': next(); break;
      case 'hub': exit(); break;
      case 'next-lesson': { const c = root; const h = hooks; start(c, { type: 'guided' }, h); break; }
      case 'review-mistakes': reviewMistakes(root._result); break;
      case 'cs-restart': { const cu = root._result.done.custom; const c = root, h = hooks; VL.custom.start(c, cu.id, h, { replace: true }); break; }
      case 'mx-restart': { const ids = root._result.done.mixedWordIds || []; const c = root, h = hooks; start(c, { type: 'mix6', words: ids.map((id) => store.word(id)).filter(Boolean), words_n: ids.length }, h); break; }
      case 'cs-new': VL.custom.create(root, hooks); break;
    }
  }

  function onKey(e) {
    if (!L || !cur || e.isComposing || document.querySelector('dialog[open]')) return;
    if (e.key !== 'Enter') return;
    const tag = e.target.tagName;
    if (tag === 'BUTTON' || tag === 'A' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'INPUT') return;
    e.preventDefault();
    if (cur.answered) next(); else if (cur.ready) check();
  }

  return { start, resume, active, exit, detach };
})();
