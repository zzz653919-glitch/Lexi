/* Avatar Studio drawing: every character is composed of SVG layers from parameters (face parts, style, equipped items). Original artwork, no external files. */
export const SKINS = ['#ffe0c7', '#fcd1ae', '#f1b98a', '#d99a6c', '#b97a4c', '#8d5524', '#6b3f1d', '#4a2a14'];
export const HAIRS = ['#1c1a1a', '#3b2314', '#6b4423', '#a86b32', '#d9a441', '#f2d16b', '#c0392b', '#e86bb0', '#4a90e2', '#8e5bd9'];
export const EYES = ['#3b2314', '#5a3a1f', '#2f7bff', '#2fb36d', '#7a8c99', '#8e5bd9', '#16b8a6', '#c0392b'];
const METALS = ['#e8ecf5', '#cfd6e6', '#b4c6e8', '#9ad6c8', '#f3c6d9', '#f7d08a', '#c9b6f2', '#8e99ad'];
export const STYLE_NAMES = ['cartoon', 'modern', 'fantasy', 'animal', 'robot'];
const INK = '#2b2640';
let counter = 0;
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join(''); };

/* ---------- face parts ---------- */
const headShape = (i, f, S) => ([
  `<ellipse cx="120" cy="88" rx="52" ry="52" fill="${f}" ${S}/>`, `<ellipse cx="120" cy="90" rx="46" ry="58" fill="${f}" ${S}/>`, `<rect x="68" y="38" width="104" height="104" rx="30" fill="${f}" ${S}/>`,
  `<path d="M120 142C62 104 58 56 92 46C108 42 118 52 120 60C122 52 132 42 148 46C182 56 178 104 120 142Z" fill="${f}" ${S}/>`, `<ellipse cx="120" cy="92" rx="42" ry="62" fill="${f}" ${S}/>`][i] || '');
/* the hair is drawn from the head's own outline, so every hairstyle sits on every face shape */
const HEAD_FIT = [{ top: 36, w: 52 }, { top: 32, w: 46 }, { top: 38, w: 52 }, { top: 44, w: 58 }, { top: 30, w: 42 }];
const fit = (shape) => HEAD_FIT[shape] || HEAD_FIT[0];
function hairBack(i, c, S, shape) {
  const { w } = fit(shape), L = 120 - w - 8, R = 120 + w + 8;
  return [ '', '', `<path d="M${L} 84C${L - 6} 150 ${L + 10} 184 92 186L148 186C${R - 10} 184 ${R + 6} 150 ${R} 84Z" fill="${c}" ${S}/>`, `<path d="M${L} 84C${L - 4} 130 ${L + 6} 142 88 144L152 144C${R - 6} 142 ${R + 4} 130 ${R} 84Z" fill="${c}" ${S}/>`,
    `<path d="M${R - 8} 78C${R + 28} 82 ${R + 34} 132 ${R + 12} 166C${R + 2} 134 ${R + 2} 104 ${R - 10} 92Z" fill="${c}" ${S}/>`, `<g fill="${c}" ${S}><circle cx="${L + 6}" cy="86" r="18"/><circle cx="${R - 6}" cy="86" r="18"/><circle cx="${L + 12}" cy="110" r="15"/><circle cx="${R - 12}" cy="110" r="15"/></g>` ][i] || '';
}
function hairFront(i, c, S, shape) {
  const { top, w } = fit(shape), L = 120 - w - 1, R = 120 + w + 1, cy = Math.round(86 - (86 - (top - 3)) / 0.75);
  const cap = `<path d="M${L} 88C${L - 3} ${cy} ${R + 3} ${cy} ${R} 88C${R - 12} 70 ${R - 32} 63 120 63C${L + 32} 63 ${L + 12} 70 ${L} 88Z" fill="${c}" ${S}/>`;
  const dy = top - 36;
  return [ '', cap, cap, cap, cap,
    `<g fill="${c}" ${S} transform="translate(0 ${dy})"><circle cx="86" cy="48" r="19"/><circle cx="112" cy="40" r="20"/><circle cx="138" cy="42" r="20"/><circle cx="160" cy="54" r="18"/><circle cx="76" cy="66" r="15"/><circle cx="${Math.max(164, R - 2)}" cy="68" r="14"/></g>` ][i] || '';
}
function eyes(i, col, S, robot, u) {
  if (robot) return `<g class="av-eyes"><rect x="86" y="80" width="22" height="18" rx="6" fill="${col}"/><rect x="132" y="80" width="22" height="18" rx="6" fill="${col}"/><rect x="90" y="83" width="6" height="5" rx="2" fill="#fff" opacity=".8"/><rect x="136" y="83" width="6" height="5" rx="2" fill="#fff" opacity=".8"/></g>`;
  const ir = u ? `url(#ir${u})` : col;
  const eye = (cx) => [
    `<ellipse cx="${cx}" cy="90" rx="11" ry="12" fill="#fff"/><circle cx="${cx}" cy="91" r="7.5" fill="${ir}"/><circle cx="${cx}" cy="91" r="3.6" fill="${INK}"/><circle cx="${cx + 2.6}" cy="87.6" r="2.6" fill="#fff"/><circle cx="${cx - 2.6}" cy="94.6" r="1.3" fill="#fff" opacity=".9"/>`,
    `<path d="M${cx - 13} 91Q${cx} 78 ${cx + 13} 91Q${cx} 102 ${cx - 13} 91Z" fill="#fff"/><circle cx="${cx}" cy="91" r="6.2" fill="${ir}"/><circle cx="${cx}" cy="91" r="3" fill="${INK}"/><circle cx="${cx + 2}" cy="89" r="1.8" fill="#fff"/>`,
    `<ellipse cx="${cx}" cy="91" rx="13" ry="16" fill="#fff"/><circle cx="${cx}" cy="93" r="10" fill="${ir}"/><circle cx="${cx}" cy="93" r="5" fill="${INK}"/><circle cx="${cx + 4}" cy="87" r="3.4" fill="#fff"/><circle cx="${cx - 3}" cy="98" r="1.8" fill="#fff"/>`,
    `<path d="M${cx - 11} 92A11 11 0 0 0 ${cx + 11} 92Z" fill="#fff"/><path d="M${cx - 7} 92A7 7 0 0 0 ${cx + 7} 92Z" fill="${ir}"/><path d="M${cx - 12} 91Q${cx} 86 ${cx + 12} 91" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    `<ellipse cx="${cx}" cy="90" rx="11" ry="12" fill="#fff"/><circle cx="${cx}" cy="91" r="7.5" fill="${ir}"/><circle cx="${cx}" cy="91" r="3.6" fill="${INK}"/><circle cx="${cx + 2.6}" cy="87.6" r="2.2" fill="#fff"/>`,
    `<ellipse cx="${cx}" cy="90" rx="11" ry="12" fill="#fff"/><circle cx="${cx}" cy="91" r="8" fill="${ir}"/><path d="M${cx} 85l1.8 3.7 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6z" fill="#fff"/>`][i] || '';
  const lid = (cx) => ([0, 1, 2, 5].includes(i) ? `<path d="M${cx - 13} 86Q${cx} 76 ${cx + 13} 86" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/><path d="M${cx - 13} 86l-4-3M${cx + 13} 86l4-3" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>` : '');
  const wink = i === 4 ? `<path d="M131 92Q143 82 155 92" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>` : eye(143) + lid(143);
  return `<g class="av-eyes">${eye(97)}${lid(97)}${wink}</g>`;
}
const brows = (i, hc) => { const c = shade(hc, .8), w = [3.5, 3.5, 6, 2, 4][i] || 3.5, d = [['M84 70H110', 'M130 70H156'], ['M84 72Q97 62 110 70', 'M130 70Q143 62 156 72'], ['M84 70H110', 'M130 70H156'], ['M84 70H110', 'M130 70H156'], ['M84 64L110 72', 'M156 64L130 72']][i] || ['M84 70H110', 'M130 70H156'];
  return `<g stroke="${c}" stroke-width="${w}" stroke-linecap="round" fill="none"><path d="${d[0]}"/><path d="${d[1]}"/></g>`; };
const mouth = (i, robot) => {
  if (robot) return `<g fill="none" stroke="#5ef2ff" stroke-width="4" stroke-linecap="round">${['<path d="M100 118Q120 130 140 118"/>', '<path d="M98 116H142M108 116v8M120 116v8M132 116v8"/>', '<path d="M102 120H138"/>', '<rect x="106" y="114" width="28" height="12" rx="5"/>', '<path d="M104 122Q122 124 138 112"/>', '<path d="M100 118Q120 130 140 118M116 126v8"/>'][i] || ''}</g>`;
  return [`<path d="M100 114Q120 132 140 114" stroke="${INK}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`,
    `<path d="M96 112Q120 140 144 112Z" fill="#fff" stroke="${INK}" stroke-width="3.4" stroke-linejoin="round"/><path d="M100 118H140" stroke="${INK}" stroke-width="1.6"/>`,
    `<path d="M104 120H136" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>`, `<ellipse cx="120" cy="121" rx="12" ry="10" fill="#7a1f2b" stroke="${INK}" stroke-width="3"/><ellipse cx="120" cy="126" rx="7" ry="4" fill="#ff7a93"/>`,
    `<path d="M102 120Q122 124 140 110" stroke="${INK}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`, `<path d="M100 114Q120 130 140 114" stroke="${INK}" stroke-width="3.6" fill="none" stroke-linecap="round"/><path d="M114 124Q120 142 128 124Z" fill="#ff7a93" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`][i] || '';
};

