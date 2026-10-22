/* App shell: boot, theme, hash router. */
(function () {
  const { esc } = VL.util;
  const main = document.getElementById('main');
  const ROUTES = {
    dashboard: { view: 'dashboard', title: 'Dashboard' },
    vocabulary: { view: 'vocabulary', title: 'My Vocabulary' },
    practice: { view: 'practice', title: 'Practice' },
    difficult: { view: 'difficult', title: 'Difficult Words' },
    progress: { view: 'progress', title: 'Progress' },
    settings: { view: 'settings', title: 'Settings' },
  };
  let current = null;

  /* ---------- theme ---------- */
  function getThemePref() { try { return localStorage.getItem('lexi.theme') || 'system'; } catch (e) { return 'system'; } }
  function resolveTheme(pref) {
    return pref === 'dark' || (pref === 'system' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  function applyTheme() {
    const theme = resolveTheme(getThemePref());
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('theme-toggle');
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    btn.querySelector('.theme-toggle-label').textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
  }
  function setThemePref(pref) {
    try { localStorage.setItem('lexi.theme', pref); } catch (e) { /* theme just won't persist */ }
    applyTheme();
  }
  VL.theme = { get: getThemePref, set: setThemePref };

  document.getElementById('theme-toggle').addEventListener('click', () => {
    setThemePref(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    if (location.hash.startsWith('#/settings')) render();
  });
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

  /* ---------- router ---------- */
  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [name, query] = raw.split('?');
    return { name: ROUTES[name] ? name : 'dashboard', params: new URLSearchParams(query || '') };
  }

  function updateBadge() {
    const n = VL.store.difficultWords().length;
    const b = document.getElementById('difficult-badge');
    b.hidden = n === 0;
    b.textContent = n > 99 ? '99+' : n;
  }

  function render() {
    if (current && current.unmount) current.unmount();
    const { name, params } = parseHash();
    const route = ROUTES[name];
    document.querySelectorAll('#nav a').forEach((a) => {
      const on = a.dataset.route === name;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.title = route.title + ' — Lexi';
    document.body.classList.remove('focus-mode');
    main.innerHTML = '';
    main.scrollTop = 0; window.scrollTo(0, 0);
    current = VL.views[route.view];
    current.mount(main, params);
    updateBadge();
  }

  VL.app = { render, updateBadge };

  function showFatal(err) {
    console.error(err);
    main.innerHTML = '<div class="empty"><h3>Storage is unavailable</h3><p>' + esc(err && err.message ? err.message : String(err)) +
      '</p><p class="muted">Lexi needs IndexedDB or localStorage to save your words. Try a normal (non-private) browser window.</p></div>';
  }

  window.addEventListener('hashchange', render);
  VL.store.onChange(updateBadge);
  applyTheme();

  VL.store.load().then(() => {
    if (!location.hash) history.replaceState(null, '', '#/dashboard');
    render();
  }).catch(showFatal);
})();
