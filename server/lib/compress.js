/* Response compression (Brotli / gzip) for text answers: JSON, JavaScript, CSS, HTML, SVG. No extra dependency.
   The body is collected, compressed on the thread pool (the event loop is never blocked) and sent with the right headers.
   Small bodies, images, fonts, 204/304 answers and anything already encoded are left alone. */
const zlib = require('node:zlib');

const TEXT = /^(application\/(json|javascript|manifest\+json)|text\/|image\/svg\+xml)/i;
const encodingOf = (req) => { const a = String(req.headers['accept-encoding'] || ''); return /\bbr\b/.test(a) ? 'br' : /\bgzip\b/.test(a) ? 'gzip' : null; };

function compress({ threshold = 1024 } = {}) {
  return (req, res, next) => {
    const enc = encodingOf(req);
    if (!enc || req.method === 'HEAD') return next();
    const write = res.write.bind(res), end = res.end.bind(res);
    const chunks = [];
    const toBuf = (c, e) => (Buffer.isBuffer(c) ? c : Buffer.from(c, typeof e === 'string' ? e : 'utf8'));
    res.write = (c, e, cb) => { if (c != null && c.length !== 0) chunks.push(toBuf(c, e)); if (typeof e === 'function') e(); else if (typeof cb === 'function') cb(); return true; };
    res.end = (c, e, cb) => {
      if (typeof c === 'function') { cb = c; c = null; } else if (typeof e === 'function') { cb = e; e = null; }
      if (c != null && c.length !== 0) chunks.push(toBuf(c, e));
      res.write = write; res.end = end;
      const body = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);
      const type = String(res.getHeader('Content-Type') || '');
      const cc = String(res.getHeader('Cache-Control') || '');
      const ok = body.length >= threshold && TEXT.test(type) && !res.getHeader('Content-Encoding') && res.statusCode !== 204 && res.statusCode !== 304 && !/no-transform/i.test(cc);
      res.vary ? res.vary('Accept-Encoding') : res.setHeader('Vary', 'Accept-Encoding');
      if (!ok) { if (!res.headersSent) res.setHeader('Content-Length', body.length); return end(body, cb); }
      const done = (err, out) => {
        if (err || !out || out.length >= body.length) { res.setHeader('Content-Length', body.length); return end(body, cb); }
        res.setHeader('Content-Encoding', enc); res.setHeader('Content-Length', out.length);
        const et = res.getHeader('ETag'); if (et && !/^W\//.test(String(et))) res.setHeader('ETag', 'W/' + et);   // the bytes differ from the stored file
        end(out, cb);
      };
      if (enc === 'br') zlib.brotliCompress(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: body.length } }, done);
      else zlib.gzip(body, { level: 6 }, done);
      return res;
    };
    next();
  };
}
module.exports = { compress };