/* ---------- clothes and accessories (drawn from the item's art parameters) ---------- */
function stripe(art, x, y, w, h) { if (art.p === 'stripes') return Array.from({ length: Math.floor(h / 14) }, (_, i) => `<rect x="${x}" y="${y + 6 + i * 14}" width="${w}" height="6" fill="${art.c2}" opacity=".9"/>`).join(''); if (art.p === 'dots') return Array.from({ length: 8 }, (_, i) => `<circle cx="${x + 12 + (i % 3) * 22}" cy="${y + 14 + Math.floor(i / 3) * 24}" r="4.2" fill="${art.c2}" opacity=".9"/>`).join(''); return ''; }
const torso = (c, S, y2 = 236) => `<path d="M88 150Q120 140 152 150L156 ${y2 - 20}Q156 ${y2} 138 ${y2}L102 ${y2}Q84 ${y2} 84 ${y2 - 20}Z" fill="${c}" ${S}/>`;
const CLOTHES = {
  tee: (a, S) => `<g>${torso(a.c, S)}<path d="M88 152L62 160L66 188L86 182ZM152 152L178 160L174 188L154 182Z" fill="${a.c}" ${S}/>${stripe(a, 86, 156, 68, 80)}<path d="M108 148Q120 160 132 148" fill="none" stroke="${shade(a.c, .7)}" stroke-width="3"/></g>`,
  hoodie: (a, S) => `<g>${torso(a.c, S, 240)}<path d="M88 152L62 160L66 222L86 224ZM152 152L178 160L174 222L154 224Z" fill="${a.c}" ${S}/>${stripe(a, 86, 160, 68, 80)}<path d="M96 148Q120 176 144 148Q120 138 96 148Z" fill="${shade(a.c, .85)}" ${S}/><path d="M120 164V190" stroke="${shade(a.c, .6)}" stroke-width="3"/><rect x="100" y="206" width="40" height="22" rx="8" fill="${shade(a.c, .9)}" ${S}/></g>`,
  jacket: (a, S) => `<g>${torso(a.c, S, 238)}<path d="M88 152L60 162L64 222L86 224ZM152 152L180 162L176 222L154 224Z" fill="${a.c}" ${S}/>${stripe(a, 86, 160, 68, 76)}<path d="M120 150V238" stroke="${shade(a.c, .55)}" stroke-width="3"/><path d="M104 148L120 172L136 148Z" fill="${shade(a.c, .8)}" ${S}/><circle cx="114" cy="190" r="3" fill="#ffd23f"/><circle cx="114" cy="210" r="3" fill="#ffd23f"/></g>`,
  shirt: (a, S) => `<g>${torso(a.c, S)}<path d="M88 152L62 160L64 206L84 204ZM152 152L178 160L176 206L156 204Z" fill="${a.c}" ${S}/>${stripe(a, 86, 156, 68, 80)}<path d="M104 148L120 168L136 148L128 144L120 154L112 144Z" fill="#fff" ${S}/><g fill="${shade(a.c, .6)}"><circle cx="120" cy="178" r="2.6"/><circle cx="120" cy="196" r="2.6"/><circle cx="120" cy="214" r="2.6"/></g></g>`,
  pants: (a, S) => `<g><path d="M92 226H148L150 308H126L120 252L114 308H90Z" fill="${a.c}" ${S}/><rect x="90" y="222" width="60" height="12" rx="4" fill="${shade(a.c, .8)}" ${S}/>${stripe(a, 92, 236, 56, 60)}</g>`,
  shorts: (a, S) => `<g><path d="M92 226H148L152 272H126L120 250L114 272H88Z" fill="${a.c}" ${S}/><rect x="90" y="222" width="60" height="12" rx="4" fill="${shade(a.c, .8)}" ${S}/>${stripe(a, 92, 236, 56, 30)}</g>`,
  dress: (a, S) => `<g><path d="M90 150Q120 140 150 150L158 236L178 290Q120 308 62 290L82 236Z" fill="${a.c}" ${S}/>${stripe(a, 84, 160, 72, 120)}<rect x="88" y="190" width="64" height="8" fill="${shade(a.c, .75)}"/><path d="M88 152L70 168L76 182L90 170ZM152 152L170 168L164 182L150 170Z" fill="${a.c}" ${S}/></g>`,
  shoes: (a, S) => `<g>${[[88, 0], [124, 0]].map(([x]) => `<path d="M${x} 296H${x + 30}Q${x + 38} 304 ${x + 34} 316H${x - 4}Q${x - 6} 304 ${x} 296Z" fill="${a.c}" ${S}/><path d="M${x - 4} 316Q${x + 12} 304 ${x + 34} 316Z" fill="${a.c2 || '#fff'}" opacity=".9"/><rect x="${x - 5}" y="314" width="42" height="8" rx="4" fill="${a.c2 || '#fff'}" ${S}/><path d="M${x + 6} 302H${x + 24}M${x + 8} 307H${x + 26}" stroke="${a.c2 || '#fff'}" stroke-width="2.4" stroke-linecap="round"/>`).join('')}</g>`,
  glasses: (a, S) => `<g fill="rgba(200,230,255,.25)" stroke="${a.c}" stroke-width="4"><circle cx="97" cy="90" r="17"/><circle cx="143" cy="90" r="17"/><path d="M114 90H126" fill="none"/><path d="M80 88L70 84M160 88L170 84" fill="none"/></g>`,
  sunglasses: (a, S) => `<g><path d="M78 80H116V98Q116 108 104 108H90Q78 108 78 98ZM124 80H162V98Q162 108 150 108H136Q124 108 124 98Z" fill="${a.c}" stroke="${INK}" stroke-width="2.5"/><path d="M116 84H124" stroke="${INK}" stroke-width="3"/><path d="M84 86L96 84M130 86L142 84" stroke="#fff" stroke-width="2.5" opacity=".6"/></g>`,
  hat: (a, S) => `<g><ellipse cx="120" cy="52" rx="64" ry="12" fill="${a.c}" ${S}/><path d="M84 52L90 18Q120 8 150 18L156 52Z" fill="${a.c}" ${S}/><rect x="86" y="38" width="68" height="9" fill="${a.c2 || '#fff'}" opacity=".9"/></g>`,
  cap: (a, S) => `<g><path d="M70 62Q72 20 120 18Q168 20 170 62Z" fill="${a.c}" ${S}/><path d="M66 62Q120 70 190 74Q176 58 168 60Z" fill="${shade(a.c, .8)}" ${S}/><circle cx="120" cy="18" r="5" fill="${a.c2 || '#fff'}"/></g>`,
  headphones: (a, S) => `<g><path d="M62 92Q58 22 120 22Q182 22 178 92" fill="none" stroke="${a.c}" stroke-width="8" stroke-linecap="round"/><rect x="52" y="82" width="20" height="36" rx="9" fill="${a.c}" ${S}/><rect x="168" y="82" width="20" height="36" rx="9" fill="${a.c}" ${S}/><rect x="56" y="90" width="8" height="20" rx="4" fill="${a.c2 || '#fff'}" opacity=".7"/><rect x="176" y="90" width="8" height="20" rx="4" fill="${a.c2 || '#fff'}" opacity=".7"/></g>`,
  backpack: (a, S) => `<g><rect x="76" y="156" width="88" height="86" rx="22" fill="${a.c}" ${S}/><rect x="92" y="204" width="56" height="30" rx="10" fill="${shade(a.c, .8)}" ${S}/><path d="M92 156V150M148 156V150" stroke="${shade(a.c, .6)}" stroke-width="6"/></g>`,
  watch: (a, S) => `<g><rect x="60" y="214" width="24" height="12" rx="4" fill="${shade(a.c, .8)}" ${S}/><circle cx="72" cy="220" r="9" fill="${a.c2 || '#fff'}" stroke="${a.c}" stroke-width="3.5"/><path d="M72 214V220L76 222" stroke="${INK}" stroke-width="2" fill="none"/></g>`,
  necklace: (a, S) => `<g><path d="M102 148Q120 178 138 148" fill="none" stroke="${a.c}" stroke-width="3.5"/><circle cx="120" cy="170" r="7" fill="${a.c2 && a.c2 !== '#ffffff' ? a.c2 : '#ff5fa2'}" stroke="${a.c}" stroke-width="3"/></g>`,
  wings: (a, S) => `<g><path d="M92 170Q20 110 18 190Q30 240 92 220Z" fill="${a.c}" ${S}/><path d="M148 170Q220 110 222 190Q210 240 148 220Z" fill="${a.c}" ${S}/><path d="M80 176Q40 150 34 190M160 176Q200 150 206 190" fill="none" stroke="${shade(a.c, .75)}" stroke-width="3"/></g>`,
  mask: (a, S) => `<g><path d="M76 82Q96 72 118 84Q120 82 122 84Q144 72 164 82Q166 102 146 102Q128 102 120 94Q112 102 94 102Q74 102 76 82Z" fill="${a.c}" ${S}/><ellipse cx="97" cy="90" rx="8" ry="6" fill="#fff" opacity=".35"/><ellipse cx="143" cy="90" rx="8" ry="6" fill="#fff" opacity=".35"/></g>`,
};
const COSTUMES = {
  astronaut: (a, S) => `<g>${torso('#e8ecf5', S, 240)}<path d="M88 152L62 162L66 222L86 224ZM152 152L178 162L174 222L154 224Z" fill="#e8ecf5" ${S}/><rect x="96" y="238" width="22" height="64" fill="#e8ecf5" ${S}/><rect x="122" y="238" width="22" height="64" fill="#e8ecf5" ${S}/><rect x="100" y="176" width="40" height="26" rx="6" fill="${a.c2}" ${S}/><circle cx="110" cy="189" r="4" fill="#ff5fa2"/><circle cx="126" cy="189" r="4" fill="#ffd23f"/><circle cx="120" cy="88" r="66" fill="rgba(160,210,255,.22)" stroke="#e8ecf5" stroke-width="7"/></g>`,
  knight: (a, S) => `<g>${torso('#9aa3b2', S, 240)}<path d="M88 152L62 162L66 222L86 224ZM152 152L178 162L174 222L154 224Z" fill="#aab3c2" ${S}/><rect x="96" y="238" width="22" height="64" fill="#8f98a8" ${S}/><rect x="122" y="238" width="22" height="64" fill="#8f98a8" ${S}/><path d="M120 156L100 176V206L120 222L140 206V176Z" fill="${a.c2}" ${S}/><path d="M120 164V212M104 190H136" stroke="#fff" stroke-width="3"/><path d="M76 160Q70 150 64 156M164 160Q170 150 176 156" stroke="#9aa3b2" stroke-width="10" fill="none" stroke-linecap="round"/></g>`,
  wizard: (a, S) => `<g><path d="M86 150Q120 140 154 150L168 304H72Z" fill="${a.c}" ${S}/><path d="M88 152L60 168L68 230L88 224ZM152 152L180 168L172 230L152 224Z" fill="${a.c}" ${S}/><g fill="${a.c2}"><path d="M120 190l5 11 12 2-9 8 3 12-11-6-11 6 3-12-9-8 12-2z"/><circle cx="96" cy="240" r="4"/><circle cx="146" cy="262" r="4"/></g></g>`,
  pirate: (a, S) => `<g>${torso('#f4f4f8', S, 238)}<path d="M88 152L62 162L66 214L86 212ZM152 152L178 162L174 214L154 212Z" fill="#f4f4f8" ${S}/><g fill="${a.c2}">${[170, 184, 198, 212, 226].map((y) => `<rect x="86" y="${y}" width="68" height="6"/>`).join('')}</g><path d="M92 226H148L150 308H126L120 252L114 308H90Z" fill="${a.c}" ${S}/><rect x="90" y="224" width="60" height="9" fill="${a.c2}"/></g>`,
  chef: (a, S) => `<g>${torso('#fff', S, 240)}<path d="M88 152L62 162L66 214L86 212ZM152 152L178 162L174 214L154 212Z" fill="#fff" ${S}/><g fill="${a.c2}"><circle cx="110" cy="180" r="3.4"/><circle cx="110" cy="198" r="3.4"/><circle cx="110" cy="216" r="3.4"/><circle cx="130" cy="180" r="3.4"/><circle cx="130" cy="198" r="3.4"/><circle cx="130" cy="216" r="3.4"/></g><path d="M92 226H148L150 308H126L120 252L114 308H90Z" fill="#7d8aa6" ${S}/></g>`,
  hero: (a, S) => `<g><path d="M92 156L50 300Q120 322 190 300L148 156Z" fill="${a.c2}" opacity=".95" ${S}/>${torso(a.c, S, 240)}<path d="M88 152L62 162L66 222L86 224ZM152 152L178 162L174 222L154 224Z" fill="${a.c}" ${S}/><path d="M96 238H144L146 308H124L120 258L116 308H94Z" fill="${a.c2}" ${S}/><path d="M120 172l9 18 20 3-14 14 4 20-19-10-19 10 4-20-14-14 20-3z" fill="#ffd23f" stroke="${INK}" stroke-width="2"/></g>`,
  winter: (a, S) => `<g><path d="M86 150Q120 140 154 150L158 244H82Z" fill="${a.c}" ${S}/><path d="M88 152L58 164L64 226L88 222ZM152 152L182 164L176 226L152 222Z" fill="${a.c}" ${S}/><path d="M92 226H148L150 308H126L120 252L114 308H90Z" fill="${shade(a.c, .7)}" ${S}/><path d="M92 150Q120 170 148 150L152 166Q120 188 88 166Z" fill="${a.c2}" ${S}/><path d="M72 40Q120 -6 168 40Q120 56 72 40Z" fill="${a.c2}" ${S}/><circle cx="120" cy="14" r="10" fill="${a.c}" ${S}/></g>`,
  summer: (a, S) => `<g>${torso(a.c, S, 232)}<path d="M92 226H148L152 270H126L120 250L114 270H88Z" fill="${a.c2}" ${S}/><path d="M96 150L100 136M144 150L140 136" stroke="${a.c}" stroke-width="6"/></g>`,
  spring: (a, S) => `<g><path d="M90 150Q120 140 150 150L158 236L174 288Q120 304 66 288L82 236Z" fill="${a.c}" ${S}/><g fill="${a.c2}">${[[100, 190], [138, 204], [112, 238], [150, 262], [88, 270]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7"/><circle cx="${x}" cy="${y}" r="2.6" fill="#ffd23f"/>`).join('')}</g></g>`,
  autumn: (a, S) => `<g>${torso(a.c, S, 238)}<path d="M88 152L60 164L64 224L88 222ZM152 152L180 164L176 224L152 222Z" fill="${a.c}" ${S}/><path d="M92 226H148L150 308H126L120 252L114 308H90Z" fill="${a.c2}" ${S}/><path d="M92 150Q120 168 148 150L150 164Q120 182 90 164Z" fill="${shade(a.c, .8)}" ${S}/></g>`,
};
const COLLECT = {
  trophy: (a) => `<g><path d="M-18 -22H18V0Q18 16 0 20Q-18 16 -18 0Z" fill="${a.c}" stroke="${INK}" stroke-width="3"/><path d="M-18 -16Q-34 -16 -28 -2Q-24 6 -16 6M18 -16Q34 -16 28 -2Q24 6 16 6" fill="none" stroke="${a.c}" stroke-width="4"/><rect x="-5" y="18" width="10" height="12" fill="${a.c2}"/><rect x="-16" y="28" width="32" height="8" rx="3" fill="${a.c}" stroke="${INK}" stroke-width="3"/></g>`,
  gem: (a) => `<g><path d="M-22 -10L-12 -26H12L22 -10L0 26Z" fill="${a.c}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-22 -10H22M-6 -10L0 26L6 -10M-12 -26L-6 -10M12 -26L6 -10" stroke="${a.c2}" stroke-width="2.4" fill="none"/></g>`,
  star: (a) => `<g><path d="M0 -28l8 17 19 3-14 13 4 19-17-10-17 10 4-19-14-13 19-3z" fill="${a.c}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><circle cx="0" cy="-2" r="7" fill="${a.c2}"/></g>`,
  key: (a) => `<g><circle cx="-10" cy="-8" r="14" fill="none" stroke="${a.c}" stroke-width="8"/><path d="M0 2L26 28M16 18l8-8M22 24l8-8" stroke="${a.c}" stroke-width="7" stroke-linecap="round"/><circle cx="-10" cy="-8" r="5" fill="${a.c2}"/></g>`,
};

