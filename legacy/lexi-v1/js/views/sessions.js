/* "Yangi sessiya yaratish" page: the list of the user's sessions with the creation button (see custom-sessions.js). */
VL.views.sessions = (function () {
  const { esc } = VL.util;
  const t = VL.t;
  let root, off;
  const hooks = () => ({ onExit: draw });
  function draw() {
    root.innerHTML = '<header class="page-head"><div><h1>' + esc(t('nav.sessions')) + '</h1><p class="muted">' + esc(t('sessions.sub')) + '</p></div></header>' + VL.custom.tabHtml();
  }
  async function onClick(e) {
    if (VL.player.active()) return;
    const a = e.target.closest('[data-action]');
    if (a && a.dataset.action.startsWith('cs-')) await VL.custom.onAction(a.dataset.action, a, root, hooks(), draw);
  }
  return {
    mount(el) { root = el; draw(); root.addEventListener('click', onClick); off = VL.store.onChange(() => { if (!VL.player.active()) draw(); }); },
    unmount() { if (off) off(); if (root) root.removeEventListener('click', onClick); VL.player.detach(); },
  };
})();
