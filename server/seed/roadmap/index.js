const fs = require('node:fs');
const path = require('node:path');
const { ensureRoadmap } = require('./build');
const A1 = require('./a1');
const IELTS = require('./ielts');
const { now } = require('../../lib/util');
const { lessonStatements, nextId, trNav } = require('./build');

/* the English words of the interface texts: kept as they are when Uzbek lesson texts are converted to the new alphabet */
function englishWords() {
  const set = new Set();
  try { const en = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'locales', 'en.json'), 'utf8')); for (const v of Object.values(en)) for (const w of JSON.stringify(v).split(/[^A-Za-z]+/)) if (w) set.add(w.toLowerCase()); } catch (_) { /* no file */ }
  return set;
}
const FLAG = 'seeded_roadmap_a1_v1';
/* the IELTS Preparation Center: its own course (never locked), one level, six topics with strategy lessons and practice tests */
async function ensureIelts(db, keep) {
  const t = now(), made = { lessons: 0, exercises: 0 };
  let course = await db.get("SELECT id FROM courses WHERE slug = 'lexio-ielts'");
  if (!course) {
    const id = await nextId(db, 'courses'), lid = await nextId(db, 'levels');
    const pos = (await db.get('SELECT COALESCE(MAX(position), -1) + 1 p FROM courses')).p;
    const st = [{ sql: 'INSERT INTO courses (id, slug, title, description, track, status, position, created_at, updated_at, translations) VALUES (?,?,?,?,?,?,?,?,?,?)',
      args: [id, 'lexio-ielts', 'IELTS Preparation Center', 'Original IELTS Academic strategies, practice tests, model answers and estimated band scores for Band 6.5–7.0 preparation. Practice material only: not an official score and not a guarantee.', 'ielts', 'published', pos, t, t,
        JSON.stringify({ uz: { title: 'IELTS tayyorgarlik markazi', description: A1.toNewUz('IELTS Academic uchun original strategiyalar, mashq testlari, namunaviy javoblar va taxminiy band ballar. Faqat tayyorgarlik materiali: rasmiy ball emas va natija kafolatlanmaydi.', keep) }, ru: { title: 'Центр подготовки к IELTS', description: 'Оригинальные стратегии, пробные тесты, образцы ответов и ориентировочные баллы. Только учебные материалы: это не официальный балл и не гарантия.' } })] },
      { sql: 'INSERT INTO levels (id, course_id, code, title, description, position, unlock_rule, unlock_threshold_pct, translations, exam_pass_pct, strict) VALUES (?,?,?,?,?,?,?,?,?,?,?)', args: [lid, id, 'IELTS', 'IELTS Academic', 'Strategies and practice for Band 6.5–7.0.', 0, 'open', 0, '{}', 80, 0] }];
    for (const [i, u] of IELTS.units.entries()) { const uid = await nextId(db, 'units'); st.push({ sql: 'INSERT INTO units (id, level_id, title, description, position, translations) VALUES (?,?,?,?,?,?)', args: [uid, lid, u.title[0], '', i, JSON.stringify({ uz: { title: A1.toNewUz(u.title[1], keep) }, ru: { title: u.title[2] } })] }); }
    await db.batch(st);
    course = { id };
  }
  const level = await db.get("SELECT id FROM levels WHERE course_id = ? AND code = 'IELTS'", course.id);
  for (const u of IELTS.units) {
    const unit = await db.get('SELECT id FROM units WHERE level_id = ? AND title = ?', level.id, u.title[0]);
    if (!unit || (await db.get('SELECT COUNT(*) n FROM lessons WHERE unit_id = ?', unit.id)).n) continue;
    const st = [];
    for (const [pos, L] of u.lessons.entries()) {
      const c = JSON.parse(JSON.stringify(L.content));
      for (const f of ['objective', 'explanation', 'tip']) if (c[f] && c[f].uz) c[f].uz = A1.toNewUz(c[f].uz, keep);
      st.push(...await lessonStatements(db, { unlock: 'open', unitId: unit.id, position: pos, kind: L.kind, skill: L.skill, title: [L.title[0], A1.toNewUz(L.title[1], keep), L.title[2]], desc: c.objective.en, descs: [c.objective.en, c.objective.uz, c.objective.ru], content: c, exercises: L.exercises, words: [], levelId: level.id, courseId: course.id, cefr: '', xp: L.xp || 25, t }));
      made.lessons++; made.exercises += L.exercises.length;
    }
    await db.batch(st);
  }
  return made;
}
const IELTS_FLAG = 'seeded_ielts_center_v1';
async function ensureAll(db) {
  const keep = englishWords();
  let made = { lessons: 0, exercises: 0 };
  if (!await db.get('SELECT 1 x FROM settings WHERE key = ?', FLAG)) { made = await ensureRoadmap(db, A1.content(keep)); await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, 'true')", FLAG); }
  if (!await db.get('SELECT 1 x FROM settings WHERE key = ?', IELTS_FLAG)) { const m = await ensureIelts(db, keep); made.lessons += m.lessons; made.exercises += m.exercises; await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, 'true')", IELTS_FLAG); }
  return made;
}
module.exports = { ensure: ensureAll };
