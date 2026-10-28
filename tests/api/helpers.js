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
