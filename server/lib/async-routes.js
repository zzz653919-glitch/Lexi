/* Express 4 does not handle rejected promises from async route handlers. This makes it pass them to next(err), so the central
   error handler (translated messages, reference ids) sees every failure. Loaded once, before any router is created. */
const Layer = require('express/lib/router/layer');

if (!Layer.prototype.__asyncPatched) {
  const original = Layer.prototype.handle_request;
  Layer.prototype.handle_request = function handleRequest(req, res, next) {
    const fn = this.handle;
    if (fn.length > 3) return next();                       // error-handling middleware is invoked elsewhere
    try {
      const out = fn(req, res, next);
      if (out && typeof out.then === 'function') out.then(undefined, next);
    } catch (e) { next(e); }
    return undefined;
  };
  Layer.prototype.handle_request.original = original;
  Layer.prototype.__asyncPatched = true;
}
