/* Test helpers: a real server on an ephemeral port with a temporary database, and a small HTTP client with a cookie jar + CSRF token. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../../server/app');
const seed = require('../../server/seed');
const A = require('../../server/lib/auth');

async function startServer(opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lexi-test-'));
  const inst = createApp({ dbPath: path.join(dir, 'test.sqlite'), dataDir: dir, rateLimit: false, quiet: true, ...opts });
  if (opts.seed !== false) seed.ensureSample(inst.db);
  const server = await new Promise((resolve) => { const s = inst.app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const createUser = ({ email, password = 'Passw0rd!x', role = 'learner', name = 'Test User', timezone = 'UTC' }) => {
    const t = new Date().toISOString();
    return inst.db.run('INSERT INTO users (email, display_name, password_hash, role, timezone, hearts, hearts_updated_at, created_at) VALUES (?,?,?,?,?,?,?,?)', email, name, A.hashPassword(password), role, timezone, 5, t, t).id;
  };
  return { ...inst, base, dir, createUser, async stop() { await new Promise((r) => server.close(r)); inst.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
}

class Client {
  constructor(base) { this.base = base; this.cookie = ''; this.csrf = null; }
  async req(method, url, body, extra = {}) {
    const headers = { ...(extra.headers || {}) };
    if (body !== undefined && !extra.raw) headers['Content-Type'] = 'application/json';
    if (this.cookie) headers.Cookie = this.cookie;
    if (this.csrf && method !== 'GET') headers['X-CSRF-Token'] = this.csrf;
    const res = await fetch(this.base + url, { method, headers, body: extra.raw ? body : body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const c of set) { const [kv] = c.split(';'); const [k, v] = kv.split('='); if (/Max-Age=0/i.test(c) || !v) this.cookie = ''; else this.cookie = `${k}=${v}`; }
    let json = null; const text = await res.text();
    try { json = JSON.parse(text); } catch (_) { /* not json */ }
    if (json && json.csrfToken) this.csrf = json.csrfToken;
    return { status: res.status, json, text, headers: res.headers };
  }
  get(u) { return this.req('GET', u); }
  post(u, b) { return this.req('POST', u, b === undefined ? {} : b); }
  put(u, b) { return this.req('PUT', u, b); }
  patch(u, b) { return this.req('PATCH', u, b); }
  del(u, b) { return this.req('DELETE', u, b === undefined ? {} : b); }
  async login(email, password = 'Passw0rd!x') { const r = await this.post('/api/auth/login', { email, password }); if (r.status !== 200) throw new Error('login failed ' + r.status + ' ' + r.text); return r; }
}

module.exports = { startServer, Client };

/* ---------- answers for API-level tests (the test process can read the database; the browser cannot) ---------- */
const X = require('../../server/lib/exercises');
const { shuffled } = require('../../server/lib/util');
const permOf = (n, seed) => { const idx = Array.from({ length: n }, (_, i) => i); let p = shuffled(idx, seed); for (let k = 1; k < 6 && n > 1 && p.every((v, i) => v === i); k++) p = shuffled(idx, seed + k * 104729); return p; };
function answerFor(db, state, wrong = false) {
  const ex = state.exercise, row = db.get('SELECT * FROM exercises WHERE id = ?', ex.id), opts = db.all('SELECT * FROM exercise_options WHERE exercise_id = ? ORDER BY position, id', ex.id), alts = X.alternatives(row.answer);
  const seed = db.get('SELECT seed FROM lesson_attempts WHERE id = ?', state.attemptId).seed + ex.id;
  if (X.CHOICE.has(ex.type)) return (opts.find((o) => (wrong ? !o.is_correct : o.is_correct))).id;
  if (['fill_blank', 'listen_type', 'translate_type', 'fix_spelling'].includes(ex.type)) return wrong ? 'qqqzzz' : alts[0];
  if (ex.type === 'scramble_letters') { const ids = alts[0].split('').map((_, i) => i); return wrong ? ids.reverse() : ids; }
  if (ex.type === 'order_words') { const ids = X.tokensOf(row.sentence).map((_, i) => i); return wrong ? ids.reverse() : ids; }
  if (ex.type === 'match_pairs') { const p = permOf(opts.length, seed); return opts.map((_, i) => ({ left: i, right: wrong && i < 2 ? p.findIndex((s) => s === (i + 1) % 2) : p.findIndex((s) => s === i) })); }
  throw new Error('unknown type');
}
/* plays an attempt to the end through the API; wrongAt = set of question numbers (1-based) to answer wrongly */
async function playAttempt(client, state, db, { wrongAt = new Set() } = {}) {
  let n = 0, last = null;
  while (state.status === 'in_progress' && state.exercise) {
    n++;
    const r = await client.post(`/api/attempts/${state.attemptId}/answer`, { exerciseId: state.exercise.id, answer: answerFor(db, state, wrongAt.has(n)) });
    if (r.status !== 200) throw new Error('answer failed ' + r.status + ' ' + r.text);
    last = r.json; state = r.json.state;
    if (n > 80) throw new Error('lesson does not end');
  }
  return { state, last, answered: n };
}
module.exports.answerFor = answerFor; module.exports.playAttempt = playAttempt;
