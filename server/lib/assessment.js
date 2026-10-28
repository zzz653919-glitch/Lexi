/* The adaptive placement test: question selection, grading, stopping rules and the result (see irt.js for the statistics).
   Everything is decided on the server; the browser never sees which option is correct or how difficult a question is. */
const LV = require('./levels');
const IRT = require('./irt');
const X = require('./exercises');
const { now, shuffled, HttpError, bad } = require('./util');

const CORE_GROUPS = ['vocabulary', 'grammar', 'reading'];
const groupOf = (skill) => Object.keys(LV.REPORT_GROUPS).find((g) => LV.REPORT_GROUPS[g].includes(skill));
/* deterministic pseudo-random number in [0,1) from an integer seed (so reloading a question never changes it) */
const rnd = (seed) => { let t = (seed + 0x6D2B79F5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

function make(db, settings, learning) {
  const S = () => settings.all();

  /* the rules in force when a test starts are stored with it, so changing the settings never alters a running test */
  function configNow() {
    const s = S();
    return { min: s.placement_min_questions, max: Math.max(s.placement_min_questions, s.placement_max_questions), precision: s.placement_precision / 100, minPerSkill: s.placement_min_per_skill, start: LV.index(s.placement_start_level), cutoffs: s.placement_cutoffs };
  }
  const toResponse = (r, optionCounts) => ({ level: LV.index(r.level), correct: !!r.is_correct, format: r.format, options: optionCounts[r.question_id] || 4, dontKnow: !!r.dont_know });

  async function loadResponses(id) { return db.all('SELECT * FROM assessment_responses WHERE assessment_id = ? ORDER BY slot', id); }
  async function optionCounts() { const m = {}; for (const r of await db.all('SELECT question_id, COUNT(*) n FROM assessment_options GROUP BY question_id')) m[r.question_id] = r.n; return m; }

  /* ability estimate after each prefix of the answers (used for the "stable result" rule) */
  function trajectory(responses, counts) {
    const out = [];
    for (let k = 1; k <= responses.length; k++) out.push(IRT.estimate(responses.slice(0, k).map((r) => toResponse(r, counts))));
    return out;
  }

  /* may the test end now? */
  function shouldStop(a, cfg, responses, est, traj, listeningOn) {
    const n = responses.length;
    if (n >= cfg.max) return 'max';
    if (n < cfg.min) return null;
    const perGroup = {};
    for (const r of responses) { const g = groupOf(r.skill); perGroup[g] = (perGroup[g] || 0) + 1; }
    const covered = CORE_GROUPS.every((g) => (perGroup[g] || 0) >= cfg.minPerSkill);
    if (!covered) return null;
    if (est.sd > cfg.precision) return null;
    // the level must also have been stable over the last three estimates, so a short streak can never end the test
    const last = traj.slice(-3).map((e) => IRT.levelIndexFor(e.mean, cfg.cutoffs));
    if (last.length < 3 || new Set(last).size !== 1) return null;
    return 'precision';
  }

  /* the next question for this test (deterministic for the same answers) or null when the bank is exhausted */
  async function chooseNext(a, cfg, responses, est) {
    const asked = new Set(responses.map((r) => r.question_id));
    const pool = (await db.all("SELECT id, skill, level, format FROM assessment_questions WHERE status = 'published'")).filter((p) => !asked.has(p.id) && (a.listening || p.skill !== 'listening'));
    if (!pool.length) return null;
    const lastLevel = responses.length ? LV.index(responses[responses.length - 1].level) : cfg.start;
    let target = responses.length ? LV.clampIndex(est.mean) : cfg.start;
    if (responses.length) target = Math.max(lastLevel - 1, Math.min(lastLevel + 1, target));   // move by at most one level at a time
    const count = {};
    for (const r of responses) count[r.skill] = (count[r.skill] || 0) + 1;
    const order = LV.SKILLS.filter((s) => a.listening || s !== 'listening');
    const lastSkill = responses.length ? responses[responses.length - 1].skill : null;
    const startAt = lastSkill ? (order.indexOf(lastSkill) + 1) % order.length : 0;
    // least-asked skill first (ties: continue the cycle after the previous skill) so every area is sampled
    const skills = order.map((s, i) => ({ s, c: count[s] || 0, k: (i - startAt + order.length) % order.length })).sort((x, y) => x.c - y.c || x.k - y.k).map((x) => x.s);
    const seed = a.seed * 7919 + responses.length * 104729;
    for (const skill of skills) {
      const cands = pool.filter((p) => p.skill === skill);
      if (!cands.length) continue;
      const dist = (p) => Math.abs(LV.index(p.level) - target);
      const best = Math.min(...cands.map(dist));
      const near = cands.filter((p) => dist(p) === best).sort((x, y) => x.id - y.id);
      return near[Math.floor(rnd(seed) * near.length)].id;
    }
    return null;
  }

  async function questionPayload(id, seed) {
    const q = await db.get('SELECT * FROM assessment_questions WHERE id = ?', id);
    const p = { id: q.id, skill: q.skill, format: q.format, prompt: q.prompt };
    if (q.passage) p.passage = q.passage;
    if (q.sentence) p.sentence = q.sentence;
    if (q.skill === 'listening' && q.audio_text) p.audio = { text: q.audio_text };
    if (q.format === 'choice') p.options = shuffled((await db.all('SELECT id, text FROM assessment_options WHERE question_id = ? ORDER BY position, id', id)).map((o) => ({ id: o.id, text: o.text })), seed + id);
    return p;
  }

  async function view(a) {
    const cfg = JSON.parse(a.config);
    if (a.status === 'completed') return { assessmentId: a.id, status: 'completed', kind: a.kind, asked: a.asked, result: JSON.parse(a.result), completedAt: a.completed_at };
    if (a.status === 'abandoned') return { assessmentId: a.id, status: 'abandoned', kind: a.kind, asked: a.asked };
    const responses = await loadResponses(a.id), counts = await optionCounts();
    const est = IRT.estimate(responses.map((r) => toResponse(r, counts)));
    const qid = await chooseNext(a, cfg, responses, est);
    return { assessmentId: a.id, status: 'in_progress', kind: a.kind, asked: a.asked, min: cfg.min, max: cfg.max, question: qid ? await questionPayload(qid, a.seed) : null };
  }

  async function current(user) {
    const a = await db.get("SELECT * FROM assessments WHERE user_id = ? AND status = 'in_progress'", user.id);
    return a ? view(a) : null;
  }

  async function start(user, { listening = false } = {}) {
    const open = await db.get("SELECT * FROM assessments WHERE user_id = ? AND status = 'in_progress'", user.id);
    if (open) return view(open);
    const n = (await db.get("SELECT COUNT(*) n FROM assessment_questions WHERE status = 'published'")).n;
    if (n < 20) throw new HttpError(409, 'err.placement_unavailable');
    const done = await db.get("SELECT 1 x FROM assessments WHERE user_id = ? AND status = 'completed'", user.id);
    const r = await db.run('INSERT INTO assessments (user_id, kind, listening, seed, config, started_at) VALUES (?,?,?,?,?,?)', user.id, done ? 'reassessment' : 'placement', listening ? 1 : 0, 1 + Math.floor(Math.random() * 1e6), JSON.stringify(configNow()), now());
    return view(await db.get('SELECT * FROM assessments WHERE id = ?', r.id));
  }

  async function get(user, id) {
    const a = await db.get('SELECT * FROM assessments WHERE id = ? AND user_id = ?', id, user.id);
    if (!a) throw new HttpError(404, 'err.assessment_not_found');
    return view(a);
  }

  async function answer(user, id, body) {
    return db.tx(async () => {
      const a = await db.get('SELECT * FROM assessments WHERE id = ? AND user_id = ?', id, user.id);
      if (!a) throw new HttpError(404, 'err.assessment_not_found');
      if (a.status !== 'in_progress') return view(a);   // an answer to a finished test changes nothing
      const cfg = JSON.parse(a.config), responses = await loadResponses(a.id), counts = await optionCounts();
      const est = IRT.estimate(responses.map((r) => toResponse(r, counts)));
      const expected = await chooseNext(a, cfg, responses, est);
      const qid = Number(body && body.questionId);
      if (!Number.isInteger(qid) || qid !== expected) {
        // a repeated submit of the previous question is answered with the current state instead of counting twice
        if (responses.some((r) => r.question_id === qid)) return view(a);
        throw new HttpError(409, 'err.question_not_current');
      }
      const q = await db.get('SELECT * FROM assessment_questions WHERE id = ?', qid);
      const dontKnow = !!(body && body.dontKnow);
      let correct = false, shown = '';
      if (!dontKnow) {
        if (q.format === 'choice') {
          const oid = Number(body.answer);
          const opts = await db.all('SELECT id, is_correct FROM assessment_options WHERE question_id = ?', qid);
          if (!Number.isInteger(oid) || !opts.some((o) => o.id === oid)) throw bad('err.invalid_answer');
          correct = !!opts.find((o) => o.id === oid).is_correct; shown = String(oid);
        } else {
          if (typeof body.answer !== 'string') throw bad('err.invalid_answer');
          shown = body.answer.slice(0, 200);
          correct = X.alternatives(q.answer).some((alt) => X.norm(alt) === X.norm(shown)) && !!X.norm(shown);
        }
      }
      await db.run('INSERT INTO assessment_responses (assessment_id, question_id, slot, skill, level, format, answer, is_correct, dont_know, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)', a.id, qid, a.asked, q.skill, q.level, q.format, shown, correct ? 1 : 0, dontKnow ? 1 : 0, now());
      await db.run('UPDATE assessment_questions SET times_asked = times_asked + 1, times_correct = times_correct + ? WHERE id = ?', correct ? 1 : 0, qid);
      await db.run('UPDATE assessments SET asked = asked + 1, correct = correct + ? WHERE id = ?', correct ? 1 : 0, a.id);
      const all = await loadResponses(a.id);
      const est2 = IRT.estimate(all.map((r) => toResponse(r, counts)));
      const why = shouldStop(a, cfg, all, est2, trajectory(all, counts), !!a.listening);
      const nextId = why ? null : await chooseNext(a, cfg, all, est2);
      if (why || !nextId) { await finalize(a, cfg, all, counts, why || 'exhausted'); }
      return view(await db.get('SELECT * FROM assessments WHERE id = ?', a.id));
    });
  }

  /* skill report, strengths and areas to improve */
  function report(responses, counts, est, cfg) {
    const skills = {};
    for (const g of Object.keys(LV.REPORT_GROUPS)) {
      const rs = responses.filter((r) => LV.REPORT_GROUPS[g].includes(r.skill));
      if (!rs.length) continue;
      const correct = rs.filter((r) => r.is_correct).length;
      // the estimate for one skill leans on the overall estimate, so three answers cannot swing it wildly
      const e = rs.length >= 3 ? IRT.estimate(rs.map((r) => toResponse(r, counts)), { mean: est.mean, sd: 1.0 }) : null;
      skills[g] = { asked: rs.length, correct, percent: Math.round(100 * correct / rs.length), theta: e ? Math.round(e.mean * 100) / 100 : null, level: e ? LV.code(IRT.levelIndexFor(e.mean, cfg.cutoffs)) : null };
    }
    const rated = Object.entries(skills).filter(([, s]) => s.theta !== null);
    let strengths = rated.filter(([, s]) => s.theta - est.mean >= 0.35).map(([g]) => g);
    let weaknesses = rated.filter(([, s]) => est.mean - s.theta >= 0.35).map(([g]) => g);
    if (!strengths.length && !weaknesses.length && rated.length >= 2) {
      const sorted = rated.slice().sort((x, y) => y[1].percent - x[1].percent);
      if (sorted[0][1].percent !== sorted[sorted.length - 1][1].percent) { strengths = [sorted[0][0]]; weaknesses = [sorted[sorted.length - 1][0]]; }
    }
    return { skills, strengths, weaknesses };
  }

  async function finalize(a, cfg, responses, counts, reason) {
    const est = IRT.estimate(responses.map((r) => toResponse(r, counts)));
    const idx = IRT.levelIndexFor(est.mean, cfg.cutoffs), level = LV.code(idx);
    const correct = responses.filter((r) => r.is_correct).length;
    const byLevel = LV.LEVELS.map((l) => { const rs = responses.filter((r) => r.level === l); return { level: l, asked: rs.length, correct: rs.filter((r) => r.is_correct).length }; }).filter((x) => x.asked);
    const rep = report(responses, counts, est, cfg);
    const result = {
      level, theta: Math.round(est.mean * 100) / 100, sd: Math.round(est.sd * 100) / 100, confidence: est.sd < 0.4 ? 'high' : est.sd < 0.6 ? 'medium' : 'low',
      asked: responses.length, correct, percent: responses.length ? Math.round(100 * correct / responses.length) : 0,
      skills: rep.skills, strengths: rep.strengths, weaknesses: rep.weaknesses, byLevel, finishedBy: reason, early: responses.length < cfg.max && reason === 'precision',
    };
    await db.run("UPDATE assessments SET status = 'completed', theta = ?, sd = ?, result_level = ?, result = ?, completed_at = ? WHERE id = ?", result.theta, result.sd, level, JSON.stringify(result), now(), a.id);
    await learning.applyAssessment(a.user_id, a.id, level, result, a.kind);
    return result;
  }

  async function abandon(user, id) {
    const a = await db.get('SELECT * FROM assessments WHERE id = ? AND user_id = ?', id, user.id);
    if (!a) throw new HttpError(404, 'err.assessment_not_found');
    if (a.status === 'in_progress') await db.run("UPDATE assessments SET status = 'abandoned', completed_at = ? WHERE id = ?", now(), a.id);
    return { ok: true };
  }

  async function history(userId) {
    return (await db.all("SELECT id, kind, asked, correct, result_level, theta, completed_at FROM assessments WHERE user_id = ? AND status = 'completed' ORDER BY id DESC", userId))
      .map((r) => ({ id: r.id, kind: r.kind, level: r.result_level, asked: r.asked, correct: r.correct, percent: r.asked ? Math.round(100 * r.correct / r.asked) : 0, completedAt: r.completed_at }));
  }

  return { configNow, start, current, get, answer, abandon, history, estimate: IRT.estimate };
}

module.exports = { make, groupOf };
