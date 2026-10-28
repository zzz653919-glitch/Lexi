/* Administrator API: interface translations (completeness, missing texts, validated edits stored as overrides). Administrators only. */
const express = require('express');
const { int, clamp, bad, HttpError, clean } = require('../lib/util');

module.exports = function i18nAdminRoutes({ auth, i18n, audit }) {
  const r = express.Router();
  r.use(auth.requireRole('admin'));
  const lang = (req) => { const l = String(req.params.lang || '').toLowerCase(); if (!i18n.core.isSupported(l)) throw new HttpError(404, 'err.not_found'); return l; };

  r.get('/i18n', async (req, res) => res.json({ languages: i18n.completeness(), groups: i18n.groups(), defaultLanguage: i18n.defaultLanguage() }));

  r.get('/i18n/:lang', async (req, res) => {
    const l = lang(req);
    const filter = ['all', 'missing', 'overridden'].includes(req.query.filter) ? req.query.filter : 'all';
    const all = i18n.entries(l, { filter, q: clean(req.query.q, 80), prefix: clean(req.query.group, 30) ? clean(req.query.group, 30) + '.' : '' });
    const size = clamp(int(req.query.pageSize, 25), 5, 100), page = Math.max(1, int(req.query.page, 1));
    res.json({ lang: l, total: all.length, page, pageSize: size, items: all.slice((page - 1) * size, page * size), pluralCategories: i18n.core.PLURAL_CATEGORIES[l] });
  });

  /* validates (and with save: true publishes) a text; nothing is stored when a check fails */
  r.put('/i18n/:lang', async (req, res) => {
    const l = lang(req); const b = req.body || {};
    const key = String(b.key || '');
    const problems = i18n.validate(l, key, b.value);
    if (problems.length) throw bad('err.i18n_invalid', { value: problems[0] }, { count: problems.length });
    if (b.dryRun === true) return res.json({ ok: true, dryRun: true });
    await i18n.setOverride(l, key, b.value, req.user.id);
    await audit(req, 'i18n.update', 'translation', `${l}:${key}`, { value: b.value });
    res.json({ ok: true, entry: i18n.entries(l, { q: key }).find((e) => e.key === key) });
  });

  r.delete('/i18n/:lang/:key', async (req, res) => {
    const l = lang(req);
    const n = await i18n.removeOverride(l, String(req.params.key));
    if (!n) throw new HttpError(404, 'err.not_found');
    await audit(req, 'i18n.reset', 'translation', `${l}:${req.params.key}`, {});
    res.json({ ok: true });
  });

  r.get('/i18n/:lang/export', async (req, res) => {
    const l = lang(req);
    await audit(req, 'i18n.export', 'translation', l, {});
    res.setHeader('Content-Disposition', `attachment; filename="messages-${l}.json"`);
    res.json(i18n.dicts()[l]);
  });
  return r;
};
