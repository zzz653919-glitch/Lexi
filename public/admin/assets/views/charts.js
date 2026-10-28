import { h } from '/js/ui.js';
const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs, ...kids) => { const e = document.createElementNS(NS, tag); Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v)); kids.forEach((k) => e.append(k)); return e; };

/* simple bar chart from [{date, value}] (real counts; y axis starts at 0) */
export function barChart(series, { label }) {
  const W = 360, H = 170, pad = { l: 28, r: 4, t: 8, b: 22 };
  const max = Math.max(1, ...series.map((p) => p.value));
  const bw = (W - pad.l - pad.r) / series.length;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': `${label}: ${series.map((p) => p.date + ' ' + p.value).join(', ')}`, preserveAspectRatio: 'xMidYMid meet' });
  [0, 0.5, 1].forEach((f) => { const y = pad.t + (H - pad.t - pad.b) * (1 - f); svg.append(s('line', { x1: pad.l, x2: W - pad.r, y1: y, y2: y, class: 'grid' })); const t = s('text', { x: 2, y: y + 3 }); t.textContent = String(Math.round(max * f)); svg.append(t); });
  series.forEach((p, i) => {
    const bh = (H - pad.t - pad.b) * (p.value / max);
    const r = s('rect', { x: pad.l + i * bw + bw * 0.12, y: pad.t + (H - pad.t - pad.b) - bh, width: Math.max(1, bw * 0.76), height: bh, class: 'bar', rx: 2 });
    const tt = s('title'); tt.textContent = `${p.date}: ${p.value}`; r.append(tt); svg.append(r);
  });
  [0, Math.floor(series.length / 2), series.length - 1].forEach((i) => { const t = s('text', { x: pad.l + i * bw, y: H - 6 }); t.textContent = series[i].date.slice(5); svg.append(t); });
  return h('div', {}, svg);
}