/* ---------- pets: drawn in a 0..100 box ---------- */
function pet(kind, a, pose) {
  const c = a.c, d = shade(c, .78), w = a.c2 || '#fff', S = `stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"`;
  const sleepy = pose === 'sleep', eye = (x, y) => sleepy ? `<path d="M${x - 4} ${y}Q${x} ${y + 4} ${x + 4} ${y}" stroke="${INK}" stroke-width="2.4" fill="none"/>` : `<circle cx="${x}" cy="${y}" r="3.2" fill="${INK}"/><circle cx="${x + 1}" cy="${y - 1}" r="1" fill="#fff"/>`;
  const mouthP = pose === 'play' ? `<path d="M44 52Q50 60 56 52Z" fill="#7a1f2b"/>` : `<path d="M46 52Q50 56 54 52" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  const head = (x = 50, y = 40, r = 20) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" ${S}/>`;
  const faceP = `${eye(42, 38)}${eye(58, 38)}<ellipse cx="35" cy="46" rx="4.6" ry="3" fill="#ff9bb3" opacity=".55"/><ellipse cx="65" cy="46" rx="4.6" ry="3" fill="#ff9bb3" opacity=".55"/><ellipse cx="50" cy="46" rx="3.4" ry="2.4" fill="#ff7a93"/>${mouthP}`;
  const body = (rx = 28, ry = 20) => `<ellipse cx="50" cy="72" rx="${rx}" ry="${ry}" fill="${c}" ${S}/><ellipse cx="50" cy="78" rx="${rx * .55}" ry="${ry * .6}" fill="${w}" opacity=".85"/>`;
  const legs = `<ellipse cx="34" cy="90" rx="9" ry="6" fill="${d}" ${S}/><ellipse cx="66" cy="90" rx="9" ry="6" fill="${d}" ${S}/>`;
  const art = {
    cat: `<path d="M78 76Q100 64 92 40" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round"/>${body()}${legs}<path d="M33 28L36 8L48 22ZM67 28L64 8L52 22Z" fill="${c}" ${S}/>${head()}${faceP}<path d="M30 46H18M30 50L19 54M70 46H82M70 50L81 54" stroke="${INK}" stroke-width="1.6"/>`,
    dog: `<path d="M76 72Q94 64 90 54" fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round"/>${body()}${legs}<ellipse cx="30" cy="36" rx="8" ry="15" fill="${d}" ${S}/><ellipse cx="70" cy="36" rx="8" ry="15" fill="${d}" ${S}/>${head()}<ellipse cx="50" cy="48" rx="11" ry="8" fill="${w}"/>${eye(42, 38)}${eye(58, 38)}<ellipse cx="50" cy="45" rx="4" ry="3" fill="${INK}"/>${pose === 'play' ? `<path d="M46 53Q50 62 54 53Z" fill="#ff7a93"/>` : ''}`,
    rabbit: `${body(24, 18)}${legs}<ellipse cx="40" cy="14" rx="7" ry="22" fill="${c}" ${S}/><ellipse cx="60" cy="14" rx="7" ry="22" fill="${c}" ${S}/><ellipse cx="40" cy="16" rx="3" ry="14" fill="#ffb3d1"/><ellipse cx="60" cy="16" rx="3" ry="14" fill="#ffb3d1"/>${head(50, 42, 19)}${faceP}<circle cx="76" cy="76" r="7" fill="${w}" ${S}/>`,
    fox: `<path d="M74 78Q104 70 94 44Q90 66 72 66Z" fill="${c}" ${S}/><path d="M92 46Q94 40 90 40Z" fill="${w}"/>${body()}${legs}<path d="M31 30L34 6L48 22ZM69 30L66 6L52 22Z" fill="${c}" ${S}/>${head()}<path d="M30 44Q50 66 70 44Q50 52 30 44Z" fill="${w}"/>${eye(42, 38)}${eye(58, 38)}<ellipse cx="50" cy="48" rx="3" ry="2.2" fill="${INK}"/>`,
    dragon: `<path d="M74 78Q98 80 96 60Q86 72 72 68Z" fill="${c}" ${S}/><path d="M30 60Q8 50 12 80Q26 76 38 70Z" fill="${w}" ${S}/><path d="M70 60Q92 50 88 80Q74 76 62 70Z" fill="${w}" ${S}/>${body()}${legs}<path d="M36 26L32 8L44 20ZM64 26L68 8L56 20Z" fill="${w}" ${S}/>${head()}<path d="M44 26L50 16L56 26Z" fill="${d}"/>${eye(42, 38)}${eye(58, 38)}<circle cx="46" cy="48" r="1.6" fill="${INK}"/><circle cx="54" cy="48" r="1.6" fill="${INK}"/>${pose === 'play' ? `<path d="M50 56Q54 68 60 62Q56 58 54 54Z" fill="#ff6a2b"/>` : ''}`,
    bird: `<path d="M74 70L94 62L90 78Z" fill="${w}" ${S}/>${body(24, 22)}<ellipse cx="40" cy="72" rx="12" ry="9" fill="${d}" ${S}/>${head(50, 42, 18)}<path d="M42 44L50 52L58 44Z" fill="#ffb02e" ${S}/>${eye(43, 38)}${eye(57, 38)}<path d="M40 90V98M60 90V98" stroke="#ffb02e" stroke-width="3"/>`,
    dino: `<path d="M72 74Q100 76 98 56Q90 70 70 68Z" fill="${c}" ${S}/><g fill="${w}" ${S}><path d="M34 52L38 40L44 52ZM46 48L51 34L57 48ZM58 52L63 40L68 52Z"/></g>${body(28, 21)}${legs}<ellipse cx="62" cy="40" rx="22" ry="17" fill="${c}" ${S}/>${eye(66, 36)}<circle cx="74" cy="42" r="1.8" fill="${INK}"/><path d="M60 48Q68 52 74 48" stroke="${INK}" stroke-width="2" fill="none"/>`,
    fantasy: `<path d="M78 74Q100 70 96 52" fill="none" stroke="${a.v === 'rainbow' ? '#ff7ab8' : a.c2}" stroke-width="9" stroke-linecap="round"/>${body(26, 19)}${legs}<path d="M30 34Q24 52 36 60M34 28Q28 40 34 52" stroke="${a.v === 'rainbow' ? '#8e5bd9' : a.c2}" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M42 24L50 -2L58 24Z" fill="#ffd23f" ${S}/>${head()}${faceP}<path d="M36 32Q50 18 64 32" stroke="${a.v === 'rainbow' ? '#4a90e2' : a.c2}" stroke-width="6" fill="none" stroke-linecap="round"/>`,
  }[kind] || '';
  return art;
}
const petZ = (pose) => (pose === 'sleep' ? `<text x="70" y="18" font-size="16" fill="#6a5a96" font-weight="700" font-family="sans-serif">z</text><text x="80" y="8" font-size="12" fill="#6a5a96" font-weight="700" font-family="sans-serif">z</text>` : '');
export const petSvg = (item, pose = 'sit', size = 90) => `<svg viewBox="-6 -6 112 112" width="${size}" height="${size}" style="width:${size}px;height:${size}px;max-width:100%" xmlns="http://www.w3.org/2000/svg" class="av-pet-solo"><g class="av-pet-body av-pose-${pose}">${pet(item.kind, item.art || {}, pose)}${petZ(pose)}</g></svg>`;

