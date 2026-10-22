VL.views.dashboard = (function () {
  const { esc, pct, timeAgo } = VL.util;
  const { icon } = VL.ui;
  const t = VL.t, n = VL.n;
  let root, off;

  function activity() {
    const s = VL.store.state;
    const items = [];
    s.sessions.slice(-8).forEach((x) => items.push({
      at: x.date, icon: 'target',
      text: t('dash.session', { c: x.correct, t: x.total, p: pct(x.correct, x.total) }),
      sub: VL.ui.sessionLabel(x),
    }));
    s.words.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 4).forEach((w) => {
      const c = VL.store.collection(w.collectionId);
      items.push({ at: w.createdAt, icon: 'plus', text: t('dash.added', { en: w.en, uz: w.uz }), sub: c ? c.name : '' });
    });
    return items.sort((a, b) => b.at - a.at).slice(0, 8);
  }

  function stat(label, value, sub, tone) {
    return '<div class="card stat ' + (tone ? 'stat-' + tone : '') + '"><div class="stat-label">' + esc(label) + '</div><div class="stat-value">' + value + '</div><div class="stat-sub">' + sub + '</div></div>';
  }

  function draw() {
    const st = VL.store, s = st.state;
    const sum = st.summarize(s.words);
    if (!s.words.length) {
      root.innerHTML =
        '<header class="page-head"><div><h1>' + esc(t('dash.welcome')) + '</h1><p class="muted">' + esc(t('dash.welcomeSub')) + '</p></div></header>' +
        VL.ui.empty(t('dash.emptyTitle'), t('dash.emptyText'),
          '<div class="btn-row center"><a class="btn btn-primary" href="#/vocabulary?add=1">' + icon('plus') + esc(t('btn.addWord')) + '</a>' +
          '<button class="btn" data-action="sample">' + icon('download') + esc(t('btn.loadSample')) + '</button>' +
          '<button class="btn" data-action="import">' + icon('upload') + esc(t('btn.importFile')) + '</button></div>');
      return;
    }
    const diff = sum.difficult;
    const cols = s.collections.map((c) => ({ c, sum: st.summarize(st.wordsIn(c.id)) })).filter((x) => x.sum.total);
    const acts = activity();
    root.innerHTML =
      '<header class="page-head"><div><h1>' + esc(t('nav.dashboard')) + '</h1><p class="muted">' + esc(t('dash.sub')) + '</p></div>' +
      '<div class="btn-row"><a class="btn" href="#/vocabulary?add=1">' + icon('plus') + esc(t('btn.addWord')) + '</a><a class="btn btn-primary" href="#/practice">' + icon('target') + esc(t('btn.startPractice')) + '</a></div></header>' +
      '<section class="stat-grid" aria-label="' + esc(t('stat.aria')) + '">' +
      stat(t('stat.total'), sum.total, esc(n('n.collection', s.collections.length))) +
      stat(t('stat.mastered'), sum.mastered, esc(t('stat.pctOfWords', { p: sum.progress })), 'success') +
      stat(t('stat.accuracy'), sum.attempts ? sum.accuracy + '%' : '—', esc(sum.attempts ? n('n.answer', sum.attempts) : t('stat.noAnswers'))) +
      stat(t('stat.difficult'), diff, diff ? '<a href="#/difficult">' + esc(t('stat.reviewThem')) + '</a>' : esc(t('stat.nothingReview')), diff ? 'danger' : '') +
      '</section>' +
      '<div class="two-col">' +
      '<section class="card"><h2 class="card-title">' + esc(t('dash.recent')) + '</h2>' +
      (acts.length ? '<ul class="activity">' + acts.map((a) => '<li><span class="act-icon">' + icon(a.icon) + '</span><div><div>' + esc(a.text) + '</div><div class="muted small">' + esc(a.sub) + ' · ' + esc(timeAgo(a.at)) + '</div></div></li>').join('') + '</ul>' : '<p class="muted">' + esc(t('dash.nothing')) + '</p>') +
      '</section>' +
      '<section class="card"><h2 class="card-title">' + esc(t('dash.collections')) + '</h2><ul class="mini-progress">' +
      cols.map((x) => '<li><div class="mini-head"><a href="#/vocabulary?collection=' + esc(x.c.id) + '">' + esc(x.c.name) + '</a><span class="muted small">' + esc(t('dash.masteredOf', { m: x.sum.mastered, t: x.sum.total })) + '</span></div>' +
        '<div class="bar" role="img" aria-label="' + esc(t('dash.masteredAria', { p: x.sum.progress })) + '"><span style="width:' + x.sum.progress + '%"></span></div></li>').join('') +
      '</ul></section></div>';
  }

  function onClick(e) {
    const a = e.target.closest('[data-action]');
    if (!a) return;
    if (a.dataset.action === 'sample') VL.io.loadSample();
    if (a.dataset.action === 'import') VL.io.openImportDialog();
  }

  return {
    mount(el) { root = el; draw(); root.addEventListener('click', onClick); off = VL.store.onChange(draw); },
    unmount() { if (off) off(); if (root) root.removeEventListener('click', onClick); },
  };
})();
