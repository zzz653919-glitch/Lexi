/* Import (CSV/TXT/paste), CSV export, JSON backup & restore, sample loading. */
VL.io = (function () {
  const { esc } = VL.util;
  const t = VL.t, n = VL.n;
  const { icon } = VL.ui;
  const store = VL.store;

  function stamp() { return new Date().toISOString().slice(0, 10); }

  function exportCSV() {
    const words = store.state.words;
    if (!words.length) { VL.ui.toast(t('io.noWords'), 'error'); return; }
    const rows = words.map((w) => ({ en: w.en, uz: w.uz, collection: (store.collection(w.collectionId) || {}).name || '' }));
    VL.ui.download('lexi-vocabulary-' + stamp() + '.csv', VL.csv.stringify(rows), 'text/csv;charset=utf-8');
    VL.ui.toast(t('io.exported', { w: n('n.word', words.length) }), 'success');
  }

  function exportBackup() {
    VL.ui.download('lexi-backup-' + stamp() + '.json', JSON.stringify(store.backup(), null, 2), 'application/json');
    VL.ui.toast(t('io.backedUp'), 'success');
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
    try { data = JSON.parse(await file.text()); } catch (e) { VL.ui.toast(t('io.badJson'), 'error'); return false; }
    const ok = await VL.ui.confirm({ title: t('io.restoreTitle'), message: t('io.restoreMsg', { f: file.name }), confirmLabel: t('io.replaceAll'), danger: true });
    if (!ok) return false;
    try {
      const r = await store.restore(data);
      VL.ui.toast(t('io.restored', { w: n('n.word', r.words), c: n('n.collection', r.collections) }), 'success');
      return true;
    } catch (e) { VL.ui.toast(e.message || t('io.restoreFail'), 'error', 5000); return false; }
  }

  async function loadSample() {
    let added = 0, duplicates = 0;
    for (const group of VL.sample) {
      const col = await store.ensureCollection(group.collection);
      const r = await store.importWords(group.words.map(([en, uz]) => ({ en, uz, collectionId: col.id })));
      added += r.added; duplicates += r.duplicates;
    }
    VL.ui.toast(added ? t('io.sampleAdded', { n: n('n.sampleWord', added) }) : t('io.sampleExists'), added ? 'success' : 'info');
    return added;
  }

  /* ---------- import dialog ---------- */
  function openImportDialog() {
    const body = document.createElement('div');
    body.className = 'import';
    body.innerHTML =
      '<p class="muted">' + t('imp.help') + '</p>' +
      '<div class="field"><label for="imp-file">' + esc(t('imp.file')) + '</label>' +
      '<input id="imp-file" type="file" accept=".csv,.txt,.tsv,text/csv,text/plain"></div>' +
      '<div class="field"><label for="imp-text">' + esc(t('imp.paste')) + '</label>' +
      '<textarea id="imp-text" rows="4" placeholder="apple — olma&#10;book — kitob"></textarea></div>' +
      '<div class="field-row">' +
      '<div class="field"><label for="imp-col">' + esc(t('imp.target')) + '</label><select id="imp-col">' + VL.ui.collectionOptions(null, false) + '</select></div>' +
      '<label class="check"><input type="checkbox" id="imp-colcol"><span>' + esc(t('imp.colcol')) + '</span></label></div>' +
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
      let html = '<div class="preview-stats"><span class="chip chip-mastered">' + esc(n('n.newWord', Math.max(0, res.rows.length - dupes))) + '</span>' +
        (dupes ? '<span class="chip chip-learning">' + esc(t('imp.skipped', { x: n('n.duplicate', dupes) })) + '</span>' : '') +
        (res.errors.length ? '<span class="chip chip-difficult">' + esc(n('n.invalidLine', res.errors.length)) + '</span>' : '') + '</div>';
      if (res.errors.length) {
        html += '<ul class="preview-errors">' + res.errors.slice(0, 5).map((e) => '<li>' + esc(t('imp.line', { l: e.line, reason: t('csv.err.' + e.reason) })) + ' — <code>' + esc(e.text.slice(0, 50)) + '</code></li>').join('') +
          (res.errors.length > 5 ? '<li>' + esc(t('imp.more', { n: res.errors.length - 5 })) + '</li>' : '') + '</ul>';
      }
      if (!res.rows.length) html += '<p class="muted">' + esc(t('imp.noneValid')) + '</p>';
      prev.innerHTML = html;
    }

    return VL.ui.modal({
      title: t('imp.title'),
      wide: true,
      body,
      buttons: [{ label: t('btn.cancel'), value: 'cancel' }, { label: t('btn.importWords'), value: 'import', kind: 'primary' }],
      onOpen(dlg) {
        $('#imp-file').addEventListener('change', async (e) => {
          const f = e.target.files[0];
          if (!f) { currentText = ''; return refresh(); }
          if (f.size > 5 * 1024 * 1024) { currentText = ''; $('#imp-preview').innerHTML = '<p class="form-error">' + esc(t('imp.tooBig')) + '</p>'; parsed = null; return; }
          try { currentText = await f.text(); } catch (err) { currentText = ''; VL.ui.toast(t('imp.readFail'), 'error'); }
          if (currentText.includes('\uFFFD')) VL.ui.toast(t('imp.garbled'), 'error', 5000);
          refresh();
        });
        ['#imp-text', '#imp-col', '#imp-colcol'].forEach((s) => $(s).addEventListener('input', refresh));
        $('#imp-colcol').addEventListener('change', refresh);
      },
      async onButton(value) {
        if (value !== 'import') return true;
        if (!parsed || !parsed.rows.length) {
          $('#imp-preview').innerHTML = '<p class="form-error">' + esc(t('imp.nothing')) + '</p>';
          return false;
        }
        const defaultCol = $('#imp-col').value;
        const rows = [];
        for (const r of parsed.rows) {
          const col = r.collection ? await store.ensureCollection(r.collection) : { id: defaultCol };
          rows.push({ en: r.en, uz: r.uz, collectionId: col.id });
        }
        const r = await store.importWords(rows);
        VL.ui.toast(t('imp.done', { w: n('n.word', r.added) }) + (r.duplicates ? t('imp.doneDup', { d: n('n.duplicate', r.duplicates) }) : '') + (parsed.errors.length ? t('imp.doneInv', { i: n('n.invalidLine', parsed.errors.length) }) : '') + '.', r.added ? 'success' : 'info', 5000);
        return true;
      },
    });
  }

  return { exportCSV, exportBackup, restoreBackup, loadSample, openImportDialog };
})();
