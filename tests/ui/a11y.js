/* Layout and accessibility probes that run inside the page. */
exports.layoutProbe = () => {
  const vw = window.innerWidth;
  const issues = [];
  const scrollAncestor = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' && p !== document.body && p !== document.documentElement) return true; } return false; };
  if (document.documentElement.scrollWidth > vw + 1) issues.push(`horizontal page scroll: scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);
  const describe = (el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean).slice(0, 2).join('.') : '') + ' "' + (el.textContent || '').trim().slice(0, 24) + '"';
  const scope = document.querySelector('dialog[open]') || document.body;
  for (const el of scope.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[hidden]') || el.closest('dialog:not([open])') || el.closest('svg')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (cs.position === 'fixed' && r.bottom < 0) continue;
    if ((r.right > vw + 1 || r.left < -1) && !scrollAncestor(el) && !el.closest('.sr-only') && !el.classList.contains('sr-only') && !el.classList.contains('skip')) issues.push(`outside viewport: ${describe(el)} (${Math.round(r.left)}..${Math.round(r.right)})`);
    if (/^(BUTTON|A)$/.test(el.tagName) || el.classList.contains('chip') || el.classList.contains('option')) {
      if (cs.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 2 && cs.overflowX !== 'visible') issues.push(`clipped text: ${describe(el)} (${el.scrollWidth} > ${el.clientWidth})`);
    }
  }
  // overlapping controls: two visible buttons whose boxes intersect substantially
  const btns = Array.from(scope.querySelectorAll('button, a.btn, .option, input, select')).filter((e) => { const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return c.display !== 'none' && c.visibility !== 'hidden' && r.width > 0 && r.height > 0 && !e.closest('[hidden]') && !e.closest('dialog:not([open])') && !e.classList.contains('sr-only') && !e.disabled === !e.disabled; });
  for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) {
    const a = btns[i], b = btns[j]; if (a.contains(b) || b.contains(a)) continue;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (w > 4 && h > 4 && !(a.closest('.tile-area') && b.closest('.tile-area')) && !a.classList.contains('tile') && !b.classList.contains('tile') && getComputedStyle(a).position !== 'fixed' && getComputedStyle(b).position !== 'fixed') issues.push(`overlap: ${describe(a)} / ${describe(b)}`);
  }
  return issues;
};

exports.a11yProbe = () => {
  const issues = [];
  const visible = (el) => { const c = getComputedStyle(el); const r = el.getBoundingClientRect(); return c.display !== 'none' && c.visibility !== 'hidden' && !el.closest('[hidden]') && !el.closest('dialog:not([open])'); };
  const name = (el) => {
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
    const lb = el.getAttribute('aria-labelledby'); if (lb) return lb.split(' ').map((id) => (document.getElementById(id) || {}).textContent || '').join(' ').trim();
    if (el.id) { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l && l.textContent.trim()) return l.textContent.trim(); }
    const wrap = el.closest('label'); if (wrap && wrap.textContent.trim()) return wrap.textContent.trim();
    if (el.getAttribute('title')) return el.getAttribute('title');
    return (el.textContent || '').trim();
  };
  const desc = (el) => el.tagName.toLowerCase() + (el.name ? `[name=${el.name}]` : '') + ' ' + (el.className || '').toString().slice(0, 30);
  document.querySelectorAll('input:not([type=hidden]), select, textarea').forEach((el) => { if (visible(el) && !name(el) && !el.placeholder) issues.push('form control without a label: ' + desc(el)); });
  document.querySelectorAll('button, a[href], [role=button]').forEach((el) => { if (visible(el) && !name(el)) issues.push('control without an accessible name: ' + desc(el)); });
  document.querySelectorAll('img').forEach((el) => { if (!el.hasAttribute('alt')) issues.push('image without alt: ' + el.getAttribute('src')); });
  if (!document.documentElement.lang) issues.push('missing <html lang>');
  if (!document.title.trim()) issues.push('empty page title');
  const mains = document.querySelectorAll('main, [role=main]').length; if (mains !== 1) issues.push(`expected 1 main landmark, found ${mains}`);
  const h1 = Array.from(document.querySelectorAll('h1')).filter(visible).length; if (h1 !== 1) issues.push(`expected 1 visible h1, found ${h1}`);
  const ids = {}; document.querySelectorAll('[id]').forEach((el) => { ids[el.id] = (ids[el.id] || 0) + 1; }); Object.entries(ids).forEach(([k, n]) => { if (n > 1) issues.push('duplicate id ' + k); });
  document.querySelectorAll('[aria-labelledby], [aria-describedby]').forEach((el) => { (el.getAttribute('aria-labelledby') || el.getAttribute('aria-describedby')).split(' ').forEach((id) => { if (!document.getElementById(id)) issues.push('aria reference to a missing id: ' + id); }); });
  return issues;
};

/* WCAG contrast of the text in the given selectors (normalises any CSS colour through a canvas) */
exports.contrastProbe = (selectors) => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (css) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = css; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bg = (el) => { let acc = [255, 255, 255, 0]; const layers = []; for (let p = el; p; p = p.parentElement) { const c = rgba(getComputedStyle(p).backgroundColor); if (c[3] > 0) layers.push(c); if (c[3] === 1) break; } let base = [getComputedStyle(document.documentElement).colorScheme.includes('dark') ? 15 : 255, 0, 0, 1]; const body = rgba(getComputedStyle(document.body).backgroundColor); base = body[3] > 0 ? body : [255, 255, 255, 1]; let out = base.slice(0, 3); for (const l of layers.reverse()) out = out.map((v, i) => l[i] * l[3] + v * (1 - l[3])); return out; };
  const res = [];
  for (const sel of selectors) {
    const els = Array.from(document.querySelectorAll(sel)).filter((e) => { const c = getComputedStyle(e); return c.display !== 'none' && c.visibility !== 'hidden' && !e.closest('[hidden]') && (e.textContent || '').trim() && !e.disabled; }).slice(0, 3);
    for (const el of els) {
      const cs = getComputedStyle(el); const fg = rgba(cs.color); const b = bg(el);
      const fgc = fg.slice(0, 3).map((v, i) => fg[3] * v + (1 - fg[3]) * b[i]);
      const L1 = lum(fgc), L2 = lum(b); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const px = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 700; const large = px >= 24 || (px >= 18.66 && bold);
      res.push({ sel, ratio: Math.round(ratio * 100) / 100, need: large ? 3 : 4.5, text: el.textContent.trim().slice(0, 20) });
    }
  }
  return res;
};