/* ---------- backgrounds, effects, styles ---------- */
function background(item, u) {
  const a = item ? item.art : { c: '#f1ecfb', c2: '#ffffff', v: 'plain' }, v = a.v || 'plain';
  const g = `<defs><linearGradient id="bg${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a.c}"/><stop offset="1" stop-color="${a.c2}"/></linearGradient></defs><rect width="240" height="340" rx="26" fill="url(#bg${u})"/>`;
  const deco = {
    meadow: '<ellipse cx="60" cy="330" rx="130" ry="50" fill="#6fcf75"/><ellipse cx="200" cy="336" rx="110" ry="44" fill="#52b85a"/><circle cx="196" cy="40" r="20" fill="#ffd23f"/>',
    beach: '<rect y="250" width="240" height="90" fill="#ffe9a8"/><path d="M0 250Q60 236 120 250T240 250V270H0Z" fill="#4cc9f0" opacity=".8"/><circle cx="190" cy="44" r="22" fill="#ffd23f"/>',
    space: Array.from({ length: 26 }, (_, i) => `<circle cx="${(i * 53) % 236 + 4}" cy="${(i * 97) % 320 + 8}" r="${i % 3 ? 1.4 : 2.4}" fill="#fff"/>`).join('') + '<circle cx="190" cy="70" r="26" fill="#ff7ab8"/><ellipse cx="190" cy="70" rx="40" ry="8" fill="none" stroke="#ffd23f" stroke-width="3" transform="rotate(-18 190 70)"/>',
    city: '<g fill="#161844"><rect x="6" y="190" width="44" height="150"/><rect x="56" y="150" width="38" height="190"/><rect x="152" y="170" width="40" height="170"/><rect x="198" y="210" width="40" height="130"/></g><g fill="#ffd23f">' + [[16, 204], [30, 204], [16, 226], [64, 168], [78, 168], [64, 192], [162, 190], [176, 190], [206, 228]].map(([x, y]) => `<rect x="${x}" y="${y}" width="8" height="10"/>`).join('') + '</g><circle cx="196" cy="48" r="16" fill="#fff6c9"/>',
    candy: Array.from({ length: 10 }, (_, i) => `<circle cx="${(i * 71) % 220 + 10}" cy="${(i * 53) % 300 + 20}" r="${14 + (i % 3) * 6}" fill="${['#ff7ab8', '#ffd23f', '#8fd8ff', '#c77dff'][i % 4]}" opacity=".55"/>`).join(''),
    castle: '<ellipse cx="120" cy="340" rx="170" ry="60" fill="#7ed957"/><g fill="#c7c9e8"><rect x="150" y="150" width="60" height="110"/><rect x="144" y="130" width="16" height="30"/><rect x="170" y="124" width="16" height="36"/><rect x="198" y="130" width="16" height="30"/></g><path d="M180 100L196 134H164Z" fill="#e63946"/>',
    sunset: '<circle cx="120" cy="250" r="64" fill="#ff7a3d"/><rect y="250" width="240" height="90" fill="#7a3d8f" opacity=".85"/>',
    forest: '<g fill="#1f6f4a">' + [[30, 230], [90, 250], [160, 236], [208, 252]].map(([x, y]) => `<path d="M${x} ${y}L${x + 22} ${y - 76}L${x + 44} ${y}Z"/>`).join('') + '</g><g fill="#ffd86b">' + Array.from({ length: 14 }, (_, i) => `<circle cx="${(i * 67) % 230 + 5}" cy="${(i * 41) % 200 + 20}" r="2"/>`).join('') + '</g>',
  }[v] || '';
  return g + deco;
}
function effect(item, front) {
  if (!item) return '';
  const a = item.art, c = a.c || '#ffd23f', v = a.v;
  if (v === 'flames') return front ? '' : `<g class="av-fx-flames"><ellipse cx="120" cy="190" rx="86" ry="130" fill="${c}" opacity=".22"/>${[40, 80, 120, 160, 200].map((x, i) => `<path d="M${x} 310Q${x - 14} 270 ${x} 240Q${x + 6} 262 ${x + 14} 250Q${x + 24} 290 ${x} 310Z" fill="${i % 2 ? '#ffd23f' : c}" opacity=".7"/>`).join('')}</g>`;
  if (!front) return '';
  const pts = [[26, 60], [206, 90], [40, 200], [196, 230], [120, 20], [60, 130], [180, 150]];
  const shapes = { sparkles: (x, y, i) => `<path class="av-tw" style="animation-delay:${i * .3}s" d="M${x} ${y - 9}l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" fill="${c}"/>`, hearts: (x, y, i) => `<path class="av-rise" style="animation-delay:${i * .4}s" d="M${x} ${y + 6}C${x - 12} ${y - 4} ${x - 6} ${y - 12} ${x} ${y - 5}C${x + 6} ${y - 12} ${x + 12} ${y - 4} ${x} ${y + 6}Z" fill="${c}"/>`,
    snow: (x, y, i) => `<circle class="av-fall" style="animation-delay:${i * .35}s" cx="${x}" cy="${y}" r="3.4" fill="${c}"/>`, bubbles: (x, y, i) => `<circle class="av-rise" style="animation-delay:${i * .35}s" cx="${x}" cy="${y}" r="${5 + (i % 3) * 2}" fill="none" stroke="${c}" stroke-width="2"/>` };
  return `<g class="av-fx">${pts.map(([x, y], i) => (shapes[v] || shapes.sparkles)(x, y, i)).join('')}</g>`;
}

