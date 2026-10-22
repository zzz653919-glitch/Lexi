/* Small UI toolkit: icons, toasts, modal dialogs, downloads. */
VL.ui = (function () {
  const { esc } = VL.util;

  const icon = (name, cls) => '<svg class="icon ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';

  function toast(message, kind, ms) {
    const host = document.getElementById('toasts');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'toast toast-' + (kind || 'info');
    el.textContent = message;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 250); }, ms || 3200);
  }

  /* buttons: [{ label, value, kind: 'primary'|'danger'|'ghost' }]
     onButton(value, dialog) may return false (or a promise of false) to keep the dialog open.
     Resolves with the clicked value, or null when dismissed. */
  function modal(opts) {
    return new Promise((resolve) => {
      const dlg = document.createElement('dialog');
      dlg.className = 'modal' + (opts.wide ? ' modal-wide' : '');
      dlg.setAttribute('aria-labelledby', 'modal-title');
      dlg.innerHTML =
        '<div class="modal-card">' +
        '<header class="modal-head"><h2 id="modal-title">' + esc(opts.title) + '</h2>' +
        '<button type="button" class="icon-btn" data-dismiss aria-label="' + esc(VL.t('btn.close')) + '">' + icon('x') + '</button></header>' +
        '<div class="modal-body"></div>' +
        '<footer class="modal-foot"></footer></div>';
      const body = dlg.querySelector('.modal-body');
      if (typeof opts.body === 'string') body.innerHTML = opts.body; else if (opts.body) body.appendChild(opts.body);
      const foot = dlg.querySelector('.modal-foot');
      let primary = null;
      (opts.buttons || []).forEach((b) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-' + (b.kind || 'ghost');
        btn.textContent = b.label;
        btn.dataset.value = b.value;
        if (b.kind === 'primary' || b.kind === 'danger') primary = primary || btn;
        foot.appendChild(btn);
      });
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        if (dlg.open) dlg.close();
        dlg.remove();
        resolve(value);
      };
      dlg.addEventListener('click', async (e) => {
        if (e.target === dlg || e.target.closest('[data-dismiss]')) return finish(null);
        const btn = e.target.closest('.modal-foot .btn');
        if (!btn || btn.disabled) return;
        const value = btn.dataset.value;
        const keep = opts.onButton ? await opts.onButton(value, dlg) : true;
        if (keep !== false) finish(value);
      });
      dlg.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && primary && e.target.tagName === 'INPUT' && !e.isComposing) { e.preventDefault(); primary.click(); }
      });
      dlg.addEventListener('cancel', (e) => { e.preventDefault(); finish(null); });
      document.body.appendChild(dlg);
      dlg.showModal();
      const first = dlg.querySelector('[data-autofocus]') || dlg.querySelector('input, select, textarea') || primary;
      if (first) first.focus();
      if (opts.onOpen) opts.onOpen(dlg);
    });
  }

  async function confirm(opts) {
    const v = await modal({
      title: opts.title,
      body: '<p class="modal-text">' + esc(opts.message) + '</p>',
      buttons: [{ label: VL.t('btn.cancel'), value: 'no' }, { label: opts.confirmLabel || VL.t('btn.confirm'), value: 'yes', kind: opts.danger ? 'danger' : 'primary' }],
    });
    return v === 'yes';
  }

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const empty = (title, text, actionsHtml) =>
    '<div class="empty"><div class="empty-art" aria-hidden="true">' + icon('book') + '</div><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' + (actionsHtml || '') + '</div>';

  const collectionOptions = (selectedId, withAll) =>
    (withAll ? '<option value="">' + esc(VL.t('opt.allCollections')) + '</option>' : '') +
    VL.store.state.collections.map((c) => '<option value="' + esc(c.id) + '"' + (c.id === selectedId ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('');

  const statusChip = (w) => {
    const s = VL.store.status(w);
    const label = VL.t('st.' + s);
    return '<span class="chip chip-' + s + '">' + label + '</span>';
  };

  // Human-readable label for a saved quiz session, in the current UI language.
  function sessionLabel(s) {
    if (s.kind === 'lesson') return VL.t('learn.sessionLabel', { type: VL.t('ex.' + (s.mode || 'mixed')) });
    if (!s.scope) return s.label || '';
    let scope;
    if (s.scope === 'all') scope = VL.t('scope.allShort');
    else if (s.scope === 'difficult') scope = VL.t('scope.difficult');
    else if (s.scope === 'missed') scope = VL.t('scope.missed');
    else { const c = VL.store.collection(s.scope); scope = c ? c.name : (s.collectionName || VL.t('scope.collection')); }
    return scope + ' · ' + VL.t('dir.' + s.direction);
  }

  return { sessionLabel, icon, toast, modal, confirm, download, empty, collectionOptions, statusChip };
})();
