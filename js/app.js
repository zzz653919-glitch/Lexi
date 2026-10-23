/* App shell: boot, theme, hash router. */
(function () {
  const { esc } = VL.util;
  const t = VL.t;
  const main = document.getElementById('main');
  const ROUTES = {
    dashboard: { view: 'dashboard' }, vocabulary: { view: 'vocabulary' }, learn: { view: 'learn' }, topics: { view: 'topics' }, bulk: { view: 'bulk' }, practice: { view: 'practice' },
    difficult: { view: 'difficult' }, progress: { view: 'progress' }, settings: { view: 'settings' },
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
    btn.setAttribute('aria-label', t(theme === 'dark' ? 'theme.toLight' : 'theme.toDark'));
    btn.querySelector('.theme-toggle-label').textContent = t(theme === 'dark' ? 'theme.light' : 'theme.dark');
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
      const on = a.dataset.route === (name === 'bulk' ? 'vocabulary' : name);
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.title = t('nav.' + name) + ' — Lexi';
    document.body.classList.remove('focus-mode');
    main.innerHTML = '';
    main.scrollTop = 0; window.scrollTo(0, 0);
    current = VL.views[route.view];
    current.mount(main, params);
    updateBadge();
  }

  function refreshChrome() { applyTheme(); }

  VL.app = { render, updateBadge, refreshChrome };

  function showFatal(err) {
    console.error(err);
    main.innerHTML = '<div class="empty"><h3>' + esc(t('err.storageTitle')) + '</h3><p>' + esc(err && err.message ? err.message : String(err)) +
      '</p><p class="muted">' + esc(t('err.storageHelp')) + '</p></div>';
  }

  window.addEventListener('hashchange', render);
  VL.store.onChange(updateBadge);
  document.getElementById('lang-select').addEventListener('change', (e) => VL.i18n.set(e.target.value));
  VL.i18n.apply();
  applyTheme();

  /* Splash screen: shown while the data loads, for at least ~900 ms so it does not flash. Skipped in automated
     browsers (tests) and when the address has ?nosplash. */
  const splash = document.getElementById('splash');
  const skipSplash = navigator.webdriver || /nosplash/.test(location.search + location.hash);
  const splashStart = Date.now();
  function hideSplash() {
    if (!splash) return;
    const wait = skipSplash ? 0 : Math.max(0, 900 - (Date.now() - splashStart));
    setTimeout(() => { splash.classList.add('hide'); setTimeout(() => splash.remove(), skipSplash ? 0 : 600); }, wait);
  }
  if (skipSplash && splash) splash.remove();

  VL.store.load().then(() => {
    if (!location.hash) history.replaceState(null, '', '#/dashboard');
    render();
    hideSplash();
  }).catch((e) => { hideSplash(); showFatal(e); });
})();
