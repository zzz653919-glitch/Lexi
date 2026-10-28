#!/usr/bin/env node
/* Runs the adaptive placement test for simulated learners of known ability and reports how accurate and how long it is.
   Usage: node scripts/simulate-placement.js [learners-per-level=40] */
const os = require('node:os'), path = require('node:path'), fs = require('node:fs');
const { createApp } = require('../server/app');
const IRT = require('../server/lib/irt');
const LV = require('../server/lib/levels');

(async () => {
  const per = Number(process.argv[2]) || 40;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lexi-sim-'));
  const inst = createApp({ dbPath: path.join(dir, 'sim.sqlite'), dataDir: dir, quiet: true, rateLimit: false, settingsTtl: 0, seedSample: true });
  await inst.init();
  let seed = 12345;
  const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const report = [];
  for (let trueLevel = 0; trueLevel < LV.LEVELS.length; trueLevel++) {
    const stat = { level: LV.LEVELS[trueLevel], exact: 0, within1: 0, lengths: [], n: per };
    for (let k = 0; k < per; k++) {
      const theta = trueLevel + (rand() - 0.5) * 0.8;            // within the level's band
      const email = `s${trueLevel}_${k}@example.com`;
      const uid = (await inst.db.run("INSERT INTO users (email, display_name, password_hash, role, hearts_updated_at, created_at, last_active_at) VALUES (?,?,?,?,?,?,?)", email, 'Sim', 'x', 'learner', new Date().toISOString(), new Date().toISOString(), new Date().toISOString())).id;
      const user = { id: uid };
      let st = await inst.assessment.start(user, { listening: true });
      let guard = 0;
      while (st.status === 'in_progress' && guard++ < 60) {
        const q = st.question;
        const row = await inst.db.get('SELECT level, format, skill FROM assessment_questions WHERE id = ?', q.id);
        const nOpts = q.options ? q.options.length : 0;
        const p = IRT.pCorrect(theta, LV.index(row.level), { format: row.format, options: nOpts || 4 });
        const ok = rand() < p;
        let body;
        if (row.format === 'type') body = ok ? { questionId: q.id, answer: (await inst.db.get('SELECT answer FROM assessment_questions WHERE id = ?', q.id)).answer.split('|')[0] } : { questionId: q.id, answer: 'zzz' };
        else { const opts = await inst.db.all('SELECT id, is_correct FROM assessment_options WHERE question_id = ?', q.id); const right = opts.find((o) => o.is_correct).id; const wrong = opts.filter((o) => !o.is_correct); body = { questionId: q.id, answer: ok ? right : wrong[Math.floor(rand() * wrong.length)].id }; }
        st = await inst.assessment.answer(user, st.assessmentId, body);
      }
      const got = LV.index(st.result.level);
      if (got === trueLevel) stat.exact++;
      if (Math.abs(got - trueLevel) <= 1) stat.within1++;
      stat.lengths.push(st.asked);
    }
    report.push(stat);
  }
  console.log('true level | exact | within ±1 | questions (min / avg / max)');
  for (const s of report) {
    const l = s.lengths;
    console.log(`${s.level.padEnd(10)} | ${String(Math.round(100 * s.exact / s.n)).padStart(4)}% | ${String(Math.round(100 * s.within1 / s.n)).padStart(8)}% | ${Math.min(...l)} / ${(l.reduce((a, b) => a + b, 0) / l.length).toFixed(1)} / ${Math.max(...l)}`);
  }
  const all = report.flatMap((s) => s.lengths);
  console.log(`overall: exact ${Math.round(100 * report.reduce((a, s) => a + s.exact, 0) / (per * report.length))}%, within ±1 ${Math.round(100 * report.reduce((a, s) => a + s.within1, 0) / (per * report.length))}%, questions avg ${(all.reduce((a, b) => a + b, 0) / all.length).toFixed(1)}`);
  await inst.close();
  fs.rmSync(dir, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
