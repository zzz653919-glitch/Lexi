/* Custom sessions ("Yangi sessiya yaratish"): the user names a session, picks a topic, the words, how many
   exercises and which kinds. A session keeps its word list, its history of runs and the words that went wrong.
   Building the exercises is done by VL.learn.buildCustom, playing them by VL.player. */
VL.custom = (function () {
  const { esc, pct } = VL.util;
  const { icon } = VL.ui;
  const t = VL.t, n = VL.n;
  const store = VL.store, E = VL.learn;
  const COUNTS = ['5', '10', '15', '20', 'all'];
  const SOURCES = ['topic', 'specific', 'typed', 'collection', 'mistakes'];

  const topicById = (id) => VL.topics.find((x) => x.id === id);
  const sessionWords = (c) => c.wordIds.map((id) => store.word(id)).filter(Boolean);
  const lastRun = (c) => c.runs[c.runs.length - 1] || null;

  /* ---------- resolving the chosen source into real vocabulary words ---------- */
  async function installTopicWords(tp) {
    const out = [];
    if (tp.decks) {
      for (const dk of tp.decks) {
        for (const lvl of VL.deckLevels) {
          const col = await store.ensureDeckCollection(lvl.id + '.' + dk, lvl.id + ' · ' + (VL.deckTopics[dk][VL.i18n.lang] || VL.deckTopics[dk].en));
          await store.importWords(VL.decks[lvl.id][dk].map(([en, uz]) => ({ en, uz, collectionId: col.id })));
          out.push(...store.wordsIn(col.id));
        }
      }
    } else if (tp.words) {
      const col = await store.ensureDeckCollection('topic.' + tp.id, VL.topicName(tp));
      await store.importWords(tp.words.map(([en, uz]) => ({ en, uz, collectionId: col.id })));
      out.push(...store.wordsIn(col.id));
    }
    return out;
  }

  // -> { words } or { error }
  async function resolveWords(form) {
    const src = form.source;
    if (src === 'topic') {
      if (form.topicId === 'custom') {
        const q = form.topicText.toLowerCase();
        const cols = store.state.collections.filter((c) => c.name.toLowerCase().includes(q));
        const words = cols.flatMap((c) => store.wordsIn(c.id));
        return words.length ? { words } : { error: t('cs.errTopicEmpty', { x: form.topicText }) };
      }
      const tp = topicById(form.topicId);
      if (tp.own) {
        const own = store.state.collections.filter((c) => !c.deckKey).flatMap((c) => store.wordsIn(c.id));
        return own.length ? { words: own } : { error: t('cs.errNoOwn') };
      }
      return { words: await installTopicWords(tp) };
    }
    if (src === 'specific') return form.ids.length ? { words: form.ids.map((id) => store.word(id)).filter(Boolean) } : { error: t('cs.errPickWords') };
    if (src === 'collection') {
      const words = store.wordsIn(form.collectionId);
      return words.length ? { words } : { error: t('cs.errColEmpty') };
    }
    if (src === 'mistakes') {
      const words = store.mistakeWords();
      return words.length ? { words } : { error: t('cs.errNoMistakes') };
    }
    if (src === 'typed') {
      const parsed = VL.bulk.parse(form.typed, { max: 200 });
      if (!parsed.rows.length) return { error: t('cs.errTyped') };
      const found = [], missing = [], fresh = [];
      parsed.rows.forEach((r) => {
        const key = VL.quiz.normalize(r.en, false);
        const have = store.state.words.find((w) => VL.quiz.normalize(w.en, false) === key);
        if (have) found.push(have);
        else if (r.uz) fresh.push(r);
        else missing.push(r.en);
      });
      if (missing.length) return { error: t('cs.errNoTranslation', { x: missing.slice(0, 5).join(', ') }) };
      if (fresh.length) {
        const col = await store.ensureDeckCollection('session.typed', t('cs.typedCollection'));
        await store.importWords(fresh.map((r) => ({ en: r.en, uz: r.uz, example: r.example, collectionId: col.id })));
        fresh.forEach((r) => { const w = store.state.words.find((x) => x.collectionId === col.id && VL.quiz.normalize(x.en, false) === VL.quiz.normalize(r.en, false)); if (w) found.push(w); });
      }
      return found.length ? { words: found } : { error: t('cs.errTyped') };
    }
    return { error: t('cs.errPickWords') };
  }

  /* ---------- the creation window ---------- */
  function typeLabel(k) { return t('cs.type.' + k); }

  async function create(root, hooks, preset) {
    const p = preset || {};
    const body = document.createElement('div');
    body.className = 'cs-form';
    const lang = VL.i18n.lang;
    const speech = VL.speech.supported;
    const defName = t('cs.defName', { n: store.state.custom.length + 1 });
    body.innerHTML =
      '<div class="field"><label for="cs-name">' + esc(t('cs.name')) + '</label><input id="cs-name" data-autofocus type="text" maxlength="60" autocomplete="off" value="' + esc(p.name || defName) + '"></div>' +
      '<div class="field"><label for="cs-topic">' + esc(t('cs.topic')) + '</label><select id="cs-topic">' + VL.topics.map((tp) => '<option value="' + tp.id + '"' + (p.topicId === tp.id ? ' selected' : '') + '>' + esc(VL.topicName(tp)) + '</option>').join('') + '<option value="custom">' + esc(t('cs.topicCustom')) + '</option></select>' +
      '<input id="cs-topic-text" type="text" maxlength="60" autocomplete="off" hidden placeholder="' + esc(t('cs.topicPh')) + '" aria-label="' + esc(t('cs.topicCustom')) + '"></div>' +
      '<fieldset class="field"><legend>' + esc(t('cs.words')) + '</legend><div class="cs-radios">' + SOURCES.map((k) => '<label class="check"><input type="radio" name="cs-src" value="' + k + '"' + ((p.source || 'topic') === k ? ' checked' : '') + '><span>' + esc(t('cs.src.' + k)) + '</span></label>').join('') + '</div></fieldset>' +
      '<div class="field" id="cs-p-specific" hidden><input id="cs-find" type="search" autocomplete="off" placeholder="' + esc(t('cs.find')) + '" aria-label="' + esc(t('cs.find')) + '"><div class="cs-pick" id="cs-pick" role="group" aria-label="' + esc(t('cs.src.specific')) + '"></div><p class="hint" id="cs-picked"></p></div>' +
      '<div class="field" id="cs-p-typed" hidden><label for="cs-typed">' + esc(t('cs.typedLabel')) + '</label><textarea id="cs-typed" rows="5" spellcheck="false" placeholder="' + esc(t('cs.typedPh')) + '"></textarea><p class="hint">' + esc(t('cs.typedHint')) + '</p></div>' +
      '<div class="field" id="cs-p-collection" hidden><label for="cs-col">' + esc(t('cs.collection')) + '</label><select id="cs-col">' + store.state.collections.map((c) => '<option value="' + c.id + '">' + esc(c.name + ' (' + store.wordsIn(c.id).length + ')') + '</option>').join('') + '</select></div>' +
      '<p class="hint" id="cs-info"></p>' +
      '<div class="field"><label for="cs-count">' + esc(t('cs.count')) + '</label><select id="cs-count">' + COUNTS.map((c) => '<option value="' + c + '"' + (String(p.count || '10') === c ? ' selected' : '') + '>' + esc(c === 'all' ? t('cs.countAll') : n('n.exercise', Number(c))) + '</option>').join('') + '</select></div>' +
      '<fieldset class="field"><legend>' + esc(t('cs.types')) + '</legend><div class="cs-types">' + E.CUSTOM_TYPES.map((k) => {
        const off = k === 'listen' && !speech;
        return '<label class="check' + (off ? ' is-off' : '') + '"><input type="checkbox" name="cs-type" value="' + k + '"' + (off ? ' disabled' : '') + ((p.types || []).includes(k) ? ' checked' : '') + '><span>' + esc(typeLabel(k)) + (off ? ' — ' + esc(t('cs.noSpeech')) : '') + '</span></label>';
      }).join('') + '</div><p class="hint">' + esc(t('cs.typesHint')) + '</p></fieldset>' +
      '<p class="form-error" id="cs-error" role="alert"></p>';
    const $ = (s) => body.querySelector(s);
    const $$ = (s) => Array.from(body.querySelectorAll(s));
    const source = () => ($('input[name="cs-src"]:checked') || {}).value;
    const checked = new Set();

    const drawPick = () => {
      const q = $('#cs-find').value.trim().toLowerCase();
      const list = store.state.words.filter((w) => !q || w.en.toLowerCase().includes(q) || w.uz.toLowerCase().includes(q)).slice(0, 300);
      $('#cs-pick').innerHTML = list.length ? list.map((w) => '<label class="check"><input type="checkbox" data-wid="' + w.id + '"' + (checked.has(w.id) ? ' checked' : '') + '><span><b>' + esc(w.en) + '</b> — ' + esc(E.primary(w.uz)) + '</span></label>').join('') : '<p class="muted">' + esc(t('cs.noMatch')) + '</p>';
      $('#cs-picked').textContent = t('cs.picked', { n: checked.size });
    };
    const refresh = () => {
      const src = source();
      $('#cs-topic-text').hidden = $('#cs-topic').value !== 'custom';
      $('#cs-p-specific').hidden = src !== 'specific';
      $('#cs-p-typed').hidden = src !== 'typed';
      $('#cs-p-collection').hidden = src !== 'collection';
      let info = '';
      if (src === 'topic') {
        const tp = topicById($('#cs-topic').value);
        if (tp && tp.own) info = t('cs.infoOwn');
        else if (tp) info = t('cs.infoTopic');
      } else if (src === 'mistakes') info = t('cs.infoMistakes', { n: store.mistakeWords().length });
      $('#cs-info').textContent = info;
      if (src === 'specific') drawPick();
    };
    body.addEventListener('input', (e) => {
      if (e.target.id === 'cs-find') drawPick();
      else if (e.target.dataset && e.target.dataset.wid) { if (e.target.checked) checked.add(e.target.dataset.wid); else checked.delete(e.target.dataset.wid); $('#cs-picked').textContent = t('cs.picked', { n: checked.size }); }
    });
    body.addEventListener('change', (e) => { if (!(e.target.dataset && e.target.dataset.wid)) refresh(); });
    (p.ids || []).forEach((id) => checked.add(id));

    let created = null;
    const buttons = [{ label: t('btn.cancel'), value: 'cancel' }, { label: t('cs.saveOnly'), value: 'save' }, { label: t('cs.createStart'), value: 'start', kind: 'primary' }];
    const result = await VL.ui.modal({
      title: t('cs.new'), body, buttons, wide: true,
      onOpen: refresh,
      async onButton(v) {
        if (v === 'cancel') return true;
        const err = (m) => { $('#cs-error').textContent = m; return false; };
        const name = $('#cs-name').value.replace(/\s+/g, ' ').trim();
        if (!name) return err(t('cs.errName'));
        if (name.length > 60) return err(t('cs.errNameLong'));
        const topicId = $('#cs-topic').value;
        const topicText = $('#cs-topic-text').value.replace(/\s+/g, ' ').trim();
        if (topicId === 'custom' && !topicText) return err(t('cs.errTopic'));
        const form = { source: source(), topicId, topicText, ids: Array.from(checked), collectionId: $('#cs-col') ? $('#cs-col').value : '', typed: $('#cs-typed').value };
        const r = await resolveWords(form);
        if (r.error) return err(r.error);
        const seen = new Set();
        const words = r.words.filter((w) => w && !seen.has(w.id) && seen.add(w.id));
        if (!words.length) return err(t('cs.errPickWords'));
        const types = $$('input[name="cs-type"]:checked').map((x) => x.value);
        created = await store.addCustom({
          name, topicId, topic: topicId === 'custom' ? topicText : VL.topicName(topicById(topicId)), source: form.source,
          wordIds: words.map((w) => w.id), count: $('#cs-count').value, types: types.length ? types : E.CUSTOM_DEFAULT.slice(),
        });
        return true;
      },
    });
    if (!created) return null;
    VL.ui.toast(t('cs.created', { name: created.name }), 'success', 2200);
    if (result === 'start') await start(root, created.id, hooks);
    else if (hooks && hooks.onExit && !VL.player.active()) hooks.onExit();
    return created;
  }

  /* ---------- playing ---------- */
  async function start(root, id, hooks, opts) {
    const c = store.customSession(id);
    if (!c) return false;
    const words = sessionWords(c);
    if (!words.length) { VL.ui.toast(t('cs.errGone'), 'error'); return false; }
    if (store.state.lesson && !(opts && opts.replace)) {
      const ok = await VL.ui.confirm({ title: t('cs.replaceTitle'), message: t('cs.replaceMsg'), confirmLabel: t('cs.replaceYes'), danger: true });
      if (!ok) return false;
    }
    await VL.player.start(root, { type: 'session', words, count: c.count, types: c.types, custom: { id: c.id, name: c.name, topic: c.topic } }, hooks);
    return true;
  }

  /* ---------- the "Sessions" tab ---------- */
  function runLine(r) {
    return new Date(r.date).toLocaleString(VL.i18n.locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' · ' + r.correct + ' / ' + r.total + ' · ' + r.pct + '%' + (r.mode === 'mistakes' ? ' · ' + t('cs.modeMistakes') : '');
  }

  const openHistory = new Set();
  function tabHtml() {
    const list = store.state.custom.slice().reverse();
    const mistakes = store.mistakeWords().length;
    let html = '<section class="card"><div class="tab-head"><p class="muted">' + esc(t('cs.intro')) + '</p><div class="btn-row">' +
      '<button class="btn btn-primary" data-action="cs-new">' + icon('plus') + esc(t('cs.new')) + '</button>' +
      (mistakes ? '<button class="btn" data-action="cs-from-mistakes">' + icon('refresh') + esc(t('cs.fromMistakes', { n: mistakes })) + '</button>' : '') + '</div></div></section>';
    if (!list.length) return html + '<section class="card">' + '<p class="muted">' + esc(t('cs.empty')) + '</p></section>';
    html += '<div class="cs-list">';
    list.forEach((c) => {
      const lr = lastRun(c);
      const open = openHistory.has(c.id);
      const words = sessionWords(c).length;
      html += '<article class="card cs-card" data-cs="' + c.id + '"><div class="cs-head"><h3>' + esc(c.name) + '</h3><span class="chip">' + esc(c.topic) + '</span></div>' +
        '<p class="muted small">' + esc(n('n.word', words)) + ' · ' + esc(c.count === 'all' ? t('cs.countAll') : n('n.exercise', Number(c.count))) + ' · ' + esc(c.types.map(typeLabel).join(', ')) + '</p>' +
        (lr ? '<p class="cs-last">' + esc(t('cs.last')) + ': <b>' + lr.pct + '%</b> (' + lr.correct + ' / ' + lr.total + ') · ' + esc(n('n.run', c.runs.length)) + '</p><div class="bar"><span style="width:' + lr.pct + '%"></span></div>' : '<p class="muted small">' + esc(t('cs.notPlayed')) + '</p>') +
        '<div class="btn-row"><button class="btn btn-primary btn-sm" data-action="cs-start">' + icon('play') + esc(t(lr ? 'cs.restart' : 'cs.start')) + '</button>' +
        (lr && lr.missedIds && lr.missedIds.length ? '<button class="btn btn-sm" data-action="cs-mistakes">' + esc(t('cs.onlyMistakes')) + '</button>' : '') +
        '<button class="btn btn-sm btn-ghost" data-action="cs-history" aria-expanded="' + open + '">' + esc(t('cs.history')) + '</button>' +
        '<button class="btn btn-sm btn-ghost" data-action="cs-rename">' + esc(t('btn.rename')) + '</button>' +
        '<button class="btn btn-sm btn-ghost" data-action="cs-delete">' + esc(t('btn.delete')) + '</button></div>' +
        (open ? (c.runs.length ? '<ul class="cs-runs">' + c.runs.slice().reverse().map((r) => '<li>' + esc(runLine(r)) + '</li>').join('') + '</ul>' : '<p class="muted small">' + esc(t('cs.notPlayed')) + '</p>') : '') + '</article>';
    });
    return html + '</div>';
  }

  // returns true when the action was handled (the caller redraws)
  async function onAction(action, el, root, hooks, redraw) {
    const card = el.closest('[data-cs]');
    const id = card ? card.dataset.cs : null;
    switch (action) {
      case 'cs-new': await create(root, hooks); redraw(); return true;
      case 'cs-start': await start(root, id, hooks); return true;
      case 'cs-mistakes': await startMistakes(root, id, hooks); return true;
      case 'cs-history': if (openHistory.has(id)) openHistory.delete(id); else openHistory.add(id); redraw(); return true;
      case 'cs-rename': await renameDialog(id); redraw(); return true;
      case 'cs-delete': {
        const c = store.customSession(id);
        if (c && await VL.ui.confirm({ title: t('btn.delete'), message: t('cs.deleteMsg', { name: c.name }), confirmLabel: t('btn.delete'), danger: true })) { await store.removeCustom(id); VL.ui.toast(t('cs.deleted'), 'info', 1800); }
        redraw(); return true;
      }
      case 'cs-from-mistakes': await create(root, hooks, { name: t('cs.mistakesName'), source: 'mistakes', topicId: 'own' }); redraw(); return true;
    }
    return false;
  }

  async function renameDialog(id) {
    const c = store.customSession(id);
    if (!c) return;
    const body = document.createElement('div');
    body.innerHTML = '<div class="field"><label for="cs-rn">' + esc(t('cs.name')) + '</label><input id="cs-rn" data-autofocus type="text" maxlength="60" autocomplete="off" value="' + esc(c.name) + '"></div><p class="form-error" id="cs-rn-err" role="alert"></p>';
    await VL.ui.modal({
      title: t('btn.rename'), body, buttons: [{ label: t('btn.cancel'), value: 'cancel' }, { label: t('btn.save'), value: 'save', kind: 'primary' }],
      async onButton(v) {
        if (v !== 'save') return true;
        const r = await store.renameCustom(id, body.querySelector('#cs-rn').value);
        if (!r.ok) { body.querySelector('#cs-rn-err').textContent = r.error; return false; }
        return true;
      },
    });
  }

  // a run of only the words that went wrong in the session's last run
  async function startMistakes(root, id, hooks) {
    const c = store.customSession(id);
    const lr = c && lastRun(c);
    if (!lr || !lr.missedIds || !lr.missedIds.length) return false;
    const words = lr.missedIds.map((w) => store.word(w)).filter(Boolean);
    if (!words.length) return false;
    if (store.state.lesson) {
      const ok = await VL.ui.confirm({ title: t('cs.replaceTitle'), message: t('cs.replaceMsg'), confirmLabel: t('cs.replaceYes'), danger: true });
      if (!ok) return false;
    }
    await VL.player.start(root, { type: 'session', mode: 'mistakes', words, count: Math.max(5, words.length * 2), types: c.types, custom: { id: c.id, name: c.name, topic: c.topic } }, hooks);
    return true;
  }

  return { create, start, startMistakes, tabHtml, onAction, resolveWords, sessionWords };
})();
