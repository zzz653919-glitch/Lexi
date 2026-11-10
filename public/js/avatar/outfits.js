/* Data-driven fashion: one drawing routine builds every outfit from a few parameters, so the shop can hold hundreds of different clothes
   and an administrator can add new ones (a preset, three colours, a pattern, an emblem) without any code.
   Everything is original artwork inspired by real clothing traditions, sports, eras and genres; no logos, no copied characters. */
import { shade, dk, MR, bodyP, sideShade, folds, sleeveL, legsP, hemBand, INK } from './geo.js';

let uid = 0;
const clip = (d, inner) => { const id = 'fc' + (++uid); return `<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})">${inner}</g>`; };
const rep = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('');

/* ---------- patterns: drawn over the whole body area, then clipped to the garment ---------- */
export const PATTERNS = ['solid', 'stripes', 'pinstripe', 'dots', 'check', 'plaid', 'diamond', 'waves', 'stars', 'flowers', 'camo', 'ikat', 'tribal', 'kente', 'circuit', 'hex', 'scales', 'chevrons', 'xmas', 'bones', 'graffiti', 'leaves', 'sparkle'];
const star = (x, y, r, c) => `<path d="M${x} ${y - r}l${r * .3} ${r * .62} ${r * .7} ${r * .1}-${r * .52} ${r * .48} ${r * .14} ${r * .7}-${r * .62}-${r * .34}-${r * .62} ${r * .34} ${r * .14}-${r * .7}-${r * .52}-${r * .48} ${r * .7}-${r * .1}z" fill="${c}"/>`;
function pattern(p, c, c3) {
  const X0 = 40, X1 = 200, Y0 = 138, Y1 = 322;
  switch (p) {
    case 'stripes': return rep(14, (i) => `<rect x="${X0}" y="${Y0 + 8 + i * 14}" width="160" height="6" fill="${c}" opacity=".9"/>`);
    case 'pinstripe': return rep(18, (i) => `<rect x="${X0 + 6 + i * 9}" y="${Y0}" width="1.6" height="190" fill="${c}" opacity=".55"/>`);
    case 'dots': return rep(11, (j) => rep(9, (i) => `<circle cx="${X0 + 8 + i * 18 + (j % 2) * 9}" cy="${Y0 + 8 + j * 17}" r="3.4" fill="${c}" opacity=".9"/>`));
    case 'check': return rep(15, (j) => rep(14, (i) => ((i + j) % 2 ? `<rect x="${X0 + i * 12}" y="${Y0 + j * 12}" width="12" height="12" fill="${c}" opacity=".5"/>` : '')));
    case 'plaid': return rep(8, (i) => `<rect x="${X0 + 6 + i * 22}" y="${Y0}" width="7" height="190" fill="${c}" opacity=".4"/><rect x="${X0}" y="${Y0 + 8 + i * 24}" width="160" height="7" fill="${c3}" opacity=".45"/>`) + rep(5, (i) => `<rect x="${X0 + 14 + i * 36}" y="${Y0}" width="2" height="190" fill="#fff" opacity=".4"/>`);
    case 'diamond': return rep(12, (j) => rep(9, (i) => `<path d="M${X0 + 10 + i * 18 + (j % 2) * 9} ${Y0 + j * 16}l7 8-7 8-7-8z" fill="${c}" opacity=".7"/>`));
    case 'waves': return rep(11, (j) => `<path d="M${X0} ${Y0 + 12 + j * 17}${rep(9, (i) => `q9 -12 18 0`)}" fill="none" stroke="${c}" stroke-width="2.6" opacity=".7" transform="translate(${(j % 2) * 9} 0)"/>`);
    case 'stars': return rep(8, (j) => rep(7, (i) => star(X0 + 12 + i * 24 + (j % 2) * 12, Y0 + 10 + j * 24, 5.6, c)));
    case 'flowers': return rep(7, (j) => rep(6, (i) => { const x = X0 + 14 + i * 28 + (j % 2) * 14, y = Y0 + 12 + j * 26; return `${rep(5, (k) => `<circle cx="${x + Math.cos(k * 1.2566) * 5}" cy="${y + Math.sin(k * 1.2566) * 5}" r="3.4" fill="${c}" opacity=".92"/>`)}<circle cx="${x}" cy="${y}" r="2.4" fill="#ffd23f"/>`; }));
    case 'camo': return rep(22, (i) => `<ellipse cx="${X0 + ((i * 53) % 150) + 6}" cy="${Y0 + ((i * 37) % 170) + 8}" rx="${12 + (i % 3) * 5}" ry="${7 + (i % 4) * 2}" fill="${i % 2 ? c : c3}" opacity=".7" transform="rotate(${(i * 41) % 90} ${X0 + ((i * 53) % 150)} ${Y0 + ((i * 37) % 170)})"/>`);
    case 'ikat': return rep(8, (i) => `<path d="M${X0 + i * 20} ${Y0}h10l-8 10 8 10-8 10 8 10-8 10 8 10-8 10 8 10-8 10 8 10-8 10 8 10-8 10 8 10-8 10 8 10-8 10 8 10-8 10 8 10h-10z" fill="${i % 2 ? c : c3}" opacity=".78"/>`);
    case 'tribal': return rep(8, (j) => rep(8, (i) => `<path d="M${X0 + i * 20 + (j % 2) * 10} ${Y0 + j * 22 + 14}l8-14 8 14z" fill="${(i + j) % 2 ? c : c3}" opacity=".8"/>`));
    case 'kente': return rep(10, (i) => `<rect x="${X0 + i * 16}" y="${Y0}" width="8" height="190" fill="${i % 3 === 0 ? c : i % 3 === 1 ? c3 : '#ffd23f'}" opacity=".85"/>`) + rep(8, (j) => `<rect x="${X0}" y="${Y0 + 14 + j * 24}" width="160" height="5" fill="${c}" opacity=".8"/>`);
    case 'circuit': return rep(9, (j) => `<path d="M${X0} ${Y0 + 10 + j * 20}h${30 + (j * 17) % 40}l10 10h20l10 -10h${40 + (j * 11) % 30}" fill="none" stroke="${c}" stroke-width="2" opacity=".9"/><circle cx="${X0 + 34 + (j * 17) % 40}" cy="${Y0 + 10 + j * 20}" r="2.6" fill="${c}"/>`);
    case 'hex': return rep(9, (j) => rep(9, (i) => `<path d="M${X0 + i * 20 + (j % 2) * 10} ${Y0 + j * 18}l5 -3 5 3v6l-5 3-5 -3z" fill="none" stroke="${c}" stroke-width="1.6" opacity=".8"/>`));
    case 'scales': return rep(11, (j) => rep(9, (i) => `<path d="M${X0 + i * 18 + (j % 2) * 9 - 9} ${Y0 + j * 11}q9 14 18 0" fill="none" stroke="${c}" stroke-width="1.8" opacity=".7"/>`));
    case 'chevrons': return rep(11, (j) => `<path d="M${X0} ${Y0 + j * 18}l80 14 80 -14v7l-80 14 -80 -14z" fill="${j % 2 ? c : c3}" opacity=".75"/>`);
    case 'xmas': return rep(7, (j) => rep(7, (i) => { const x = X0 + 12 + i * 24 + (j % 2) * 12, y = Y0 + 12 + j * 24; return `<path d="M${x - 5} ${y}h10M${x} ${y - 5}v10M${x - 3.5} ${y - 3.5}l7 7M${x - 3.5} ${y + 3.5}l7 -7" stroke="${c}" stroke-width="1.6" opacity=".95"/>`; }));
    case 'bones': return `<path d="M120 150V240" stroke="${c}" stroke-width="5"/>${rep(4, (i) => `<path d="M${98} ${166 + i * 14}Q120 ${158 + i * 14} 142 ${166 + i * 14}" fill="none" stroke="${c}" stroke-width="4"/>`)}<path d="M96 240H144M104 230H136" stroke="${c}" stroke-width="4"/>`;
    case 'graffiti': return rep(9, (i) => `<circle cx="${X0 + ((i * 47) % 150) + 6}" cy="${Y0 + ((i * 31) % 170) + 8}" r="${6 + (i % 3) * 3}" fill="${['#ffd23f', c, c3, '#5ef2ff'][i % 4]}" opacity=".85"/><path d="M${X0 + ((i * 47) % 140)} ${Y0 + ((i * 29) % 160) + 10}q14 -16 28 0" fill="none" stroke="${['#ff5fa2', '#fff', c][i % 3]}" stroke-width="3" stroke-linecap="round" opacity=".9"/>`);
    case 'leaves': return rep(7, (j) => rep(6, (i) => `<path d="M${X0 + 14 + i * 28 + (j % 2) * 14} ${Y0 + 18 + j * 26}q-8 -8 0 -16q8 8 0 16z" fill="${(i + j) % 2 ? c : c3}" opacity=".85"/>`));
    case 'sparkle': return rep(8, (j) => rep(7, (i) => star(X0 + 8 + i * 24 + (j % 2) * 12 + ((i * j) % 3) * 3, Y0 + 8 + j * 24, 3 + (i + j) % 3, c))).replace(/fill="/g, 'opacity=".9" fill="');
    default: return '';
  }
}

/* ---------- emblems on the chest ---------- */
export const EMBLEMS = ['none', 'star', 'bolt', 'flame', 'shield', 'crown', 'heart', 'moon', 'leaf', 'ball', 'gear', 'paw', 'bat', 'sun', 'cross', 'wing'];
function emblem(e, x, y, r, c, line) {
  const st = `stroke="${line}" stroke-width="2" stroke-linejoin="round"`;
  switch (e) {
    case 'star': return `<path d="M${x} ${y - r}l${r * .3} ${r * .62} ${r * .7} ${r * .1}-${r * .52} ${r * .48} ${r * .14} ${r * .7}-${r * .62}-${r * .34}-${r * .62} ${r * .34} ${r * .14}-${r * .7}-${r * .52}-${r * .48} ${r * .7}-${r * .1}z" fill="${c}" ${st}/>`;
    case 'bolt': return `<path d="M${x + r * .2} ${y - r}L${x - r * .6} ${y + r * .1}H${x - r * .05}L${x - r * .2} ${y + r}L${x + r * .6} ${y - r * .2}H${x + r * .05}Z" fill="${c}" ${st}/>`;
    case 'flame': return `<path d="M${x} ${y - r}Q${x + r * .9} ${y - r * .1} ${x + r * .5} ${y + r * .6}Q${x} ${y + r * 1.1} ${x - r * .5} ${y + r * .6}Q${x - r * .8} ${y} ${x - r * .1} ${y - r * .3}Q${x - r * .05} ${y - r * .7} ${x} ${y - r}Z" fill="${c}" ${st}/>`;
    case 'shield': return `<path d="M${x - r * .8} ${y - r * .8}H${x + r * .8}V${y + r * .1}Q${x + r * .8} ${y + r * .8} ${x} ${y + r}Q${x - r * .8} ${y + r * .8} ${x - r * .8} ${y + r * .1}Z" fill="${c}" ${st}/>`;
    case 'crown': return `<path d="M${x - r} ${y + r * .6}L${x - r * .8} ${y - r * .5}L${x - r * .35} ${y + r * .1}L${x} ${y - r * .8}L${x + r * .35} ${y + r * .1}L${x + r * .8} ${y - r * .5}L${x + r} ${y + r * .6}Z" fill="${c}" ${st}/>`;
    case 'heart': return `<path d="M${x} ${y + r * .9}C${x - r * 1.4} ${y - r * .1} ${x - r * .6} ${y - r * 1} ${x} ${y - r * .3}C${x + r * .6} ${y - r * 1} ${x + r * 1.4} ${y - r * .1} ${x} ${y + r * .9}Z" fill="${c}" ${st}/>`;
    case 'moon': return `<path d="M${x + r * .5} ${y - r * .9}A${r} ${r} 0 1 0 ${x + r * .5} ${y + r * .9}A${r * .75} ${r * .75} 0 1 1 ${x + r * .5} ${y - r * .9}Z" fill="${c}" ${st}/>`;
    case 'leaf': return `<path d="M${x - r * .8} ${y + r * .8}Q${x - r} ${y - r * .8} ${x + r * .8} ${y - r * .9}Q${x + r} ${y + r * .6} ${x - r * .8} ${y + r * .8}Z" fill="${c}" ${st}/><path d="M${x - r * .8} ${y + r * .8}L${x + r * .3} ${y - r * .3}" stroke="${line}" stroke-width="1.6"/>`;
    case 'ball': return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" ${st}/><path d="M${x} ${y - r * .45}l${r * .42} ${r * .3}-${r * .16} ${r * .5}h-${r * .52}l-${r * .16}-${r * .5}z" fill="${line}"/>`;
    case 'gear': return `<circle cx="${x}" cy="${y}" r="${r * .75}" fill="${c}" ${st}/><circle cx="${x}" cy="${y}" r="${r * .3}" fill="${line}"/>${rep(8, (i) => `<rect x="${x - 2}" y="${y - r}" width="4" height="${r * .4}" fill="${c}" ${st} transform="rotate(${i * 45} ${x} ${y})"/>`)}`;
    case 'paw': return `<ellipse cx="${x}" cy="${y + r * .3}" rx="${r * .55}" ry="${r * .45}" fill="${c}" ${st}/>${[[-.7, -.3], [-.25, -.8], [.25, -.8], [.7, -.3]].map(([a, b]) => `<circle cx="${x + a * r}" cy="${y + b * r}" r="${r * .26}" fill="${c}" ${st}/>`).join('')}`;
    case 'bat': return `<path d="M${x} ${y - r * .3}L${x + r * .3} ${y - r * .7}L${x + r * .4} ${y - r * .3}Q${x + r * 1.1} ${y - r * .7} ${x + r * 1.2} ${y + r * .1}Q${x + r * .8} ${y - r * .1} ${x + r * .6} ${y + r * .3}Q${x + r * .3} ${y} ${x} ${y + r * .7}Q${x - r * .3} ${y} ${x - r * .6} ${y + r * .3}Q${x - r * .8} ${y - r * .1} ${x - r * 1.2} ${y + r * .1}Q${x - r * 1.1} ${y - r * .7} ${x - r * .4} ${y - r * .3}L${x - r * .3} ${y - r * .7}Z" fill="${c}" ${st}/>`;
    case 'sun': return `<circle cx="${x}" cy="${y}" r="${r * .55}" fill="${c}" ${st}/>${rep(8, (i) => `<path d="M${x} ${y - r * .75}V${y - r}" stroke="${c}" stroke-width="3" stroke-linecap="round" transform="rotate(${i * 45} ${x} ${y})"/>`)}`;
    case 'cross': return `<path d="M${x - r * .3} ${y - r}H${x + r * .3}V${y - r * .3}H${x + r}V${y + r * .3}H${x + r * .3}V${y + r}H${x - r * .3}V${y + r * .3}H${x - r}V${y - r * .3}H${x - r * .3}Z" fill="${c}" ${st}/>`;
    case 'wing': return `<path d="M${x} ${y + r * .6}Q${x - r * 1.3} ${y + r * .2} ${x - r * 1.2} ${y - r * .8}Q${x - r * .4} ${y - r * .2} ${x} ${y - r * .2}Q${x + r * .4} ${y - r * .2} ${x + r * 1.2} ${y - r * .8}Q${x + r * 1.3} ${y + r * .2} ${x} ${y + r * .6}Z" fill="${c}" ${st}/>`;
    default: return '';
  }
}

/* ---------- body shapes of the dress-like garments ---------- */
const LONG = {
  robe: 'M88 150Q120 139 152 150L158 206L174 304Q120 320 66 304L82 206Z',
  kimono: 'M88 150Q120 139 152 150L156 210L160 300Q120 310 80 300L84 210Z',
  gown: 'M89 150Q120 139 151 150L156 200L160 232Q172 268 184 290Q120 310 56 290Q68 268 80 232L84 200Z',
  column: 'M89 150Q120 139 151 150L156 200L158 240Q160 290 156 306Q120 316 84 306Q80 290 82 240L84 200Z',
  ball: 'M89 150Q120 139 151 150L155 196L158 222Q190 270 206 304Q120 324 34 304Q50 270 82 222L85 196Z',
  mini: 'M89 150Q120 139 151 150L156 200L160 224Q168 244 174 258Q120 272 66 258Q72 244 80 224L84 200Z',
};
const SKIRT = { skirt: 'M86 214Q120 224 154 214L168 270Q120 284 72 270Z', pleat: 'M86 214Q120 224 154 214L170 274Q120 288 70 274Z', kilt: 'M87 216Q120 226 153 216L160 262Q120 272 80 262Z' };

/* ---------- presets: how each kind of outfit is cut ----------
   sl sleeves (none|short|puff|long|wide|cap) · lo lower part · nk neckline · w waist band · ln length of the top (pants types) · ext extras · p default pattern · e emblem */
export const PRESETS = {
  plain: { sl: 'short', lo: 'pants', nk: 'round' },
  /* traditional */
  chapan: { sl: 'long', lo: 'robe', nk: 'wrap', w: 'sash', p: 'ikat', ext: ['trim'] },
  atlas_dress: { sl: 'puff', lo: 'gown', nk: 'round', p: 'ikat', ext: ['trim'] },
  uz_shirt: { sl: 'long', lo: 'pants', nk: 'mandarin', ext: ['trim', 'buttons'], ln: 250 },
  kimono: { sl: 'wide', lo: 'kimono', nk: 'wrap', w: 'obi', p: 'flowers' },
  yukata: { sl: 'wide', lo: 'kimono', nk: 'wrap', w: 'sash', p: 'waves' },
  hakama: { sl: 'wide', lo: 'wide', nk: 'wrap', w: 'belt', ln: 244, ext: ['trim'] },
  hanbok: { sl: 'long', lo: 'ball', nk: 'wrap', w: 'ribbon', ext: ['trim'] },
  hanfu: { sl: 'wide', lo: 'kimono', nk: 'wrap', w: 'sash', ext: ['trim', 'trimhem'] },
  qipao: { sl: 'cap', lo: 'column', nk: 'mandarin', ext: ['trim', 'frog'], p: 'flowers' },
  tang_suit: { sl: 'long', lo: 'pants', nk: 'mandarin', ext: ['frog', 'trim'], ln: 248 },
  sari: { sl: 'cap', lo: 'column', nk: 'boat', ext: ['drape', 'trim'], p: 'diamond' },
  kurta: { sl: 'long', lo: 'pants', nk: 'mandarin', ext: ['trim', 'buttons'], ln: 262, p: 'dots' },
  lehenga: { sl: 'short', lo: 'ball', nk: 'v', w: 'belt', ext: ['trim'], p: 'flowers' },
  sherwani: { sl: 'long', lo: 'pants', nk: 'mandarin', ext: ['buttons', 'trim'], ln: 276 },
  thobe: { sl: 'long', lo: 'kimono', nk: 'mandarin', ext: ['buttons'], noWide: true },
  kaftan: { sl: 'wide', lo: 'robe', nk: 'v', ext: ['trim', 'trimhem'], p: 'diamond' },
  dashiki: { sl: 'short', lo: 'pants', nk: 'v', ext: ['trim'], p: 'tribal' },
  kente: { sl: 'none', lo: 'gown', nk: 'boat', p: 'kente', ext: ['drape'] },
  boubou: { sl: 'wide', lo: 'robe', nk: 'round', p: 'tribal', ext: ['trim'] },
  dirndl: { sl: 'puff', lo: 'skirt', nk: 'square', ext: ['apron', 'vest', 'dirndl'], longSkirt: true },
  lederhosen: { sl: 'short', lo: 'shorts', nk: 'collar', ext: ['suspenders', 'buttons'], p: 'check' },
  kilt_set: { sl: 'long', lo: 'kilt', nk: 'tie', ext: ['lapel', 'buttons'], p: 'plaid', plLower: true },
  flamenco: { sl: 'puff', lo: 'ball', nk: 'v', p: 'dots', ext: ['ruffle'] },
  sarafan: { sl: 'long', lo: 'gown', nk: 'round', ext: ['trim', 'trimhem', 'apron'], p: 'flowers' },
  /* sports */
  jersey_fb: { sl: 'short', lo: 'shorts', nk: 'v', ext: ['number', 'trim', 'stripe-side'], p: 'stripes', sock: true },
  jersey_bb: { sl: 'none', lo: 'knee', nk: 'round', ext: ['number', 'trim', 'stripe-side'], ln: 244 },
  racing_suit: { sl: 'long', lo: 'pants', nk: 'mandarin', ext: ['zip', 'panel', 'emblem'], p: 'chevrons', e: 'flame', same: true },
  boxing: { sl: 'none', lo: 'shorts', nk: 'round', w: 'belt', ext: ['gloves', 'trim'], e: 'bolt' },
  karate_gi: { sl: 'wide', lo: 'wide', nk: 'wrap', w: 'belt', ln: 240, same: true },
  tennis: { sl: 'short', lo: 'shorts', nk: 'collar', ext: ['trim'] },
  rashguard: { sl: 'long', lo: 'knee', nk: 'round', ext: ['stripe-side'], p: 'waves' },
  ski_suit: { sl: 'long', lo: 'pants', nk: 'turtle', ext: ['zip', 'panel', 'quilt'], same: true },
  cycling: { sl: 'short', lo: 'knee', nk: 'mandarin', ext: ['zip', 'stripe-side'], p: 'chevrons' },
  hockey: { sl: 'long', lo: 'pants', nk: 'v', ext: ['number', 'trim'], p: 'stripes' },
  baseball: { sl: 'short', lo: 'pants', nk: 'round', ext: ['buttons', 'number', 'stripe-side'], p: 'pinstripe' },
  rugby: { sl: 'long', lo: 'shorts', nk: 'collar', p: 'stripes', ext: ['trim'] },
  /* formal */
  suit: { sl: 'long', lo: 'pants', nk: 'tie', ext: ['lapel', 'buttons', 'cuffs'], ln: 252 },
  tuxedo: { sl: 'long', lo: 'pants', nk: 'bow', ext: ['lapel', 'buttons', 'satin'], ln: 252 },
  blazer_skirt: { sl: 'long', lo: 'pleat', nk: 'tie', ext: ['lapel', 'buttons'], ln: 224 },
  cocktail: { sl: 'cap', lo: 'gown', nk: 'boat', w: 'belt', ext: ['bow'] },
  evening_gown: { sl: 'none', lo: 'ball', nk: 'boat', p: 'sparkle', ext: ['trim', 'straps'] },
  waistcoat: { sl: 'long', lo: 'pants', nk: 'tie', ext: ['vest', 'buttons'], white: true },
  smart_casual: { sl: 'long', lo: 'pants', nk: 'collar', ext: ['lapel', 'buttons', 'pockets'], ln: 246 },
  school: { sl: 'long', lo: 'pleat', nk: 'tie', ext: ['lapel', 'buttons', 'emblem'], ln: 224, e: 'shield', p: 'solid' },
  /* fantasy */
  wizard_robe: { sl: 'wide', lo: 'robe', nk: 'v', w: 'rope', p: 'stars', ext: ['trim', 'trimhem'] },
  knight_armor: { sl: 'long', lo: 'pants', nk: 'turtle', w: 'belt', ext: ['armor', 'pauldrons', 'emblem'], e: 'shield', mail: true },
  elf_tunic: { sl: 'long', lo: 'pants', nk: 'v', w: 'belt', ln: 264, ext: ['trim', 'emblem'], e: 'leaf' },
  dragon_armor: { sl: 'long', lo: 'pants', nk: 'turtle', p: 'scales', ext: ['pauldrons', 'cape', 'emblem'], e: 'flame' },
  fairy_dress: { sl: 'cap', lo: 'ball', nk: 'boat', p: 'sparkle', ext: ['trim', 'wings-trim'] },
  sorcerer: { sl: 'wide', lo: 'robe', nk: 'hood', w: 'sash', p: 'waves', ext: ['trim'] },
  ranger: { sl: 'long', lo: 'pants', nk: 'hood', w: 'belt', ln: 262, ext: ['cape', 'buckles'] },
  paladin: { sl: 'long', lo: 'pants', nk: 'round', ext: ['armor', 'tabard', 'pauldrons', 'cape', 'emblem'], e: 'sun', mail: true },
  druid: { sl: 'wide', lo: 'kimono', nk: 'v', w: 'rope', p: 'leaves', ext: ['trim', 'emblem'], e: 'leaf' },
  mage_tunic: { sl: 'long', lo: 'pants', nk: 'v', w: 'sash', ln: 262, ext: ['trim', 'emblem'], e: 'star' },
  /* historical */
  medieval: { sl: 'long', lo: 'pants', nk: 'v', w: 'belt', ln: 262, ext: ['lace'] },
  chiton: { sl: 'none', lo: 'column', nk: 'boat', w: 'rope', ext: ['trim', 'trimhem', 'straps'] },
  toga: { sl: 'none', lo: 'column', nk: 'boat', ext: ['drape', 'trimhem'], noWaist: true },
  egyptian: { sl: 'none', lo: 'kilt', nk: 'round', ext: ['broadcollar', 'trim'], e: 'sun' },
  viking: { sl: 'long', lo: 'pants', nk: 'v', w: 'belt', ln: 258, ext: ['vest', 'fur'], wraps: true },
  samurai: { sl: 'wide', lo: 'wide', nk: 'wrap', w: 'sash', ln: 244, ext: ['armor', 'pauldrons-wide', 'trim'], e: 'sun' },
  victorian_dress: { sl: 'long', lo: 'ball', nk: 'ruff', w: 'corset', ext: ['bow'], p: 'pinstripe' },
  victorian_suit: { sl: 'long', lo: 'pants', nk: 'cravat', ext: ['vest', 'lapel', 'buttons'], ln: 262 },
  renaissance: { sl: 'puff', lo: 'pants', nk: 'ruff', w: 'belt', ln: 252, ext: ['vest', 'trim'], p: 'diamond' },
  musketeer: { sl: 'long', lo: 'pants', nk: 'cravat', ext: ['cape', 'vest', 'drape', 'buttons'], ln: 262, e: 'none' },
  /* futuristic */
  cyber_jacket: { sl: 'long', lo: 'pants', nk: 'turtle', ext: ['neon', 'zip', 'pockets'], p: 'circuit', ln: 252 },
  scifi_suit: { sl: 'long', lo: 'pants', nk: 'mandarin', w: 'belt', ext: ['panel', 'neon'], same: true },
  space_explorer: { sl: 'long', lo: 'pants', nk: 'turtle', ext: ['panel', 'zip', 'emblem', 'pockets'], e: 'star', same: true },
  robot_armor: { sl: 'long', lo: 'pants', nk: 'turtle', p: 'hex', ext: ['pauldrons', 'neon', 'armor'], e: 'gear' },
  hologram: { sl: 'long', lo: 'pants', nk: 'mandarin', p: 'hex', ext: ['neon'], same: true, glass: true },
  mech_pilot: { sl: 'long', lo: 'pants', nk: 'turtle', ext: ['harness', 'panel', 'emblem', 'pockets'], e: 'gear', same: true },
  android: { sl: 'long', lo: 'pants', nk: 'round', ext: ['seams', 'neon'], same: true },
  /* gaming & fandom-inspired (original designs) */
  battle_royale: { sl: 'long', lo: 'pants', nk: 'collar', p: 'camo', ext: ['tactical', 'pockets'], ln: 246 },
  rpg_adventurer: { sl: 'long', lo: 'pants', nk: 'v', w: 'belt', ln: 258, ext: ['vest', 'buckles'], white: true },
  explorer: { sl: 'short', lo: 'shorts', nk: 'collar', w: 'belt', ext: ['pockets', 'buttons', 'strap'], ln: 244 },
  survivor: { sl: 'long', lo: 'pants', nk: 'hood', ext: ['zip', 'pockets', 'quilt'], p: 'camo', ln: 258 },
  healer: { sl: 'wide', lo: 'robe', nk: 'v', w: 'sash', ext: ['trim', 'emblem', 'trimhem'], e: 'cross' },
  ninja: { sl: 'long', lo: 'wide', nk: 'wrap', w: 'sash', ln: 244, same: true, ext: ['wraps2'] },
  overalls: { sl: 'long', lo: 'pants', nk: 'collar', ext: ['overalls', 'pockets', 'buttons'], ln: 252 },
  flight_suit: { sl: 'long', lo: 'pants', nk: 'collar', ext: ['zip', 'patches', 'pockets'], same: true },
  letterman: { sl: 'long', lo: 'pants', nk: 'round', ext: ['emblem', 'trim', 'buttons', 'sleevecolor'], e: 'star', ln: 252 },
  sailor_uniform: { sl: 'short', lo: 'pleat', nk: 'sailor', ext: ['bow'], ln: 224 },
  anime_hero: { sl: 'long', lo: 'wide', nk: 'wrap', w: 'sash', ln: 244, ext: ['scarf', 'emblem'], e: 'bolt' },
  magical_girl: { sl: 'puff', lo: 'mini', nk: 'round', ext: ['bigbow', 'trim', 'emblem'], p: 'stars', e: 'heart' },
  onesie: { sl: 'long', lo: 'pants', nk: 'hood', ext: ['zip', 'belly', 'ears'], same: true },
  movie_adventurer: { sl: 'long', lo: 'pants', nk: 'collar', w: 'belt', ext: ['vest', 'strap', 'pockets'], ln: 252 },
  space_ranger: { sl: 'long', lo: 'pants', nk: 'turtle', ext: ['armor', 'pauldrons', 'emblem', 'panel'], e: 'star' },
  hero_bolt: { sl: 'long', lo: 'pants', nk: 'mandarin', ext: ['cape', 'emblem', 'belt2', 'cuffs'], e: 'bolt', same: false },
  hero_shield: { sl: 'long', lo: 'pants', nk: 'mandarin', ext: ['cape', 'emblem', 'belt2', 'cuffs'], e: 'shield' },
  hero_flame: { sl: 'long', lo: 'pants', nk: 'turtle', ext: ['cape', 'emblem', 'belt2', 'panel'], e: 'flame' },
  hero_wing: { sl: 'long', lo: 'pants', nk: 'mandarin', ext: ['emblem', 'belt2', 'cuffs'], e: 'wing' },
  guardian: { sl: 'long', lo: 'pants', nk: 'turtle', ext: ['armor', 'pauldrons', 'cape', 'emblem'], e: 'sun' },
  wizard_school: { sl: 'long', lo: 'robe', nk: 'tie', ext: ['lapel', 'scarf', 'trimhem'], white: true },
  royal: { sl: 'long', lo: 'pants', nk: 'mandarin', ext: ['cape', 'trim', 'buttons', 'drape', 'chain'], ln: 266 },
  /* seasonal */
  winter_coat: { sl: 'long', lo: 'pants', nk: 'turtle', ext: ['zip', 'quilt', 'fur'], ln: 272 },
  parka: { sl: 'long', lo: 'pants', nk: 'hood', ext: ['zip', 'pockets', 'fur', 'quilt'], ln: 268 },
  xmas_sweater: { sl: 'long', lo: 'pants', nk: 'round', ext: ['trim', 'cuffs'], p: 'xmas', ln: 246 },
  gift_giver: { sl: 'long', lo: 'pants', nk: 'v', w: 'belt', ext: ['fur', 'buttons'], ln: 268, same: false },
  holiday_elf: { sl: 'long', lo: 'pants', nk: 'v', w: 'belt', ext: ['trim', 'trimhem'], ln: 258, p: 'stripes', plLower: true },
  witch_dress: { sl: 'long', lo: 'gown', nk: 'v', ext: ['trim', 'trimhem', 'bow'], p: 'stars' },
  vampire: { sl: 'long', lo: 'pants', nk: 'cravat', ext: ['cape', 'vest', 'lapel'], ln: 262 },
  ghost: { sl: 'none', lo: 'robe', nk: 'none', ext: ['scallop'], ghost: true },
  pumpkin: { sl: 'short', lo: 'shorts', nk: 'round', ext: ['emblem', 'pumpkin'], e: 'leaf' },
  skeleton: { sl: 'long', lo: 'pants', nk: 'round', p: 'bones', same: true },
  hawaiian: { sl: 'short', lo: 'shorts', nk: 'collar', p: 'flowers', ext: ['buttons'] },
  sundress: { sl: 'none', lo: 'gown', nk: 'boat', p: 'dots', ext: ['straps', 'bow'] },
  swim: { sl: 'short', lo: 'knee', nk: 'round', ext: ['stripe-side'], p: 'waves' },
  festive_nowruz: { sl: 'puff', lo: 'gown', nk: 'round', p: 'ikat', ext: ['trim', 'embroid'] },
  party: { sl: 'cap', lo: 'mini', nk: 'round', p: 'sparkle', ext: ['bigbow', 'trim'] },
  /* streetwear */
  hiphop: { sl: 'long', lo: 'wide', nk: 'hood', ln: 262, ext: ['chain', 'emblem', 'pockets'], e: 'star', baggy: true },
  skate: { sl: 'long', lo: 'knee', nk: 'collar', p: 'plaid', ext: ['buttons', 'pockets'], ln: 250, baggy: true },
  urban_bomber: { sl: 'long', lo: 'pants', nk: 'mandarin', ext: ['zip', 'trim', 'stripe-side', 'cuffs'], ln: 246 },
  graffiti_tee: { sl: 'short', lo: 'pants', nk: 'round', p: 'graffiti', ext: ['pockets'], ln: 250 },
  track_suit: { sl: 'long', lo: 'pants', nk: 'mandarin', ext: ['zip', 'stripe-side', 'trim', 'cuffs'], ln: 248, same: true },
  puffer_vest: { sl: 'none', lo: 'pants', nk: 'turtle', ext: ['zip', 'quilt', 'underhoodie'], ln: 248 },
  cargo: { sl: 'short', lo: 'pants', nk: 'round', ext: ['pockets', 'cargo'], ln: 250 },
  /* luxury */
  designer_gown: { sl: 'cap', lo: 'ball', nk: 'boat', ext: ['trim', 'trimhem', 'jewel'], p: 'sparkle' },
  velvet_suit: { sl: 'long', lo: 'pants', nk: 'bow', ext: ['lapel', 'buttons', 'satin', 'cuffs'], ln: 254 },
  fur_coat: { sl: 'long', lo: 'pants', nk: 'turtle', ext: ['fur', 'buttons', 'trim'], ln: 280 },
  sequin_dress: { sl: 'long', lo: 'gown', nk: 'boat', p: 'sparkle', ext: ['trim'] },
  couture_cape: { sl: 'none', lo: 'column', nk: 'boat', ext: ['cape', 'jewel', 'trim'], p: 'diamond' },
  gold_tux: { sl: 'long', lo: 'pants', nk: 'bow', ext: ['lapel', 'buttons', 'satin', 'cuffs'], ln: 254, same: false },
};
export const PRESET_KEYS = Object.keys(PRESETS);

/* ---------- the drawing routine ---------- */
export function drawFashion(a, S, F) {
  const pr = PRESETS[a.v] || PRESETS.plain, ext = new Set(pr.ext || []);
  const c = a.c || '#4a90e2', c2 = a.c2 || '#ffffff', c3 = a.c3 || (pr.same ? c : dk(c, .6)), p = a.p && a.p !== 'solid' ? a.p : (a.p === 'solid' ? '' : pr.p || ''), emb = a.e && a.e !== 'none' ? a.e : pr.e || '';
  const white = '#f6f6fa', top = pr.white ? white : c, line = dk(c, .5);
  const longKey = ['robe', 'kimono', 'gown', 'column', 'ball', 'mini'].includes(pr.lo) ? (pr.lo === 'kimono' && pr.noWide ? 'kimono' : pr.lo) : '';
  const skirtKey = SKIRT[pr.lo] ? pr.lo : '';
  const ln = pr.ln || (skirtKey ? 226 : 236);
  const out = [];
  const sleeveC = ext.has('sleevecolor') ? c2 : pr.sl === 'long' && pr.mail ? '#aab3c2' : top;
  const lowerC = c3;
  /* 0 cape / hood behind */
  if (ext.has('cape')) out.push(`<path d="M96 152L46 302Q120 326 194 302L144 152Z" fill="${c2}" ${S}/><path d="M120 156L194 302Q150 318 120 320Z" fill="#1b1240" opacity=".16"/><path d="M96 152L46 302" stroke="${dk(c2, .6)}" stroke-width="2" fill="none"/>`);
  if (pr.nk === 'hood') out.push(`<path d="M90 152Q120 118 150 152Q148 172 120 178Q92 172 90 152Z" fill="${dk(top, .82)}" ${S}/>`);
  if (ext.has('drape') && !longKey) { /* drape handled after */ }
  /* 1 lower part */
  let bodyD = '', lowerShapes = '';
  if (longKey) bodyD = LONG[longKey];
  else {
    const end = pr.lo === 'shorts' ? 276 : pr.lo === 'knee' ? 286 : 308;
    if (['pants', 'shorts', 'knee'].includes(pr.lo)) {
      lowerShapes = legsP(lowerC, S, end, 228) + (ext.has('stripe-side') ? `<path d="M93 232L96 ${end - 6}M147 232L144 ${end - 6}" stroke="${c2}" stroke-width="4" stroke-linecap="round"/>` : '') + (pr.sock ? `<path d="M94 290H118V308H94ZM122 290H146V308H122Z" fill="${c2}" ${S}/>` : '') + (pr.wraps ? `<path d="M94 270H118M94 280H118M122 270H146M122 280H146" stroke="${dk(c3, .6)}" stroke-width="4"/>` : '');
      if (pr.plLower && p) lowerShapes += clip(`M90 228H150L148.5 ${end}H122.5L120 256L117.5 ${end}H91.5Z`, pattern(p, c2, c3));
      if (ext.has('cargo')) lowerShapes += `<rect x="92" y="262" width="22" height="18" rx="3" fill="${dk(c3, .85)}" ${S}/><rect x="126" y="262" width="22" height="18" rx="3" fill="${dk(c3, .85)}" ${S}/>`;
    } else if (pr.lo === 'wide') lowerShapes = `<path d="M88 226H152L${pr.baggy ? 162 : 158} 306H122L120 258L118 306H${pr.baggy ? 78 : 82}Z" fill="${lowerC}" ${S}/><path d="M120 258L122 306H${pr.baggy ? 162 : 158}L152 226H120Z" fill="#1b1240" opacity=".1"/>${pr.baggy ? `<path d="M96 262Q100 272 96 282M144 262Q140 272 144 282" stroke="${dk(c3, .6)}" stroke-width="2" fill="none" opacity=".6"/>` : ''}`;
    else if (skirtKey) {
      lowerShapes = `<path d="${SKIRT[skirtKey]}" fill="${lowerC}" ${S}/>` + (skirtKey === 'pleat' ? rep(8, (i) => `<path d="M${90 + i * 8.6} 222L${82 + i * 10.8} 276" stroke="${dk(c3, .6)}" stroke-width="1.8" opacity=".6"/>`) : '') + (pr.plLower && p ? clip(SKIRT[skirtKey], pattern(p, c2, c3)) : '') + `<path d="${SKIRT[skirtKey].replace(/Z$/, '')}" fill="none" stroke="${dk(c3, .5)}" stroke-width="0"/>`;
      if (pr.longSkirt) lowerShapes = `<path d="M84 214Q120 226 156 214L176 292Q120 310 64 292Z" fill="${lowerC}" ${S}/>` + (ext.has('apron') ? '' : '');
    }
  }
  if (!longKey) out.push(lowerShapes);
  /* 2 sleeves */
  const sl = pr.sl, tc = sleeveC;
  const wideSleeve = `M91 151Q56 156 52 206L50 258Q70 270 92 252L90 190Z`;
  const sleeveShape = (kind) => kind === 'wide' ? `<path d="${wideSleeve}" fill="${tc}" ${S}/><path d="M50 252Q70 264 92 248L92 254Q70 272 50 258Z" fill="${ext.has('trim') || ext.has('trimhem') ? c2 : dk(tc, .75)}"/>`
    : kind === 'puff' ? `<path d="M91 151Q62 150 60 178Q60 192 76 194Q86 192 90 180Z" fill="${tc}" ${S}/><path d="M60 188Q76 198 90 186" fill="none" stroke="${dk(tc, .65)}" stroke-width="2.2"/>${pr.lo === 'ball' || pr.lo === 'gown' || pr.nk === 'wrap' ? `<path d="M64 186Q72 214 66 226Q76 230 86 224L88 190Z" fill="${tc}" ${S}/><path d="M64 222Q76 230 86 222" stroke="${c2}" stroke-width="4" fill="none"/>` : ''}`
      : kind === 'cap' ? `<path d="M91 151Q76 150 70 166Q74 176 90 174Z" fill="${tc}" ${S}/>`
        : kind === 'none' ? (ext.has('straps') ? `<path d="M96 152L100 138H108L105 152Z" fill="${c}" ${S}/>` : '') : sleeveL(tc, S, kind, ext.has('cuffs') || ext.has('trim') ? c2 : undefined, 0);
  if (sl !== 'none' || ext.has('straps')) out.push(sleeveShape(sl) + MR(sleeveShape(sl)));
  /* 3 body */
  const bd = bodyD || bodyP(ln);
  out.push(`<path d="${bd}" fill="${top}" ${S}/>`);
  if (p && !pr.white) out.push(clip(bd, pattern(p, c2, c3)));
  if (pr.white && p) out.push(clip(bd, pattern(p, c2, c3)));
  out.push(longKey ? `<path d="${bd}" fill="#1b1240" opacity=".08" clip-path="none"/>` : sideShade(ln));
  if (!longKey && ln > 236) out.push(hemBand(top, ln - 8));
  if (!longKey) out.push(folds(top));
  /* trims along the bottom of long garments */
  if (longKey && (ext.has('trimhem') || ext.has('trim'))) { const yb = longKey === 'mini' ? 258 : longKey === 'kimono' ? 298 : longKey === 'robe' ? 302 : longKey === 'column' ? 304 : longKey === 'ball' ? 302 : 288; const w = longKey === 'ball' ? 86 : longKey === 'gown' ? 62 : longKey === 'robe' ? 56 : longKey === 'column' ? 36 : longKey === 'mini' ? 52 : 38; out.push(`<path d="M${120 - w} ${yb}Q120 ${yb + 16} ${120 + w} ${yb}L${120 + w + 2} ${yb + 6}Q120 ${yb + 24} ${120 - w - 2} ${yb + 6}Z" fill="${c2}" ${S}/>`); }
  if (ext.has('scallop')) out.push(`<path d="M68 300${rep(7, (i) => `q9 14 18 0`)}" fill="${top}" ${S}/>`);
  /* 4 waist */
  const wy = pr.w === 'ribbon' ? 176 : longKey === 'column' || longKey === 'ball' || longKey === 'gown' || longKey === 'mini' ? 206 : 214;
  if (pr.w === 'belt' && !pr.noWaist) out.push(`<path d="M${86} ${wy}Q120 ${wy + 8} 154 ${wy}V${wy + 10}Q120 ${wy + 18} 86 ${wy + 10}Z" fill="${c3 === c ? dk(c, .6) : c3}" ${S}/><rect x="112" y="${wy + 1}" width="16" height="13" rx="3" fill="#ffd23f" stroke="#8a6200" stroke-width="1.4"/>`);
  if (pr.w === 'sash') out.push(`<path d="M84 ${wy - 4}Q120 ${wy + 6} 156 ${wy - 4}V${wy + 12}Q120 ${wy + 22} 84 ${wy + 12}Z" fill="${c2}" ${S}/><path d="M142 ${wy + 12}Q150 ${wy + 36} 140 ${wy + 52}L152 ${wy + 50}Q158 ${wy + 30} 152 ${wy + 12}Z" fill="${c2}" ${S}/>`);
  if (pr.w === 'obi') out.push(`<path d="M84 ${wy - 10}Q120 ${wy} 156 ${wy - 10}V${wy + 22}Q120 ${wy + 32} 84 ${wy + 22}Z" fill="${c2}" ${S}/><path d="M84 ${wy + 3}Q120 ${wy + 13} 156 ${wy + 3}" stroke="${dk(c2, .6)}" stroke-width="2" fill="none"/><path d="M148 ${wy + 6}l12 -12v28z" fill="${dk(c2, .85)}" ${S}/>`);
  if (pr.w === 'rope') out.push(`<path d="M86 ${wy}Q120 ${wy + 10} 154 ${wy}" fill="none" stroke="${c2}" stroke-width="5" stroke-linecap="round"/><path d="M148 ${wy + 6}Q156 ${wy + 24} 150 ${wy + 40}" fill="none" stroke="${c2}" stroke-width="4" stroke-linecap="round"/><circle cx="150" cy="${wy + 42}" r="4" fill="${c2}"/>`);
  if (pr.w === 'corset') out.push(`<path d="M88 ${wy - 22}Q120 ${wy - 14} 152 ${wy - 22}L150 ${wy + 6}Q120 ${wy + 14} 90 ${wy + 6}Z" fill="${c2}" ${S}/>${rep(4, (i) => `<path d="M112 ${wy - 14 + i * 5}l8 3 8 -3" stroke="${dk(c2, .55)}" stroke-width="1.6" fill="none"/>`)}`);
  if (pr.w === 'ribbon') out.push(`<path d="M92 ${wy}Q120 ${wy + 8} 148 ${wy}V${wy + 7}Q120 ${wy + 15} 92 ${wy + 7}Z" fill="${c2}" ${S}/><path d="M118 ${wy + 4}l-14 14 8 4zM122 ${wy + 4}l14 14-8 4z" fill="${c2}" ${S}/>`);
  /* 5 extras on the body */
  if (ext.has('vest')) out.push(`<path d="M90 153L108 147L114 ${ln - 10}H90Z" fill="${pr.white ? c : c2}" ${S}/>${MR(`<path d="M90 153L108 147L114 ${ln - 10}H90Z" fill="${pr.white ? c : c2}" ${S}/>`)}${ext.has('fur') ? `<path d="M90 153L108 147L106 ${ln - 14}H90Z" fill="#fff" opacity=".7"/>` : ''}`);
  if (ext.has('armor')) out.push(`<path d="M95 152Q120 144 145 152L149 204Q120 228 91 204Z" fill="${c2}" ${S}/><path d="M120 150V222M96 180Q120 188 144 180" fill="none" stroke="${dk(c2, .6)}" stroke-width="2.4"/><path d="M103 160Q99 172 103 186" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="3" stroke-linecap="round"/>`);
  if (ext.has('tabard')) out.push(`<path d="M104 152H136L140 ${ln + 36}Q120 ${ln + 44} 100 ${ln + 36}Z" fill="${c}" ${S}/>`);
  if (ext.has('apron')) out.push(`<path d="M102 172H138L146 ${pr.longSkirt ? 284 : 262}Q120 ${pr.longSkirt ? 296 : 274} 94 ${pr.longSkirt ? 284 : 262}Z" fill="${c2}" ${S}/><path d="M102 172H138" stroke="${dk(c2, .7)}" stroke-width="2"/>`);
  if (ext.has('dirndl')) out.push(`<path d="M92 156L106 150V204H90Z" fill="${c3}" ${S}/>${MR(`<path d="M92 156L106 150V204H90Z" fill="${c3}" ${S}/>`)}`);
  if (ext.has('overalls')) out.push(`<path d="M100 150V176H140V150L148 150V236H92V150Z" fill="${c3}" ${S}/><path d="M98 148L104 138M142 148L136 138" stroke="${dk(c3, .7)}" stroke-width="5" stroke-linecap="round"/><rect x="108" y="184" width="24" height="18" rx="3" fill="${dk(c3, .85)}" stroke="${dk(c3, .5)}" stroke-width="1.6"/><circle cx="100" cy="170" r="3" fill="#ffd23f"/><circle cx="140" cy="170" r="3" fill="#ffd23f"/>`);
  if (ext.has('suspenders')) out.push(`<path d="M98 150V226M142 150V226" stroke="${c3 === c ? dk(c, .6) : c3}" stroke-width="7"/><path d="M96 214H144" stroke="${c3 === c ? dk(c, .6) : c3}" stroke-width="3"/>`);
  if (ext.has('harness')) out.push(`<path d="M96 150L140 236M144 150L100 236" stroke="${c2}" stroke-width="7" stroke-linecap="round"/><circle cx="120" cy="193" r="5" fill="#ffd23f" ${S}/>`);
  if (ext.has('strap')) out.push(`<path d="M94 150L146 234" stroke="${dk(c3, .8)}" stroke-width="7"/><rect x="132" y="216" width="22" height="18" rx="3" fill="${dk(c3, .85)}" ${S} transform="rotate(25 143 225)"/>`);
  if (ext.has('tactical')) out.push(`<path d="M92 156H148V222H92Z" fill="${dk(c3, .7)}" ${S}/>${rep(3, (i) => `<rect x="${96 + i * 17}" y="196" width="14" height="22" rx="2" fill="${dk(c3, .9)}" stroke="${dk(c3, .4)}" stroke-width="1.4"/>`)}<path d="M92 170H148" stroke="${dk(c3, .5)}" stroke-width="2"/>`);
  if (ext.has('quilt')) out.push(`<path d="M84 ${ln - 54}Q120 ${ln - 46} 156 ${ln - 54}M83 ${ln - 30}Q120 ${ln - 22} 157 ${ln - 30}M84 ${ln - 6}Q120 ${ln + 2} 156 ${ln - 6}" fill="none" stroke="${dk(top, .65)}" stroke-width="2.4" opacity=".7"/>`);
  if (ext.has('underhoodie')) out.push(`<path d="M92 151Q120 124 148 151Q146 168 120 174Q94 168 92 151Z" fill="${c2}" ${S}/>`);
  if (ext.has('pockets')) out.push(`<path d="M96 ${ln - 34}L112 ${ln - 30}V${ln - 12}L94 ${ln - 14}ZM144 ${ln - 34}L128 ${ln - 30}V${ln - 12}L146 ${ln - 14}Z" fill="${dk(top, .88)}" ${S}/>`);
  if (ext.has('patches')) out.push(`<rect x="96" y="170" width="16" height="10" rx="2" fill="${c2}" stroke="${line}" stroke-width="1.4"/><circle cx="104" cy="196" r="6" fill="${c2}" stroke="${line}" stroke-width="1.4"/>`);
  if (ext.has('panel')) out.push(`<path d="M92 156L100 236M148 156L140 236" stroke="${c2}" stroke-width="6" opacity=".95" fill="none"/><path d="M104 170H136" stroke="${dk(c, .55)}" stroke-width="2"/>`);
  if (ext.has('seams')) out.push(`<path d="M120 150V236M96 160Q92 196 96 232M144 160Q148 196 144 232" fill="none" stroke="${c2}" stroke-width="2.4" opacity=".9"/>`);
  if (ext.has('neon')) out.push(`<g stroke="${c2}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".95"><path d="M120 160V190M100 176H140M96 214H144M92 160L88 200M148 160L152 200"/></g><circle cx="120" cy="196" r="6" fill="${c2}" opacity=".95"/><circle cx="120" cy="196" r="10" fill="none" stroke="${c2}" stroke-width="2" opacity=".5"/>`);
  if (ext.has('quilt') && ext.has('fur')) { /* fur drawn below */ }
  if (ext.has('zip')) out.push(`<path d="M120 152V${ln}" stroke="${dk(top, .5)}" stroke-width="3"/><circle cx="120" cy="166" r="3" fill="#ffd23f" stroke="${dk(top, .4)}" stroke-width="1"/>`);
  if (ext.has('buttons')) out.push(`<g fill="${dk(top, .5)}">${rep(3, (i) => `<circle cx="120" cy="${176 + i * 16}" r="2.6"/>`)}</g>`);
  if (ext.has('frog')) out.push(`<g stroke="${c2}" stroke-width="2.6" fill="none" stroke-linecap="round">${rep(3, (i) => `<path d="M${120 - 8} ${172 + i * 16}Q${120} ${166 + i * 16} ${120 + 8} ${172 + i * 16}"/>`)}</g><g fill="${c2}">${rep(3, (i) => `<circle cx="120" cy="${172 + i * 16}" r="2.8"/>`)}</g>`);
  if (ext.has('trim') && !longKey) out.push(`<path d="M84 ${ln - 6}Q120 ${ln + 2} 156 ${ln - 6}" fill="none" stroke="${c2}" stroke-width="4"/>`);
  if (ext.has('embroid')) out.push(`<path d="M92 172Q120 182 148 172" fill="none" stroke="${c2}" stroke-width="3"/>${rep(5, (i) => `<circle cx="${100 + i * 10}" cy="${178 + (i % 2) * 2}" r="2.4" fill="${c2}"/>`)}`);
  if (ext.has('ruffle')) out.push(`<path d="M60 262Q72 252 84 262T108 262T132 262T156 262T180 262" fill="none" stroke="${c2}" stroke-width="5" stroke-linecap="round"/>`);
  if (ext.has('lace')) out.push(`<path d="M108 150L120 172L132 150" fill="none" stroke="#fff" stroke-width="2.4"/>${rep(4, (i) => `<path d="M${112 + i * 3} ${154 + i * 5}h${8 - i * 2}" stroke="#fff" stroke-width="1.6"/>`)}`);
  if (ext.has('jewel')) out.push(`<circle cx="120" cy="${wy - 2}" r="6" fill="#5ef2ff" stroke="#8a6200" stroke-width="2"/><circle cx="118" cy="${wy - 4}" r="2" fill="#fff"/>`);
  if (ext.has('belt2')) out.push(`<rect x="86" y="${ln - 18}" width="68" height="9" rx="3" fill="${c2}" ${S}/><circle cx="120" cy="${ln - 14}" r="6" fill="#ffd23f" stroke="#8a6200" stroke-width="1.6"/>`);
  /* emblem and number */
  if (emb && !ext.has('belly')) out.push(emblem(emb, 120, 188, ext.has('armor') ? 13 : 14, c2, dk(c, .45)));
  if (ext.has('number') && (a.n || a.n === 0)) out.push(`<text x="120" y="204" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="30" fill="${c2}" stroke="${dk(c, .45)}" stroke-width="1.6" paint-order="stroke">${String(a.n).replace(/[^0-9]/g, '').slice(0, 2)}</text>`);
  if (ext.has('belly')) out.push(`<ellipse cx="120" cy="206" rx="22" ry="26" fill="${c2}" ${S}/>`);
  if (ext.has('wings-trim')) out.push(`<path d="M120 150V172" stroke="${c2}" stroke-width="3"/>`);
  /* 6 necklines (they sit over the body, with the skin showing through) */
  const nk = pr.nk;
  const NECK = {
    round: `<path d="M104 146Q120 168 136 146Z" fill="${F}"/><path d="M103 145Q120 171 137 145" fill="none" stroke="${dk(top, .7)}" stroke-width="4" stroke-linecap="round"/>`,
    v: `<path d="M106 146L120 174L134 146Z" fill="${F}"/><path d="M105 145L120 177L135 145" fill="none" stroke="${dk(top, .7)}" stroke-width="3.6" stroke-linejoin="round"/>`,
    boat: `<path d="M98 150Q120 164 142 150Q120 144 98 150Z" fill="${F}"/><path d="M96 149Q120 166 144 149" fill="none" stroke="${dk(top, .7)}" stroke-width="3.6" stroke-linecap="round"/>`,
    square: `<path d="M102 148H138V164H102Z" fill="${F}"/><path d="M101 148V165H139V148" fill="none" stroke="${dk(top, .7)}" stroke-width="3.4" stroke-linejoin="round"/>`,
    collar: `<path d="M106 146L120 170L134 146Z" fill="${F}"/><path d="M103 143L121 168L108 177L97 150Z" fill="${c2 === c ? '#fff' : c2}" ${S}/>${MR(`<path d="M103 143L121 168L108 177L97 150Z" fill="${c2 === c ? '#fff' : c2}" ${S}/>`)}`,
    tie: `<path d="M106 146L120 170L134 146Z" fill="${F}"/><path d="M103 143L121 168L108 177L97 150Z" fill="#fff" ${S}/>${MR(`<path d="M103 143L121 168L108 177L97 150Z" fill="#fff" ${S}/>`)}<path d="M114 168L120 162L126 168L129 214L120 224L111 214Z" fill="${c2}" ${S}/>`,
    cravat: `<path d="M106 146L120 170L134 146Z" fill="${F}"/><path d="M103 143L121 168L108 177L97 150Z" fill="#fff" ${S}/>${MR(`<path d="M103 143L121 168L108 177L97 150Z" fill="#fff" ${S}/>`)}<path d="M108 162Q120 154 132 162Q132 176 120 180Q108 176 108 162Z" fill="#fff" ${S}/>`,
    bow: `<path d="M106 146L120 170L134 146Z" fill="${F}"/><path d="M103 143L121 168L108 177L97 150Z" fill="#fff" ${S}/>${MR(`<path d="M103 143L121 168L108 177L97 150Z" fill="#fff" ${S}/>`)}<path d="M120 164L106 156V172ZM120 164L134 156V172Z" fill="${c2 === '#ffffff' ? '#e63946' : c2}" ${S}/><circle cx="120" cy="164" r="3.4" fill="${dk(c2, .7)}"/>`,
    mandarin: `<path d="M108 146Q120 154 132 146Z" fill="${F}"/><path d="M99 148Q120 138 141 148L139 161Q120 156 101 161Z" fill="${ext.has('trim') || ext.has('frog') ? c2 : dk(top, .85)}" ${S}/>`,
    turtle: `<path d="M99 147Q120 138 141 147L140 162Q120 170 100 162Z" fill="${dk(top, .82)}" ${S}/><path d="M104 152H136M103 157H137" stroke="${dk(top, .6)}" stroke-width="1.6" opacity=".7"/>`,
    wrap: `<path d="M107 146L121 182L133 146Z" fill="${F}"/><path d="M103 144L124 200L113 204L96 150Z" fill="${c2}" ${S}/><path d="M137 144L116 200L127 204L144 150Z" fill="${dk(c2, .88)}" ${S}/>`,
    sailor: `<path d="M106 146L120 176L134 146Z" fill="${F}"/><path d="M92 152L120 184L148 152L154 172L120 206L86 172Z" fill="${c2}" ${S}/><path d="M104 172l16 18 16-18" fill="none" stroke="${dk(c2, .6)}" stroke-width="2"/><path d="M120 184L110 206L120 200L130 206Z" fill="#e63946" ${S}/>`,
    ruff: `<path d="M106 148Q120 156 134 148Z" fill="${F}"/><g fill="#fff" stroke="${dk('#f0f0f8', .6)}" stroke-width="1.4">${rep(9, (i) => `<circle cx="${96 + i * 6}" cy="${154 + Math.sin(i / 8 * Math.PI) * 4 + 2}" r="5.4"/>`)}</g>`,
    hood: `<path d="M104 148Q120 174 136 148Q120 142 104 148Z" fill="${F}"/><path d="M98 148Q120 180 142 148" fill="none" stroke="${dk(top, .66)}" stroke-width="5" stroke-linecap="round"/>${ext.has('ears') ? `<path d="M92 124L84 100L108 116ZM148 124L156 100L132 116Z" fill="${dk(top, .85)}" ${S}/>` : ''}`,
    none: '',
  };
  out.push(NECK[nk] || '');
  if (ext.has('lapel')) out.push(`<path d="M104 146L120 206L96 214L90 160Z" fill="${ext.has('satin') ? c2 : dk(top, .78)}" ${S}/>${MR(`<path d="M104 146L120 206L96 214L90 160Z" fill="${ext.has('satin') ? c2 : dk(top, .78)}" ${S}/>`)}<path d="M120 206V${ln}" stroke="${dk(top, .5)}" stroke-width="2.4"/>`);
  if (ext.has('broadcollar')) out.push(`<path d="M92 150Q120 190 148 150L154 160Q120 208 86 160Z" fill="#ffd23f" ${S}/><path d="M96 158Q120 192 144 158" fill="none" stroke="#5ef2ff" stroke-width="4" stroke-dasharray="6 5"/>`);
  if (ext.has('fur')) out.push(`<path d="M92 150Q120 170 148 150L152 164Q120 188 88 164Z" fill="#fffaf2" ${S}/>${ext.has('buttons') || ln > 262 ? `<path d="M84 ${ln - 8}Q120 ${ln + 2} 156 ${ln - 8}L156 ${ln + 4}Q120 ${ln + 14} 84 ${ln + 4}Z" fill="#fffaf2" ${S}/>` : ''}`);
  if (ext.has('scarf')) out.push(`<path d="M92 150Q120 172 148 150L150 166Q120 186 90 166Z" fill="${c2}" ${S}/><path d="M138 170L146 208L158 204L150 168Z" fill="${c2}" ${S}/>${rep(3, (i) => `<path d="M${96 + i * 14} ${158 + i * 2}l8 4" stroke="${dk(c2, .6)}" stroke-width="2"/>`)}`);
  if (ext.has('bigbow')) out.push(`<path d="M120 170L96 158Q90 172 96 184ZM120 170L144 158Q150 172 144 184Z" fill="${c2}" ${S}/><circle cx="120" cy="170" r="5" fill="${dk(c2, .75)}" ${S}/>`);
  if (ext.has('bow') && !['bow'].includes(nk)) out.push(`<path d="M120 ${wy + 4}L106 ${wy - 4}V${wy + 12}ZM120 ${wy + 4}L134 ${wy - 4}V${wy + 12}Z" fill="${c2}" ${S}/><circle cx="120" cy="${wy + 4}" r="3.4" fill="${dk(c2, .7)}"/>`);
  if (ext.has('chain')) out.push(`<path d="M102 150Q120 192 138 150" fill="none" stroke="#ffd23f" stroke-width="3.4"/><circle cx="120" cy="190" r="6" fill="#ffd23f" stroke="#8a6200" stroke-width="1.6"/>`);
  if (ext.has('buckles')) out.push(`<rect x="106" y="162" width="8" height="8" rx="1.6" fill="#ffd23f" stroke="#8a6200" stroke-width="1.2"/><rect x="126" y="162" width="8" height="8" rx="1.6" fill="#ffd23f" stroke="#8a6200" stroke-width="1.2"/>`);
  if (ext.has('pumpkin')) out.push(`<path d="M104 170Q120 160 136 170Q148 200 136 232H104Q92 200 104 170Z" fill="${c}" ${S} opacity=".0"/>`);
  if (ext.has('drape')) out.push(`<path d="M92 150L148 220L148 236L136 236L88 164Z" fill="${c2}" ${S}/><path d="M92 150L148 220" stroke="${dk(c2, .65)}" stroke-width="2" fill="none"/>`);
  if (ext.has('wraps2')) out.push(`<path d="M64 200H88M64 210H88M152 200H176M152 210H176" stroke="${c2}" stroke-width="4"/>`);
  /* pauldrons and gloves go over the sleeves */
  if (ext.has('pauldrons')) out.push(`<ellipse cx="80" cy="158" rx="16" ry="11" transform="rotate(-18 80 158)" fill="${c2}" ${S}/><ellipse cx="160" cy="158" rx="16" ry="11" transform="rotate(18 160 158)" fill="${c2}" ${S}/><path d="M72 154Q80 150 88 154M152 154Q160 150 168 154" stroke="#fff" stroke-opacity=".7" stroke-width="2.4" fill="none"/>`);
  if (ext.has('pauldrons-wide')) out.push(`<path d="M62 150L98 150L96 176L66 172Z" fill="${c2}" ${S}/>${MR(`<path d="M62 150L98 150L96 176L66 172Z" fill="${c2}" ${S}/>`)}<path d="M66 158H96M66 166H96" stroke="${dk(c2, .6)}" stroke-width="2"/>${MR(`<path d="M66 158H96M66 166H96" stroke="${dk(c2, .6)}" stroke-width="2"/>`)}`);
  if (ext.has('gloves')) out.push(`<ellipse cx="70" cy="238" rx="13" ry="14" fill="${c2}" ${S}/><ellipse cx="170" cy="238" rx="13" ry="14" fill="${c2}" ${S}/><path d="M60 228Q70 222 80 228M160 228Q170 222 180 228" stroke="#fff" stroke-opacity=".6" stroke-width="2.4" fill="none"/>`);
  if (pr.glass) return `<g opacity=".82">${out.join('')}</g>`;
  if (pr.ghost) return `<g opacity=".95">${out.join('')}<ellipse cx="104" cy="176" rx="5" ry="8" fill="#1b1240"/><ellipse cx="136" cy="176" rx="5" ry="8" fill="#1b1240"/><ellipse cx="120" cy="196" rx="6" ry="9" fill="#1b1240"/></g>`;
  return `<g>${out.join('')}</g>`;
}
