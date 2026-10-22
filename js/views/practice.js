VL.views.practice = (function () {
  const { esc, pct } = VL.util;
  const t = VL.t, n = VL.n;
  const { icon } = VL.ui;
  const dirLabel = (d) => t('dir.' + d);
  const NEXT_GUARD_MS = 250;

  let root, keyHandler;
  let mode = 'setup'; // 'setup' | 'run' | 'summary'
  let cfg = null;     // { scope, direction, length, wordIds? }
  let run = null;
  let timer = null;

  /* ---------- setup ---------- */
  function scopeWords(scope, wordIds) {
    const st = VL.store;
    if (wordIds) return wordIds.map((id) => st.word(id)).filter(Boolean);
    if (scope === 'difficult') return st.difficultWords();
    if (scope === 'all' || !scope) return st.state.words;
    return st.wordsIn(scope);
  }


  function drawSetup(preset) {
    mode = 'setup';
    document.body.classList.remove('focus-mode');
    const st = VL.store, s = st.state.settings;
    const scope = (preset && preset.scope) || (cfg && cfg.scope) || 'all';
    const dir = (preset && preset.direction) || (cfg && cfg.direction) || s.direction;
    const len = (cfg && cfg.length) || String(s.length);
    const options = '<option value="all"' + (scope === 'all' ? ' selected' : '') + '>' + esc(t('scope.all', { n: st.state.words.length })) + '</option>' +
      '<option value="difficult"' + (scope === 'difficult' ? ' selected' : '') + '>' + esc(t('scope.difficultOpt', { n: st.difficultWords().length })) + '</option>' +
      st.state.collections.map((c) => '<option value="' + esc(c.id) + '"' + (scope === c.id ? ' selected' : '') + '>' + esc(c.name) + ' (' + st.wordsIn(c.id).length + ')</option>').join('');
    root.innerHTML =
      '<header class="page-head"><div><h1>' + esc(t('nav.practice')) + '</h1><p class="muted">' + esc(t('practice.sub')) + '</p></div></header>' +
      '<form id="setup" class="card setup" novalidate>' +
      '<div class="field"><label for="s-scope">' + esc(t('practice.what')) + '</label><select id="s-scope">' + options + '</select></div>' +
      '<fieldset class="field"><legend>' + esc(t('practice.direction')) + '</legend><div class="segmented" role="radiogroup">' +
      ['en-uz', 'uz-en', 'mixed'].map((d) => '<label><input type="radio" name="dir" value="' + d + '"' + (dir === d ? ' checked' : '') + '><span>' + esc(dirLabel(d)) + '</span></label>').join('') + '</div></fieldset>' +
      '<div class="field"><label for="s-len">' + esc(t('practice.length')) + '</label><select id="s-len">' +
      [['all', t('len.all')], ['10', t('len.n', { n: 10 })], ['20', t('len.n', { n: 20 })], ['50', t('len.n', { n: 50 })]].map((o) => '<option value="' + o[0] + '"' + (len === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select></div>' +
      '<p class="form-error" id="s-error" role="alert"></p>' +
      '<button class="btn btn-primary btn-lg" type="submit">' + icon('arrow') + esc(t('btn.start')) + '</button></form>';
    root.querySelector('#setup').addEventListener('submit', (e) => {
      e.preventDefault();
      const c = {
        scope: root.querySelector('#s-scope').value,
        direction: root.querySelector('input[name="dir"]:checked').value,
        length: root.querySelector('#s-len').value,
      };
      if (!start(c)) {
        root.querySelector('#s-error').textContent = c.scope === 'difficult' ? t('practice.errDifficult') : t('practice.errEmpty');
      }
    });
  }

  /* ---------- running ---------- */
  function start(c) {
    const words = scopeWords(c.scope, c.wordIds);
    if (!words.length) return false;
    cfg = c;
    const queue = VL.quiz.buildQueue({ words, direction: c.direction, limit: c.length === 'all' ? 0 : parseInt(c.length, 10) });
    run = { queue, index: 0, answered: false, correct: 0, wrong: 0, results: [], blockUntil: 0 };
    mode = 'run';
    drawQuestion();
    return true;
  }

  function current() { return run.queue[run.index]; }

  function drawQuestion() {
    clearTimeout(timer);
    document.body.classList.add('focus-mode');
    const q = current(), w = VL.store.word(q.wordId);
    if (!w) { skipMissing(); return; }
    const prompt = q.dir === 'en-uz' ? w.en : w.uz;
    const total = run.queue.length;
    root.innerHTML =
      '<h1 class="sr-only">' + esc(t('quiz.title')) + '</h1>' +
      '<div class="quiz">' +
      '<div class="quiz-top">' +
      '<div class="quiz-progress"><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + run.index + '" aria-label="' + esc(t('quiz.progressAria')) + '"><span style="width:' + pct(run.index, total) + '%"></span></div>' +
      '<span class="small muted">' + esc(t('quiz.qOf', { i: run.index + 1, n: total })) + '</span></div>' +
      '<div class="score" aria-label="' + esc(t('quiz.scoreAria')) + '"><span class="ok">' + icon('check') + '<b id="sc-ok">' + run.correct + '</b></span><span class="bad">' + icon('x') + '<b id="sc-bad">' + run.wrong + '</b></span></div></div>' +
      '<div class="quiz-card" id="qcard">' +
      '<span class="chip">' + esc(dirLabel(q.dir)) + '</span>' +
      '<p class="q-label">' + esc(t('quiz.q')) + '</p>' +
      '<p class="q-word" lang="' + (q.dir === 'en-uz' ? 'en' : 'uz') + '">' + esc(prompt) + '</p>' +
      '<form id="answer-form" autocomplete="off" novalidate><label class="sr-only" for="answer">' + esc(t(q.dir === 'en-uz' ? 'quiz.ariaUz' : 'quiz.ariaEn')) + '</label>' +
      '<input id="answer" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="' + esc(t(q.dir === 'en-uz' ? 'quiz.phUz' : 'quiz.phEn')) + '">' +
      '<div class="quiz-buttons"><button type="submit" class="btn btn-primary" id="btn-check">' + esc(t('btn.check')) + '</button>' +
      '<button type="button" class="btn btn-ghost" id="btn-skip">' + esc(t('btn.dontKnow')) + '</button></div></form>' +
      '<div id="feedback" class="feedback" role="status" aria-live="assertive"></div>' +
      '</div>' +
      '<div class="quiz-bottom"><button type="button" class="btn btn-ghost btn-sm" id="btn-restart">' + icon('shuffle') + esc(t('btn.restart')) + '</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="btn-end">' + esc(t('btn.end')) + '</button></div></div>';
    run.answered = false;
    const input = root.querySelector('#answer');
    input.focus();
    root.querySelector('#answer-form').addEventListener('submit', (e) => { e.preventDefault(); if (run.answered) next(); else submit(input.value, false); });
    root.querySelector('#btn-skip').addEventListener('click', () => submit('', true));
    root.querySelector('#btn-restart').addEventListener('click', restart);
    root.querySelector('#btn-end').addEventListener('click', () => finish());
  }

  function skipMissing() { run.queue.splice(run.index, 1); if (run.index >= run.queue.length) finish(); else drawQuestion(); }

  async function submit(typed, giveUp) {
    if (run.answered) return;
    const q = current(), w = VL.store.word(q.wordId);
    const expected = q.dir === 'en-uz' ? w.uz : w.en;
    const text = typed.trim();
    if (!text && !giveUp) {
      const input = root.querySelector('#answer');
      input.classList.add('shake'); setTimeout(() => input.classList.remove('shake'), 400);
      root.querySelector('#feedback').innerHTML = '<p class="muted">' + esc(t('quiz.typeFirst')) + '</p>';
      return;
    }
    const ok = text ? VL.quiz.check(text, expected, VL.store.state.settings.lenient) : false;
    run.answered = true;
    run.blockUntil = Date.now() + NEXT_GUARD_MS;
    run.results.push({ wordId: w.id, dir: q.dir, prompt: q.dir === 'en-uz' ? w.en : w.uz, expected, typed: text, correct: ok });
    if (ok) run.correct++; else run.wrong++;
    VL.store.recordAnswer(w.id, ok);

    const input = root.querySelector('#answer');
    input.readOnly = true;
    const isLast = run.index >= run.queue.length - 1;
    root.querySelector('#qcard').classList.add(ok ? 'is-correct' : 'is-wrong');
    root.querySelector('#sc-ok').textContent = run.correct;
    root.querySelector('#sc-bad').textContent = run.wrong;
    root.querySelector('.quiz-buttons').innerHTML = '<button type="button" class="btn btn-primary" id="btn-next">' + esc(t(isLast ? 'btn.finish' : 'btn.next')) + icon('arrow') + '</button>';
    root.querySelector('#feedback').innerHTML = ok
      ? '<div class="fb fb-ok">' + icon('check') + '<div><strong>' + esc(t('fb.correct')) + '</strong>' + (VL.quiz.acceptedAnswers(expected).length > 1 ? '<div class="small">' + esc(t('fb.allAccepted', { a: expected })) + '</div>' : '') + '</div></div>'
      : '<div class="fb fb-bad">' + icon('x') + '<div><strong>' + esc(t(text ? 'fb.notQuite' : 'fb.noProblem')) + '</strong><div>' + esc(t('fb.correctAnswer')) + ' <b>' + esc(expected) + '</b></div>' + (text ? '<div class="small">' + esc(t('fb.youTyped', { x: text })) + '</div>' : '') + '</div></div>';
    const nextBtn = root.querySelector('#btn-next');
    nextBtn.addEventListener('click', next);
    nextBtn.focus();
    if (ok && VL.store.state.settings.autoAdvance) timer = setTimeout(next, 1100);
  }

  function next() {
    if (!run || !run.answered || Date.now() < run.blockUntil) return;
    clearTimeout(timer);
    if (run.index >= run.queue.length - 1) { finish(); return; }
    run.index++;
    drawQuestion();
  }

  async function saveSession() {
    if (!run || !run.results.length || run.saved) return null;
    run.saved = true;
    const missed = run.results.filter((r) => !r.correct).map((r) => r.wordId);
    return VL.store.addSession({
      direction: cfg.direction, scope: cfg.wordIds ? 'missed' : cfg.scope,
      collectionId: VL.store.collection(cfg.scope) ? cfg.scope : null,
      collectionName: (VL.store.collection(cfg.scope) || {}).name || null,
      total: run.results.length, correct: run.correct, wrong: run.wrong, missedIds: Array.from(new Set(missed)),
    });
  }

  async function restart() {
    if (run.results.length) await saveSession();
    const c = Object.assign({}, cfg);
    if (!start(c)) drawSetup();
    else VL.ui.toast(t('quiz.reshuffled'), 'info', 1600);
  }

  /* ---------- summary ---------- */
  async function finish() {
    clearTimeout(timer);
    document.body.classList.remove('focus-mode');
    if (!run.results.length) { mode = 'setup'; drawSetup(); return; }
    await saveSession();
    mode = 'summary';
    const total = run.results.length, p = pct(run.correct, total);
    const missed = run.results.filter((r) => !r.correct);
    const msg = t(p === 100 ? 'sum.m100' : p >= 80 ? 'sum.m80' : p >= 50 ? 'sum.m50' : 'sum.m0');
    const label = VL.ui.sessionLabel({ scope: cfg.wordIds ? 'missed' : cfg.scope, direction: cfg.direction });
    const R = 52, C = 2 * Math.PI * R;
    root.innerHTML =
      '<header class="page-head"><div><h1>' + esc(t('sum.title')) + '</h1><p class="muted">' + esc(label) + '</p></div></header>' +
      '<section class="card summary">' +
      '<div class="ring" role="img" aria-label="' + esc(t('sum.ringAria', { p: p })) + '"><svg viewBox="0 0 120 120"><circle class="ring-bg" cx="60" cy="60" r="' + R + '"/><circle class="ring-fg" cx="60" cy="60" r="' + R + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - p / 100)).toFixed(1) + '"/></svg><div class="ring-text">' + p + '%</div></div>' +
      '<div><h2>' + esc(msg) + '</h2><p class="muted">' + esc(t('sum.line', { c: run.correct, w: run.wrong, q: n('n.question', total) })) + '</p>' +
      '<div class="btn-row"><button class="btn btn-primary" id="again">' + icon('refresh') + esc(t('btn.again')) + '</button>' +
      (missed.length ? '<button class="btn" id="mistakes">' + icon('target') + esc(t('btn.mistakes', { m: n('n.mistake', missed.length) })) + '</button>' : '') +
      '<button class="btn btn-ghost" id="back">' + esc(t('btn.newSetup')) + '</button></div></div></section>' +
      (missed.length
        ? '<section class="card"><h2 class="card-title">' + esc(t('sum.review')) + '</h2><div class="table-wrap"><table class="words"><thead><tr><th scope="col">' + esc(t('th.word')) + '</th><th scope="col">' + esc(t('th.correctAnswer')) + '</th><th scope="col">' + esc(t('th.youTyped')) + '</th></tr></thead><tbody>' +
          missed.map((r) => '<tr><td class="strong">' + esc(r.prompt) + '</td><td>' + esc(r.expected) + '</td><td class="muted">' + (r.typed ? esc(r.typed) : '—') + '</td></tr>').join('') + '</tbody></table></div></section>'
        : '<section class="card"><p>' + esc(t('sum.noMistakes')) + '</p></section>');
    root.querySelector('#again').addEventListener('click', () => { if (!start(Object.assign({}, cfg))) drawSetup(); });
    root.querySelector('#back').addEventListener('click', () => drawSetup());
    const mb = root.querySelector('#mistakes');
    if (mb) mb.addEventListener('click', () => start({ scope: 'all', direction: cfg.direction, length: 'all', wordIds: Array.from(new Set(missed.map((r) => r.wordId))) }));
    root.querySelector('#again').focus();
  }

  return {
    mount(el, params) {
      root = el;
      run = null;
      const preset = {};
      if (params.get('scope')) preset.scope = params.get('scope');
      if (params.get('dir')) preset.direction = params.get('dir');
      drawSetup(preset);
      keyHandler = (e) => {
        if (mode === 'run' && run && run.answered && e.key === 'Enter' && !e.isComposing && !/^(BUTTON|A|TEXTAREA|SELECT)$/.test(e.target.tagName) && !document.querySelector('dialog[open]')) {
          e.preventDefault(); next();
        }
      };
      document.addEventListener('keydown', keyHandler);
    },
    unmount() {
      clearTimeout(timer);
      document.removeEventListener('keydown', keyHandler);
      document.body.classList.remove('focus-mode');
      if (mode === 'run' && run) saveSession(); // keep partially completed sessions in the history
      mode = 'setup'; run = null;
    },
  };
})();
