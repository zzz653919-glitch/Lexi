/* Bulk Vocabulary Import: paste -> checked, editable table -> save as separate vocabulary cards. */
VL.views.bulk = (function () {
  const { esc, debounce } = VL.util;
  const { icon } = VL.ui;
  const t = VL.t, n = VL.n;
  const store = VL.store, B = VL.bulk;
  const NEW = '__new__';
  const EXAMPLE_TEXT = ['problem\tmuammo', 'home\tuy', 'work\tishlamoq', 'repair\ttuzatmoq', 'broken\tbuzilgan', 'mend\tyamoq solmoq', "die\to'lmoq", 'water\tsuv', 'untidy\ttartibsiz', 'tidy\ttartibli', "lose\tyo'qotmoq", 'look for\tizlamoq', 'cut\tkesmoq', "put on a plaster\tleykoplastir qo'ymoq", 'have a row with\tbilan janjallashmoq', "apologise\tkechirim so'ramoq"].join('\n');

  // State lives outside mount() so switching language or tabs does not throw away unsaved work.
  const S = { text: '', sep: 'auto', rows: [], nextId: 1, page: 0, pageSize: 50, showExample: false, target: NEW, newName: '', practise: true, meta: null, dirty: false, result: null, saving: false, error: '' };
  let root, statuses = [], existing = null;

  /* ---------- model ---------- */
  const rowFromParsed = (r) => ({ id: S.nextId++, en: r.en, uz: r.uz, example: r.example, include: false, touched: false, filled: false });

  function existingMap() {
    if (S.target === NEW || !store.collection(S.target)) return null;
    const m = new Map();
    store.wordsIn(S.target).forEach((w) => m.set(B.dupKey(w.en), w));
    return m;
  }

  function revalidate() {
    existing = existingMap();
    statuses = B.validate(S.rows, existing);
    S.rows.forEach((r, i) => { if (!r.touched) r.include = statuses[i].kind === 'ok'; });
  }

  function counts() {
    const c = { ready: 0, missing: 0, errors: 0, dups: 0 };
    statuses.forEach((s) => {
      if (s.kind === 'ok') c.ready++;
      else if (s.kind === 'dup') c.dups++;
      else if (s.code === 'noUz') c.missing++;
      else c.errors++;
    });
    return c;
  }

  // What "Save all words" would do, or the reason it cannot.
  function plan() {
    const add = [], update = [];
    let errors = 0, conflict = null;
    const seen = new Map();
    S.rows.forEach((r, i) => {
      if (!r.include) return;
      const st = statuses[i];
      if (st.kind === 'error') { errors++; return; }
      const k = B.dupKey(r.en);
      if (seen.has(k) && !conflict) conflict = r.en;
      seen.set(k, r);
      const have = existing && existing.get(k);
      if (have) update.push({ row: r, word: have }); else add.push(r);
    });
    return { add, update, errors, conflict, total: add.length + update.length };
  }

  /* ---------- rendering ---------- */
  function drawShell() {
    root.innerHTML =
      '<header class="page-head"><div><h1>' + esc(t('bulk.title')) + '</h1><p class="muted">' + esc(t('bulk.sub')) + '</p></div>' +
      '<a class="btn" href="#/vocabulary">' + esc(t('bulk.back')) + '</a></header>' +
      '<section class="card bulk-input"><h2 class="card-title">' + esc(t('bulk.step1')) + '</h2><p class="muted bulk-formats">' + t('bulk.formats') + '</p>' +
      '<label class="sr-only" for="bulk-text">' + esc(t('bulk.textAria')) + '</label>' +
      '<textarea id="bulk-text" rows="10" spellcheck="false" placeholder="problem&#9;muammo&#10;look for&#9;izlamoq&#10;have a row with&#9;bilan janjallashmoq"></textarea>' +
      '<div class="bulk-controls"><div class="field"><label for="bulk-sep">' + esc(t('bulk.sep')) + '</label><select id="bulk-sep">' +
      ['auto', 'tab', 'semicolon', 'comma', 'dash', 'none'].map((v) => '<option value="' + v + '"' + (S.sep === v ? ' selected' : '') + '>' + esc(t('bulk.sep.' + v)) + '</option>').join('') + '</select></div>' +
      '<div class="btn-row"><button class="btn btn-primary" data-action="build">' + icon('list') + esc(t('bulk.build')) + '</button>' +
      '<label class="btn" for="bulk-file">' + icon('upload') + esc(t('bulk.openFile')) + '</label><input id="bulk-file" class="sr-only" type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain">' +
      '<button class="btn btn-ghost" data-action="example">' + esc(t('bulk.example')) + '</button>' +
      '<button class="btn btn-ghost" data-action="clear-text">' + esc(t('bulk.clearText')) + '</button></div></div>' +
      '<p class="form-error" id="bulk-input-error" role="alert"></p></section>' +
      '<section class="card" id="bulk-table-card" hidden></section>' +
      '<section class="card" id="bulk-save-card"></section>';
    root.querySelector('#bulk-text').value = S.text;
  }

  function chips(c) {
    const m = S.meta;
    let html = '<span class="chip">' + esc(n('n.row', S.rows.length)) + '</span>' +
      '<span class="chip chip-mastered">' + esc(t('bulk.sum.ready', { n: c.ready })) + '</span>' +
      (c.missing ? '<span class="chip chip-difficult">' + esc(t('bulk.sum.missing', { n: c.missing })) + '</span>' : '') +
      (c.errors ? '<span class="chip chip-difficult">' + esc(t('bulk.sum.errors', { n: c.errors })) + '</span>' : '') +
      (c.dups ? '<span class="chip chip-learning">' + esc(t('bulk.sum.dups', { n: c.dups })) + '</span>' : '');
    if (m) {
      html += (m.separator ? '<span class="chip">' + esc(t('bulk.detected', { s: t('bulk.sep.' + m.separator) })) + '</span>' : '') +
        (m.blank ? '<span class="chip">' + esc(t('bulk.sum.blank', { n: m.blank })) + '</span>' : '') +
        (m.hadHeader ? '<span class="chip">' + esc(t('bulk.sum.header')) + '</span>' : '') +
        (m.droppedNumbers ? '<span class="chip">' + esc(t('bulk.sum.numbers')) + '</span>' : '');
    }
    return html;
  }

  function statusHtml(r, st) {
    let label;
    if (st.code === 'dupList') label = t('bulk.st.dupList', { n: st.ref });
    else if (st.code === 'dupExisting') label = t('bulk.st.dupExisting', { uz: st.ref.uz });
    else label = t('bulk.st.' + st.code);
    const cls = st.kind === 'ok' ? 'chip-mastered' : st.kind === 'dup' ? 'chip-learning' : 'chip-difficult';
    const ic = st.kind === 'ok' ? 'check' : st.kind === 'dup' ? 'alert' : 'x';
    return '<span class="chip ' + cls + '">' + icon(ic) + '<span>' + esc(label) + '</span></span>' + (r.filled ? '<span class="chip chip-new-word">' + esc(t('bulk.fromLib')) + '</span>' : '');
  }

  function rowHtml(r, i) {
    const st = statuses[i], num = i + 1;
    return '<div class="bulk-row k-' + st.kind + (r.include ? '' : ' off') + (S.showExample ? ' with-ex' : '') + '" role="row" data-id="' + r.id + '">' +
      '<label class="b-tick"><input type="checkbox" data-field="include" aria-label="' + esc(t('bulk.tickAria', { n: num })) + '"' + (r.include ? ' checked' : '') + '></label>' +
      '<span class="b-num" aria-hidden="true">' + num + '</span>' +
      '<input class="b-en" type="text" data-field="en" maxlength="400" autocomplete="off" spellcheck="false" value="' + esc(r.en) + '" aria-label="' + esc(t('bulk.enAria', { n: num })) + '">' +
      '<input class="b-uz" type="text" data-field="uz" maxlength="400" autocomplete="off" spellcheck="false" value="' + esc(r.uz) + '" aria-label="' + esc(t('bulk.uzAria', { n: num })) + '">' +
      (S.showExample ? '<input class="b-ex" type="text" data-field="example" maxlength="400" autocomplete="off" value="' + esc(r.example) + '" aria-label="' + esc(t('bulk.exAria', { n: num })) + '">' : '') +
      '<div class="b-status" role="status">' + statusHtml(r, st) + '</div>' +
      '<button type="button" class="icon-btn danger b-del" data-action="del-row" aria-label="' + esc(t('bulk.delAria', { n: num })) + '">' + icon('trash') + '</button></div>';
  }

  function drawTable() {
    const card = root.querySelector('#bulk-table-card');
    if (!S.rows.length) { card.hidden = true; card.innerHTML = ''; return; }
    card.hidden = false;
    const pages = Math.max(1, Math.ceil(S.rows.length / S.pageSize));
    S.page = Math.min(S.page, pages - 1);
    const from = S.page * S.pageSize, to = Math.min(S.rows.length, from + S.pageSize);
    const c = counts();
    card.innerHTML =
      '<h2 class="card-title">' + esc(t('bulk.step2')) + '</h2><div class="bulk-summary" id="bulk-summary">' + chips(c) + '</div>' +
      (S.meta && S.meta.truncated ? '<p class="notice">' + icon('alert') + '<span>' + esc(t('bulk.sum.cut', { n: B.MAX_ROWS })) + '</span></p>' : '') +
      '<div id="bulk-dup-banner">' + dupBanner(c) + '</div>' +
      '<p class="notice">' + icon('alert') + '<span>' + esc(t('bulk.noAi')) + '</span></p>' +
      '<div class="bulk-toolbar"><button class="btn btn-sm" data-action="add-row">' + icon('plus') + esc(t('bulk.addRow')) + '</button>' +
      '<button class="btn btn-sm" data-action="fill-lib">' + icon('book') + esc(t('bulk.fillLib')) + '</button>' +
      '<button class="btn btn-sm" data-action="swap">' + icon('refresh') + esc(t('bulk.swap')) + '</button>' +
      '<button class="btn btn-sm btn-ghost" data-action="tick-ready">' + esc(t('bulk.tickReady')) + '</button>' +
      '<button class="btn btn-sm btn-ghost" data-action="untick-all">' + esc(t('bulk.untickAll')) + '</button>' +
      '<button class="btn btn-sm btn-ghost" data-action="remove-unticked">' + esc(t('bulk.removeUnticked')) + '</button>' +
      '<button class="btn btn-sm btn-danger-outline" data-action="clear-all">' + icon('trash') + esc(t('bulk.clearAll')) + '</button></div>' +
      '<div class="bulk-options"><label class="check"><input type="checkbox" id="bulk-showex"' + (S.showExample ? ' checked' : '') + '><span>' + esc(t('bulk.showEx')) + '</span></label>' +
      '<div class="field inline"><label for="bulk-psize">' + esc(t('bulk.pageSize')) + '</label><select id="bulk-psize">' + [25, 50, 100].map((v) => '<option value="' + v + '"' + (S.pageSize === v ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></div></div>' +
      '<div class="bulk-table" role="table" aria-label="' + esc(t('bulk.tableAria')) + '"><div class="bulk-row bulk-head' + (S.showExample ? ' with-ex' : '') + '" role="row"><span>' + esc(t('bulk.col.save')) + '</span><span>№</span><span>' + esc(t('th.english')) + '</span><span>' + esc(t('field.uzbek')) + '</span>' + (S.showExample ? '<span>' + esc(t('bulk.col.ex')) + '</span>' : '') + '<span>' + esc(t('bulk.col.status')) + '</span><span></span></div>' +
      S.rows.slice(from, to).map((r, k) => rowHtml(r, from + k)).join('') + '</div>' +
      '<div class="bulk-pager"><span class="muted small">' + esc(t('bulk.pager', { a: from + 1, b: to, n: S.rows.length })) + '</span><div class="btn-row">' +
      '<button class="btn btn-sm" data-action="prev"' + (S.page === 0 ? ' disabled' : '') + '>' + esc(t('bulk.prev')) + '</button>' +
      '<button class="btn btn-sm" data-action="next"' + (S.page >= pages - 1 ? ' disabled' : '') + '>' + esc(t('bulk.next')) + '</button></div></div>';
  }

  const dupBanner = (c) => (c.dups ? '<p class="notice warn">' + icon('alert') + '<span>' + esc(t('bulk.dupBanner', { n: c.dups })) + '</span></p>' : '');

  // Lightweight update while typing: statuses, chips and the save summary change, inputs are left alone.
  function refreshLive() {
    revalidate();
    const card = root.querySelector('#bulk-table-card');
    if (!card.hidden) {
      const c = counts();
      root.querySelector('#bulk-summary').innerHTML = chips(c);
      root.querySelector('#bulk-dup-banner').innerHTML = dupBanner(c);
      card.querySelectorAll('.bulk-row[data-id]').forEach((el) => {
        const idx = S.rows.findIndex((r) => r.id === Number(el.dataset.id));
        if (idx < 0) return;
        const r = S.rows[idx], st = statuses[idx];
        el.className = 'bulk-row k-' + st.kind + (r.include ? '' : ' off') + (S.showExample ? ' with-ex' : '');
        el.querySelector('.b-status').innerHTML = statusHtml(r, st);
        el.querySelector('[data-field="include"]').checked = r.include;
      });
    }
    drawSave();
  }

  function drawSave() {
    const card = root.querySelector('#bulk-save-card');
    if (S.result && S.result.ok) { card.innerHTML = resultHtml(); return; }
    const p = plan();
    const cols = store.state.collections;
    const hadFocus = document.activeElement && document.activeElement.id;
    card.innerHTML =
      '<h2 class="card-title">' + esc(t('bulk.step3')) + '</h2>' +
      (S.result && !S.result.ok ? '<p class="notice danger" role="alert">' + icon('x') + '<span>' + esc(t('bulk.fail')) + '</span></p>' : '') +
      '<div class="bulk-target"><div class="field"><label for="bulk-target">' + esc(t('field.collection')) + '</label><select id="bulk-target">' +
      '<option value="' + NEW + '"' + (S.target === NEW ? ' selected' : '') + '>' + esc(t('bulk.targetNew')) + '</option>' +
      cols.map((c) => '<option value="' + esc(c.id) + '"' + (S.target === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></div>' +
      (S.target === NEW ? '<div class="field"><label for="bulk-newname">' + esc(t('bulk.newName')) + '</label><input id="bulk-newname" type="text" maxlength="60" autocomplete="off" placeholder="' + esc(t('bulk.newNamePh')) + '" value="' + esc(S.newName) + '"></div>' : '') + '</div>' +
      '<label class="check"><input type="checkbox" id="bulk-practise"' + (S.practise ? ' checked' : '') + '><span>' + esc(t('bulk.practise')) + '</span></label>' +
      '<div class="bulk-savebar"><div><b id="bulk-willsave">' + esc(t('bulk.willSave', { n: n('n.word', p.total) })) + '</b>' + (p.update.length ? '<div class="small muted">' + esc(t('bulk.willReplace', { n: p.update.length })) + '</div>' : '') + '</div>' +
      '<button class="btn btn-primary btn-lg" data-action="save"' + (S.saving ? ' disabled' : '') + '>' + icon('check') + esc(t(S.saving ? 'bulk.saving' : 'bulk.saveAll')) + '</button></div>' +
      '<p class="form-error" id="bulk-save-error" role="alert">' + esc(S.error) + '</p>';
    if (hadFocus) { const el = card.querySelector('#' + hadFocus); if (el && el.tagName === 'INPUT' && el.type === 'text') { el.focus(); const v = el.value.length; el.setSelectionRange(v, v); } }
  }

  function resultHtml() {
    const r = S.result;
    return '<div class="bulk-done"><span class="fb-ico ok-ico">' + icon('check') + '</span><div><h2 class="card-title">' + esc(t('bulk.ok', { w: n('n.word', r.added + r.updated), c: r.col.name })) + '</h2>' +
      (r.updated ? '<p class="muted">' + esc(t('bulk.ok.updated', { n: r.updated })) + '</p>' : '') +
      (r.skipped ? '<p class="muted">' + esc(t('bulk.ok.skipped', { n: r.skipped })) + '</p>' : '') +
      '<div class="btn-row"><button class="btn btn-primary" data-action="practise-now" data-col="' + esc(r.col.id) + '">' + icon('zap') + esc(t('bulk.next.practise')) + '</button>' +
      '<a class="btn" href="#/vocabulary?collection=' + esc(r.col.id) + '">' + esc(t('bulk.next.open')) + '</a>' +
      '<button class="btn btn-ghost" data-action="more">' + esc(t('bulk.next.more')) + '</button></div></div></div>';
  }

  /* ---------- actions ---------- */
  async function build(force) {
    const text = root.querySelector('#bulk-text').value;
    const err = root.querySelector('#bulk-input-error');
    S.text = text;
    if (!text.trim()) { err.textContent = t('bulk.empty'); return; }
    err.textContent = '';
    if (!force && S.rows.length && S.dirty) {
      const ok = await VL.ui.confirm({ title: t('bulk.rebuildT'), message: t('bulk.rebuildM'), confirmLabel: t('bulk.rebuildB'), danger: true });
      if (!ok) return;
    }
    const res = B.parse(text, { separator: S.sep });
    S.rows = res.rows.map(rowFromParsed);
    S.meta = res; S.page = 0; S.dirty = false; S.result = null; S.error = '';
    if (!S.rows.length) { err.textContent = t('bulk.empty'); drawTable(); drawSave(); return; }
    revalidate(); drawTable(); drawSave();
    root.querySelector('#bulk-table-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    VL.ui.toast(t('bulk.built', { n: n('n.row', S.rows.length) }), 'success', 1800);
  }

  async function save() {
    const p = plan();
    const err = (msg) => { S.error = msg; drawSave(); };
    if (p.errors) return err(t('bulk.err.fix', { n: p.errors }));
    if (p.conflict) return err(t('bulk.err.conflict', { w: p.conflict }));
    if (!p.total) return err(t('bulk.err.nothing'));
    S.error = ''; S.saving = true; drawSave();
    let col;
    if (S.target === NEW) {
      const r = await store.addCollection(S.newName);
      if (!r.ok) { S.saving = false; return err(r.error); }
      col = r.collection;
    } else col = store.collection(S.target);
    const res = await store.importWords(p.add.map((r) => ({ en: r.en, uz: r.uz, example: r.example, collectionId: col.id })));
    let updated = 0;
    for (const u of p.update) {
      const r = await store.updateWord(u.word.id, { en: u.word.en, uz: u.row.uz, example: u.row.example || u.word.example, collectionId: col.id });
      if (r.ok) updated++;
    }
    const sel = store.state.settings.learnSelected || [];
    if (S.practise && sel.length && !sel.includes(col.id)) await store.setSetting('learnSelected', sel.concat(col.id));
    S.saving = false;
    const ok = res.ok !== false;
    S.result = { ok, added: res.added, updated, skipped: res.duplicates, col };
    if (ok) {
      VL.ui.toast(t('bulk.ok', { w: n('n.word', res.added + updated), c: col.name }), 'success', 4000);
      S.rows = []; S.meta = null; S.dirty = false; S.target = col.id; S.newName = '';
      statuses = []; drawTable();
    } else VL.ui.toast(t('bulk.fail'), 'error', 7000);
    drawSave();
  }

  function resetAll() {
    S.text = ''; S.rows = []; S.meta = null; S.result = null; S.dirty = false; S.error = ''; statuses = [];
    drawShell(); drawTable(); drawSave();
  }

  async function onClick(e) {
    const a = e.target.closest('[data-action]');
    if (!a) return;
    const rowEl = a.closest('.bulk-row');
    const id = rowEl ? Number(rowEl.dataset.id) : null;
    switch (a.dataset.action) {
      case 'build': await build(false); break;
      case 'example': root.querySelector('#bulk-text').value = EXAMPLE_TEXT; S.text = EXAMPLE_TEXT; await build(false); break;
      case 'clear-text': root.querySelector('#bulk-text').value = ''; S.text = ''; root.querySelector('#bulk-text').focus(); break;
      case 'add-row': {
        S.rows.push({ id: S.nextId++, en: '', uz: '', example: '', include: false, touched: false, filled: false });
        S.page = Math.ceil(S.rows.length / S.pageSize) - 1; S.dirty = true; revalidate(); drawTable(); drawSave();
        const last = root.querySelector('.bulk-row[data-id]:last-of-type .b-en'); if (last) last.focus();
        break;
      }
      case 'del-row': S.rows = S.rows.filter((r) => r.id !== id); S.dirty = true; revalidate(); drawTable(); drawSave(); break;
      case 'fill-lib': {
        const dict = B.libraryDictionary();
        const empty = S.rows.filter((r) => B.clean(r.en) && !B.clean(r.uz));
        if (!empty.length) { VL.ui.toast(t('bulk.fillNone'), 'info'); break; }
        let filled = 0;
        empty.forEach((r) => { const hit = dict.get(B.dupKey(r.en)); if (hit) { r.uz = hit; r.filled = true; filled++; } });
        S.dirty = true; revalidate(); drawTable(); drawSave();
        VL.ui.toast(t('bulk.fillDone', { a: filled, b: empty.length }), filled ? 'success' : 'info', 4000);
        break;
      }
      case 'swap': S.rows.forEach((r) => { const x = r.en; r.en = r.uz; r.uz = x; r.filled = false; }); S.dirty = true; revalidate(); drawTable(); drawSave(); break;
      case 'tick-ready': S.rows.forEach((r, i) => { r.touched = true; r.include = statuses[i].kind === 'ok'; }); drawTable(); drawSave(); break;
      case 'untick-all': S.rows.forEach((r) => { r.touched = true; r.include = false; }); drawTable(); drawSave(); break;
      case 'remove-unticked': S.rows = S.rows.filter((r) => r.include); S.dirty = true; revalidate(); drawTable(); drawSave(); break;
      case 'clear-all':
        if (await VL.ui.confirm({ title: t('bulk.clearT'), message: t('bulk.clearM', { n: S.rows.length }), confirmLabel: t('bulk.clearAll'), danger: true })) { S.rows = []; S.meta = null; S.dirty = false; statuses = []; drawTable(); drawSave(); }
        break;
      case 'prev': S.page = Math.max(0, S.page - 1); drawTable(); break;
      case 'next': S.page++; drawTable(); break;
      case 'save': await save(); break;
      case 'practise-now': await store.setSetting('learnSelected', [a.dataset.col]); location.hash = '#/learn?tab=practice'; break;
      case 'more': resetAll(); break;
    }
  }

  const liveInput = debounce(refreshLive, 140);

  function onInput(e) {
    const el = e.target;
    const rowEl = el.closest('.bulk-row[data-id]');
    if (rowEl && el.dataset.field && el.dataset.field !== 'include') {
      const r = S.rows.find((x) => x.id === Number(rowEl.dataset.id));
      if (!r) return;
      r[el.dataset.field] = el.value;
      if (el.dataset.field === 'uz') r.filled = false;
      S.dirty = true; S.error = ''; liveInput();
    } else if (el.id === 'bulk-text') S.text = el.value;
    else if (el.id === 'bulk-newname') { S.newName = el.value; S.error = ''; }
  }

  function onChange(e) {
    const el = e.target;
    const rowEl = el.closest('.bulk-row[data-id]');
    if (rowEl && el.dataset.field === 'include') {
      const r = S.rows.find((x) => x.id === Number(rowEl.dataset.id));
      if (r) { r.include = el.checked; r.touched = true; S.error = ''; refreshLive(); }
    } else if (el.id === 'bulk-sep') S.sep = el.value;
    else if (el.id === 'bulk-psize') { S.pageSize = Number(el.value); S.page = 0; drawTable(); }
    else if (el.id === 'bulk-showex') { S.showExample = el.checked; drawTable(); }
    else if (el.id === 'bulk-target') { S.target = el.value; S.error = ''; S.rows.forEach((r) => { if (!r.touched) r.include = false; }); revalidate(); drawTable(); drawSave(); }
    else if (el.id === 'bulk-practise') S.practise = el.checked;
    else if (el.id === 'bulk-file') readFile(el);
  }

  async function readFile(input) {
    const f = input.files && input.files[0];
    if (!f) return;
    const err = root.querySelector('#bulk-input-error');
    if (f.size > 5 * 1024 * 1024) { err.textContent = t('imp.tooBig'); input.value = ''; return; }
    let text;
    try { text = await f.text(); } catch (e) { err.textContent = t('imp.readFail'); return; }
    input.value = '';
    if (text.includes('\uFFFD')) VL.ui.toast(t('imp.garbled'), 'error', 5000);
    root.querySelector('#bulk-text').value = text; S.text = text;
    await build(false);
  }

  // Enter in a table cell moves to the same cell in the next row (like a spreadsheet).
  function onKey(e) {
    if (e.key !== 'Enter' || e.isComposing) return;
    const el = e.target;
    if (!(el.matches && el.matches('.bulk-row input[type="text"]'))) return;
    e.preventDefault();
    const rows = Array.from(root.querySelectorAll('.bulk-row[data-id]'));
    const i = rows.indexOf(el.closest('.bulk-row'));
    const nextRow = rows[i + 1];
    if (nextRow) { const f = nextRow.querySelector('[data-field="' + el.dataset.field + '"]'); if (f) { f.focus(); f.select(); } }
  }

  return {
    mount(el) {
      root = el;
      if (!store.collection(S.target) && S.target !== NEW) S.target = NEW;
      drawShell(); revalidate(); drawTable(); drawSave();
      root.addEventListener('click', onClick);
      root.addEventListener('input', onInput);
      root.addEventListener('change', onChange);
      root.addEventListener('keydown', onKey);
    },
    unmount() {
      if (root) { root.removeEventListener('click', onClick); root.removeEventListener('input', onInput); root.removeEventListener('change', onChange); root.removeEventListener('keydown', onKey); }
    },
  };
})();
