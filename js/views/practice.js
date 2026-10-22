VL.views.practice = (function () {
  const { esc, pct, plural } = VL.util;
  const { icon } = VL.ui;
  const DIR_LABEL = { 'en-uz': 'English → Uzbek', 'uz-en': 'Uzbek → English', mixed: 'Mixed directions' };
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

  function scopeLabel(c) {
    if (c.wordIds) return 'Missed words';
    if (c.scope === 'difficult') return 'Difficult words';
    if (c.scope === 'all') return 'All words';
    const col = VL.store.collection(c.scope);
    return col ? col.name : 'Collection';
  }

  function drawSetup(preset) {
    mode = 'setup';
    document.body.classList.remove('focus-mode');
    const st = VL.store, s = st.state.settings;
    const scope = (preset && preset.scope) || (cfg && cfg.scope) || 'all';
    const dir = (preset && preset.direction) || (cfg && cfg.direction) || s.direction;
    const len = (cfg && cfg.length) || String(s.length);
    const options = '<option value="all"' + (scope === 'all' ? ' selected' : '') + '>All words (' + st.state.words.length + ')</option>' +
      '<option value="difficult"' + (scope === 'difficult' ? ' selected' : '') + '>Difficult words only (' + st.difficultWords().length + ')</option>' +
      st.state.collections.map((c) => '<option value="' + esc(c.id) + '"' + (scope === c.id ? ' selected' : '') + '>' + esc(c.name) + ' (' + st.wordsIn(c.id).length + ')</option>').join('');
    root.innerHTML =
      '<header class="page-head"><div><h1>Practice</h1><p class="muted">Type the translation of each word. Words never repeat until you have been through all of them.</p></div></header>' +
      '<form id="setup" class="card setup" novalidate>' +
      '<div class="field"><label for="s-scope">What do you want to practise?</label><select id="s-scope">' + options + '</select></div>' +
      '<fieldset class="field"><legend>Direction</legend><div class="segmented" role="radiogroup">' +
      ['en-uz', 'uz-en', 'mixed'].map((d) => '<label><input type="radio" name="dir" value="' + d + '"' + (dir === d ? ' checked' : '') + '><span>' + DIR_LABEL[d] + '</span></label>').join('') + '</div></fieldset>' +
      '<div class="field"><label for="s-len">Number of questions</label><select id="s-len">' +
      [['all', 'All available words'], ['10', '10 questions'], ['20', '20 questions'], ['50', '50 questions']].map((o) => '<option value="' + o[0] + '"' + (len === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div>' +
      '<p class="form-error" id="s-error" role="alert"></p>' +
      '<button class="btn btn-primary btn-lg" type="submit">' + icon('arrow') + 'Start quiz</button></form>';
    root.querySelector('#setup').addEventListener('submit', (e) => {
      e.preventDefault();
      const c = {
        scope: root.querySelector('#s-scope').value,
        direction: root.querySelector('input[name="dir"]:checked').value,
        length: root.querySelector('#s-len').value,
      };
      if (!start(c)) {
        const n = c.scope === 'difficult' ? 'You have no difficult words right now — nice! Pick another set.' : 'There are no words in this selection yet. Add some in My Vocabulary first.';
        root.querySelector('#s-error').textContent = n;
      }
    });
  }

  /* ---------- running ---------- */
  function start(c) {
    const words = scopeWords(c.scope, c.wordIds);
    if (!words.length) return false;
    cfg = c;
    const queue = VL.quiz.buildQueue({ words, direction: c.direction, limit: c.length === 'all' ? 0 : parseInt(c.length, 10) });
    run = { queue, index: 0, answered: false, correct: 0, wrong: 0, results: [], blockUntil: 0, label: scopeLabel(c) + ' · ' + DIR_LABEL[c.direction] };
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
      '<h1 class="sr-only">Practice quiz</h1>' +
      '<div class="quiz">' +
      '<div class="quiz-top">' +
      '<div class="quiz-progress"><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + run.index + '" aria-label="Quiz progress"><span style="width:' + pct(run.index, total) + '%"></span></div>' +
      '<span class="small muted">Question ' + (run.index + 1) + ' of ' + total + '</span></div>' +
      '<div class="score" aria-label="Score"><span class="ok">' + icon('check') + '<b id="sc-ok">' + run.correct + '</b></span><span class="bad">' + icon('x') + '<b id="sc-bad">' + run.wrong + '</b></span></div></div>' +
      '<div class="quiz-card" id="qcard">' +
      '<span class="chip">' + (q.dir === 'en-uz' ? 'English → Uzbek' : 'Uzbek → English') + '</span>' +
      '<p class="q-label">What does this word mean?</p>' +
      '<p class="q-word" lang="' + (q.dir === 'en-uz' ? 'en' : 'uz') + '">' + esc(prompt) + '</p>' +
      '<form id="answer-form" autocomplete="off" novalidate><label class="sr-only" for="answer">Your answer in ' + (q.dir === 'en-uz' ? 'Uzbek' : 'English') + '</label>' +
      '<input id="answer" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Type the ' + (q.dir === 'en-uz' ? 'Uzbek' : 'English') + ' translation and press Enter">' +
      '<div class="quiz-buttons"><button type="submit" class="btn btn-primary" id="btn-check">Check answer</button>' +
      '<button type="button" class="btn btn-ghost" id="btn-skip">I don’t know</button></div></form>' +
      '<div id="feedback" class="feedback" role="status" aria-live="assertive"></div>' +
      '</div>' +
      '<div class="quiz-bottom"><button type="button" class="btn btn-ghost btn-sm" id="btn-restart">' + icon('shuffle') + 'Restart &amp; shuffle</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="btn-end">End session</button></div></div>';
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
      root.querySelector('#feedback').innerHTML = '<p class="muted">Type an answer first, or press “I don’t know”.</p>';
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
    root.querySelector('.quiz-buttons').innerHTML = '<button type="button" class="btn btn-primary" id="btn-next">' + (isLast ? 'Finish quiz' : 'Next word') + icon('arrow') + '</button>';
    root.querySelector('#feedback').innerHTML = ok
      ? '<div class="fb fb-ok">' + icon('check') + '<div><strong>Correct!</strong>' + (VL.quiz.acceptedAnswers(expected).length > 1 ? '<div class="small">All accepted: ' + esc(expected) + '</div>' : '') + '</div></div>'
      : '<div class="fb fb-bad">' + icon('x') + '<div><strong>' + (text ? 'Not quite.' : 'No problem.') + '</strong><div>Correct answer: <b>' + esc(expected) + '</b></div>' + (text ? '<div class="small">You typed: ' + esc(text) + '</div>' : '') + '</div></div>';
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
      label: run.label, direction: cfg.direction, scope: cfg.scope,
      collectionId: VL.store.collection(cfg.scope) ? cfg.scope : null,
      total: run.results.length, correct: run.correct, wrong: run.wrong, missedIds: Array.from(new Set(missed)),
    });
  }

  async function restart() {
    if (run.results.length) await saveSession();
    const c = Object.assign({}, cfg);
    if (!start(c)) drawSetup();
    else VL.ui.toast('Reshuffled — starting over.', 'info', 1600);
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
    const msg = p === 100 ? 'Flawless!' : p >= 80 ? 'Great work!' : p >= 50 ? 'Good effort — keep going.' : 'Every mistake is a chance to learn.';
    const R = 52, C = 2 * Math.PI * R;
    root.innerHTML =
      '<header class="page-head"><div><h1>Session complete</h1><p class="muted">' + esc(run.label) + '</p></div></header>' +
      '<section class="card summary">' +
      '<div class="ring" role="img" aria-label="' + p + ' percent correct"><svg viewBox="0 0 120 120"><circle class="ring-bg" cx="60" cy="60" r="' + R + '"/><circle class="ring-fg" cx="60" cy="60" r="' + R + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - p / 100)).toFixed(1) + '"/></svg><div class="ring-text">' + p + '%</div></div>' +
      '<div><h2>' + msg + '</h2><p class="muted">' + run.correct + ' correct · ' + run.wrong + ' incorrect · ' + plural(total, 'question') + '</p>' +
      '<div class="btn-row"><button class="btn btn-primary" id="again">' + icon('refresh') + 'Practise again</button>' +
      (missed.length ? '<button class="btn" id="mistakes">' + icon('target') + 'Practise ' + plural(missed.length, 'mistake') + '</button>' : '') +
      '<button class="btn btn-ghost" id="back">New setup</button></div></div></section>' +
      (missed.length
        ? '<section class="card"><h2 class="card-title">Review: words you missed</h2><div class="table-wrap"><table class="words"><thead><tr><th scope="col">Word</th><th scope="col">Correct answer</th><th scope="col">You typed</th></tr></thead><tbody>' +
          missed.map((r) => '<tr><td class="strong">' + esc(r.prompt) + '</td><td>' + esc(r.expected) + '</td><td class="muted">' + (r.typed ? esc(r.typed) : '—') + '</td></tr>').join('') + '</tbody></table></div></section>'
        : '<section class="card"><p>No mistakes this time. 🎉</p></section>');
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
