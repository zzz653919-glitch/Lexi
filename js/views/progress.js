VL.views.progress = (function () {
  const { esc, pct, dayKey, plural } = VL.util;
  let root, off;

  function lastDays(n) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      out.push({ key: dayKey(d.getTime()), label: d.toLocaleDateString(undefined, { weekday: 'short' }), count: 0 });
    }
    return out;
  }

  function draw() {
    const st = VL.store, s = st.state;
    if (!s.words.length) {
      root.innerHTML = '<header class="page-head"><div><h1>Progress</h1></div></header>' + VL.ui.empty('No data yet', 'Add words and take a quiz to see your learning statistics.', '<div class="btn-row center"><a class="btn btn-primary" href="#/vocabulary?add=1">Add words</a></div>');
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
      '<header class="page-head"><div><h1>Progress</h1><p class="muted">How well you know your vocabulary.</p></div></header>' +
      '<section class="stat-grid">' +
      stat('Overall accuracy', sum.attempts ? sum.accuracy + '%' : '—', plural(sum.correct, 'correct answer') + ' of ' + sum.attempts) +
      stat('Correct / incorrect', '<span class="ok-text">' + sum.correct + '</span> / <span class="bad-text">' + sum.wrong + '</span>', 'All time') +
      stat('Sessions', sessions.length, plural(answered, 'question') + ' answered') +
      stat('Mastered', sum.mastered + ' / ' + sum.total, sum.progress + '% of all words') +
      '</section>' +
      '<div class="two-col">' +
      '<section class="card"><h2 class="card-title">Questions answered · last 7 days</h2><div class="chart" role="img" aria-label="Questions answered per day">' +
      days.map((d) => '<div class="col"><div class="col-bar"><span style="height:' + Math.max(d.count ? 6 : 0, pct(d.count, maxDay)) + '%" title="' + d.count + '"></span></div><div class="col-val">' + d.count + '</div><div class="col-label">' + d.label + '</div></div>').join('') + '</div></section>' +
      '<section class="card"><h2 class="card-title">Accuracy · recent sessions</h2>' +
      (recent.length ? '<div class="chart" role="img" aria-label="Accuracy of recent sessions">' + recent.map((x) => {
        const p = pct(x.correct, x.total);
        return '<div class="col"><div class="col-bar"><span class="' + (p >= 80 ? 'good' : p >= 50 ? 'mid' : 'low') + '" style="height:' + Math.max(6, p) + '%" title="' + esc(x.label || '') + '"></span></div><div class="col-val">' + p + '%</div><div class="col-label">' + new Date(x.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + '</div></div>';
      }).join('') + '</div>' : '<p class="muted">Finish a quiz to see your trend.</p>') + '</section></div>' +
      '<section class="card"><h2 class="card-title">By collection</h2><div class="table-wrap"><table class="words"><thead><tr><th scope="col">Collection</th><th scope="col">Words</th><th scope="col" class="grow">Learning progress</th><th scope="col" class="hide-sm">Accuracy</th></tr></thead><tbody>' +
      cols.map((x) => {
        const t = x.sum.total;
        return '<tr><td class="strong">' + esc(x.c.name) + '</td><td>' + t + '</td><td><div class="stack" role="img" aria-label="' + x.sum.mastered + ' mastered, ' + x.sum.learning + ' learning, ' + x.sum.difficult + ' difficult, ' + x.sum.new + ' new">' +
          '<span class="seg seg-mastered" style="width:' + pct(x.sum.mastered, t) + '%"></span><span class="seg seg-learning" style="width:' + pct(x.sum.learning, t) + '%"></span><span class="seg seg-difficult" style="width:' + pct(x.sum.difficult, t) + '%"></span></div>' +
          '<div class="small muted">' + x.sum.progress + '% mastered</div></td><td class="hide-sm">' + (x.sum.attempts ? x.sum.accuracy + '%' : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="legend"><span><i class="dot seg-mastered"></i>Mastered</span><span><i class="dot seg-learning"></i>Learning</span><span><i class="dot seg-difficult"></i>Difficult</span><span><i class="dot seg-new"></i>New</span></div></section>' +
      '<section class="card"><h2 class="card-title">Session history</h2>' +
      (sessions.length ? '<div class="table-wrap"><table class="words"><thead><tr><th scope="col">Date</th><th scope="col">Quiz</th><th scope="col">Score</th><th scope="col">Accuracy</th></tr></thead><tbody>' +
        sessions.slice(-15).reverse().map((x) => '<tr><td>' + new Date(x.date).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + '</td><td>' + esc(x.label || '') + '</td><td>' + x.correct + ' / ' + x.total + '</td><td>' + pct(x.correct, x.total) + '%</td></tr>').join('') + '</tbody></table></div>' : '<p class="muted">No finished sessions yet.</p>') + '</section>';
  }

  function stat(label, value, sub) {
    return '<div class="card stat"><div class="stat-label">' + label + '</div><div class="stat-value">' + value + '</div><div class="stat-sub">' + sub + '</div></div>';
  }

  return {
    mount(el) { root = el; draw(); off = VL.store.onChange(draw); },
    unmount() { if (off) off(); },
  };
})();
