/* In-memory state backed by VL.db. Every mutation updates memory first, then
   persists; a failed write surfaces an error toast but never loses the UI state. */
VL.store = (function () {
  const { uid } = VL.util;
  const DEFAULTS = { direction: 'en-uz', length: 'all', autoAdvance: false, lenient: true, dailyGoal: 50, learnSelected: [], autoSpeak: false, lessonSize: 10, lessonLength: 12, sentenceHistory: [], typoMode: 'careful', mixedWords: 10 };
  const MAX_LEN = 200;
  const MASTERED_STREAK = 3;

  const state = { words: [], collections: [], sessions: [], days: [], lesson: null, custom: [], settings: Object.assign({}, DEFAULTS) };
  const listeners = new Set();

  const key = (s) => String(s).trim().replace(/\s+/g, ' ').toLowerCase();
  const clean = (s) => String(s == null ? '' : s).trim().replace(/\s+/g, ' ');

  function notify() { listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }
  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  async function save(fn) {
    try { await fn(); return true; } catch (err) {
      console.error(err);
      if (VL.ui) VL.ui.toast(VL.t('err.saveFail', { msg: err && err.message ? err.message : '?' }), 'error', 6000);
      return false;
    }
  }

  function newCollection(name, deckKey) {
    const c = { id: uid(), name: clean(name), createdAt: Date.now() };
    if (deckKey) c.deckKey = deckKey;
    return c;
  }

  // Words saved before the lesson system existed get spaced-repetition defaults on load.
  function withLearnFields(w) {
    if (w.box === undefined) { w.box = 0; w.reps = 0; w.lapses = 0; w.due = null; }
    if (w.example === undefined) w.example = '';
    if (w.phonetic === undefined) w.phonetic = '';
    if (!Array.isArray(w.alts)) w.alts = [];
    if (typeof w.sense !== 'string') w.sense = '';
    if (typeof w.pos !== 'string') w.pos = '';
    return w;
  }
  function blankWord(en, uz, collectionId, example, phonetic, extras) {
    const x = extras || {};
    return { id: uid(), en, uz, example: clean(example || ''), phonetic: clean(phonetic || ''), alts: x.alts || [], sense: clean(x.sense || ''), pos: x.pos || '', collectionId, createdAt: Date.now(), updatedAt: Date.now(), correct: 0, wrong: 0, streak: 0, lastSeenAt: null, lastWrongAt: null, box: 0, reps: 0, lapses: 0, due: null };
  }

  async function load() {
    await VL.db.open();
    const [words, collections, sessions, settings, days] = await Promise.all([
      VL.db.getAll('words'), VL.db.getAll('collections'), VL.db.getAll('sessions'), VL.db.getAll('settings'), VL.db.getAll('days'),
    ]);
    state.words = words.map(withLearnFields);
    state.days = days.sort((a, b) => (a.date < b.date ? -1 : 1));
    const saved = settings.find((s) => s.key === 'lessonState');
    state.lesson = saved ? saved.value : null;
    const cs = settings.find((x) => x.key === 'customSessions');
    state.custom = cs && Array.isArray(cs.value) ? cs.value : [];
    state.collections = collections.sort((a, b) => a.createdAt - b.createdAt);
    state.sessions = sessions.sort((a, b) => a.date - b.date);
    state.settings = Object.assign({}, DEFAULTS);
    settings.forEach((s) => { if (s.key !== 'lessonState' && s.key !== 'customSessions') state.settings[s.key] = s.value; });
    if (!state.collections.length) {
      const c = newCollection(VL.t('default.collection'));
      state.collections.push(c);
      await save(() => VL.db.put('collections', [c]));
    }
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  }

  /* ---------- queries ---------- */
  const collection = (id) => state.collections.find((c) => c.id === id) || null;
  const word = (id) => state.words.find((w) => w.id === id) || null;
  const wordsIn = (colId) => (colId ? state.words.filter((w) => w.collectionId === colId) : state.words);

  function status(w) {
    if (!w.correct && !w.wrong) return 'new';
    if (w.wrong > 0 && w.streak < MASTERED_STREAK) return 'difficult';
    if (w.streak >= MASTERED_STREAK) return 'mastered';
    return 'learning';
  }
  const difficultWords = () => state.words.filter((w) => status(w) === 'difficult');

  function summarize(words) {
    const out = { total: words.length, new: 0, learning: 0, difficult: 0, mastered: 0, correct: 0, wrong: 0 };
    words.forEach((w) => { out[status(w)]++; out.correct += w.correct; out.wrong += w.wrong; });
    out.attempts = out.correct + out.wrong;
    out.accuracy = out.attempts ? Math.round((out.correct / out.attempts) * 100) : 0;
    out.progress = out.total ? Math.round((out.mastered / out.total) * 100) : 0;
    return out;
  }

  function findDuplicate(en, collectionId, ignoreId) {
    const k = key(en);
    return state.words.find((w) => w.id !== ignoreId && w.collectionId === collectionId && key(w.en) === k) || null;
  }

  /* ---------- words ---------- */
  function validateWord(en, uz, collectionId, ignoreId) {
    if (!en && !uz) return VL.t('err.emptyBoth');
    if (!en) return VL.t('err.emptyEn');
    if (!uz) return VL.t('err.emptyUz');
    if (en.length > MAX_LEN || uz.length > MAX_LEN) return VL.t('err.tooLong', { max: MAX_LEN });
    if (!collection(collectionId)) return VL.t('err.chooseCol');
    const dup = findDuplicate(en, collectionId, ignoreId);
    if (dup) return VL.t('err.dup', { en: dup.en, uz: dup.uz });
    return null;
  }

  // extra translations / meaning / part of speech from a dialog or import; { ok, extras } or { ok:false, error }
  function readExtras(input, current) {
    const x = {
      alts: input.alts === undefined ? (current ? current.alts : []) : (Array.isArray(input.alts) ? input.alts.map((a) => ({ text: clean(a.text), context: clean(a.context || '') })).filter((a) => a.text) : VL.answers.parseAlts(input.alts)),
      sense: input.sense === undefined ? (current ? current.sense : '') : clean(input.sense),
      pos: input.pos === undefined ? (current ? current.pos : '') : String(input.pos || ''),
    };
    const err = VL.answers.validateExtras(x);
    return err ? { ok: false, error: VL.t(err) } : { ok: true, extras: x };
  }

  async function addWord(input) {
    const en = clean(input.en), uz = clean(input.uz);
    const error = validateWord(en, uz, input.collectionId);
    if (error) return { ok: false, error };
    if (clean(input.example).length > 300) return { ok: false, error: VL.t('err.exampleLong') };
    if (clean(input.phonetic).length > 100) return { ok: false, error: VL.t('err.phoneticLong') };
    const ex = readExtras(input);
    if (!ex.ok) return ex;
    const w = blankWord(en, uz, input.collectionId, input.example, input.phonetic, ex.extras);
    state.words.push(w);
    await save(() => VL.db.put('words', [w]));
    notify();
    return { ok: true, word: w };
  }

  async function updateWord(id, input) {
    const w = word(id);
    if (!w) return { ok: false, error: VL.t('err.noWord') };
    const en = clean(input.en), uz = clean(input.uz);
    const error = validateWord(en, uz, input.collectionId, id);
    if (error) return { ok: false, error };
    if (clean(input.example).length > 300) return { ok: false, error: VL.t('err.exampleLong') };
    if (clean(input.phonetic).length > 100) return { ok: false, error: VL.t('err.phoneticLong') };
    const ex = readExtras(input, w);
    if (!ex.ok) return ex;
    if (key(en) !== key(w.en) || key(uz) !== key(w.uz)) { w.correct = 0; w.wrong = 0; w.streak = 0; w.lastWrongAt = null; w.box = 0; w.reps = 0; w.lapses = 0; w.due = null; }
    Object.assign(w, { en, uz, example: clean(input.example || ''), phonetic: input.phonetic === undefined ? w.phonetic : clean(input.phonetic), alts: ex.extras.alts, sense: ex.extras.sense, pos: ex.extras.pos, collectionId: input.collectionId, updatedAt: Date.now() });
    await save(() => VL.db.put('words', [w]));
    notify();
    return { ok: true, word: w };
  }

  async function deleteWords(ids) {
    const set = new Set(ids);
    state.words = state.words.filter((w) => !set.has(w.id));
    await save(() => VL.db.remove('words', ids));
    notify();
  }

  /* ---------- collections ---------- */
  function validateCollection(name, ignoreId) {
    const n = clean(name);
    if (!n) return VL.t('err.colEmpty');
    if (n.length > 60) return VL.t('err.colLong');
    if (state.collections.some((c) => c.id !== ignoreId && key(c.name) === key(n))) return VL.t('err.colExists');
    return null;
  }

  async function addCollection(name) {
    const error = validateCollection(name);
    if (error) return { ok: false, error };
    const c = newCollection(name);
    state.collections.push(c);
    await save(() => VL.db.put('collections', [c]));
    notify();
    return { ok: true, collection: c };
  }

  async function renameCollection(id, name) {
    const c = collection(id);
    if (!c) return { ok: false, error: VL.t('err.colNotFound') };
    const error = validateCollection(name, id);
    if (error) return { ok: false, error };
    c.name = clean(name);
    await save(() => VL.db.put('collections', [c]));
    notify();
    return { ok: true };
  }

  async function deleteCollection(id) {
    if (state.collections.length <= 1) return { ok: false, error: VL.t('err.lastCollection') };
    const ids = state.words.filter((w) => w.collectionId === id).map((w) => w.id);
    state.words = state.words.filter((w) => w.collectionId !== id);
    state.collections = state.collections.filter((c) => c.id !== id);
    await save(async () => { await VL.db.remove('words', ids); await VL.db.remove('collections', [id]); });
    notify();
    return { ok: true, removedWords: ids.length };
  }

  async function ensureCollection(name) {
    const existing = state.collections.find((c) => key(c.name) === key(name));
    if (existing) return existing;
    const c = newCollection(name);
    state.collections.push(c);
    await save(() => VL.db.put('collections', [c]));
    return c;
  }

  /* ---------- progress ---------- */
  async function recordAnswer(id, correct) {
    const w = word(id);
    if (!w) return;
    w.lastSeenAt = Date.now();
    if (correct) { w.correct++; w.streak++; } else { w.wrong++; w.streak = 0; w.lastWrongAt = Date.now(); }
    await save(() => VL.db.put('words', [w]));
    notify();
  }

  async function markLearned(ids) {
    const changed = [];
    ids.forEach((id) => { const w = word(id); if (w) { w.streak = MASTERED_STREAK; changed.push(w); } });
    await save(() => VL.db.put('words', changed));
    notify();
  }

  async function addSession(s) {
    const rec = Object.assign({ id: uid(), date: Date.now() }, s);
    state.sessions.push(rec);
    const day = dayRecord();
    day.sessions++;
    if (rec.kind === 'lesson') day.lessons++;
    await save(async () => { await VL.db.put('sessions', [rec]); await VL.db.put('days', [day]); });
    notify();
    return rec;
  }

  /* ---------- daily activity (XP, goal, streak) ---------- */
  function dayRecord(ts) {
    const k = VL.util.dayKey(ts || Date.now());
    let d = state.days.find((x) => x.date === k);
    if (!d) { d = { date: k, xp: 0, answers: 0, correct: 0, sessions: 0, lessons: 0, goalMet: false }; state.days.push(d); }
    return d;
  }

  // Adds XP / answer counts to today. Returns { goalJustMet } so the UI can celebrate once.
  async function logLearn(delta) {
    const d = dayRecord();
    const before = d.goalMet;
    d.xp += delta.xp || 0; d.answers += delta.answers || 0; d.correct += delta.correct || 0;
    if (!d.goalMet && d.xp >= state.settings.dailyGoal) d.goalMet = true;
    await save(() => VL.db.put('days', [d]));
    notify();
    return { goalJustMet: d.goalMet && !before };
  }

  /* Updates one word after a lesson answer. `first` = the first attempt for this word in the
     lesson (only that attempt moves the spaced-repetition schedule). */
  async function recordLearn(id, correct, first) {
    const w = word(id);
    if (!w) return;
    const now = Date.now();
    w.lastSeenAt = now;
    if (correct) { w.correct++; w.streak++; } else { w.wrong++; w.streak = 0; w.lastWrongAt = now; }
    if (first) VL.srs.schedule(w, correct, now);
    await save(() => VL.db.put('words', [w]));
    notify();
  }

  // Lesson in progress (so it can be paused and resumed, even after a reload).
  async function saveLesson(lesson) {
    state.lesson = lesson;
    await save(() => lesson ? VL.db.put('settings', [{ key: 'lessonState', value: lesson }]) : VL.db.remove('settings', ['lessonState']));
  }

  // Finds or creates the collection that holds a ready-made deck.
  async function ensureDeckCollection(deckKey, name) {
    const existing = state.collections.find((c) => c.deckKey === deckKey);
    if (existing) return existing;
    const c = newCollection(name, deckKey);
    state.collections.push(c);
    await save(() => VL.db.put('collections', [c]));
    return c;
  }

  /* ---------- custom sessions (created by the user: name, topic, words, exercise types, run history) ---------- */
  const saveCustom = () => save(() => VL.db.put('settings', [{ key: 'customSessions', value: state.custom }]));
  const customSession = (id) => state.custom.find((c) => c.id === id) || null;
  async function addCustom(rec) {
    const c = Object.assign({ id: uid(), createdAt: Date.now(), runs: [] }, rec);
    state.custom.push(c);
    await saveCustom(); notify();
    return c;
  }
  async function renameCustom(id, name) {
    const c = customSession(id), nm = clean(name);
    if (!c) return { ok: false, error: VL.t('err.noSession') };
    if (!nm) return { ok: false, error: VL.t('cs.errName') };
    if (nm.length > 60) return { ok: false, error: VL.t('cs.errNameLong') };
    c.name = nm;
    await saveCustom(); notify();
    return { ok: true };
  }
  async function removeCustom(id) {
    state.custom = state.custom.filter((c) => c.id !== id);
    await saveCustom(); notify();
  }
  // run: { total, correct, wrong, pct, missedIds, goodIds, mode }; words that went wrong are remembered for later sessions
  async function recordCustomRun(id, run) {
    const c = customSession(id);
    const rec = Object.assign({ date: Date.now() }, run);
    if (c) { c.runs.push(rec); c.runs = c.runs.slice(-30); await saveCustom(); }
    const prev = state.settings.mistakeIds || [];
    const next = prev.filter((x) => !run.goodIds.includes(x) && !run.missedIds.includes(x)).concat(run.missedIds).filter((x) => word(x)).slice(-200);
    await setSetting('mistakeIds', next);
    return rec;
  }
  // words the user got wrong (remembered from sessions, plus words whose latest answer was wrong)
  function mistakeWords() {
    const ids = new Set(state.settings.mistakeIds || []);
    return state.words.filter((w) => ids.has(w.id) || (w.lastWrongAt && w.streak === 0 && w.wrong > 0)).sort((a, b) => (b.lastWrongAt || 0) - (a.lastWrongAt || 0));
  }

  async function resetProgress() {
    state.words.forEach((w) => { w.correct = 0; w.wrong = 0; w.streak = 0; w.lastSeenAt = null; w.lastWrongAt = null; w.box = 0; w.reps = 0; w.lapses = 0; w.due = null; });
    state.sessions = []; state.days = []; state.lesson = null;
    state.custom.forEach((c) => { c.runs = []; }); state.settings.mistakeIds = [];
    await save(async () => { await VL.db.put('words', state.words); await VL.db.clear(['sessions', 'days']); await VL.db.remove('settings', ['lessonState', 'mistakeIds']); });
    await saveCustom();
    notify();
  }

  async function clearAll() {
    state.words = []; state.collections = []; state.sessions = []; state.days = []; state.lesson = null; state.custom = [];
    state.settings.learnSelected = []; state.settings.mistakeIds = [];
    await save(() => VL.db.clear(['words', 'collections', 'sessions', 'days']));
    await save(() => VL.db.remove('settings', ['lessonState', 'learnSelected', 'customSessions', 'mistakeIds']));
    const c = newCollection(VL.t('default.collection'));
    state.collections.push(c);
    await save(() => VL.db.put('collections', [c]));
    notify();
  }

  /* ---------- settings ---------- */
  async function setSetting(k, value) {
    state.settings[k] = value;
    await save(() => VL.db.put('settings', [{ key: k, value }]));
    notify();
  }

  /* ---------- bulk import / backup ---------- */
  // rows: [{ en, uz, collectionId }]; skips empty rows and duplicates.
  async function importWords(rows) {
    const added = [];
    let duplicates = 0;
    rows.forEach((r) => {
      const en = clean(r.en), uz = clean(r.uz);
      if (!en || !uz || en.length > MAX_LEN || uz.length > MAX_LEN) return;
      if (findDuplicate(en, r.collectionId)) { duplicates++; return; }
      const w = blankWord(en, uz, r.collectionId, String(r.example || '').slice(0, 300));
      state.words.push(w);
      added.push(w);
    });
    const ok = await save(() => VL.db.put('words', added));
    notify();
    return { added: added.length, duplicates, ok };
  }

  function backup() {
    return { app: 'lexi', version: 2, exportedAt: new Date().toISOString(), collections: state.collections, words: state.words, sessions: state.sessions, days: state.days, lesson: state.lesson, custom: state.custom, settings: state.settings };
  }

  async function restore(data) {
    if (!data || data.app !== 'lexi' || !Array.isArray(data.words) || !Array.isArray(data.collections)) throw new Error(VL.t('err.notBackup'));
    const validWord = (w) => w && typeof w.id === 'string' && typeof w.en === 'string' && typeof w.uz === 'string' && typeof w.collectionId === 'string';
    const validCol = (c) => c && typeof c.id === 'string' && typeof c.name === 'string';
    const cols = data.collections.filter(validCol).map((c) => Object.assign({ id: c.id, name: c.name, createdAt: Number(c.createdAt) || Date.now() }, typeof c.deckKey === 'string' ? { deckKey: c.deckKey } : {}));
    if (!cols.length) throw new Error(VL.t('err.noCollections'));
    const ids = new Set(cols.map((c) => c.id));
    const words = data.words.filter((w) => validWord(w) && ids.has(w.collectionId)).map((w) => ({
      id: w.id, en: clean(w.en), uz: clean(w.uz), collectionId: w.collectionId,
      createdAt: Number(w.createdAt) || Date.now(), updatedAt: Number(w.updatedAt) || Date.now(),
      correct: Number(w.correct) || 0, wrong: Number(w.wrong) || 0, streak: Number(w.streak) || 0,
      lastSeenAt: w.lastSeenAt || null, lastWrongAt: w.lastWrongAt || null,
      example: typeof w.example === 'string' ? w.example.slice(0, 300) : '',
      phonetic: typeof w.phonetic === 'string' ? w.phonetic.slice(0, 100) : '',
      alts: Array.isArray(w.alts) ? w.alts.filter((a) => a && typeof a.text === 'string' && a.text.trim()).slice(0, 12).map((a) => ({ text: clean(a.text).slice(0, 200), context: clean(a.context || '').slice(0, 100) })) : [],
      sense: typeof w.sense === 'string' ? w.sense.slice(0, 200) : '',
      pos: VL.answers.POS.includes(w.pos) ? w.pos : '',
      box: Math.min(5, Math.max(0, Number(w.box) || 0)), reps: Number(w.reps) || 0, lapses: Number(w.lapses) || 0, due: Number(w.due) || null,
    }));
    const days = (Array.isArray(data.days) ? data.days : []).filter((d) => d && /^\d{4}-\d{2}-\d{2}$/.test(d.date)).map((d) => ({ date: d.date, xp: Number(d.xp) || 0, answers: Number(d.answers) || 0, correct: Number(d.correct) || 0, sessions: Number(d.sessions) || 0, lessons: Number(d.lessons) || 0, goalMet: !!d.goalMet }));
    const sessions = (Array.isArray(data.sessions) ? data.sessions : []).filter((s) => s && typeof s.id === 'string' && Number(s.date));
    const settings = Object.assign({}, DEFAULTS, data.settings || {});
    const wordIdSet = new Set(words.map((w) => w.id));
    const customList = (Array.isArray(data.custom) ? data.custom : []).filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string' && Array.isArray(c.wordIds)).map((c) => Object.assign({}, c, { name: clean(c.name).slice(0, 60), wordIds: c.wordIds.filter((x) => wordIdSet.has(x)), runs: Array.isArray(c.runs) ? c.runs.slice(-30) : [] }));
    await VL.db.clear(['words', 'collections', 'sessions', 'settings', 'days']);
    await VL.db.put('collections', cols);
    await VL.db.put('days', days);
    await VL.db.put('words', words);
    await VL.db.put('sessions', sessions);
    await VL.db.put('settings', Object.keys(settings).map((k) => ({ key: k, value: settings[k] })).concat([{ key: 'customSessions', value: customList }]));
    state.collections = cols.sort((a, b) => a.createdAt - b.createdAt);
    state.words = words; state.sessions = sessions.sort((a, b) => a.date - b.date); state.settings = settings;
    state.days = days.sort((a, b) => (a.date < b.date ? -1 : 1)); state.lesson = null;
    state.custom = customList;
    notify();
    return { words: words.length, collections: cols.length };
  }

  return {
    state, DEFAULTS, MASTERED_STREAK, load, onChange,
    collection, word, wordsIn, status, difficultWords, summarize, findDuplicate,
    addWord, updateWord, deleteWords, addCollection, renameCollection, deleteCollection, ensureCollection,
    recordAnswer, markLearned, addSession, customSession, addCustom, renameCustom, removeCustom, recordCustomRun, mistakeWords, dayRecord, logLearn, recordLearn, saveLesson, ensureDeckCollection, resetProgress, clearAll, setSetting, importWords, backup, restore,
  };
})();
