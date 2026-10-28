/* fetch wrapper: JSON in/out, CSRF token on every write, consistent errors. */
import { t, lang } from './i18n.js';
export class ApiError extends Error {
  constructor(status, message, data) { super(message); this.status = status; this.fields = (data && data.fields) || null; this.data = data || {}; }
}
export const session = { user: null, csrf: null, config: null, onUnauthorized: null, onMaintenance: null };

export async function api(method, url, body, opts = {}) {
  const headers = {};
  if (body !== undefined && !opts.raw) headers['Content-Type'] = 'application/json';
  if (session.csrf && method !== 'GET') headers['X-CSRF-Token'] = session.csrf;
  headers['X-Lang'] = lang();   // the server answers (error messages, content) in the language the learner sees
  if (opts.headers) Object.assign(headers, opts.headers);
  let res;
  try { res = await fetch('/api' + url, { method, headers, credentials: 'same-origin', body: opts.raw ? body : body === undefined ? undefined : JSON.stringify(body) }); }
  catch (_) { throw new ApiError(0, t('err.network')); }
  let data = null; try { data = await res.json(); } catch (_) { /* empty body */ }
  if (data && data.csrfToken) session.csrf = data.csrfToken;
  if (!res.ok) {
    const err = new ApiError(res.status, (data && data.error) || (data === null ? t('err.not_api', { status: res.status }) : t('err.generic')), Object.assign({ notApi: data === null }, data || {}));
    if (res.status === 401 && session.user && session.onUnauthorized) session.onUnauthorized();
    if (res.status === 503 && data && data.maintenance && session.onMaintenance) session.onMaintenance(err.message);
    throw err;
  }
  return data;
}
export const get = (u) => api('GET', u);
export const post = (u, b) => api('POST', u, b === undefined ? {} : b);
export const patch = (u, b) => api('PATCH', u, b);
export const put = (u, b) => api('PUT', u, b);
export const del = (u, b) => api('DELETE', u, b === undefined ? {} : b);
