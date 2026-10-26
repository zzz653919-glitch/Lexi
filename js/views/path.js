/* The learning path map: levels -> units (topics) -> lesson buttons. Every button opens a real lesson. */
VL.views.path = (function () {
  const { esc, pct } = VL.util;
  const { icon } = VL.ui;
  const t = VL.t, n = VL.n;
  const store = VL.store, P = VL.path;
  let root = null, off = null, levelId = null;

  const KEY = 'lexi.pathLevel';
  const saved = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const remember = (v) => { try { localStorage.setItem(KEY, v); } catch (e) { /* the level just is not remembered */ } };
  const STATE_ICON = { locked: 'lock', available: 'play', inprogress: 'pause', done: 'check', review: 'refresh' };

  function pickLevel() {
    const b = P.build();
    if (levelId && b.levels.some((l) => l.id === levelId)) return levelId;
    const nx = P.next();
    return (nx && nx.levelId) || saved() || 'A1';
  }

  function nodeHtml(lesson) {
    const st = P.status(lesson);
    const label = t('path.nodeAria', { unit: P.unitName(lesson.unit), n: lesson.n, state: t('path.st.' + st) });
    const r = P.rec(lesson.id);
    return '<li class="pnode-wrap pos-' + ((lesson.n - 1) % 4) + '"><button type="button" class="pnode pnode-' + st + '" data-lesson="' + lesson.id + '" aria-label="' + esc(label) + '" title="' + esc(label) + '">' +
      '<span class="pnode-ico">' + icon(STATE_ICON[st]) + '</span></button><span class="pnode-n">' + lesson.n + (r && r.best ? '<small>' + r.best + '%</small>' : '') + '</span></li>';
  }

  function unitHtml(unit) {
    const us = P.unitStats(unit);
    return '<section class="card punit" id="unit-' + esc(unit.levelId + '-' + unit.id) + '"><header class="punit-head"><span class="punit-emoji" aria-hidden="true">' + unit.emoji + '</span><div class="punit-title"><h3>' + esc(P.unitName(unit)) + '</h3><p class="muted small">' + esc(t('path.unitProgress', { d: us.done, t: us.total })) + '</p></div>' +
      '<div class="bar punit-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + us.pct + '"><span style="width:' + us.pct + '%"></span></div></header>' +
      '<ol class="ppath">' + unit.lessons.map(nodeHtml).join('') + '</ol></section>';
  }

  function draw() {
    const b = P.build();
    levelId = pickLevel();
    const lv = b.levels.find((l) => l.id === levelId);
    const tot = P.totals();
    const paused = store.state.lesson && store.state.lesson.pathLesson && b.lessonsById[store.state.lesson.pathLesson];
    const nx = P.next();
    root.innerHTML =
      '<header class="page-head"><div><h1>' + esc(t('path.title')) + '</h1><p class="muted">' + esc(t('path.sub')) + '</p></div>' +
      (nx ? '<button class="btn btn-primary btn-lg" data-action="path-go">' + icon('play') + esc(t(paused ? 'path.resume' : 'path.continueBtn')) + '</button>' : '') + '</header>' +
      (store.state.settings.freePath ? '<p class="notice">' + icon('check') + '<span>' + esc(t('path.free')) + '</span></p>' : '') +
      '<nav class="plevels" aria-label="' + esc(t('path.levelOf')) + '">' + b.levels.map((l) => {
        const st = P.levelStats(l), open = P.levelOpen(l);
        return '<button type="button" class="plevel' + (l.id === levelId ? ' active' : '') + (open ? '' : ' closed') + '" data-level="' + l.id + '" aria-pressed="' + (l.id === levelId) + '"><span class="plevel-emoji" aria-hidden="true">' + l.def.emoji + '</span><b>' + esc(l.def.short) + '</b><span class="plevel-bar"><span style="width:' + st.pct + '%"></span></span>' + (open ? '' : '<span class="plevel-lock">' + icon('lock') + '</span>') + '</button>';
      }).join('') + '</nav>' +
      '<section class="card plevel-card"><div><h2>' + esc(lv.def.emoji + ' ' + lv.def.name) + '</h2><p class="muted">' + esc(lv.def.sub) + ' · ' + esc(t('path.lessonsDone', { d: P.levelStats(lv).done, t: P.levelStats(lv).total })) + '</p>' +
      (P.levelOpen(lv) ? '' : '<p class="small path-lockmsg">' + icon('lock') + ' ' + esc(t('path.levelOpenHint')) + '</p>') + '</div>' +
      '<ul class="plegend" aria-label="' + esc(t('path.legend')) + '">' + ['locked', 'available', 'inprogress', 'done', 'review'].map((s) => '<li><span class="pnode-dot pnode-' + s + '"></span>' + esc(t('path.st.' + s)) + '</li>').join('') + '</ul>' +
      '<p class="hint">' + esc(t('path.howItWorks')) + '</p></section>' +
      (lv.units.length ? lv.units.map(unitHtml).join('') : '<section class="card"><p class="muted">' + esc(t('path.noContent')) + '</p></section>') +
      '<p class="muted small ptotal">' + esc(t('path.lessonsDone', { d: tot.done, t: tot.lessons })) + '</p>';
    // bring the next lesson into view when the map opens
    const target = nx && nx.levelId === levelId ? root.querySelector('[data-lesson="' + nx.id + '"]') : null;
    if (target && !draw.scrolled) { draw.scrolled = true; setTimeout(() => target.scrollIntoView({ block: 'center' }), 60); }
  }

  async function openLesson(id) {
    const lesson = P.build().lessonsById[id];
    if (!lesson) return;
    const st = P.status(lesson);
    if (st === 'locked') { VL.ui.toast(t(P.lockReason(lesson)), 'info', 2800); return; }
    const r = P.rec(id);
    const body = document.createElement('div');
    body.innerHTML = '<p class="muted small">' + esc(P.lessonTitle(lesson)) + ' · ' + esc(t('path.st.' + st)) + (r && r.best ? ' · ' + esc(t('path.best', { p: r.best })) : '') + '</p>' +
      '<h3 class="card-title">' + esc(t('path.words')) + '</h3><ul class="word-list">' + lesson.rows.map((row) => { const e = P.entry(row); return '<li><div class="wl-main"><span class="wl-en">' + esc(e.en) + VL.speech.button(e.en) + '</span><span class="wl-uz">' + esc(e.uz) + '</span></div><span class="chip">' + esc(e.level) + '</span></li>'; }).join('') + '</ul>' +
      (st === 'review' ? '<p class="notice warn">' + icon('alert') + '<span>' + esc(t('path.needsReviewNote')) + '</span></p>' : '');
    const label = st === 'inprogress' ? t('path.resume') : st === 'done' || st === 'review' ? t('path.practiseAgain') : t('path.start');
    const v = await VL.ui.modal({ title: lesson.unit.emoji + ' ' + t('path.lessonN', { n: lesson.n }), body, buttons: [{ label: t('btn.cancel'), value: 'cancel' }, { label, value: 'go', kind: 'primary' }] });
    if (v === 'go') await P.start(root, id, { onExit: draw }, { restart: st === 'done' || st === 'review' });
  }

  async function onClick(e) {
    if (VL.player.active()) return;
    const lv = e.target.closest('[data-level]');
    if (lv) { levelId = lv.dataset.level; remember(levelId); draw.scrolled = false; draw(); return; }
    const node = e.target.closest('[data-lesson]');
    if (node) { await openLesson(node.dataset.lesson); return; }
    if (e.target.closest('[data-action="path-go"]')) {
      const nx = P.next();
      if (nx) await P.start(root, nx.id, { onExit: draw });
    }
  }

  function mount(el) {
    root = el; levelId = null; draw.scrolled = false;
    draw();
    root.addEventListener('click', onClick);
    off = store.onChange(() => { if (!VL.player.active()) draw(); });
  }
  function unmount() {
    if (off) off();
    if (root) root.removeEventListener('click', onClick);
    VL.player.detach();
  }
  return { mount, unmount };
})();
