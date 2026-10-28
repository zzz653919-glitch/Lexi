/* Motion settings and small effects. The preference is stored on this device:
     'system' (default) follows the operating system's "reduce motion" setting, 'on' always animates, 'off' never does.
   CSS reads <html data-motion="on|off">; JavaScript effects (confetti, counters, loaders) check enabled() first. */
const KEY = 'lexi.motion';
const media = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const listeners = new Set();

const read = () => { try { const v = localStorage.getItem(KEY); return ['system', 'on', 'off'].includes(v) ? v : 'system'; } catch (_) { return 'system'; } };
let pref = read();

export const getPref = () => pref;
export const enabled = () => (pref === 'on' ? true : pref === 'off' ? false : !(media && media.matches));
function apply() { document.documentElement.dataset.motion = enabled() ? 'on' : 'off'; listeners.forEach((fn) => { try { fn(enabled()); } catch (_) { /* ignore */ } }); }
export function setPref(v) {
  if (!['system', 'on', 'off'].includes(v)) return;
  pref = v;
  try { localStorage.setItem(KEY, v); } catch (_) { /* the choice still applies to this visit */ }
  apply();
}
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
if (media && media.addEventListener) media.addEventListener('change', apply);
apply();

const el = (tag, cls, style) => { const e = document.createElement(tag); e.className = cls; if (style) for (const [k, v] of Object.entries(style)) e.style.setProperty(k, v); return e; };

/* a short burst of stars or confetti around `anchor` (an element) or the middle of the screen; removes itself afterwards */
export function burst(anchor, { kind = 'stars', count } = {}) {
  if (!enabled()) return;
  const n = count || (kind === 'confetti' ? 46 : 9);
  const layer = el('div', 'fx-layer fx-' + kind);
  layer.setAttribute('aria-hidden', 'true');
  const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null;
  layer.style.left = (r ? r.left + r.width / 2 : window.innerWidth / 2) + 'px';
  layer.style.top = (r ? r.top + Math.min(r.height / 2, 40) : window.innerHeight * 0.35) + 'px';
  const colors = ['#1f9d6b', '#f5a524', '#3b82f6', '#e5484d', '#a78bfa', '#2dd4bf'];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.5, d = (kind === 'confetti' ? 90 + Math.random() * 190 : 34 + Math.random() * 46);
    const p = el('i', 'fx-p', { '--dx': Math.cos(a) * d + 'px', '--dy': Math.sin(a) * d - (kind === 'confetti' ? 60 : 12) + 'px', '--rot': Math.round(Math.random() * 720 - 360) + 'deg', '--c': colors[i % colors.length], '--dl': Math.round(Math.random() * 120) + 'ms', '--s': (kind === 'confetti' ? 6 + Math.random() * 6 : 10 + Math.random() * 8) + 'px' });
    layer.append(p);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), kind === 'confetti' ? 2200 : 1100);
}

/* animates a number from `from` to `to` (real values only); without motion it just shows the final value */
export function countUp(node, from, to, { ms = 700, format = (v) => String(v) } = {}) {
  if (!node) return;
  if (!enabled() || from === to || !Number.isFinite(from) || !Number.isFinite(to)) { node.textContent = format(to); return; }
  const t0 = performance.now();
  const step = (now) => {
    if (!node.isConnected) return;
    const k = Math.min(1, (now - t0) / ms), eased = 1 - Math.pow(1 - k, 3);
    node.textContent = format(Math.round(from + (to - from) * eased));
    if (k < 1) requestAnimationFrame(step); else node.textContent = format(to);
  };
  requestAnimationFrame(step);
}

/* plays a one-shot CSS animation class on an element (restartable) */
export function play(node, cls, ms = 600) {
  if (!node || !enabled()) return;
  node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls);
  setTimeout(() => node.classList.remove(cls), ms);
}
