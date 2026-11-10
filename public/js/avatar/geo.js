/* Shared drawing helpers of the avatar renderer: colour maths and the body geometry the clothes are cut to. */
export const INK = '#2b2640';
export const shade = (hex, k) => { if (/^#[0-9a-f]{3}$/i.test(hex)) hex = '#' + [...hex.slice(1)].map((x) => x + x).join(''); const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join(''); };
export function stripe(art, x, y, w, h) { if (art.p === 'stripes') return Array.from({ length: Math.floor(h / 14) }, (_, i) => `<rect x="${x}" y="${y + 6 + i * 14}" width="${w}" height="6" fill="${art.c2}" opacity=".9"/>`).join(''); if (art.p === 'dots') return Array.from({ length: 8 }, (_, i) => `<circle cx="${x + 12 + (i % 3) * 22}" cy="${y + 14 + Math.floor(i / 3) * 24}" r="4.2" fill="${art.c2}" opacity=".9"/>`).join(''); return ''; }
export const MR = (s) => `<g transform="translate(240 0) scale(-1 1)">${s}</g>`;   // the right side is the left side mirrored
export const dk = (c, k = .8) => shade(c, k);
export const bodyP = (y2 = 236) => `M88 150Q120 139 152 150L157 ${y2 - 34}Q158 ${y2 - 8} 152 ${y2}L88 ${y2}Q82 ${y2 - 8} 83 ${y2 - 34}Z`;
export const sideShade = (y2 = 236) => `<path d="M120 142Q140 143 152 150L157 ${y2 - 34}Q158 ${y2 - 8} 152 ${y2}L120 ${y2}Z" fill="#1b1240" opacity=".08"/>`;
export const folds = (c) => `<path d="M95 218Q103 211 111 220M133 210Q142 205 147 214M100 190Q106 186 110 192" fill="none" stroke="${dk(c, .66)}" stroke-opacity=".45" stroke-width="2" stroke-linecap="round"/>`;
export const sleeveL = (c, S, len = 'short', cuff, wide = 0) => {
  const d = len === 'long' ? `M91 151Q${68 - wide} 152 ${65 - wide} 177Q${62 - wide} 200 ${62.5 - wide} 217Q74 224 86 219L89 190L91 168Z` : `M91 151Q${68 - wide} 152 ${65 - wide} 177L${63.6 - wide} 197Q76 203 88.5 197L90 170Z`;
  const cf = len === 'long' ? `<path d="M${62.4 - wide} 212Q74 219 86.2 214L85.8 221Q74 227 ${62.6 - wide} 220Z" fill="${cuff || dk(c, .78)}" ${S}/>` : `<path d="M${63.6 - wide} 192Q76 198 89 192L88.6 198Q76 204 ${63.6 - wide} 198Z" fill="${cuff || dk(c, .86)}"/>`;
  return `<path d="${d}" fill="${c}" ${S}/>${cf}<path d="M70 160Q66 170 66 182" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="3" stroke-linecap="round"/>`;
};
export const sleeves = (c, S, len, cuff, wide) => sleeveL(c, S, len, cuff, wide) + MR(sleeveL(c, S, len, cuff, wide));
export const neckRound = (c, F) => `<path d="M104 146Q120 168 136 146Z" fill="${F}"/><path d="M103 145Q120 171 137 145" fill="none" stroke="${dk(c, .7)}" stroke-width="4" stroke-linecap="round"/>`;
export const legsP = (c, S, end = 308, top = 226) => `<path d="M90 ${top}H150L${end > 280 ? 148.5 : 151} ${end}H122.5L120 ${top + 28}L117.5 ${end}H${end > 280 ? 91.5 : 89}Z" fill="${c}" ${S}/><path d="M120 ${top + 28}L122.5 ${end}H${end > 280 ? 148.5 : 151}L150 ${top}H120Z" fill="#1b1240" opacity=".09"/><path d="M106 ${top + 50}Q108 ${top + 56} 106 ${top + 62}M134 ${top + 50}Q132 ${top + 56} 134 ${top + 62}" fill="none" stroke="${dk(c, .65)}" stroke-opacity=".5" stroke-width="2" stroke-linecap="round"/>`;
export const hemBand = (c, y) => `<path d="M85.6 ${y}Q120 ${y + 5} 154.4 ${y}L153 ${y + 9}H87Z" fill="${dk(c, .8)}"/>`;
