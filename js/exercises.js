/* Exercise components for the lesson player. Every exercise type is a self-contained component:

   render(ctx)                   -> HTML of the card
   mount(root, ctx, api)         -> wires events; may return a cleanup function
                                    api.ready(bool)  enables / disables the Check button
                                    api.submit()     same as pressing Check
                                    api.skip(opts)   gives up on the exercise
                                    api.finish(res)  (self-checked exercises) reports the result
   collect(root, ctx)            -> the user's answer
   evaluate(answer, ctx, opts)   -> { correct, skipped, neutral, typo, lines: [safe html] }
   reveal(root, ctx, res)        -> locks the UI and shows the right / wrong state
   speakText(ctx)                -> text to read aloud when the exercise appears (optional)
   ctx = { item, words, word, sentence, lesson }                                                      */
VL.exercises = (function () {
  const { esc } = VL.util;
  const { icon } = VL.ui;
  const t = VL.t;
  const E = VL.learn;
  const store = VL.store;
  const lenient = () => store.state.settings.lenient;

  /* ---------- shared pieces ---------- */
  const exampleLine = (w) => (w && w.example ? esc(t('les.example')) + ': ' + esc(w.example) + (w.exUz ? ' — ' + esc(w.exUz) : '') : '');
  const ruleLine = (s) => (s && s.rule ? [esc(t('fb.ruleLine', { t: t('rule.' + s.rule + '.t'), d: t('rule.' + s.rule + '.d') }))] : []);
  const label = (key) => '<p class="lesson-type">' + esc(t(key)) + '</p>';
  const sayBtn = (text, big) => VL.speech.button(text, big ? 'big' : '');
  const meaning = (w) => esc(t('fb.meaning', { en: w.en, uz: E.primary(w.uz) }));
  const sentenceAlts = (s, lang) => (lang === 'uz' ? s.uz : [s.en].concat(s.enAlts || []));

  function typedInput(phKey, ariaKey, multiline) {
    const common = 'id="lans" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="' + esc(t(phKey)) + '" aria-label="' + esc(t(ariaKey)) + '"';
    return '<form id="lform" autocomplete="off" novalidate>' + (multiline ? '<textarea ' + common + ' rows="2" maxlength="300"></textarea>' : '<input type="text" ' + common + '>') + '</form>';
  }

  function mountTyped(root, api) {
    const input = root.querySelector('#lans');
    const form = root.querySelector('#lform');
    input.addEventListener('input', () => api.ready(input.value.trim().length > 0));
    form.addEventListener('submit', (e) => { e.preventDefault(); api.submit(); });
    if (input.tagName === 'TEXTAREA') input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); api.submit(); } });
    input.focus();
  }
  const collectTyped = (root) => root.querySelector('#lans').value.trim();
  function lockTyped(root, res) {
    const input = root.querySelector('#lans');
    input.readOnly = true;
    input.classList.add(res.correct ? 'is-ok' : 'is-bad');
  }

  /* ---------- tile board (letters and words) ---------- */
  function TileBoard(root, o) {
    const el = root.querySelector('.tb');
    const answerEl = el.querySelector('.tb-answer'), bankEl = el.querySelector('.tb-bank');
    const byId = new Map(o.tokens.map((tk) => [tk.id, tk]));
    let ans = [], locked = false, drag = null, suppress = false;

    const chip = (tk, zone) => '<button type="button" class="tile-chip ' + o.kind + '" data-id="' + tk.id + '" data-zone="' + zone + '" aria-label="' + esc(tk.text) + '">' + esc(tk.text) + '</button>';
    function render(focusId) {
      answerEl.innerHTML = ans.length ? ans.map((id) => chip(byId.get(id), 'ans')).join('') : '<span class="tb-placeholder">' + esc(t('tiles.emptyAnswer')) + '</span>';
      bankEl.innerHTML = o.tokens.filter((tk) => !ans.includes(tk.id)).map((tk) => chip(tk, 'bank')).join('');
      el.querySelector('[data-tb="undo"]').disabled = locked || !ans.length;
      el.querySelector('[data-tb="reset"]').disabled = locked || !ans.length;
      if (focusId) { const f = answerEl.querySelector('[data-id="' + focusId + '"]'); if (f) f.focus(); }
      o.onChange();
    }
    const add = (id) => { if (!locked && !ans.includes(id)) { ans.push(id); render(); } };
    const remove = (id) => { if (!locked && ans.includes(id)) { ans = ans.filter((x) => x !== id); render(); } };
    function moveTo(id, index) {
      const from = ans.indexOf(id);
      if (from < 0 || index < 0 || index >= ans.length || from === index) return;
      ans.splice(from, 1); ans.splice(index, 0, id);
      render(id);
    }

    el.addEventListener('click', (e) => {
      if (suppress) { suppress = false; return; }
      const b = e.target.closest('[data-tb]');
      if (b) { if (b.dataset.tb === 'undo') { ans.pop(); render(); } else if (b.dataset.tb === 'reset') { ans = []; render(); } return; }
      const c = e.target.closest('.tile-chip');
      if (!c) return;
      if (c.dataset.zone === 'bank') add(c.dataset.id); else remove(c.dataset.id);
    });
    el.addEventListener('keydown', (e) => {
      const c = e.target.closest('.tile-chip[data-zone="ans"]');
      if (!c || locked) return;
      const i = ans.indexOf(c.dataset.id);
      if (e.key === 'ArrowLeft') { e.preventDefault(); moveTo(c.dataset.id, i - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); moveTo(c.dataset.id, i + 1); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); const next = ans[i + 1] || ans[i - 1]; remove(c.dataset.id); if (next) { const f = answerEl.querySelector('[data-id="' + next + '"]'); if (f) f.focus(); } }
    });

    // pointer drag to reorder the placed tiles (mouse and touch)
    answerEl.addEventListener('pointerdown', (e) => {
      const c = e.target.closest('.tile-chip');
      if (!c || locked || e.button > 0) return;
      drag = { id: c.dataset.id, x: e.clientX, y: e.clientY, started: false, target: null, el: c };
    });
    answerEl.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (!drag.started) {
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 9) return;
        drag.started = true; drag.el.classList.add('dragging');
        try { drag.el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
      e.preventDefault();
      const chips = Array.from(answerEl.querySelectorAll('.tile-chip')).filter((c) => c !== drag.el);
      answerEl.querySelectorAll('.drop-before, .drop-after').forEach((c) => c.classList.remove('drop-before', 'drop-after'));
      let best = null, bestD = Infinity;
      chips.forEach((c) => {
        const r = c.getBoundingClientRect();
        const d = Math.hypot(e.clientX - (r.left + r.width / 2), (e.clientY - (r.top + r.height / 2)) * 2);
        if (d < bestD) { bestD = d; best = { c, after: e.clientX > r.left + r.width / 2 }; }
      });
      drag.target = best;
      if (best) best.c.classList.add(best.after ? 'drop-after' : 'drop-before');
    });
    const endDrag = () => {
      if (!drag) return;
      const d = drag; drag = null;
      d.el.classList.remove('dragging');
      answerEl.querySelectorAll('.drop-before, .drop-after').forEach((c) => c.classList.remove('drop-before', 'drop-after'));
      if (!d.started) return;
      suppress = true; setTimeout(() => { suppress = false; }, 0);
      if (!d.target) return;
      const others = ans.filter((x) => x !== d.id);
      let idx = others.indexOf(d.target.c.dataset.id) + (d.target.after ? 1 : 0);
      idx = Math.max(0, Math.min(others.length, idx));
      others.splice(idx, 0, d.id);
      ans = others; render(d.id);
    };
    answerEl.addEventListener('pointerup', endDrag);
    answerEl.addEventListener('pointercancel', endDrag);

    render();
    return {
      ids: () => ans.slice(),
      texts: () => ans.map((id) => byId.get(id).text),
      full: () => ans.length === o.tokens.length,
      addByText(ch) { const tk = o.tokens.find((x) => !ans.includes(x.id) && x.text.toLowerCase() === ch.toLowerCase()); if (tk) add(tk.id); return !!tk; },
      removeLast() { if (ans.length) { ans.pop(); render(); } },
      lock(ok) {
        locked = true;
        el.querySelectorAll('.tile-chip').forEach((c) => { c.disabled = true; });
        answerEl.classList.add(ok ? 'ok' : 'bad');
        el.querySelector('[data-tb="undo"]').disabled = true; el.querySelector('[data-tb="reset"]').disabled = true;
      },
    };
  }

  const boardHtml = (kind, aria) =>
    '<div class="tb" data-kind="' + kind + '"><div class="tb-answer" role="list" aria-live="polite" aria-label="' + esc(t('tiles.answer')) + '"></div>' +
    '<div class="tb-bank" role="group" aria-label="' + esc(t(aria)) + '"></div>' +
    '<div class="tb-tools"><button type="button" class="btn btn-sm btn-ghost" data-tb="undo">' + esc(t('btn.undo')) + '</button><button type="button" class="btn btn-sm btn-ghost" data-tb="reset">' + esc(t('btn.reset')) + '</button></div>' +
    '<p class="hint tb-hint">' + esc(t('tiles.hint')) + '</p></div>';

  /* ---------- option lists (choose / cloze / listen-choose) ---------- */
  const optionsHtml = (options, aria) => '<div class="options" role="group" aria-label="' + esc(aria) + '">' + options.map((o, i) =>
    '<button type="button" class="option" data-index="' + i + '" aria-pressed="false"><kbd>' + String.fromCharCode(65 + i) + '</kbd><span>' + esc(o.text) + '</span></button>').join('') + '</div>';

  function mountOptions(root, ctx, api) {
    let selected = -1;
    const buttons = Array.from(root.querySelectorAll('.option'));
    const select = (i) => {
      if (!buttons[i] || buttons[i].disabled) return;
      selected = i;
      buttons.forEach((b, k) => { b.classList.toggle('selected', k === i); b.setAttribute('aria-pressed', String(k === i)); });
      api.ready(true);
    };
    buttons.forEach((b, i) => b.addEventListener('click', () => select(i)));
    const onKey = (e) => {
      if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      const idx = /^[1-9]$/.test(k) ? Number(k) - 1 : /^[a-d]$/.test(k) ? k.charCodeAt(0) - 97 : -1;
      if (idx >= 0 && idx < buttons.length) { e.preventDefault(); select(idx); }
    };
    document.addEventListener('keydown', onKey);
    root._getSelected = () => selected;
    return () => document.removeEventListener('keydown', onKey);
  }
  const collectOption = (root) => { const i = root._getSelected ? root._getSelected() : -1; return i >= 0 ? i : null; };
  function revealOptions(root, options, chosen) {
    root.querySelectorAll('.option').forEach((b, i) => {
      b.disabled = true; b.classList.remove('selected');
      if (options[i].correct) b.classList.add('right'); else if (i === chosen) b.classList.add('wrong');
    });
  }

  /* =========================== components =========================== */
  const C = {};

  C.learn = {
    render({ word: w }) {
      return '<span class="chip chip-new-word">' + icon('star') + esc(t('les.newWord')) + '</span>' +
        '<p class="q-word" lang="en">' + esc(w.en) + sayBtn(w.en, true) + '</p>' +
        (w.phonetic ? '<p class="phonetic" aria-label="' + esc(t('les.phonetic')) + '">' + esc(w.phonetic) + '</p>' : '') +
        '<p class="intro-uz" lang="uz">' + esc(w.uz) + '</p>' + (w.example ? '<p class="lesson-example"><b>' + esc(t('les.example')) + ':</b> ' + esc(w.example) + '</p>' : '') +
        '<p class="q-label">' + esc(t('q.learn')) + '</p>' + typedInput('q.fillPh', 'quiz.ariaEn');
    },
    mount: (root, ctx, api) => mountTyped(root, api),
    collect: collectTyped,
    speakText: (ctx) => ctx.word.en,
    evaluate(answer, { word: w }, opts) {
      const r = answer && !(opts && opts.skipped) ? E.checkTyped(answer, w.en, lenient()) : { correct: false, closeCall: false };
      const lines = r.correct ? [esc(w.en) + ' — ' + esc(w.uz)] : [(r.closeCall ? esc(t('fb.close')) + '<br>' : '') + esc(t('fb.rightIs', { a: w.en })) + sayBtn(w.en), answer ? esc(t('fb.youTyped', { x: answer })) : ''].filter(Boolean);
      return { correct: r.correct, skipped: !answer, lines };
    },
    reveal: lockTyped,
  };

  C.choose = {
    render({ item, word: w }) {
      return label('ex.choose') + '<p class="q-label">' + esc(t('quiz.q')) + '</p><p class="q-word" lang="en">' + esc(w.en) + sayBtn(w.en, true) + '</p>' + optionsHtml(item.options, t('ex.choose'));
    },
    mount: mountOptions,
    collect: collectOption,
    speakText: (ctx) => ctx.word.en,
    evaluate(answer, { item, word: w }) {
      const correct = answer != null && !!item.options[answer].correct;
      const lines = correct ? (VL.quiz.acceptedAnswers(w.uz).length > 1 ? [esc(t('fb.allAccepted', { a: w.uz }))] : [meaning(w)]) : [esc(t('fb.rightIs', { a: w.uz })), meaning(w)];
      if (w.example) lines.push(exampleLine(w));
      return { correct, skipped: answer == null, lines, chosen: answer };
    },
    reveal: (root, ctx, res) => revealOptions(root, ctx.item.options, res.chosen),
  };

  // Uzbek word -> choose the English word
  C.chooseRev = {
    render({ item, word: w }) {
      return label('ex.chooseRev') + '<p class="q-label">' + esc(t('q.chooseRev')) + '</p><p class="q-word" lang="uz">' + esc(E.primary(w.uz)) + '</p>' + optionsHtml(item.options, t('ex.chooseRev'));
    },
    mount: mountOptions,
    collect: collectOption,
    evaluate(answer, { item, word: w }) {
      const correct = answer != null && !!item.options[answer].correct;
      const lines = [correct ? esc(w.en) + ' — ' + esc(w.uz) + sayBtn(w.en) : esc(t('fb.rightIs', { a: w.en })) + sayBtn(w.en), meaning(w)];
      if (w.example) lines.push(exampleLine(w));
      return { correct, skipped: answer == null, lines, chosen: answer };
    },
    speakText: () => null,
    reveal: (root, ctx, res) => revealOptions(root, ctx.item.options, res.chosen),
  };

  // word typing: English -> Uzbek (translate), Uzbek -> English (reverse) or either (type)
  C.wordType = {
    render({ item, word: w }) {
      const toUz = item.dir === 'en-uz';
      const key = item.type === 'type' ? 'ex.type' : item.type === 'translate' ? 'ex.translate' : 'ex.reverse';
      return label(key) + '<p class="q-label">' + esc(t(toUz ? 'q.typeUz' : 'q.typeEn')) + '</p><p class="q-word" lang="' + (toUz ? 'en' : 'uz') + '">' + esc(toUz ? w.en : (item.prompt || w.uz)) + (toUz ? sayBtn(w.en, true) : '') + '</p>' +
        typedInput(toUz ? 'quiz.phUz' : 'quiz.phEn', toUz ? 'quiz.ariaUz' : 'quiz.ariaEn');
    },
    mount: (root, ctx, api) => mountTyped(root, api),
    collect: collectTyped,
    speakText: ({ item, word }) => (item.dir === 'en-uz' ? word.en : null),
    evaluate(answer, { item, word: w }, opts) {
      const expected = E.expectedFor(item, w);
      const give = !answer || (opts && opts.skipped);
      const r = give ? { verdict: 'empty' } : VL.answers.checkWord(answer, w, { dir: item.dir, prompt: E.promptFor(item, w), lenient: lenient(), context: item.context || '' });
      const ok = r.verdict === 'correct' || r.verdict === 'typo';
      const speak = item.dir === 'uz-en' ? sayBtn(w.en) : '';
      const lines = [];
      const info = item.dir === 'en-uz' ? VL.answers.describe(w, item.context) : null;
      if (ok) {
        if (r.verdict === 'typo') lines.push(esc(t('fb.typo', { a: r.matched })));
        else if (info && info.others.length) lines.push(esc(t('fb.alsoOk', { a: [info.main].concat(info.others).join(' / ') })));
        else if (!info && VL.quiz.acceptedAnswers(expected).length > 1) lines.push(esc(t('fb.allAccepted', { a: expected })));
        if (r.synonymOf) lines.push(esc(t('fb.synonym', { a: w.en, b: r.matched })));
        if (speak) lines.push(esc(w.en) + speak);
      } else {
        if (r.verdict === 'close') lines.push(esc(t('fb.close')));
        if (r.verdict === 'contextOnly') lines.push(esc(t('fb.contextOnly', { a: r.matched, c: r.context })));
        if (r.verdict === 'generalOnly') lines.push(esc(t('fb.generalOnly', { a: r.matched })));
        lines.push(esc(t('fb.rightIs', { a: info ? info.main : expected })) + speak);
        if (info && info.others.length) lines.push(esc(t('fb.alsoOk', { a: info.others.join(' / ') })));
        if (!give) lines.push(esc(t('fb.youTyped', { x: answer })));
        lines.push(meaning(w));
      }
      if (w.example) lines.push(exampleLine(w));
      return { correct: ok, typo: r.verdict === 'typo', skipped: give, lines, typed: answer };
    },
    reveal: lockTyped,
  };
  C.type = C.translate = C.reverse = C.wordType;

  /* "study" card of the mixed exercise: the word with its translation(s) and example, shown BEFORE the six
     exercises of that word. It is not an exercise: nothing is graded and it is not counted. */
  C.study = {
    selfChecked: true,
    hideActions: true,
    render({ word: w, item }) {
      const posKey = w.pos ? 'pos.' + w.pos : '';
      return '<span class="chip chip-new-word">' + icon('star') + esc(t('mx.studyChip', { i: (item.mixWord || 0) + 1 })) + '</span>' +
        '<p class="q-word" lang="en">' + esc(w.en) + sayBtn(w.en, true) + '</p>' +
        (w.phonetic ? '<p class="phonetic">' + esc(w.phonetic) + '</p>' : '') +
        '<p class="intro-uz" lang="uz">' + esc(w.uz) + '</p>' +
        '<div class="tp-chips">' + (posKey ? '<span class="chip">' + esc(t(posKey)) + '</span>' : '') + (w.level ? '<span class="chip">' + esc(w.level) + '</span>' : '') + '</div>' +
        (w.example ? '<p class="lesson-example"><b>' + esc(t('les.example')) + ':</b> <span lang="en">' + esc(w.example) + '</span>' + sayBtn(w.example) + (w.exUz ? '<br><span class="muted" lang="uz">' + esc(w.exUz) + '</span>' : '') + '</p>' : '') +
        (w.sense ? '<p class="muted small">' + esc(w.sense) + '</p>' : '') +
        '<p class="muted small study-hint">' + esc(t('mx.studyHint')) + '</p>' +
        '<button type="button" class="btn btn-primary btn-lg study-go" data-study-go>' + esc(t('mx.begin')) + icon('arrow') + '</button>';
    },
    mount(root, ctx, api) { const b = root.querySelector('[data-study-go]'); b.addEventListener('click', () => api.finish({ neutral: true, skipped: true, lines: [] })); b.focus(); },
    collect: () => null,
    speakText: (ctx) => ctx.word.en,
    evaluate: () => ({ neutral: true, skipped: true, lines: [] }),
  };

  // missing letters:  B _ _ k
  C.fill = {
    render({ item, word: w }) {
      const letters = item.mask.map((ch) => (ch === ' ' ? '<span class="gap"></span>' : '<span class="ch' + (ch === '_' ? ' blank' : '') + '">' + (ch === '_' ? '' : esc(ch)) + '</span>')).join('');
      return label('ex.fill') + '<p class="q-label">' + esc(t('q.fill')) + '</p><p class="mask" aria-label="' + esc(item.mask.join(' ')) + '">' + letters + '</p><p class="fill-hint">' + esc(t('q.fillHint', { t: E.primary(w.uz) })) + '</p>' + typedInput('q.fillPh', 'quiz.ariaEn');
    },
    mount: (root, ctx, api) => mountTyped(root, api),
    collect: collectTyped,
    evaluate(answer, { word: w }, opts) {
      const give = !answer || (opts && opts.skipped);
      const r = give ? { correct: false, closeCall: false } : E.checkTyped(answer, w.en, lenient());
      const lines = r.correct ? [esc(w.en) + sayBtn(w.en)] : [(r.closeCall ? esc(t('fb.close')) + '<br>' : '') + esc(t('fb.fullWord', { w: w.en })) + sayBtn(w.en), give ? '' : esc(t('fb.youTyped', { x: answer })), meaning(w)].filter(Boolean);
      return { correct: r.correct, skipped: give, lines };
    },
    reveal: lockTyped,
  };

  // letters in a shuffled order -> tap to build the word
  C.scramble = {
    render({ item, word: w }) {
      return label('ex.scramble') + '<p class="q-label">' + esc(t('q.scramble', { t: E.primary(w.uz) })) + '</p>' + boardHtml('letters', 'tiles.letters');
    },
    mount(root, ctx, api) {
      let board = null;
      board = TileBoard(root, { tokens: ctx.item.tiles, kind: 'letters', onChange: () => api.ready(!!board && board.full()) });
      root._board = board;
      const onKey = (e) => {
        if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        if (e.key.length === 1 && /\p{L}/u.test(e.key)) { if (board.addByText(e.key)) e.preventDefault(); }
        else if (e.key === 'Backspace' && !e.target.closest('.tile-chip')) { e.preventDefault(); board.removeLast(); }
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    },
    collect: (root) => (root._board.full() ? root._board.texts().join('') : null),
    speakText: null,
    evaluate(answer, { word: w }) {
      const correct = answer != null && answer.toLowerCase() === w.en.toLowerCase();
      const lines = correct ? [esc(w.en) + ' — ' + esc(w.uz) + sayBtn(w.en)] : [esc(t('fb.rightIs', { a: w.en })) + sayBtn(w.en), answer ? esc(t('fb.youTyped', { x: answer })) : '', meaning(w)].filter(Boolean);
      if (w.example) lines.push(exampleLine(w));
      return { correct, skipped: answer == null, lines };
    },
    reveal: (root, ctx, res) => root._board.lock(res.correct),
  };

  // hear the word or sentence, then choose it or type it
  C.listen = {
    render({ item, word: w, sentence: s }) {
      const text = item.sentenceId ? s.en : w.en;
      const rich = '<div class="listen-box"><button type="button" class="listen-btn" data-speak="' + esc(text) + '" data-rate="0.95" aria-label="' + esc(t('listen.play')) + '">' + icon('volume') + '</button>' +
        '<button type="button" class="listen-btn slow" data-speak="' + esc(text) + '" data-rate="0.55" aria-label="' + esc(t('listen.slow')) + '">' + icon('volume') + '<span>' + esc(t('listen.slow')) + '</span></button></div>';
      const body = item.variant === 'choose' ? '<p class="q-label">' + esc(t('q.listenWord')) + '</p>' + rich + optionsHtml(item.options, t('q.listenWord'))
        : '<p class="q-label">' + esc(t(item.variant === 'sentence' ? 'q.listenType' : 'q.listenType')) + '</p>' + rich + typedInput(item.variant === 'sentence' ? 'q.listenPh' : 'quiz.phEn', 'quiz.ariaEn', item.variant === 'sentence');
      return label('ex.listen') + body + '<button type="button" class="btn btn-ghost btn-sm" data-cant-listen>' + esc(t('listen.cant')) + '</button>';
    },
    mount(root, ctx, api) {
      root.querySelector('[data-cant-listen]').addEventListener('click', () => api.skip({ neutral: true }));
      return ctx.item.variant === 'choose' ? mountOptions(root, ctx, api) : (mountTyped(root, api), null);
    },
    collect: (root, ctx) => (ctx.item.variant === 'choose' ? collectOption(root) : collectTyped(root)),
    speakText: ({ item, word, sentence }) => (item.sentenceId ? sentence.en : word.en),
    evaluate(answer, ctx, opts) {
      const { item, word: w, sentence: s } = ctx;
      const text = item.sentenceId ? s.en : w.en;
      if (opts && opts.neutral) return { correct: false, skipped: true, neutral: true, lines: [esc(t('listen.skipped')), esc(t('listen.text', { t: text })) + sayBtn(text)] };
      if (item.variant === 'choose') {
        const correct = answer != null && !!item.options[answer].correct;
        return { correct, skipped: answer == null, chosen: answer, lines: correct ? [esc(w.en) + ' — ' + esc(w.uz)] : [esc(t('fb.rightIs', { a: w.en })) + sayBtn(w.en), meaning(w)] };
      }
      const give = !answer || (opts && opts.skipped);
      if (item.variant === 'sentence') {
        const r = give ? { correct: false } : E.checkSentence(answer, [s.en].concat(s.enAlts || []), 'en', lenient());
        const lines = r.correct ? (r.typo ? [esc(t('fb.typo', { x: s.en }))] : [esc(s.en) + sayBtn(s.en)]) : [esc(t('fb.rightIs', { a: s.en })) + sayBtn(s.en), give ? '' : esc(t('fb.youTyped', { x: answer })), esc(s.uz[0])].filter(Boolean);
        return { correct: r.correct, skipped: give, lines };
      }
      const r = give ? { correct: false, closeCall: false } : E.checkTyped(answer, w.en, lenient());
      return { correct: r.correct, skipped: give, lines: r.correct ? [esc(w.en) + ' — ' + esc(w.uz)] : [(r.closeCall ? esc(t('fb.close')) + '<br>' : '') + esc(t('fb.rightIs', { a: w.en })) + sayBtn(w.en), give ? '' : esc(t('fb.youTyped', { x: answer })), meaning(w)].filter(Boolean) };
    },
    reveal(root, ctx, res) { if (ctx.item.variant === 'choose') revealOptions(root, ctx.item.options, res.chosen); else lockTyped(root, res); },
  };

  // translate a sentence (English -> Uzbek, Uzbek -> English)
  C.sentence = {
    render({ item, sentence: s }) {
      const toUz = item.type === 'sentEnUz';
      return label(toUz ? 'ex.sentEnUz' : 'ex.sentUzEn') + '<p class="q-label">' + esc(t(toUz ? 'q.sentEnUz' : 'q.sentUzEn')) + '</p>' +
        '<p class="q-sentence" lang="' + (toUz ? 'en' : 'uz') + '">' + esc(toUz ? s.en : s.uz[0]) + (toUz ? sayBtn(s.en, true) : '') + '</p>' + typedInput(toUz ? 'q.sentPh' : 'q.sentPhEn', toUz ? 'quiz.ariaUz' : 'quiz.ariaEn', true);
    },
    mount: (root, ctx, api) => mountTyped(root, api),
    collect: collectTyped,
    speakText: ({ item, sentence }) => (item.type === 'sentEnUz' ? sentence.en : null),
    evaluate(answer, { item, sentence: s }, opts) {
      const toUz = item.type === 'sentEnUz';
      const lang = toUz ? 'uz' : 'en';
      const alts = sentenceAlts(s, lang);
      const give = !answer || (opts && opts.skipped);
      const r = give ? { correct: false, typo: false, closest: alts[0] } : E.checkSentence(answer, alts, lang, lenient());
      const speak = toUz ? '' : sayBtn(s.en);
      const lines = [];
      if (r.correct) {
        if (r.typo) lines.push(esc(t('fb.typo', { x: r.closest })));
        const others = alts.filter((a) => a !== r.closest).slice(0, 2);
        if (others.length) lines.push(esc(t('fb.otherOk', { a: others.join(' / ') })));
        if (!toUz) lines.push(esc(s.en) + speak);
      } else {
        lines.push(esc(t('fb.rightIs', { a: alts[0] })) + speak);
        const others = alts.slice(1, 3);
        if (others.length) lines.push(esc(t('fb.otherOk', { a: others.join(' / ') })));
        if (!give) lines.push(esc(t('fb.yourSentence', { x: answer })));
      }
      return { correct: r.correct, skipped: give, lines: lines.concat(ruleLine(s)) };
    },
    reveal: lockTyped,
  };
  C.sentEnUz = C.sentUzEn = C.sentence;

  // put the words in order
  C.order = {
    render({ item, sentence: s }) {
      return label('ex.order') + '<p class="q-label">' + esc(t('q.sentUzEn')) + '</p><p class="q-sentence" lang="uz">' + esc(s.uz[0]) + '</p>' + boardHtml('words', 'tiles.words');
    },
    mount(root, ctx, api) {
      let board = null;
      board = TileBoard(root, { tokens: ctx.item.tiles, kind: 'words', onChange: () => api.ready(!!board && board.full()) });
      root._board = board;
      return null;
    },
    collect: (root) => (root._board.full() ? root._board.texts().join(' ') : null),
    evaluate(answer, { sentence: s }) {
      const r = answer == null ? { correct: false } : E.checkSentence(answer, [s.en].concat(s.enAlts || []), 'en', false);
      const lines = r.correct ? [esc(s.en) + sayBtn(s.en)] : [esc(t('fb.modelEn', { a: s.en })) + sayBtn(s.en), answer ? esc(t('fb.yourSentence', { x: answer })) : ''].filter(Boolean);
      return { correct: r.correct && !r.typo, skipped: answer == null, lines: lines.concat(ruleLine(s)) };
    },
    reveal: (root, ctx, res) => root._board.lock(res.correct),
  };

  // fill in the blank with the right grammar word
  C.cloze = {
    render({ item, sentence: s }) {
      const re = new RegExp('(^|[\\s,])' + s.cloze.answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=[\\s,.?!]|$)', 'i');
      const html = esc(s.en).replace(re, (m, pre) => pre + '<span class="blank-slot" id="blank-slot">&nbsp;</span>');
      return label('ex.cloze') + '<p class="q-label">' + esc(t('q.cloze')) + '</p><p class="q-sentence cloze-sentence" lang="en">' + html + '</p><p class="muted small">' + esc(s.uz[0]) + '</p>' + optionsHtml(item.options, t('q.cloze'));
    },
    mount: mountOptions,
    collect: collectOption,
    evaluate(answer, { item, sentence: s }) {
      const correct = answer != null && !!item.options[answer].correct;
      const lines = [correct ? esc(s.en) + sayBtn(s.en) : esc(t('fb.rightIs', { a: s.cloze.answer })) + '<br>' + esc(s.en) + sayBtn(s.en)];
      return { correct, skipped: answer == null, chosen: answer, lines: lines.concat(ruleLine(s)) };
    },
    reveal(root, ctx, res) {
      const slot = root.querySelector('#blank-slot');
      if (slot) { slot.textContent = ctx.sentence.cloze.answer; slot.classList.add(res.correct ? 'ok' : 'bad'); }
      revealOptions(root, ctx.item.options, res.chosen);
    },
  };

  // match words with translations (finishes by itself)
  C.match = {
    selfChecked: true,
    render({ item }) {
      const left = VL.util.shuffle(item.pairs), right = VL.util.shuffle(item.pairs);
      return label('ex.match') + '<p class="q-label">' + esc(t('match.hint')) + '</p><div class="match-board">' +
        '<div class="match-col" role="group" aria-label="' + esc(t('match.enAria')) + '">' + left.map((p) => '<button type="button" class="tile" data-side="l" data-id="' + esc(p.wordId) + '">' + esc(p.en) + '</button>').join('') + '</div>' +
        '<div class="match-col" role="group" aria-label="' + esc(t('match.uzAria')) + '">' + right.map((p) => '<button type="button" class="tile" data-side="r" data-id="' + esc(p.wordId) + '">' + esc(p.uz) + '</button>').join('') + '</div></div>';
    },
    mount(root, ctx, api) {
      const m = { done: new Set(), mistakes: {}, selL: null, selR: null, total: ctx.item.pairs.length };
      root.addEventListener('click', (e) => {
        const btn = e.target.closest('.tile');
        if (!btn || btn.disabled) return;
        const side = btn.dataset.side, id = btn.dataset.id, key = side === 'l' ? 'selL' : 'selR';
        root.querySelectorAll('.tile[data-side="' + side + '"]').forEach((b) => b.classList.remove('selected'));
        if (m[key] === id) { m[key] = null; return; }
        m[key] = id; btn.classList.add('selected');
        if (!(m.selL && m.selR)) return;
        const l = root.querySelector('.tile[data-side="l"][data-id="' + m.selL + '"]'), r = root.querySelector('.tile[data-side="r"][data-id="' + m.selR + '"]');
        if (m.selL === m.selR) {
          [l, r].forEach((b) => { b.classList.remove('selected'); b.classList.add('matched'); b.disabled = true; });
          m.done.add(m.selL); m.selL = m.selR = null;
          if (m.done.size === m.total) {
            const pairs = ctx.item.pairs.map((p) => ({ wordId: p.wordId, en: p.en, ok: !(m.mistakes[p.wordId] > 0), mistakes: m.mistakes[p.wordId] || 0 }));
            const wrongTries = pairs.reduce((a, p) => a + p.mistakes, 0), weak = pairs.filter((p) => !p.ok).map((p) => p.en);
            const lines = [esc(t('fb.matchAll'))];
            if (wrongTries) lines.push(esc(t('fb.matchMistakes', { n: wrongTries })));
            if (weak.length) lines.push(esc(t('fb.matchWeak', { w: weak.join(', ') })));
            api.finish({ correct: true, pairs, lines });
          }
        } else {
          m.mistakes[m.selL] = (m.mistakes[m.selL] || 0) + 1;
          [l, r].forEach((b) => { b.classList.remove('selected'); b.classList.add('miss'); });
          m.selL = m.selR = null;
          setTimeout(() => root.querySelectorAll('.tile.miss').forEach((b) => b.classList.remove('miss')), 450);
        }
      });
      return null;
    },
  };

  // the item type -> component
  const BY_TYPE = { chooseRev: C.chooseRev, study: C.study, learn: C.learn, intro: C.learn, choose: C.choose, type: C.wordType, translate: C.wordType, reverse: C.wordType, fill: C.fill, scramble: C.scramble,
    listen: C.listen, sentEnUz: C.sentence, sentUzEn: C.sentence, order: C.order, cloze: C.cloze, match: C.match };

  return { components: C, forItem: (item) => BY_TYPE[item.type] || null, TileBoard };
})();