/* ---------- the whole character ---------- */
/* opts: { style, look, equipped: {slot: item}, size, viewBox, plain (no background), pose } ; items are objects { kind, slot, art, image } */
export function renderAvatar({ style = 'cartoon', look = {}, equipped = {}, size = 240, viewBox = '0 0 240 340', plain = false, label = '', petPose = 'sit' } = {}) {
  const u = ++counter, L = { shape: 0, skin: 2, hairStyle: 1, hairColor: 1, eyeStyle: 0, eyeColor: 0, brows: 0, mouth: 0, ...look };
  const robot = style === 'robot', animal = style === 'animal', fantasy = style === 'fantasy', threeD = false;
  const S = style === 'cartoon' ? `stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"` : style === 'modern' ? 'stroke="rgba(30,20,60,.2)" stroke-width="1.6" stroke-linejoin="round"' : '';
  let skin = SKINS[L.skin] || SKINS[2]; const metal = METALS[L.skin] || METALS[0];
  const hair = HAIRS[L.hairColor] || HAIRS[1], eyeC = EYES[L.eyeColor] || EYES[0];
  const get = (slot) => equipped[slot] || null, st = get('style'), sv = st && st.art ? st.art.v : '';
  const fill = robot ? metal : skin;
  const body3d = threeD ? `<defs><radialGradient id="sk${u}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${shade(fill, 1.12)}"/><stop offset=".7" stop-color="${fill}"/><stop offset="1" stop-color="${shade(fill, .82)}"/></radialGradient></defs>` : '';
  const F = threeD ? `url(#sk${u})` : fill;
  const fx = size >= 150;   // the soft lighting is for the big pictures; small thumbnails stay flat and fast
  const lp = threeD ? { ss: 3.2, sd: 4.5, dc: 1.2, spec: true } : robot ? { ss: 2.4, sd: 3.2, dc: 1.16, spec: true } : style === 'cartoon' ? { ss: 1.1, sd: 3, dc: 1.12 } : { ss: 1.8, sd: 3.6, dc: 1.14 };
  const lightDef = fx ? `<filter id="lt${u}" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="${lp.sd}" result="b"/><feDiffuseLighting in="b" surfaceScale="${lp.ss}" diffuseConstant="${lp.dc}" lighting-color="#fff" result="d"><feDistantLight azimuth="235" elevation="58"/></feDiffuseLighting><feComposite in="d" in2="SourceGraphic" operator="arithmetic" k1="1.2" k2="0" k3="0" k4="0" result="m"/>${lp.spec ? `<feSpecularLighting in="b" surfaceScale="${lp.ss}" specularConstant=".85" specularExponent="24" lighting-color="#fff" result="sp"><feDistantLight azimuth="235" elevation="55"/></feSpecularLighting><feComposite in="sp" in2="m" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="m"/>` : ''}<feComposite in="m" in2="SourceAlpha" operator="in"/></filter>` : '';
  const LT = fx ? `filter="url(#lt${u})"` : '';
  const gradDefs = `<defs>${lightDef}<radialGradient id="ir${u}" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="${shade(eyeC, 1.55)}"/><stop offset="1" stop-color="${shade(eyeC, .72)}"/></radialGradient><linearGradient id="hg${u}" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="${shade(hair, 1.32)}"/><stop offset=".55" stop-color="${hair}"/><stop offset="1" stop-color="${shade(hair, .8)}"/></linearGradient><radialGradient id="bl${u}"><stop offset="0" stop-color="#ff6f91" stop-opacity=".6"/><stop offset="1" stop-color="#ff6f91" stop-opacity="0"/></radialGradient></defs>`;
  const img = (it) => `<image href="${it.image}" x="0" y="0" width="240" height="340" preserveAspectRatio="xMidYMid meet"/>`;
  const layer = (slot, drawer) => { const it = get(slot); if (!it) return ''; if (it.image) return img(it); const fn = drawer(it); return fn ? fn(it.art || {}, S) : ''; };
  const fullBody = get('outfit'), hideTB = !!fullBody || !!get('dress');
  const basic = { tee: { c: '#cfd6ec', c2: '#ffffff', p: 'solid' }, shorts: { c: '#8f98b0', c2: '#ffffff', p: 'solid' } };   // nobody is drawn without clothes
  const bots = hideTB ? '' : get('bottom') ? layer('bottom', (it) => CLOTHES[it.kind]) : CLOTHES.shorts(basic.shorts, S);
  const tops = get('dress') ? layer('dress', (it) => CLOTHES[it.kind]) : get('top') ? layer('top', (it) => CLOTHES[it.kind]) : CLOTHES.tee(basic.tee, S);
  const clothes = fullBody ? (fullBody.image ? img(fullBody) : (COSTUMES[(fullBody.art || {}).v] || (() => ''))(fullBody.art || {}, S)) : `${bots}${tops}`;
  const shoes = get('shoes') ? layer('shoes', (it) => CLOTHES[it.kind]) : `<g>${[88, 124].map((x) => `<path d="M${x} 298H${x + 30}Q${x + 38} 306 ${x + 34} 316H${x - 4}Q${x - 6} 306 ${x} 298Z" fill="#7a7f99" ${S}/><rect x="${x - 5}" y="314" width="42" height="8" rx="4" fill="#d9dcec" ${S}/><path d="M${x + 6} 306H${x + 24}" stroke="#d9dcec" stroke-width="3"/>`).join('')}</g>`;
  const arms = `<g class="av-arms"><path d="M86 154Q68 158 66 180L63 214Q60 229 72 231Q85 232 85 218L89 190Z" fill="${F}" ${S}/><g class="av-arm-r"><path d="M154 154Q172 158 174 180L177 214Q180 229 168 231Q155 232 155 218L151 190Z" fill="${F}" ${S}/></g></g>`;
  const legs = `<path d="M95 230L119 230L117 306Q116 313 106 313Q96 313 96 306Z" fill="${F}" ${S}/><path d="M121 230L145 230L144 306Q143 313 134 313Q124 313 123 306Z" fill="${F}" ${S}/>`;
  const torsoBase = `<path d="M88 150Q120 140 152 150L157 200Q156 222 151 238L89 238Q84 222 83 200Z" fill="${F}" ${S}/><rect x="108" y="130" width="24" height="26" fill="${F}"/><ellipse cx="120" cy="148" rx="19" ry="7" fill="${shade(fill, .72)}" opacity=".35"/>`;
  const earsP = fantasy ? `<path d="M68 90L44 76L70 112Z" fill="${F}" ${S}/><path d="M172 90L196 76L170 112Z" fill="${F}" ${S}/>` : robot ? `<rect x="54" y="78" width="14" height="30" rx="6" fill="${shade(fill, .85)}" ${S}/><rect x="172" y="78" width="14" height="30" rx="6" fill="${shade(fill, .85)}" ${S}/>` : `<circle cx="68" cy="94" r="10" fill="${F}" ${S}/><circle cx="172" cy="94" r="10" fill="${F}" ${S}/><circle cx="68" cy="95" r="5" fill="${shade(fill, .86)}"/><circle cx="172" cy="95" r="5" fill="${shade(fill, .86)}"/>`;
  const animalBits = animal ? `<path d="M74 54L66 14L102 40Z" fill="${F}" ${S}/><path d="M166 54L174 14L138 40Z" fill="${F}" ${S}/><path d="M76 48L72 26L92 40Z" fill="#ffb3d1"/><path d="M164 48L168 26L148 40Z" fill="#ffb3d1"/>` : '';
  const animalFace = animal ? `<ellipse cx="120" cy="106" rx="16" ry="11" fill="${shade(skin, 1.08)}"/><path d="M114 101Q120 98 126 101Q120 108 114 101Z" fill="#c0506d"/><g stroke="${INK}" stroke-width="1.6" fill="none"><path d="M96 108H66M96 113L68 120M144 108H174M144 113L172 120"/></g>` : '';
  const tail = animal ? `<path d="M156 226Q214 224 204 168Q196 200 156 206Z" fill="${F}" ${S}/>` : '';
  const head = robot
    ? `<rect x="68" y="40" width="104" height="100" rx="26" fill="${F}" ${S}/><rect x="80" y="62" width="80" height="62" rx="16" fill="#1b2a4e"/><path d="M120 40V22" stroke="${INK}" stroke-width="4"/><circle cx="120" cy="18" r="8" fill="#ff5fa2" ${S}/>`
    : `${headShape(L.shape, F, S)}${threeD ? `<ellipse cx="102" cy="64" rx="18" ry="10" fill="#fff" opacity=".35"/>` : ''}`;
  const faceBits = robot ? `${eyes(L.eyeStyle, '#5ef2ff', S, true, u)}${mouth(L.mouth, true)}` : `${animalFace}${eyes(L.eyeStyle, eyeC, S, false, u)}${brows(L.brows, hair)}${animal ? '' : `<path d="M116 104Q120 108 124 104" stroke="${shade(skin, .7)}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`}<ellipse cx="84" cy="109" rx="13" ry="8" fill="url(#bl${u})"/><ellipse cx="156" cy="109" rx="13" ry="8" fill="url(#bl${u})"/>${mouth(L.mouth, false)}`;
  const HG = `url(#hg${u})`, sheen = L.hairStyle === 0 || L.hairStyle === 8 ? '' : `<path d="M82 62Q108 44 142 54" stroke="#fff" stroke-opacity=".42" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M150 58Q162 64 168 76" stroke="#fff" stroke-opacity=".25" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  const hairBk = robot ? '' : hairBack(L.hairStyle, HG, S, L.shape), hairFt = robot ? '' : hairFront(L.hairStyle, HG, S, L.shape) + sheen;
  const aura = fantasy ? `<ellipse cx="120" cy="190" rx="92" ry="140" fill="#c9b6f2" opacity=".28"/>${[[30, 80], [206, 120], [44, 220], [194, 250]].map(([x, y], i) => `<path class="av-tw" style="animation-delay:${i * .4}s" d="M${x} ${y - 8}l2.6 5.4 5.4 2.6-5.4 2.6-2.6 5.4-2.6-5.4-5.4-2.6 5.4-2.6z" fill="#fff6a8"/>`).join('')}` : '';
  const anim = get('animation') && get('animation').art ? get('animation').art.v : '';
  const petItem = get('pet'), petLook = petItem && !petItem.image ? petItem : null;
  const petG = petItem ? `<g class="av-pet" ${LT} transform="translate(150 244) scale(.62)"><g class="av-pet-body av-pose-${petPose}">${petItem.image ? `<image href="${petItem.image}" x="0" y="0" width="100" height="100"/>` : pet(petItem.kind, petItem.art || {}, petPose)}${petZ(petPose)}</g></g>` : '';
  const col = get('collectible'), collectG = col && col.art ? `<g transform="translate(30 286) scale(.9)">${col.image ? '' : (COLLECT[col.art.v] || (() => ''))(col.art)}</g>` : '';
  const filters = `<defs><filter id="fg${u}"><feColorMatrix type="matrix" values="0.345 0.678 0.127 0 0.08  0.264 0.519 0.097 0 0.03  0.09 0.177 0.033 0 0  0 0 0 1 0"/></filter><filter id="fn${u}" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="${st && st.art && st.art.c || '#5ef2ff'}"/><feDropShadow dx="0" dy="0" stdDeviation="9" flood-color="${st && st.art && st.art.c2 || '#ff5fa2'}"/></filter><filter id="fh${u}"><feColorMatrix type="matrix" values="0.8 0.1 0.1 0 0.15  0.1 0.8 0.2 0 0.2  0.2 0.2 0.8 0 0.3  0 0 0 0.72 0"/></filter></defs>`;
  const flt = sv === 'gold' ? `filter="url(#fg${u})"` : sv === 'neon' ? `filter="url(#fn${u})"` : sv === 'ghost' ? `filter="url(#fh${u})"` : '';
  const bgItem = get('background');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${size}" height="${Math.round(size * (viewBox.split(' ')[3] / viewBox.split(' ')[2]))}" style="width:${size}px;max-width:100%;height:auto" role="img" aria-label="${label}" class="av-svg av-style-${style}${anim ? ' av-anim-' + anim : ''}" focusable="false">${body3d}${filters}${gradDefs}
    <defs><clipPath id="cp${u}"><rect width="240" height="340" rx="26"/></clipPath></defs><g clip-path="url(#cp${u})">${plain ? '' : (bgItem && bgItem.image ? img(bgItem) : background(bgItem, u))}${effect(get('effect'), false)}${aura}</g>
    <ellipse class="av-shadow" cx="120" cy="322" rx="62" ry="9" fill="rgba(30,20,60,.18)"/>
    <g class="av-char" ${flt}>${get('wings') ? layer('wings', (it) => CLOTHES.wings) : ''}${get('back') ? layer('back', (it) => CLOTHES.backpack) : ''}${tail}<g ${LT}>${hairBk}</g><g ${LT}>${legs}${arms}${torsoBase}</g><g ${LT}>${clothes}</g><g ${LT}>${shoes}</g>
      <g ${LT}>${earsP}${animalBits}${head}</g>${faceBits}<g ${LT}>${hairFt}</g>${layer('mask', () => CLOTHES.mask)}${get('neck') ? layer('neck', () => CLOTHES.necklace) : ''}${layer('glasses', (it) => CLOTHES[it.kind])}${layer('headphones', () => CLOTHES.headphones)}${layer('hat', (it) => CLOTHES[it.kind])}${layer('wrist', () => CLOTHES.watch)}</g>
    ${petG}${collectG}${effect(get('effect'), true)}</svg>`;
}
/* the thumbnail of a shop / inventory item: the item worn by a plain character, cropped to the part that matters */
const CROP = { hat: '50 0 140 130', glasses: '60 50 120 80', mask: '60 50 120 80', headphones: '40 0 160 140', neck: '70 110 100 90', top: '40 120 160 140', dress: '40 120 160 190', outfit: '20 0 200 340', bottom: '60 210 120 120', shoes: '60 280 120 60', wrist: '30 190 90 70', back: '20 100 200 180', wings: '0 90 240 180' };
export function itemSvg(item, { look, style = 'cartoon', size = 96 } = {}) {
  if (item.image && !['background'].includes(item.slot)) return `<img src="${item.image}" alt="" width="${size}" height="${size}" style="object-fit:contain" draggable="false">`;
  if (item.slot === 'pet') return petSvg(item, 'sit', size);
  if (item.slot === 'collectible') return `<svg viewBox="-40 -40 80 80" width="${size}" height="${size}" style="width:${size}px;height:${size}px;max-width:100%" xmlns="http://www.w3.org/2000/svg">${(COLLECT[(item.art || {}).v] || (() => ''))(item.art || {})}</svg>`;
  const eq = { [item.slot]: item };
  if (['top', 'bottom', 'dress', 'shoes'].includes(item.slot)) { /* the clothes alone are easier to see on the plain character */ }
  return renderAvatar({ style, look: look || { shape: 0, skin: 2, hairStyle: 1, hairColor: 1 }, equipped: eq, size, viewBox: CROP[item.slot] || '0 0 240 340', plain: item.slot !== 'background' && item.slot !== 'effect' && item.slot !== 'animation' && item.slot !== 'style' ? true : false });
}
