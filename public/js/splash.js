/* The start-up screen (markup lives in index.html so it appears before any JavaScript runs).
   It reports REAL stages only: each step is called when that piece of work has actually finished, and the bar shows
   completed steps / total steps. There is no timer-driven fake progress. */
const root = document.getElementById('splash');
const msg = document.getElementById('splash-msg');
const fill = document.getElementById('splash-fill');
const bar = document.getElementById('splash-bar');
if (root) root.classList.add('alive');

/* step(done, total, text): `done` of `total` stages are finished */
export function step(done, total, text) {
  if (!root) return;
  const pct = Math.round((100 * done) / total);
  fill.style.width = pct + '%';
  bar.setAttribute('aria-valuenow', String(pct));
  if (text !== undefined) msg.textContent = text;
}
export function say(text) { if (msg) msg.textContent = text; }

/* fades the screen out (after the first page has really been drawn) and removes it */
export function finish() {
  if (!root) return;
  step(1, 1);
  const done = () => { root.remove(); };
  root.classList.add('out');
  const reduced = document.documentElement.dataset.motion === 'off';
  if (reduced) done(); else setTimeout(done, 560);
}
/* removes it at once (used when an error or maintenance screen takes over) */
export function dismiss() { if (root) { root.classList.add('out'); setTimeout(() => root.remove(), 520); } }
