VL.views.dashboard = (function () {
  const { esc, pct, timeAgo, plural } = VL.util;
  const { icon } = VL.ui;
  let root, off;

  function activity() {
    const s = VL.store.state;
    const items = [];
    s.sessions.slice(-8).forEach((x) => items.push({
      at: x.date, icon: 'target',
      text: 'Practice · ' + x.correct + '/' + x.total + ' correct (' + pct(x.correct, x.total) + '%)',
      sub: x.label || 'Practice session',
    }));
    s.words.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 4).forEach((w) => {
      const c = VL.store.collection(w.collectionId);
      items.push({ at: w.createdAt, icon: 'plus', text: 'Added “' + w.en + '” — ' + w.uz, sub: c ? c.name : '' });
    });
    return items.sort((a, b) => b.at - a.at).slice(0, 8);
  }

  function draw() {
    const st = VL.store, s = st.state;
    const sum = st.summarize(s.words);
    if (!s.words.length) {
      root.innerHTML =
        '<header class="page-head"><div><h1>Welcome to Lexi</h1><p class="muted">Build your vocabulary and learn it by typing.</p></div></header>' +
        VL.ui.empty('Your library is empty', 'Add your first word, import a file, or load the sample vocabulary to try the app.',
          '<div class="btn-row center"><a class="btn btn-primary" href="#/vocabulary?add=1">' + icon('plus') + 'Add a word</a>' +
          '<button class="btn" data-action="sample">' + icon('download') + 'Load sample vocabulary</button>' +
          '<button class="btn" data-action="import">' + icon('upload') + 'Import file</button></div>');
      return;
    }
    const diff = sum.difficult;
    const cols = s.collections.map((c) => ({ c, sum: st.summarize(st.wordsIn(c.id)) })).filter((x) => x.sum.total);
    const acts = activity();
    root.innerHTML =
      '<header class="page-head"><div><h1>Dashboard</h1><p class="muted">Your vocabulary at a glance.</p></div>' +
      '<div class="btn-row"><a class="btn" href="#/vocabulary?add=1">' + icon('plus') + 'Add word</a><a class="btn btn-primary" href="#/practice">' + icon('target') + 'Start practice</a></div></header>' +
      '<section class="stat-grid" aria-label="Statistics">' +
      stat('Total words', sum.total, plural(s.collections.length, 'collection')) +
      stat('Mastered', sum.mastered, sum.progress + '% of your words', 'success') +
      stat('Accuracy', sum.attempts ? sum.accuracy + '%' : '—', sum.attempts ? plural(sum.attempts, 'answer') : 'No answers yet') +
      stat('Difficult', diff, diff ? '<a href="#/difficult">Review them</a>' : 'Nothing to review', diff ? 'danger' : '') +
      '</section>' +
      '<div class="two-col">' +
      '<section class="card"><h2 class="card-title">Recent activity</h2>' +
      (acts.length ? '<ul class="activity">' + acts.map((a) => '<li><span class="act-icon">' + icon(a.icon) + '</span><div><div>' + esc(a.text) + '</div><div class="muted small">' + esc(a.sub) + ' · ' + timeAgo(a.at) + '</div></div></li>').join('') + '</ul>' : '<p class="muted">Nothing yet.</p>') +
      '</section>' +
      '<section class="card"><h2 class="card-title">Collections</h2><ul class="mini-progress">' +
      cols.map((x) => '<li><div class="mini-head"><a href="#/vocabulary?collection=' + esc(x.c.id) + '">' + esc(x.c.name) + '</a><span class="muted small">' + x.sum.mastered + '/' + x.sum.total + ' mastered</span></div>' +
        '<div class="bar" role="img" aria-label="' + x.sum.progress + '% mastered"><span style="width:' + x.sum.progress + '%"></span></div></li>').join('') +
      '</ul></section></div>';
  }

  function stat(label, value, sub, tone) {
    return '<div class="card stat ' + (tone ? 'stat-' + tone : '') + '"><div class="stat-label">' + label + '</div><div class="stat-value">' + value + '</div><div class="stat-sub">' + sub + '</div></div>';
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
