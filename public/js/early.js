/* Starts the two requests every page needs (site settings, the signed-in account) while the application modules are still downloading,
   so the start-up waits for the slower of the two instead of for both one after the other. app.js falls back to its normal requests if this fails. */
(function () {
  try {
    var get = function (url) { return fetch(url, { credentials: 'same-origin' }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); }).catch(function () { return { ok: false, data: null }; }); };
    window.__early = { config: get('/api/public/config'), me: get('/api/auth/me') };
  } catch (e) { /* the application loads its data itself */ }
})();
