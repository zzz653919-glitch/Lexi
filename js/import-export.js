/* Import (CSV/TXT/paste), CSV export, JSON backup & restore, sample loading. */
VL.io = (function () {
  const { esc, plural } = VL.util;
  const { icon } = VL.ui;
  const store = VL.store;

  function stamp() { return new Date().toISOString().slice(0, 10); }

  function exportCSV() {
    const words = store.state.words;
    if (!words.length) { VL.ui.toast('There are no words to export yet.', 'error'); return; }
    const rows = words.map((w) => ({ en: w.en, uz: w.uz, collection: (store.collection(w.collectionId) || {}).name || '' }));
    VL.ui.download('lexi-vocabulary-' + stamp() + '.csv', VL.csv.stringify(rows), 'text/csv;charset=utf-8');
    VL.ui.toast('Exported ' + plural(words.length, 'word') + ' to CSV.', 'success');
  }

  function exportBackup() {
    VL.ui.download('lexi-backup-' + stamp() + '.json', JSON.stringify(store.backup(), null, 2), 'application/json');
    VL.ui.toast('Backup downloaded (includes progress).', 'success');
  }

  function pickFile(accept) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = accept;
      input.addEventListener('change', () => resolve(input.files && input.files[0] ? input.files[0] : null));
      input.addEventListener('cancel', () => resolve(null));
      input.click();
    });
  }

  async function restoreBackup() {
    const file = await pickFile('.json,application/json');
    if (!file) return false;
    let data;
    try { data = JSON.parse(await file.text()); } catch (e) { VL.ui.toast('That file is not valid JSON.', 'error'); return false; }
    const ok = await VL.ui.confirm({ title: 'Restore backup?', message: 'This replaces ALL current words, collections and progress with the contents of "' + file.name + '".', confirmLabel: 'Replace everything', danger: true });
    if (!ok) return false;
    try {
      const r = await store.restore(data);
      VL.ui.toast('Restored ' + plural(r.words, 'word') + ' in ' + plural(r.collections, 'collection') + '.', 'success');
      return true;
    } catch (e) { VL.ui.toast(e.message || 'Could not restore the backup.', 'error', 5000); return false; }
  }

  async function loadSample() {
    let added = 0, duplicates = 0;
    for (const group of VL.sample) {
      const col = await store.ensureCollection(group.collection);
      const r = await store.importWords(group.words.map(([en, uz]) => ({ en, uz, collectionId: col.id })));
      added += r.added; duplicates += r.duplicates;
    }
    VL.ui.toast(added ? 'Added ' + plural(added, 'sample word') + '.' : 'Sample vocabulary is already in your library.', added ? 'success' : 'info');
    return added;
  }

  /* ---------- import dialog ---------- */
  function openImportDialog() {
    const body = document.createElement('div');
    body.className = 'import';
    body.innerHTML =
      '<p class="muted">One entry per line, e.g. <code>apple — olma</code>. Also accepts CSV, tab- or semicolon-separated text, <code>word = translation</code> and <code>word | translation</code>.</p>' +
      '<div class="field"><label for="imp-file">File (.csv or .txt)</label>' +
      '<input id="imp-file" type="file" accept=".csv,.txt,.tsv,text/csv,text/plain"></div>' +
      '<div class="field"><label for="imp-text">…or paste lines here</label>' +
      '<textarea id="imp-text" rows="4" placeholder="apple — olma&#10;book — kitob"></textarea></div>' +
      '<div class="field-row">' +
      '<div class="field"><label for="imp-col">Add to collection</label><select id="imp-col">' + VL.ui.collectionOptions(null, false) + '</select></div>' +
      '<label class="check"><input type="checkbox" id="imp-colcol"><span>Use the 3rd column as collection name (creates it if missing)</span></label></div>' +
      '<div id="imp-preview" class="import-preview" aria-live="polite"></div>';

    let parsed = null;
    const $ = (sel) => body.querySelector(sel);
    let currentText = '';

    function refresh() {
      const source = $('#imp-text').value.trim() ? $('#imp-text').value : currentText;
      const prev = $('#imp-preview');
      parsed = null;
      if (!source.trim()) { prev.innerHTML = ''; return; }
      const res = VL.csv.parseImport(source, { useCollectionColumn: $('#imp-colcol').checked });
      const colId = $('#imp-col').value;
      let dupes = 0;
      const seen = new Set();
      res.rows.forEach((r) => {
        const target = r.collection ? (store.state.collections.find((c) => c.name.toLowerCase() === r.collection.toLowerCase()) || { id: 'new:' + r.collection.toLowerCase() }).id : colId;
        const k = target + '|' + r.en.toLowerCase();
        if (seen.has(k) || (!String(target).startsWith('new:') && store.findDuplicate(r.en, target))) dupes++;
        seen.add(k);
      });
      parsed = res;
      let html = '<div class="preview-stats"><span class="chip chip-mastered">' + plural(res.rows.length - dupes < 0 ? 0 : res.rows.length - dupes, 'new word') + '</span>' +
        (dupes ? '<span class="chip chip-learning">' + plural(dupes, 'duplicate') + ' skipped</span>' : '') +
        (res.errors.length ? '<span class="chip chip-difficult">' + plural(res.errors.length, 'invalid line') + '</span>' : '') + '</div>';
      if (res.errors.length) {
        html += '<ul class="preview-errors">' + res.errors.slice(0, 5).map((e) => '<li>Line ' + e.line + ': ' + esc(e.reason) + ' — <code>' + esc(e.text.slice(0, 50)) + '</code></li>').join('') +
          (res.errors.length > 5 ? '<li>…and ' + (res.errors.length - 5) + ' more</li>' : '') + '</ul>';
      }
      if (!res.rows.length) html += '<p class="muted">No valid entries found yet.</p>';
      prev.innerHTML = html;
    }

    return VL.ui.modal({
      title: 'Import vocabulary',
      wide: true,
      body,
      buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Import words', value: 'import', kind: 'primary' }],
      onOpen(dlg) {
        $('#imp-file').addEventListener('change', async (e) => {
          const f = e.target.files[0];
          if (!f) { currentText = ''; return refresh(); }
          if (f.size > 5 * 1024 * 1024) { currentText = ''; $('#imp-preview').innerHTML = '<p class="form-error">File is larger than 5 MB.</p>'; parsed = null; return; }
          try { currentText = await f.text(); } catch (err) { currentText = ''; VL.ui.toast('Could not read that file.', 'error'); }
          if (currentText.includes('�')) VL.ui.toast('Some characters look garbled — save the file as UTF-8 and try again.', 'error', 5000);
          refresh();
        });
        ['#imp-text', '#imp-col', '#imp-colcol'].forEach((s) => $(s).addEventListener('input', refresh));
        $('#imp-colcol').addEventListener('change', refresh);
      },
      async onButton(value) {
        if (value !== 'import') return true;
        if (!parsed || !parsed.rows.length) {
          $('#imp-preview').innerHTML = '<p class="form-error">Choose a file or paste some lines first — nothing valid to import.</p>';
          return false;
        }
        const defaultCol = $('#imp-col').value;
        const rows = [];
        for (const r of parsed.rows) {
          const col = r.collection ? await store.ensureCollection(r.collection) : { id: defaultCol };
          rows.push({ en: r.en, uz: r.uz, collectionId: col.id });
        }
        const r = await store.importWords(rows);
        VL.ui.toast('Imported ' + plural(r.added, 'word') + (r.duplicates ? ', skipped ' + plural(r.duplicates, 'duplicate') : '') + (parsed.errors.length ? ', ' + plural(parsed.errors.length, 'invalid line') + ' ignored' : '') + '.', r.added ? 'success' : 'info', 5000);
        return true;
      },
    });
  }

  return { exportCSV, exportBackup, restoreBackup, loadSample, openImportDialog };
})();
