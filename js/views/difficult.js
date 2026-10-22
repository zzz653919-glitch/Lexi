VL.views.difficult = (function () {
  const { esc, pct, timeAgo } = VL.util;
  const t = VL.t;
  const { icon } = VL.ui;
  let root, off;

  function draw() {
    const st = VL.store;
    const list = st.difficultWords().sort((a, b) => (b.lastWrongAt || 0) - (a.lastWrongAt || 0));
    const head = '<header class="page-head"><div><h1>' + esc(t('nav.difficult')) + '</h1><p class="muted">' + esc(t('diff.sub', { n: st.MASTERED_STREAK })) + '</p></div>' +
      (list.length ? '<div class="btn-row"><a class="btn btn-primary" href="#/practice?scope=difficult">' + icon('target') + esc(t('btn.practiseThese', { n: list.length })) + '</a></div>' : '') + '</header>';
    if (!list.length) {
      root.innerHTML = head + VL.ui.empty(t(st.state.sessions.length || st.state.words.some((w) => w.wrong) ? 'diff.emptyTitle2' : 'diff.emptyTitle1'),
        t(st.state.words.length ? 'diff.emptyText2' : 'diff.emptyText1'),
        '<div class="btn-row center"><a class="btn btn-primary" href="#/practice">' + icon('target') + esc(t('btn.goPractice')) + '</a></div>');
      return;
    }
    root.innerHTML = head +
      '<section class="card"><div class="table-wrap"><table class="words"><thead><tr><th scope="col">' + esc(t('th.english')) + '</th><th scope="col">' + esc(t('th.uzbek')) + '</th><th scope="col" class="hide-sm">' + esc(t('th.mistakes')) + '</th><th scope="col" class="hide-sm">' + esc(t('th.accuracy')) + '</th><th scope="col" class="hide-sm">' + esc(t('th.lastMissed')) + '</th><th scope="col"><span class="sr-only">' + esc(t('th.actions')) + '</span></th></tr></thead><tbody>' +
      list.map((w) => '<tr data-id="' + esc(w.id) + '"><td class="strong">' + esc(w.en) + '</td><td>' + esc(w.uz) + '</td><td class="hide-sm">' + w.wrong + '</td><td class="hide-sm">' + pct(w.correct, w.correct + w.wrong) + '%</td>' +
        '<td class="hide-sm muted">' + (w.lastWrongAt ? esc(timeAgo(w.lastWrongAt)) : '—') + '</td>' +
        '<td class="row-actions"><button class="btn btn-sm" data-action="learned" aria-label="' + esc(t('diff.markAria', { w: w.en })) + '">' + icon('check') + esc(t('btn.markLearned')) + '</button></td></tr>').join('') +
      '</tbody></table></div></section>';
  }

  async function onClick(e) {
    const b = e.target.closest('[data-action="learned"]');
    if (!b) return;
    await VL.store.markLearned([b.closest('tr').dataset.id]);
    VL.ui.toast(t('diff.moved'), 'success', 1800);
  }

  return {
    mount(el) { root = el; draw(); root.addEventListener('click', onClick); off = VL.store.onChange(draw); },
    unmount() { if (off) off(); if (root) root.removeEventListener('click', onClick); },
  };
})();
