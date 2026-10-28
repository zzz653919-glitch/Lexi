/* Learner routes for the placement test, the learner's level and the personalised daily lesson. */
const express = require('express');
const LV = require('../lib/levels');
const { int, bad, HttpError } = require('../lib/util');

module.exports = function learningRoutes({ db, settings, auth, core, assessment, learning, daily }) {
  const r = express.Router();
  r.use(auth.requireUser);

  /* ---------- level ---------- */
  r.get('/me/level', async (req, res) => res.json(await learning.status(req.user)));
  r.post('/me/level', async (req, res) => {
    const level = String((req.body || {}).level || '');
    if (!LV.valid(level)) throw bad('err.fix_fields', { level: 'val.level_unknown' });
    await learning.setLevel(req.user.id, level, 'manual', { note: 'chosen by the learner' });
    res.json(await learning.status(req.user));
  });

  /* ---------- placement test ---------- */
  r.get('/assessment/info', async (req, res) => {
    const cfg = assessment.configNow();
    res.json({ min: cfg.min, max: cfg.max, available: (await db.get("SELECT COUNT(*) n FROM assessment_questions WHERE status = 'published'")).n >= 20, validDays: settings.all().placement_valid_days });
  });
  r.get('/assessment/current', async (req, res) => res.json((await assessment.current(req.user)) || { status: 'none' }));
  r.post('/assessment/start', async (req, res) => res.json(await assessment.start(req.user, { listening: !!(req.body || {}).listening })));
  r.get('/assessment/history', async (req, res) => res.json({ items: await assessment.history(req.user.id) }));
  r.get('/assessment/:id', async (req, res) => res.json(await assessment.get(req.user, int(req.params.id))));
  r.post('/assessment/:id/answer', async (req, res) => res.json(await assessment.answer(req.user, int(req.params.id), req.body || {})));
  r.post('/assessment/:id/abandon', async (req, res) => res.json(await assessment.abandon(req.user, int(req.params.id))));

  /* ---------- daily lesson ---------- */
  r.get('/daily/summary', async (req, res) => res.json(await daily.summary(req.user)));
  r.post('/daily/start', async (req, res) => res.json(await daily.start(req.user)));
  r.get('/daily/attempts/:id', async (req, res) => res.json(await daily.getAttempt(req.user, int(req.params.id))));
  r.post('/daily/attempts/:id/answer', async (req, res) => res.json(await daily.answer(req.user, int(req.params.id), req.body || {})));
  r.post('/daily/attempts/:id/abandon', async (req, res) => res.json(await daily.abandon(req.user, int(req.params.id))));

  return r;
};
