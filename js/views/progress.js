VL.views.progress = (function () {
  const { esc, pct, dayKey } = VL.util;
  const t = VL.t, n = VL.n;
  let root, off;

  function lastDays(n) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      out.push({ key: dayKey(d.getTime()), label: d.toLocaleDateString(VL.i18n.locale, { weekday: 'short' }), count: 0 });
    }
    return out;
  }

  function draw() {
    const st = VL.store, s = st.state;
    if (!s.words.length) {
      root.innerHTML = '<header class="page-head"><div><h1>' + esc(t('nav.progress')) + '</h1></div></header>' + VL.ui.empty(t('prog.emptyTitle'), t('prog.emptyText'), '<div class="btn-row center"><a class="btn btn-primary" href="#/vocabulary?add=1">' + esc(t('btn.addWords')) + '</a></div>');
      return;
    }
    const sum = st.summarize(s.words);
    const sessions = s.sessions;
    const answered = sessions.reduce((a, x) => a + x.total, 0);
    const days = lastDays(7);
    sessions.forEach((x) => { const d = days.find((dd) => dd.key === dayKey(x.date)); if (d) d.count += x.total; });
    const maxDay = Math.max(1, ...days.map((d) => d.count));
    const recent = sessions.slice(-12);

    const cols = s.collections.map((c) => ({ c, sum: st.summarize(st.wordsIn(c.id)) })).filter((x) => x.sum.total);

    root.innerHTML =
      '<header class="page-head"><div><h1>' + esc(t('nav.progress')) + '</h1><p class="muted">' + esc(t('prog.sub')) + '</p></div></header>' +
      '<section class="stat-grid">' +
      stat(t('stat.overall'), sum.attempts ? sum.accuracy + '%' : '—', esc(t('prog.correctOf', { c: sum.correct, a: sum.attempts }))) +
      stat(t('stat.cw'), '<span class="ok-text">' + sum.correct + '</span> / <span class="bad-text">' + sum.wrong + '</span>', esc(t('stat.allTime'))) +
      stat(t('stat.sessions'), sessions.length, esc(t('prog.answeredQ', { q: n('n.question', answered) }))) +
      stat(t('stat.mastered'), sum.mastered + ' / ' + sum.total, esc(t('stat.pctOfWords', { p: sum.progress }))) +
      '</section>' +
      '<div class="two-col">' +
      '<section class="card"><h2 class="card-title">' + esc(t('chart.days')) + '</h2><div class="chart" role="img" aria-label="' + esc(t('chart.daysAria')) + '">' +
      days.map((d) => '<div class="col"><div class="col-bar"><span style="height:' + Math.max(d.count ? 6 : 0, pct(d.count, maxDay)) + '%" title="' + d.count + '"></span></div><div class="col-val">' + d.count + '</div><div class="col-label">' + esc(d.label) + '</div></div>').join('') + '</div></section>' +
      '<section class="card"><h2 class="card-title">' + esc(t('chart.sessions')) + '</h2>' +
      (recent.length ? '<div class="chart" role="img" aria-label="' + esc(t('chart.sessionsAria')) + '">' + recent.map((x) => {
        const p = pct(x.correct, x.total);
        return '<div class="col"><div class="col-bar"><span class="' + (p >= 80 ? 'good' : p >= 50 ? 'mid' : 'low') + '" style="height:' + Math.max(6, p) + '%" title="' + esc(VL.ui.sessionLabel(x)) + '"></span></div><div class="col-val">' + p + '%</div><div class="col-label">' + new Date(x.date).toLocaleDateString(VL.i18n.locale, { day: 'numeric', month: 'short' }) + '</div></div>';
      }).join('') + '</div>' : '<p class="muted">' + esc(t('prog.finishTrend')) + '</p>') + '</section></div>' +
      '<section class="card"><h2 class="card-title">' + esc(t('prog.byCol')) + '</h2><div class="table-wrap"><table class="words"><thead><tr><th scope="col">' + esc(t('th.collection')) + '</th><th scope="col">' + esc(t('th.words')) + '</th><th scope="col" class="grow">' + esc(t('th.progress')) + '</th><th scope="col" class="hide-sm">' + esc(t('th.accuracy')) + '</th></tr></thead><tbody>' +
      cols.map((x) => {
        const tot = x.sum.total;
        return '<tr><td class="strong">' + esc(x.c.name) + '</td><td>' + tot + '</td><td><div class="stack" role="img" aria-label="' + esc(t('prog.stackAria', { m: x.sum.mastered, l: x.sum.learning, d: x.sum.difficult, n: x.sum.new })) + '">' +
          '<span class="seg seg-mastered" style="width:' + pct(x.sum.mastered, tot) + '%"></span><span class="seg seg-learning" style="width:' + pct(x.sum.learning, tot) + '%"></span><span class="seg seg-difficult" style="width:' + pct(x.sum.difficult, tot) + '%"></span></div>' +
          '<div class="small muted">' + esc(t('prog.pctMastered', { p: x.sum.progress })) + '</div></td><td class="hide-sm">' + (x.sum.attempts ? x.sum.accuracy + '%' : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="legend"><span><i class="dot seg-mastered"></i>' + esc(t('st.mastered')) + '</span><span><i class="dot seg-learning"></i>' + esc(t('st.learning')) + '</span><span><i class="dot seg-difficult"></i>' + esc(t('st.difficult')) + '</span><span><i class="dot seg-new"></i>' + esc(t('st.new')) + '</span></div></section>' +
      '<section class="card"><h2 class="card-title">' + esc(t('prog.history')) + '</h2>' +
      (sessions.length ? '<div class="table-wrap"><table class="words"><thead><tr><th scope="col">' + esc(t('th.date')) + '</th><th scope="col">' + esc(t('th.quiz')) + '</th><th scope="col">' + esc(t('th.score')) + '</th><th scope="col">' + esc(t('th.accuracy')) + '</th></tr></thead><tbody>' +
        sessions.slice(-15).reverse().map((x) => '<tr><td>' + esc(new Date(x.date).toLocaleString(VL.i18n.locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) + '</td><td>' + esc(VL.ui.sessionLabel(x)) + '</td><td>' + x.correct + ' / ' + x.total + '</td><td>' + pct(x.correct, x.total) + '%</td></tr>').join('') + '</tbody></table></div>' : '<p class="muted">' + esc(t('prog.noSessions')) + '</p>') + '</section>';
  }

  function stat(label, value, sub) {
    return '<div class="card stat"><div class="stat-label">' + esc(label) + '</div><div class="stat-value">' + value + '</div><div class="stat-sub">' + sub + '</div></div>';
  }

  return {
    mount(el) { root = el; draw(); off = VL.store.onChange(draw); },
    unmount() { if (off) off(); },
  };
})();
