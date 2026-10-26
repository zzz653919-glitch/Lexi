/* Home page: today's goal, streak, XP, learned words, the last session, the week, and one big "continue" button. */
VL.views.dashboard = (function () {
  const { esc, pct, timeAgo, dayKey } = VL.util;
  const { icon } = VL.ui;
  const t = VL.t, n = VL.n;
  const store = VL.store, E = VL.learn;
  let root, off;

  function ring(value, total, size, label) {
    const R = 46, C = 2 * Math.PI * R, p = Math.min(1, total ? value / total : 0);
    return '<span class="goal-ring" style="width:' + size + 'px;height:' + size + 'px" role="img" aria-label="' + esc(label) + '"><svg viewBox="0 0 108 108"><circle class="ring-bg" cx="54" cy="54" r="' + R + '"/><circle class="ring-fg" cx="54" cy="54" r="' + R + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - p)).toFixed(1) + '"/></svg><b>' + Math.round(p * 100) + '%</b></span>';
  }

  const todayXp = () => (store.state.days.find((d) => d.date === dayKey(Date.now())) || { xp: 0 }).xp;

  function week() {
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const ts = Date.now() - i * 86400000;
      const rec = store.state.days.find((d) => d.date === dayKey(ts));
      out.push({ ts, xp: rec ? rec.xp : 0, met: !!(rec && rec.goalMet), today: i === 0 });
    }
    return out;
  }

  // what the big button does: the paused lesson, else the next lesson of the path, else a guided lesson
  function nextStep() {
    const paused = store.state.lesson;
    if (paused) {
      const what = paused.pathTitle || (paused.custom && paused.custom.name) || t('ex.' + (paused.type || 'mixed'));
      return { kind: 'resume', text: t('home.resumePaused', { what }) };
    }
    const lesson = VL.path.next();
    if (lesson) return { kind: 'path', lesson, text: t('home.continueWhat', { what: VL.path.lessonTitle(lesson) }) };
    return { kind: 'path-map', text: t('path.allDone') };
  }

  function lastSessionHtml() {
    const last = store.state.sessions[store.state.sessions.length - 1];
    if (!last) return '<p class="muted">' + esc(t('home.lastNone')) + '</p>';
    const p = pct(last.correct, last.total);
    return '<div class="last-row"><span class="last-pct ' + (p >= 80 ? 'good' : p >= 50 ? 'mid' : 'low') + '">' + p + '%</span><div><b>' + esc(last.customName || VL.ui.sessionLabel(last)) + '</b><div class="muted small">' + esc(t('home.lastResult', { c: last.correct, t: last.total, p })) + ' · ' + esc(timeAgo(last.date)) + '</div></div></div>';
  }

  function weekHtml() {
    const w = week();
    const max = Math.max(20, ...w.map((d) => d.xp));
    return '<div class="week-bars" role="img" aria-label="' + esc(t('home.weekXp', { n: w.reduce((a, d) => a + d.xp, 0) })) + '">' + w.map((d) =>
      '<div class="week-col' + (d.today ? ' is-today' : '') + (d.met ? ' met' : '') + '"><span class="week-xp">' + (d.xp || '') + '</span><div class="week-bar"><span style="height:' + Math.max(d.xp ? 8 : 3, Math.round(d.xp / max * 100)) + '%"></span></div><span class="week-day">' + esc(new Date(d.ts).toLocaleDateString(VL.i18n.locale, { weekday: 'short' })) + '</span></div>').join('') + '</div>';
  }

  function draw() {
    const s = store.state;
    const st = E.stats(s);
    const goal = s.settings.dailyGoal, today = todayXp();
    const step = nextStep();
    const name = (s.settings.profileName || '').trim();
    const mistakes = store.difficultWords().length;
    const totals = VL.path.totals();
    const goalLeft = Math.max(0, goal - today);
    const achievements = E.achievements(s).filter((a) => !a.unlocked).sort((a, b) => b.value / b.target - a.value / a.target).slice(0, 3);
    root.innerHTML =
      '<section class="card home-hero"><div class="home-hero-text"><h1>' + esc(name ? t('home.helloName', { name }) : t('home.hello')) + '</h1>' +
      '<p class="muted">' + esc(goalLeft ? t('home.goalLeft', { n: goalLeft }) : t('home.goalDone')) + '</p>' +
      '<p class="home-next">' + icon('flag') + '<span>' + esc(step.text) + '</span></p>' +
      '<div class="btn-row"><button class="btn btn-primary btn-xl" data-action="continue">' + icon('play') + esc(t(s.sessions.length || Object.keys(s.path.lessons).length ? 'home.continue' : 'home.start')) + '</button>' +
      '<button class="btn" data-action="new-session">' + icon('plus') + esc(t('home.newSession')) + '</button>' +
      '<a class="btn" href="#/topics">' + icon('list') + esc(t('home.topics')) + '</a>' +
      '<a class="btn" href="#/difficult">' + icon('refresh') + esc(mistakes ? t('home.mistakesN', { n: mistakes }) : t('home.mistakes')) + '</a></div></div>' +
      '<img class="home-hero-art" src="img/hero.svg" alt="" width="240" height="200"></section>' +
      '<div class="home-grid"><div class="home-main">' +
      '<section class="home-stats stat-grid" aria-label="' + esc(t('stat.aria')) + '">' +
      '<div class="card hstat hstat-flame"><span class="hstat-ico">' + icon('flame') + '</span><div><b>' + esc(n('n.day', st.streak.current)) + '</b><span>' + esc(st.streak.current ? t('home.streakDays', { n: st.streak.current }) : t('home.streakNone')) + '</span></div></div>' +
      '<div class="card hstat hstat-xp"><span class="hstat-ico">' + icon('star') + '</span><div><b>' + st.xp + ' XP</b><span>' + esc(t('home.level', { n: st.level.level })) + ' · ' + esc(t('home.toNext', { n: st.level.to - st.xp })) + '</span></div></div>' +
      '<div class="card hstat hstat-words"><span class="hstat-ico">' + icon('book') + '</span><div><b>' + st.learned + '</b><span>' + esc(t('home.learned')) + (s.words.length ? ' · ' + esc(t('home.learnedOf', { n: s.words.length })) : '') + '</span></div></div>' +
      '<div class="card hstat hstat-all"><span class="hstat-ico">' + icon('chart') + '</span><div><b>' + totals.pct + '%</b><span>' + esc(t('home.overall')) + ' · ' + esc(t('home.overallSub', { d: totals.done, t: totals.lessons })) + '</span></div></div></section>' +
      '<section class="card"><h2 class="card-title">' + esc(t('home.last')) + '</h2>' + lastSessionHtml() + '</section>' +
      '<section class="card"><div class="week-head"><h2 class="card-title">' + esc(t('home.week')) + '</h2><span class="muted small">' + esc(t('home.weekXp', { n: week().reduce((a, d) => a + d.xp, 0) })) + '</span></div>' + weekHtml() + '</section>' +
      (s.words.length ? '' : '<section class="card"><p class="muted">' + esc(t('home.empty')) + '</p><div class="btn-row" style="margin-top:12px"><a class="btn" href="#/vocabulary?add=1">' + icon('plus') + esc(t('home.addWords')) + '</a><button class="btn" data-action="sample">' + icon('download') + esc(t('btn.loadSample')) + '</button><button class="btn" data-action="import">' + icon('upload') + esc(t('btn.importFile')) + '</button></div></section>') +
      '</div><aside class="home-side">' +
      '<section class="card goal-card"><h2 class="card-title">' + esc(t('home.goalCard')) + '</h2><div class="goal-body">' + ring(today, goal, 112, t('res.goal', { a: Math.min(today, goal), b: goal })) + '<div><b class="goal-xp">' + today + ' / ' + goal + ' XP</b><p class="muted small">' + esc(goalLeft ? t('home.goalLeft', { n: goalLeft }) : t('home.goalDone')) + '</p></div></div></section>' +
      (achievements.length ? '<section class="card"><h2 class="card-title">' + esc(t('tab.achievements')) + '</h2><ul class="ach-mini">' + achievements.map((a) => '<li><span class="ach-ico">' + icon(a.icon) + '</span><div><b>' + esc(t('ach.' + a.id + '.t')) + '</b><div class="bar"><span style="width:' + pct(a.value, a.target) + '%"></span></div><span class="muted small">' + a.value + ' / ' + a.target + '</span></div></li>').join('') + '</ul></section>' : '') +
      '</aside></div>';
  }

  async function onClick(e) {
    if (VL.player.active()) return;
    const a = e.target.closest('[data-action]');
    if (!a) return;
    const hooks = { onExit: draw };
    if (a.dataset.action === 'sample') { VL.io.loadSample(); return; }
    if (a.dataset.action === 'import') { VL.io.openImportDialog(); return; }
    if (a.dataset.action === 'continue') {
      const step = nextStep();
      if (step.kind === 'resume') VL.player.resume(root, hooks);
      else if (step.kind === 'path') await VL.path.start(root, step.lesson.id, hooks);
      else location.hash = '#/path';
    } else if (a.dataset.action === 'new-session') {
      await VL.custom.create(root, hooks);
      if (!VL.player.active()) draw();
    }
  }

  return {
    mount(el) { root = el; draw(); root.addEventListener('click', onClick); off = store.onChange(() => { if (!VL.player.active()) draw(); }); },
    unmount() { if (off) off(); if (root) root.removeEventListener('click', onClick); VL.player.detach(); },
  };
})();
