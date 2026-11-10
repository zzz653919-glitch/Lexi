/* Turns flat SVG artwork into lit surfaces: every solid fill becomes a soft gradient (light from the upper left), the picture gets a
   gentle contact shadow, and the highlights stay crisp. Used for the Kids friends and by the script that prepares the static mascots. */
const expand = (c) => (c.length === 4 ? '#' + [...c.slice(1)].map((x) => x + x).join('') : c).toLowerCase();
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join(''); };

export function lit(svg, uid = 'x', { shadow = true } = {}) {
  const open = (svg.match(/^<svg[^>]*>/) || [''])[0];
  if (!open) return svg;
  const map = new Map(), defs = [];
  const body = svg.slice(open.length, svg.lastIndexOf('</svg>')).replace(/fill="(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})"/g, (m, c) => {
    const col = expand(c);
    if (!map.has(col)) {
      const id = `lg${uid}_${map.size}`; map.set(col, id);
      defs.push(`<radialGradient id="${id}" cx=".34" cy=".26" r=".95"><stop offset="0" stop-color="${shade(col, 1.2)}"/><stop offset=".5" stop-color="${col}"/><stop offset="1" stop-color="${shade(col, .8)}"/></radialGradient>`);
    }
    return `fill="url(#${map.get(col)})"`;
  });
  const sh = shadow ? `<filter id="ls${uid}" x="-12%" y="-12%" width="130%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#1b1240" flood-opacity=".28"/></filter>` : '';
  return `${open}<defs>${defs.join('')}${sh}</defs><g${shadow ? ` filter="url(#ls${uid})"` : ''}>${body}</g></svg>`;
}
