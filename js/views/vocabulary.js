VL.views.vocabulary = (function () {
  const { esc, debounce } = VL.util;
  const t = VL.t, n = VL.n;
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
      '<header class="page-head"><div><h1>' + esc(t('nav.vocabulary')) + '</h1><p class="muted" id="v-count"></p></div>' +
      '<div class="btn-row"><button class="btn" data-action="import">' + icon('upload') + esc(t('btn.import')) + '</button>' +
      '<button class="btn" data-action="export">' + icon('download') + esc(t('btn.exportCsv')) + '</button></div></header>' +
      '<div class="vocab-layout">' +
      '<aside class="card collections" aria-label="' + esc(t('dash.collections')) + '"><h2 class="card-title">' + esc(t('dash.collections')) + '</h2><ul id="v-collections"></ul>' +
      '<form id="col-form" class="inline-form" novalidate><label class="sr-only" for="col-name">' + esc(t('vocab.newColAria')) + '</label>' +
      '<input id="col-name" type="text" maxlength="60" placeholder="' + esc(t('vocab.newCol')) + '" autocomplete="off"><button class="btn btn-icon" type="submit" aria-label="' + esc(t('vocab.createCol')) + '">' + icon('plus') + '</button></form>' +
      '<p class="form-error" id="col-error" role="alert"></p></aside>' +
      '<div class="vocab-main">' +
      '<form id="add-form" class="card add-card" novalidate><h2 class="card-title">' + esc(t('vocab.addTitle')) + '</h2>' +
      '<div class="add-grid"><div class="field"><label for="f-en">' + esc(t('field.english')) + '</label><input id="f-en" type="text" maxlength="200" autocomplete="off" spellcheck="false" placeholder="' + esc(t('ph.en')) + '"></div>' +
      '<div class="field"><label for="f-uz">' + esc(t('field.uzbek')) + '</label><input id="f-uz" type="text" maxlength="200" autocomplete="off" spellcheck="false" placeholder="' + esc(t('ph.uz')) + '"></div>' +
      '<div class="field"><label for="f-col">' + esc(t('field.collection')) + '</label><select id="f-col"></select></div>' +
      '<button class="btn btn-primary add-btn" type="submit">' + icon('plus') + esc(t('btn.addWord')) + '</button>' +
      '<div class="field add-example"><label for="f-ex">' + esc(t('field.example')) + '</label><input id="f-ex" type="text" maxlength="300" autocomplete="off" placeholder="' + esc(t('ph.example')) + '"></div>' +
      '</div>' +
      '<p class="form-error" id="add-error" role="alert"></p><p class="hint">' + esc(t('vocab.tip')) + '</p></form>' +
      '<section class="card"><div class="toolbar"><div class="search">' + icon('search') + '<label class="sr-only" for="v-search">' + esc(t('vocab.searchAria')) + '</label><input id="v-search" type="search" placeholder="' + esc(t('vocab.search')) + '" autocomplete="off"></div>' +
      '<label class="sr-only" for="v-sort">' + esc(t('vocab.sortAria')) + '</label><select id="v-sort"><option value="newest">' + esc(t('sort.newest')) + '</option><option value="en">' + esc(t('sort.en')) + '</option><option value="uz">' + esc(t('sort.uz')) + '</option></select></div>' +
      '<div id="v-list"></div></section></div></div>';
    root.querySelector('#v-search').value = filter.q;
    root.querySelector('#v-sort').value = filter.sort;
  }

  function drawCollections() {
    const st = VL.store;
    const total = st.state.words.length;
    let html = '<li><button class="col-item' + (!filter.collection ? ' active' : '') + '" data-col="">' + '<span>' + esc(t('col.all')) + '</span><b>' + total + '</b></button></li>';
    st.state.collections.forEach((c) => {
      const n = st.wordsIn(c.id).length;
      const on = filter.collection === c.id;
      html += '<li class="col-row"><button class="col-item' + (on ? ' active' : '') + '" data-col="' + esc(c.id) + '"><span>' + esc(c.name) + '</span><b>' + n + '</b></button>' +
        (on ? '<span class="col-actions"><button class="icon-btn" data-action="rename-col" aria-label="' + esc(t('col.renameAria', { name: c.name })) + '">' + icon('edit') + '</button>' +
          '<button class="icon-btn danger" data-action="delete-col" aria-label="' + esc(t('col.deleteAria', { name: c.name })) + '">' + icon('trash') + '</button></span>' : '') + '</li>';
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
    root.querySelector('#v-count').textContent = t('vocab.count', { w: n('n.word', total), c: n('n.collection', VL.store.state.collections.length) });
    const host = root.querySelector('#v-list');
    if (!total) { host.innerHTML = VL.ui.empty(t('vocab.noWords'), t('vocab.noWordsText')); return; }
    if (!all.length) { host.innerHTML = VL.ui.empty(t('vocab.noMatches'), t('vocab.noMatchesText')); return; }
    host.innerHTML =
      '<div class="table-wrap"><table class="words"><thead><tr><th scope="col">' + esc(t('th.english')) + '</th><th scope="col">' + esc(t('th.uzbek')) + '</th><th scope="col" class="hide-sm">' + esc(t('th.collection')) + '</th><th scope="col" class="hide-sm">' + esc(t('th.status')) + '</th><th scope="col"><span class="sr-only">' + esc(t('th.actions')) + '</span></th></tr></thead><tbody>' +
      list.map((w) => {
        const c = VL.store.collection(w.collectionId);
        return '<tr data-id="' + esc(w.id) + '"><td class="strong"><span class="word-cell">' + esc(w.en) + VL.speech.button(w.en) + '</span></td><td>' + esc(w.uz) + (w.example ? '<div class="word-example">' + esc(w.example) + '</div>' : '') + '</td><td class="hide-sm"><span class="chip">' + esc(c ? c.name : '—') + '</span></td>' +
          '<td class="hide-sm">' + VL.ui.statusChip(w) + '</td><td class="row-actions"><button class="icon-btn" data-action="edit" aria-label="' + esc(t('vocab.editAria', { w: w.en })) + '">' + icon('edit') + '</button>' +
          '<button class="icon-btn danger" data-action="delete" aria-label="' + esc(t('vocab.deleteAria', { w: w.en })) + '">' + icon('trash') + '</button></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="list-foot muted small">' + esc(t('vocab.showing', { a: list.length, b: all.length })) + (all.length > list.length ? ' <button class="btn btn-sm" data-action="more">' + esc(t('btn.showMore')) + '</button>' : '') + '</div>';
  }

  function drawAll() { drawCollections(); drawList(); }

  async function addWord(e) {
    e.preventDefault();
    const en = root.querySelector('#f-en'), uz = root.querySelector('#f-uz'), err = root.querySelector('#add-error');
    addCollectionId = root.querySelector('#f-col').value;
    const ex = root.querySelector('#f-ex');
    const sent = { en: en.value, uz: uz.value, ex: ex.value };
    const r = await VL.store.addWord({ en: sent.en, uz: sent.uz, example: sent.ex, collectionId: addCollectionId });
    if (!r.ok) {
      err.textContent = r.error;
      (en.value.trim() ? uz : en).focus();
      return;
    }
    err.textContent = '';
    if (en.value === sent.en) en.value = '';   // don't wipe text typed while saving
    if (uz.value === sent.uz) uz.value = '';
    if (ex.value === sent.ex) ex.value = '';
    en.focus();
    VL.ui.toast(t('vocab.added', { en: r.word.en }), 'success', 1800);
  }

  const editWord = (id) => VL.wd.wordDialog({ id });
  const deleteWord = (id) => VL.wd.confirmDeleteWord(id);

  async function createCollection(e) {
    e.preventDefault();
    const input = root.querySelector('#col-name'), err = root.querySelector('#col-error');
    const r = await VL.store.addCollection(input.value);
    if (!r.ok) { err.textContent = r.error; input.focus(); return; }
    err.textContent = ''; input.value = '';
    filter.collection = r.collection.id; addCollectionId = r.collection.id;
    drawAll();
    VL.ui.toast(t('col.created', { name: r.collection.name }), 'success', 1800);
  }

  const renameCollection = () => { if (filter.collection) VL.wd.collectionDialog(filter.collection); };

  async function deleteCollection() {
    if (!filter.collection) return;
    if (await VL.wd.deleteCollectionDialog(filter.collection)) { filter.collection = ''; addCollectionId = null; drawAll(); }
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
