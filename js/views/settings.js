VL.views.settings = (function () {
  const { icon } = VL.ui;
  let root;

  function draw() {
    const s = VL.store.state.settings;
    const theme = VL.theme.get();
    const radio = (name, val, cur, label) => '<label><input type="radio" name="' + name + '" value="' + val + '"' + (cur === val ? ' checked' : '') + '><span>' + label + '</span></label>';
    root.innerHTML =
      '<header class="page-head"><div><h1>Settings</h1><p class="muted">Everything is stored on this device (' + (VL.db.backend === 'indexeddb' ? 'IndexedDB' : 'localStorage fallback') + ').</p></div></header>' +
      '<section class="card settings-group"><h2 class="card-title">Appearance</h2>' +
      '<fieldset class="field"><legend>Theme</legend><div class="segmented">' + radio('theme', 'light', theme, 'Light') + radio('theme', 'dark', theme, 'Dark') + radio('theme', 'system', theme, 'System') + '</div></fieldset></section>' +
      '<section class="card settings-group"><h2 class="card-title">Quiz preferences</h2>' +
      '<fieldset class="field"><legend>Default direction</legend><div class="segmented">' + radio('direction', 'en-uz', s.direction, 'English → Uzbek') + radio('direction', 'uz-en', s.direction, 'Uzbek → English') + radio('direction', 'mixed', s.direction, 'Mixed') + '</div></fieldset>' +
      '<div class="field"><label for="set-len">Default quiz length</label><select id="set-len">' +
      [['all', 'All available words'], ['10', '10 questions'], ['20', '20 questions'], ['50', '50 questions']].map((o) => '<option value="' + o[0] + '"' + (String(s.length) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div>' +
      '<label class="check"><input type="checkbox" id="set-lenient"' + (s.lenient ? ' checked' : '') + '><span>Ignore accents and apostrophe styles (o\' = oʻ = o‘, café = cafe)</span></label>' +
      '<label class="check"><input type="checkbox" id="set-auto"' + (s.autoAdvance ? ' checked' : '') + '><span>Automatically move on after a correct answer</span></label>' +
      '<p class="hint">Capitalisation and extra spaces are always ignored.</p></section>' +
      '<section class="card settings-group"><h2 class="card-title">Data management</h2>' +
      '<div class="data-grid">' +
      row('Import vocabulary', 'Add words from a CSV or TXT file.', '<button class="btn" data-action="import">' + icon('upload') + 'Import…</button>') +
      row('Export vocabulary', 'Download all words as a CSV file.', '<button class="btn" data-action="export">' + icon('download') + 'Export CSV</button>') +
      row('Backup everything', 'Words, collections and progress as one JSON file.', '<button class="btn" data-action="backup">' + icon('download') + 'Download backup</button>') +
      row('Restore backup', 'Replace all data from a backup file.', '<button class="btn" data-action="restore">' + icon('upload') + 'Restore…</button>') +
      row('Sample vocabulary', 'Add ~60 A1–IELTS words to try the app.', '<button class="btn" data-action="sample">' + icon('plus') + 'Load samples</button>') +
      row('Reset progress', 'Keep your words, clear scores and history.', '<button class="btn btn-danger-outline" data-action="reset">' + icon('refresh') + 'Reset progress</button>') +
      row('Delete all data', 'Permanently remove every word and collection.', '<button class="btn btn-danger-outline" data-action="wipe">' + icon('trash') + 'Delete everything</button>') +
      '</div></section>';
  }

  const row = (t, d, btn) => '<div class="data-row"><div><strong>' + t + '</strong><div class="muted small">' + d + '</div></div>' + btn + '</div>';

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
        if (await VL.ui.confirm({ title: 'Reset progress?', message: 'All scores, difficult-word marks and session history will be cleared. Your words stay.', confirmLabel: 'Reset progress', danger: true })) {
          await st.resetProgress(); VL.ui.toast('Progress reset.', 'success');
        }
        break;
      case 'wipe':
        if (await VL.ui.confirm({ title: 'Delete all data?', message: 'Every word, collection and progress record will be permanently deleted. Consider downloading a backup first.', confirmLabel: 'Delete everything', danger: true })) {
          await st.clearAll(); VL.ui.toast('All data deleted.', 'success');
        }
        break;
    }
  }

  function onChange(e) {
    const t = e.target;
    if (t.name === 'theme') VL.theme.set(t.value);
    else if (t.name === 'direction') VL.store.setSetting('direction', t.value);
    else if (t.id === 'set-len') VL.store.setSetting('length', t.value);
    else if (t.id === 'set-lenient') VL.store.setSetting('lenient', t.checked);
    else if (t.id === 'set-auto') VL.store.setSetting('autoAdvance', t.checked);
  }

  return {
    mount(el) { root = el; draw(); root.addEventListener('click', onClick); root.addEventListener('change', onChange); },
    unmount() { if (root) { root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); } },
  };
})();
