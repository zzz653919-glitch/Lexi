/* Shared dialogs for words and collections (used by My Vocabulary and Word Lessons). */
VL.wd = (function () {
  const { esc } = VL.util;
  const t = VL.t, n = VL.n;
  const store = VL.store;

  /* Add (id == null) or edit a word. `collectionId` preselects the collection when adding. */
  async function wordDialog(opts) {
    const w = opts.id ? store.word(opts.id) : null;
    if (opts.id && !w) return null;
    const body = document.createElement('div');
    body.innerHTML =
      '<div class="field"><label for="e-en">' + esc(t('field.english')) + '</label><input id="e-en" data-autofocus type="text" maxlength="200" autocomplete="off" spellcheck="false" placeholder="' + esc(t('ph.en')) + '" value="' + esc(w ? w.en : '') + '"></div>' +
      '<div class="field"><label for="e-uz">' + esc(t('field.uzbek')) + '</label><input id="e-uz" type="text" maxlength="200" autocomplete="off" spellcheck="false" placeholder="' + esc(t('ph.uz')) + '" value="' + esc(w ? w.uz : '') + '"></div>' +
      '<div class="field"><label for="e-ex">' + esc(t('field.example')) + '</label><input id="e-ex" type="text" maxlength="300" autocomplete="off" placeholder="' + esc(t('ph.example')) + '" value="' + esc(w ? w.example : '') + '"></div>' +
      '<div class="field"><label for="e-ph">' + esc(t('field.phonetic')) + '</label><input id="e-ph" type="text" maxlength="100" autocomplete="off" spellcheck="false" placeholder="' + esc(t('ph.phonetic')) + '" value="' + esc(w ? w.phonetic : '') + '"></div>' +
      '<details class="more-opts"' + (w && ((w.alts && w.alts.length) || w.sense || w.pos) ? ' open' : '') + '><summary>' + esc(t('wd.more')) + '</summary>' +
      '<div class="field"><label for="e-alts">' + esc(t('field.alts')) + '</label><textarea id="e-alts" rows="3" maxlength="1200" spellcheck="false" placeholder="' + esc(t('ph.alts')) + '">' + esc(w ? VL.answers.formatAlts(w.alts) : '') + '</textarea><p class="hint">' + esc(t('hint.alts')) + '</p></div>' +
      '<div class="field"><label for="e-sense">' + esc(t('field.sense')) + '</label><input id="e-sense" type="text" maxlength="200" autocomplete="off" placeholder="' + esc(t('ph.sense')) + '" value="' + esc(w ? w.sense : '') + '"></div>' +
      '<div class="field"><label for="e-pos">' + esc(t('field.pos')) + '</label><select id="e-pos"><option value="">—</option>' + VL.answers.POS.map((p) => '<option value="' + p + '"' + (w && w.pos === p ? ' selected' : '') + '>' + esc(t('pos.' + p)) + '</option>').join('') + '</select></div></details>' +
      '<div class="field"><label for="e-col">' + esc(t('field.collection')) + '</label><select id="e-col">' + VL.ui.collectionOptions(w ? w.collectionId : opts.collectionId, false) + '</select></div>' +
      (w ? '<p class="hint">' + esc(t('edit.hint')) + '</p>' : '') + '<p class="form-error" id="e-error" role="alert"></p>';
    const $ = (s) => body.querySelector(s);
    const read = () => ({ en: $('#e-en').value, uz: $('#e-uz').value, example: $('#e-ex').value, phonetic: $('#e-ph').value, alts: $('#e-alts').value, sense: $('#e-sense').value, pos: $('#e-pos').value, collectionId: $('#e-col').value });
    const buttons = [{ label: t('btn.cancel'), value: 'cancel' }];
    if (!w) buttons.push({ label: t('wd.addMore'), value: 'more' });
    buttons.push({ label: w ? t('btn.saveChanges') : t('btn.save'), value: 'save', kind: 'primary' });
    return VL.ui.modal({
      title: w ? t('edit.title') : t('vocab.addTitle'), body, buttons,
      async onButton(v) {
        if (v === 'cancel') return true;
        const input = read();
        const r = w ? await store.updateWord(w.id, input) : await store.addWord(input);
        if (!r.ok) { $('#e-error').textContent = r.error; return false; }
        VL.ui.toast(t(w ? 'vocab.updated' : 'vocab.added', { en: r.word.en }), 'success', 1800);
        if (v === 'more') { $('#e-en').value = ''; $('#e-uz').value = ''; $('#e-ex').value = ''; $('#e-ph').value = ''; $('#e-alts').value = ''; $('#e-sense').value = ''; $('#e-pos').value = ''; $('#e-error').textContent = ''; $('#e-en').focus(); return false; }
        return true;
      },
    });
  }

  async function confirmDeleteWord(id) {
    const w = store.word(id);
    if (!w) return false;
    const ok = await VL.ui.confirm({ title: t('del.title'), message: t('del.msg', { en: w.en, uz: w.uz }), confirmLabel: t('btn.delete'), danger: true });
    if (ok) { await store.deleteWords([id]); VL.ui.toast(t('vocab.deleted'), 'info', 1800); }
    return ok;
  }

  async function collectionDialog(id) {
    const c = id ? store.collection(id) : null;
    const body = document.createElement('div');
    body.innerHTML = '<div class="field"><label for="r-name">' + esc(t('col.name')) + '</label><input id="r-name" data-autofocus type="text" maxlength="60" autocomplete="off" value="' + esc(c ? c.name : '') + '"></div><p class="form-error" id="r-error" role="alert"></p>';
    let created = null;
    await VL.ui.modal({
      title: c ? t('col.renameTitle') : t('colt.new'), body,
      buttons: [{ label: t('btn.cancel'), value: 'cancel' }, { label: t('btn.save'), value: 'save', kind: 'primary' }],
      async onButton(v) {
        if (v !== 'save') return true;
        const name = body.querySelector('#r-name').value;
        const r = c ? await store.renameCollection(c.id, name) : await store.addCollection(name);
        if (!r.ok) { body.querySelector('#r-error').textContent = r.error; return false; }
        created = r.collection || c;
        if (!c) VL.ui.toast(t('col.created', { name: r.collection.name }), 'success', 1800);
        return true;
      },
    });
    return created;
  }

  async function deleteCollectionDialog(id) {
    const c = store.collection(id);
    if (!c) return false;
    if (store.state.collections.length <= 1) { VL.ui.toast(t('err.lastCollection'), 'error'); return false; }
    const cnt = store.wordsIn(id).length;
    const ok = await VL.ui.confirm({ title: t('col.delTitle'), message: t('col.delMsg', { name: c.name, w: n('n.word', cnt) }), confirmLabel: t('col.delBtn'), danger: true });
    if (ok) {
      await store.deleteCollection(id);
      const sel = (store.state.settings.learnSelected || []).filter((x) => x !== id);
      if (sel.length !== (store.state.settings.learnSelected || []).length) await store.setSetting('learnSelected', sel);
    }
    return ok;
  }

  return { wordDialog, confirmDeleteWord, collectionDialog, deleteCollectionDialog };
})();
