VL.views.settings = (function () {
  const { esc } = VL.util;
  const { icon } = VL.ui;
  const t = VL.t;
  let root;

  const radio = (name, val, cur, label) => '<label><input type="radio" name="' + name + '" value="' + val + '"' + (cur === val ? ' checked' : '') + '><span>' + esc(label) + '</span></label>';
  const row = (title, desc, btn) => '<div class="data-row"><div><strong>' + esc(title) + '</strong><div class="muted small">' + esc(desc) + '</div></div>' + btn + '</div>';

  function draw() {
    const s = VL.store.state.settings;
    const theme = VL.theme.get();
    const lang = VL.i18n.lang;
    root.innerHTML =
      '<header class="page-head"><div><h1>' + esc(t('nav.settings')) + '</h1><p class="muted">' + esc(t(VL.db.backend === 'indexeddb' ? 'set.subIdb' : 'set.subLs')) + '</p></div></header>' +
      '<section class="card settings-group"><h2 class="card-title">' + esc(t('set.appearance')) + '</h2>' +
      '<fieldset class="field"><legend>' + esc(t('set.theme')) + '</legend><div class="segmented">' + radio('theme', 'light', theme, t('theme.optLight')) + radio('theme', 'dark', theme, t('theme.optDark')) + radio('theme', 'system', theme, t('theme.optSystem')) + '</div></fieldset>' +
      '<fieldset class="field"><legend>' + esc(t('set.language')) + '</legend><div class="segmented">' + VL.i18n.LANGS.map((l) => radio('lang', l, lang, VL.i18n.NAMES[l])).join('') + '</div></fieldset></section>' +
      '<section class="card settings-group"><h2 class="card-title">' + esc(t('set.profile')) + '</h2>' +
      '<div class="field"><label for="set-name">' + esc(t('set.name')) + '</label><input id="set-name" type="text" maxlength="30" autocomplete="nickname" placeholder="' + esc(t('set.namePh')) + '" value="' + esc(s.profileName || '') + '"></div>' +
      '<h3 class="card-title" style="margin-top:14px">' + esc(t('set.pathTitle')) + '</h3><label class="check"><input type="checkbox" id="set-freepath"' + (s.freePath ? ' checked' : '') + '><span>' + esc(t('set.freePath')) + '</span></label><p class="hint">' + esc(t('set.freePathHint')) + '</p></section>' +
      '<section class="card settings-group"><h2 class="card-title">' + esc(t('set.quiz')) + '</h2>' +
      '<fieldset class="field"><legend>' + esc(t('set.defDir')) + '</legend><div class="segmented">' + radio('direction', 'en-uz', s.direction, t('dir.en-uz')) + radio('direction', 'uz-en', s.direction, t('dir.uz-en')) + radio('direction', 'mixed', s.direction, t('dir.short.mixed')) + '</div></fieldset>' +
      '<div class="field"><label for="set-len">' + esc(t('set.defLen')) + '</label><select id="set-len">' +
      [['all', t('len.all')], ['10', t('len.n', { n: 10 })], ['20', t('len.n', { n: 20 })], ['50', t('len.n', { n: 50 })]].map((o) => '<option value="' + o[0] + '"' + (String(s.length) === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select></div>' +
      '<label class="check"><input type="checkbox" id="set-lenient"' + (s.lenient ? ' checked' : '') + '><span>' + esc(t('set.lenient')) + '</span></label>' +
      '<fieldset class="field"><legend>' + esc(t('set.typo')) + '</legend><div class="segmented">' + radio('typoMode', 'careful', s.typoMode, t('set.typoCareful')) + radio('typoMode', 'strict', s.typoMode, t('set.typoStrict')) + '</div><p class="hint">' + esc(t('set.typoHint')) + '</p></fieldset>' +
      '<label class="check"><input type="checkbox" id="set-auto"' + (s.autoAdvance ? ' checked' : '') + '><span>' + esc(t('set.auto')) + '</span></label>' +
      '<p class="hint">' + esc(t('set.caseHint')) + '</p></section>' +
      '<section class="card settings-group"><h2 class="card-title">' + esc(t('set.learn')) + '</h2>' +
      '<div class="field"><label for="set-goal">' + esc(t('set.goal')) + '</label><select id="set-goal">' + [20, 50, 100, 150, 200].map((v) => '<option value="' + v + '"' + (Number(s.dailyGoal) === v ? ' selected' : '') + '>' + v + ' XP</option>').join('') + '</select></div>' +
      (VL.speech.supported ? '<label class="check"><input type="checkbox" id="set-speak"' + (s.autoSpeak ? ' checked' : '') + '><span>' + esc(t('set.autoSpeak')) + '</span></label>' : '') + '</section>' +
      '<section class="card settings-group"><h2 class="card-title">' + esc(t('set.data')) + '</h2>' +
      '<p class="notice">' + icon('alert') + '<span>' + esc(t('set.storageNote')) + '</span></p>' +
      '<div class="data-grid">' +
      row(t('data.importT'), t('data.importD'), '<button class="btn" data-action="import">' + icon('upload') + esc(t('data.importB')) + '</button>') +
      row(t('data.exportT'), t('data.exportD'), '<button class="btn" data-action="export">' + icon('download') + esc(t('btn.exportCsv')) + '</button>') +
      row(t('data.backupT'), t('data.backupD'), '<button class="btn" data-action="backup">' + icon('download') + esc(t('data.backupB')) + '</button>') +
      row(t('data.restoreT'), t('data.restoreD'), '<button class="btn" data-action="restore">' + icon('upload') + esc(t('data.restoreB')) + '</button>') +
      row(t('data.sampleT'), t('data.sampleD'), '<button class="btn" data-action="sample">' + icon('plus') + esc(t('data.sampleB')) + '</button>') +
      row(t('data.resetT'), t('data.resetD'), '<button class="btn btn-danger-outline" data-action="reset">' + icon('refresh') + esc(t('data.resetT')) + '</button>') +
      row(t('data.wipeT'), t('data.wipeD'), '<button class="btn btn-danger-outline" data-action="wipe">' + icon('trash') + esc(t('data.wipeB')) + '</button>') +
      '</div></section>';
  }

  async function onClick(e) {
    const a = e.target.closest('[data-action]');
    if (!a) return;
    const st = VL.store;
    switch (a.dataset.action) {
      case 'import': VL.io.openImportDialog(); break;
      case 'export': VL.io.exportCSV(); break;
      case 'backup': VL.io.exportBackup(); break;
      case 'restore': if (await VL.io.restoreBackup()) draw(); break;
      case 'sample': VL.io.loadSample(); break;
      case 'reset':
        if (await VL.ui.confirm({ title: t('reset.title'), message: t('reset.msg'), confirmLabel: t('data.resetT'), danger: true })) {
          await st.resetProgress(); VL.ui.toast(t('reset.done'), 'success');
        }
        break;
      case 'wipe':
        if (await VL.ui.confirm({ title: t('wipe.title'), message: t('wipe.msg'), confirmLabel: t('data.wipeB'), danger: true })) {
          await st.clearAll(); VL.ui.toast(t('wipe.done'), 'success');
        }
        break;
    }
  }

  function onChange(e) {
    const el = e.target;
    if (el.name === 'theme') VL.theme.set(el.value);
    else if (el.name === 'lang') VL.i18n.set(el.value);
    else if (el.name === 'direction') VL.store.setSetting('direction', el.value);
    else if (el.name === 'typoMode') VL.store.setSetting('typoMode', el.value);
    else if (el.id === 'set-len') VL.store.setSetting('length', el.value);
    else if (el.id === 'set-name') VL.store.setSetting('profileName', el.value.replace(/\s+/g, ' ').trim().slice(0, 30));
    else if (el.id === 'set-freepath') VL.store.setSetting('freePath', el.checked);
    else if (el.id === 'set-lenient') VL.store.setSetting('lenient', el.checked);
    else if (el.id === 'set-auto') VL.store.setSetting('autoAdvance', el.checked);
    else if (el.id === 'set-goal') VL.store.setSetting('dailyGoal', Number(el.value));
    else if (el.id === 'set-speak') VL.store.setSetting('autoSpeak', el.checked);
  }

  return {
    mount(el) { root = el; draw(); root.addEventListener('click', onClick); root.addEventListener('change', onChange); },
    unmount() { if (root) { root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); } },
  };
})();
