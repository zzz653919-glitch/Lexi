/* fetch wrapper: JSON in/out, CSRF token on every write, consistent errors. */
export class ApiError extends Error {
  constructor(status, message, data) { super(message); this.status = status; this.fields = (data && data.fields) || null; this.data = data || {}; }
}
export const session = { user: null, csrf: null, config: null, onUnauthorized: null, onMaintenance: null };

export async function api(method, url, body, opts = {}) {
  const headers = {};
  if (body !== undefined && !opts.raw) headers['Content-Type'] = 'application/json';
  if (session.csrf && method !== 'GET') headers['X-CSRF-Token'] = session.csrf;
  if (opts.headers) Object.assign(headers, opts.headers);
  let res;
  try { res = await fetch('/api' + url, { method, headers, credentials: 'same-origin', body: opts.raw ? body : body === undefined ? undefined : JSON.stringify(body) }); }
  catch (_) { throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.'); }
  let data = null; try { data = await res.json(); } catch (_) { /* empty body */ }
  if (data && data.csrfToken) session.csrf = data.csrfToken;
  if (!res.ok) {
    const err = new ApiError(res.status, (data && data.error) || (data === null ? `The server answered ${res.status} but not with data from the Lexi Learn API.` : 'Something went wrong.'), Object.assign({ notApi: data === null }, data || {}));
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
