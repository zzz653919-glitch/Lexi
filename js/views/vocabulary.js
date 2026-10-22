VL.views.vocabulary = (function () {
  const { esc, plural, debounce } = VL.util;
  const { icon } = VL.ui;
  const PAGE = 100;
  let root, off;
  let filter = { collection: '', q: '', sort: 'newest', limit: PAGE };
  let addCollectionId = null;

  function visibleWords() {
    const q = VL.quiz.normalize(filter.q, true);
    let list = VL.store.wordsIn(filter.collection || null).filter((w) =>
      !q || VL.quiz.normalize(w.en, true).includes(q) || VL.quiz.normalize(w.uz, true).includes(q));
    const by = { newest: (a, b) => b.createdAt - a.createdAt, en: (a, b) => a.en.localeCompare(b.en), uz: (a, b) => a.uz.localeCompare(b.uz, 'uz') };
    return list.sort(by[filter.sort] || by.newest);
  }

  function shell() {
    root.innerHTML =
      '<header class="page-head"><div><h1>My Vocabulary</h1><p class="muted" id="v-count"></p></div>' +
      '<div class="btn-row"><button class="btn" data-action="import">' + icon('upload') + 'Import</button>' +
      '<button class="btn" data-action="export">' + icon('download') + 'Export CSV</button></div></header>' +
      '<div class="vocab-layout">' +
      '<aside class="card collections" aria-label="Collections"><h2 class="card-title">Collections</h2><ul id="v-collections"></ul>' +
      '<form id="col-form" class="inline-form" novalidate><label class="sr-only" for="col-name">New collection name</label>' +
      '<input id="col-name" type="text" maxlength="60" placeholder="New collection…" autocomplete="off"><button class="btn btn-icon" type="submit" aria-label="Create collection">' + icon('plus') + '</button></form>' +
      '<p class="form-error" id="col-error" role="alert"></p></aside>' +
      '<div class="vocab-main">' +
      '<form id="add-form" class="card add-card" novalidate><h2 class="card-title">Add a word</h2>' +
      '<div class="add-grid"><div class="field"><label for="f-en">English</label><input id="f-en" type="text" maxlength="200" autocomplete="off" spellcheck="false" placeholder="e.g. journey"></div>' +
      '<div class="field"><label for="f-uz">Uzbek translation</label><input id="f-uz" type="text" maxlength="200" autocomplete="off" spellcheck="false" placeholder="e.g. sayohat"></div>' +
      '<div class="field"><label for="f-col">Collection</label><select id="f-col"></select></div>' +
      '<button class="btn btn-primary add-btn" type="submit">' + icon('plus') + 'Add word</button></div>' +
      '<p class="form-error" id="add-error" role="alert"></p><p class="hint">Tip: separate alternative translations with “;” — the quiz accepts any of them.</p></form>' +
      '<section class="card"><div class="toolbar"><div class="search">' + icon('search') + '<label class="sr-only" for="v-search">Search words</label><input id="v-search" type="search" placeholder="Search English or Uzbek…" autocomplete="off"></div>' +
      '<label class="sr-only" for="v-sort">Sort</label><select id="v-sort"><option value="newest">Newest first</option><option value="en">English A–Z</option><option value="uz">Uzbek A–Z</option></select></div>' +
      '<div id="v-list"></div></section></div></div>';
    root.querySelector('#v-search').value = filter.q;
    root.querySelector('#v-sort').value = filter.sort;
  }

  function drawCollections() {
    const st = VL.store;
    const total = st.state.words.length;
    let html = '<li><button class="col-item' + (!filter.collection ? ' active' : '') + '" data-col="">' + '<span>All words</span><b>' + total + '</b></button></li>';
    st.state.collections.forEach((c) => {
      const n = st.wordsIn(c.id).length;
      const on = filter.collection === c.id;
      html += '<li class="col-row"><button class="col-item' + (on ? ' active' : '') + '" data-col="' + esc(c.id) + '"><span>' + esc(c.name) + '</span><b>' + n + '</b></button>' +
        (on ? '<span class="col-actions"><button class="icon-btn" data-action="rename-col" aria-label="Rename ' + esc(c.name) + '">' + icon('edit') + '</button>' +
          '<button class="icon-btn danger" data-action="delete-col" aria-label="Delete ' + esc(c.name) + '">' + icon('trash') + '</button></span>' : '') + '</li>';
    });
    root.querySelector('#v-collections').innerHTML = html;
    const sel = root.querySelector('#f-col');
    const cur = addCollectionId && st.collection(addCollectionId) ? addCollectionId : (filter.collection || st.state.collections[0].id);
    addCollectionId = cur;
    sel.innerHTML = VL.ui.collectionOptions(cur, false);
  }

  function drawList() {
    const all = visibleWords();
    const list = all.slice(0, filter.limit);
    const total = VL.store.state.words.length;
    root.querySelector('#v-count').textContent = plural(total, 'word') + ' in ' + plural(VL.store.state.collections.length, 'collection');
    const host = root.querySelector('#v-list');
    if (!total) { host.innerHTML = VL.ui.empty('No words yet', 'Use the form above to add your first word, or import a file.'); return; }
    if (!all.length) { host.innerHTML = VL.ui.empty('No matches', 'Try a different search or collection.'); return; }
    host.innerHTML =
      '<div class="table-wrap"><table class="words"><thead><tr><th scope="col">English</th><th scope="col">Uzbek</th><th scope="col" class="hide-sm">Collection</th><th scope="col" class="hide-sm">Status</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
      list.map((w) => {
        const c = VL.store.collection(w.collectionId);
        return '<tr data-id="' + esc(w.id) + '"><td class="strong">' + esc(w.en) + '</td><td>' + esc(w.uz) + '</td><td class="hide-sm"><span class="chip">' + esc(c ? c.name : '—') + '</span></td>' +
          '<td class="hide-sm">' + VL.ui.statusChip(w) + '</td><td class="row-actions"><button class="icon-btn" data-action="edit" aria-label="Edit ' + esc(w.en) + '">' + icon('edit') + '</button>' +
          '<button class="icon-btn danger" data-action="delete" aria-label="Delete ' + esc(w.en) + '">' + icon('trash') + '</button></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="list-foot muted small">Showing ' + list.length + ' of ' + all.length + (all.length > list.length ? ' <button class="btn btn-sm" data-action="more">Show more</button>' : '') + '</div>';
  }

  function drawAll() { drawCollections(); drawList(); }

  async function addWord(e) {
    e.preventDefault();
    const en = root.querySelector('#f-en'), uz = root.querySelector('#f-uz'), err = root.querySelector('#add-error');
    addCollectionId = root.querySelector('#f-col').value;
    const sent = { en: en.value, uz: uz.value };
    const r = await VL.store.addWord({ en: sent.en, uz: sent.uz, collectionId: addCollectionId });
    if (!r.ok) {
      err.textContent = r.error;
      (en.value.trim() ? uz : en).focus();
      return;
    }
    err.textContent = '';
    if (en.value === sent.en) en.value = '';   // don't wipe text typed while saving
    if (uz.value === sent.uz) uz.value = '';
    en.focus();
    VL.ui.toast('Added “' + r.word.en + '”.', 'success', 1800);
  }

  async function editWord(id) {
    const w = VL.store.word(id);
    if (!w) return;
    const body = document.createElement('div');
    body.innerHTML =
      '<div class="field"><label for="e-en">English</label><input id="e-en" data-autofocus type="text" maxlength="200" value="' + esc(w.en) + '"></div>' +
      '<div class="field"><label for="e-uz">Uzbek translation</label><input id="e-uz" type="text" maxlength="200" value="' + esc(w.uz) + '"></div>' +
      '<div class="field"><label for="e-col">Collection</label><select id="e-col">' + VL.ui.collectionOptions(w.collectionId, false) + '</select></div>' +
      '<p class="hint">Changing the wording resets this word’s progress.</p><p class="form-error" id="e-error" role="alert"></p>';
    await VL.ui.modal({
      title: 'Edit word', body,
      buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Save changes', value: 'save', kind: 'primary' }],
      async onButton(v) {
        if (v !== 'save') return true;
        const r = await VL.store.updateWord(id, { en: body.querySelector('#e-en').value, uz: body.querySelector('#e-uz').value, collectionId: body.querySelector('#e-col').value });
        if (!r.ok) { body.querySelector('#e-error').textContent = r.error; return false; }
        VL.ui.toast('Word updated.', 'success', 1800);
        return true;
      },
    });
  }

  async function deleteWord(id) {
    const w = VL.store.word(id);
    if (!w) return;
    if (await VL.ui.confirm({ title: 'Delete word?', message: '“' + w.en + ' — ' + w.uz + '” will be removed permanently.', confirmLabel: 'Delete', danger: true })) {
      await VL.store.deleteWords([id]);
      VL.ui.toast('Word deleted.', 'info', 1800);
    }
  }

  async function createCollection(e) {
    e.preventDefault();
    const input = root.querySelector('#col-name'), err = root.querySelector('#col-error');
    const r = await VL.store.addCollection(input.value);
    if (!r.ok) { err.textContent = r.error; input.focus(); return; }
    err.textContent = ''; input.value = '';
    filter.collection = r.collection.id; addCollectionId = r.collection.id;
    drawAll();
    VL.ui.toast('Collection “' + r.collection.name + '” created.', 'success', 1800);
  }

  async function renameCollection() {
    const c = VL.store.collection(filter.collection);
    if (!c) return;
    const body = document.createElement('div');
    body.innerHTML = '<div class="field"><label for="r-name">Collection name</label><input id="r-name" data-autofocus type="text" maxlength="60" value="' + esc(c.name) + '"></div><p class="form-error" id="r-error" role="alert"></p>';
    await VL.ui.modal({
      title: 'Rename collection', body,
      buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Save', value: 'save', kind: 'primary' }],
      async onButton(v) {
        if (v !== 'save') return true;
        const r = await VL.store.renameCollection(c.id, body.querySelector('#r-name').value);
        if (!r.ok) { body.querySelector('#r-error').textContent = r.error; return false; }
        return true;
      },
    });
  }

  async function deleteCollection() {
    const c = VL.store.collection(filter.collection);
    if (!c) return;
    if (VL.store.state.collections.length <= 1) { VL.ui.toast('You need at least one collection.', 'error'); return; }
    const n = VL.store.wordsIn(c.id).length;
    if (await VL.ui.confirm({ title: 'Delete collection?', message: '“' + c.name + '” and its ' + plural(n, 'word') + ' will be deleted permanently.', confirmLabel: 'Delete collection', danger: true })) {
      await VL.store.deleteCollection(c.id);
      filter.collection = ''; addCollectionId = null;
      drawAll();
    }
  }

  function onClick(e) {
    const colBtn = e.target.closest('[data-col]');
    if (colBtn) { filter.collection = colBtn.dataset.col; filter.limit = PAGE; if (filter.collection) addCollectionId = filter.collection; drawAll(); return; }
    const a = e.target.closest('[data-action]');
    if (!a) return;
    const id = a.closest('tr') ? a.closest('tr').dataset.id : null;
    switch (a.dataset.action) {
      case 'edit': editWord(id); break;
      case 'delete': deleteWord(id); break;
      case 'more': filter.limit += PAGE; drawList(); break;
      case 'rename-col': renameCollection(); break;
      case 'delete-col': deleteCollection(); break;
      case 'import': VL.io.openImportDialog(); break;
      case 'export': VL.io.exportCSV(); break;
    }
  }

  return {
    mount(el, params) {
      root = el;
      filter = { collection: '', q: '', sort: 'newest', limit: PAGE };
      addCollectionId = null;
      const want = params.get('collection');
      if (want && VL.store.collection(want)) { filter.collection = want; addCollectionId = want; }
      shell(); drawAll();
      root.addEventListener('click', onClick);
      root.querySelector('#add-form').addEventListener('submit', addWord);
      root.querySelector('#col-form').addEventListener('submit', createCollection);
      root.querySelector('#v-search').addEventListener('input', debounce((e) => { filter.q = e.target.value; filter.limit = PAGE; drawList(); }, 120));
      root.querySelector('#v-sort').addEventListener('change', (e) => { filter.sort = e.target.value; drawList(); });
      off = VL.store.onChange(() => { drawAll(); });
      if (params.get('add')) root.querySelector('#f-en').focus();
    },
    unmount() { if (off) off(); if (root) root.removeEventListener('click', onClick); },
  };
})();
