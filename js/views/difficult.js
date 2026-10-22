VL.views.difficult = (function () {
  const { esc, pct, timeAgo, plural } = VL.util;
  const { icon } = VL.ui;
  let root, off;

  function draw() {
    const st = VL.store;
    const list = st.difficultWords().sort((a, b) => (b.lastWrongAt || 0) - (a.lastWrongAt || 0));
    const head = '<header class="page-head"><div><h1>Difficult Words</h1><p class="muted">Words you got wrong and have not yet answered correctly ' + st.MASTERED_STREAK + ' times in a row.</p></div>' +
      (list.length ? '<div class="btn-row"><a class="btn btn-primary" href="#/practice?scope=difficult">' + icon('target') + 'Practise these ' + list.length + '</a></div>' : '') + '</header>';
    if (!list.length) {
      root.innerHTML = head + VL.ui.empty(st.state.sessions.length || st.state.words.some((w) => w.wrong) ? 'Nothing to review' : 'No mistakes yet',
        st.state.words.length ? 'Words you answer incorrectly in a quiz will show up here for focused review.' : 'Add some words and take a quiz first.',
        '<div class="btn-row center"><a class="btn btn-primary" href="#/practice">' + icon('target') + 'Go to Practice</a></div>');
      return;
    }
    root.innerHTML = head +
      '<section class="card"><div class="table-wrap"><table class="words"><thead><tr><th scope="col">English</th><th scope="col">Uzbek</th><th scope="col" class="hide-sm">Mistakes</th><th scope="col" class="hide-sm">Accuracy</th><th scope="col" class="hide-sm">Last missed</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
      list.map((w) => '<tr data-id="' + esc(w.id) + '"><td class="strong">' + esc(w.en) + '</td><td>' + esc(w.uz) + '</td><td class="hide-sm">' + w.wrong + '</td><td class="hide-sm">' + pct(w.correct, w.correct + w.wrong) + '%</td>' +
        '<td class="hide-sm muted">' + (w.lastWrongAt ? timeAgo(w.lastWrongAt) : '—') + '</td>' +
        '<td class="row-actions"><button class="btn btn-sm" data-action="learned" aria-label="Mark ' + esc(w.en) + ' as learned">' + icon('check') + 'Mark learned</button></td></tr>').join('') +
      '</tbody></table></div></section>';
  }

  async function onClick(e) {
    const b = e.target.closest('[data-action="learned"]');
    if (!b) return;
    await VL.store.markLearned([b.closest('tr').dataset.id]);
    VL.ui.toast('Moved out of the difficult list.', 'success', 1800);
  }

  return {
    mount(el) { root = el; draw(); root.addEventListener('click', onClick); off = VL.store.onChange(draw); },
    unmount() { if (off) off(); if (root) root.removeEventListener('click', onClick); },
  };
})();
