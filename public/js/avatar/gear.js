/* Game gear: helmets, funny hats, face masks, gloves, boots and packs of the gaming skins. Original shapes, drawn from scratch:
   they hint at the genre (tactical, blocky, sci-fi, fantasy, crew) without copying any game's artwork. */
import { dk } from './geo.js';

const T = (c, w = 2.2) => `stroke="${dk(c, .45)}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const rep = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('');

/* 8×8 pixel faces for the blocky head covers */
const FACES = {
  smile: ['........', '........', '.##..##.', '.##..##.', '........', '.#....#.', '..####..', '........'],
  grim: ['........', '........', '.##..##.', '.##..##.', '...##...', '..####..', '..#..#..', '........'],
  zombie: ['........', '.#....#.', '.##..##.', '.##..##.', '...##...', '..#..#..', '.######.', '........'],
  bones: ['........', '.##..##.', '.##..##.', '........', '...##...', '.#....#.', '..#..#..', '........'],
  ender: ['........', '........', '........', '#.#..#.#', '###..###', '........', '..####..', '........'],
  blank: ['........', '........', '........', '........', '........', '........', '........', '........'],
};
export const GEAR_HATS = ['milhelm', 'tachelm', 'boonie', 'swathelm', 'ghilliehood', 'bandanahead', 'blockhead', 'blockhelm', 'visorhelm', 'hornhelm', 'aviator', 'plantpot', 'pancakes', 'cheese', 'cone', 'bucket', 'banana', 'eggshell', 'bowler', 'cactus', 'miner'];
export function gearHat(a) {
  const c = a.c || '#4a5a3a', c2 = a.c2 || '#222', c3 = a.c3 || dk(c, .7), S = T(c);
  switch (a.v) {
    case 'milhelm': return `<g><path d="M68 70Q68 26 120 24Q172 26 172 70Q120 78 68 70Z" fill="${c}" ${S}/><path d="M68 68Q120 80 172 68L172 74Q120 86 68 74Z" fill="${dk(c, .7)}" ${S}/>${rep(7, (i) => `<path d="M${84 + i * 12} 34V66" stroke="${c3}" stroke-width="1.6" opacity=".6"/>`)}${rep(4, (i) => `<path d="M72 ${40 + i * 8}Q120 ${34 + i * 8} 168 ${40 + i * 8}" stroke="${c3}" stroke-width="1.6" fill="none" opacity=".6"/>`)}<path d="M80 38Q104 28 128 30" stroke="#fff" stroke-opacity=".4" stroke-width="3" fill="none" stroke-linecap="round"/></g>`;
    case 'tachelm': return `<g><path d="M68 74Q66 26 120 24Q174 26 172 74L164 98V70H76V98Z" fill="${c}" ${S}/><rect x="104" y="30" width="32" height="8" rx="2" fill="${dk(c, .6)}"/><path d="M72 58Q120 46 168 58" fill="none" stroke="${c2}" stroke-width="8"/><rect x="92" y="40" width="56" height="16" rx="8" fill="#1b1240" stroke="${dk(c, .4)}" stroke-width="2"/><rect x="98" y="43" width="44" height="9" rx="4" fill="${c3}" opacity=".85"/><path d="M80 40Q104 30 128 32" stroke="#fff" stroke-opacity=".35" stroke-width="3" fill="none" stroke-linecap="round"/></g>`;
    case 'boonie': return `<g><path d="M86 58Q88 26 120 26Q152 26 154 58Z" fill="${c}" ${S}/><path d="M52 60Q56 74 92 66Q120 70 148 66Q184 74 188 60Q168 70 120 62Q72 70 52 60Z" fill="${c}" ${S}/><path d="M88 52H152" stroke="${c3}" stroke-width="6"/>${rep(5, (i) => `<path d="M${92 + i * 14} 30V58" stroke="${c3}" stroke-width="1.6" opacity=".6"/>`)}</g>`;
    case 'swathelm': return `<g><path d="M68 80Q66 26 120 24Q174 26 172 80L166 98H74Z" fill="${c}" ${S}/><path d="M78 62H162V102H78Z" fill="rgba(80,170,255,.35)" stroke="${dk(c, .4)}" stroke-width="2.4"/><path d="M84 70L106 98M104 66L126 98" stroke="#fff" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/><path d="M80 38Q104 28 128 30" stroke="#fff" stroke-opacity=".4" stroke-width="3" fill="none" stroke-linecap="round"/></g>`;
    case 'ghilliehood': return `<g><path d="M60 104Q50 30 120 20Q190 30 180 104Q166 72 150 64Q120 54 90 64Q74 72 60 104Z" fill="${c}" ${S}/>${rep(18, (i) => `<path d="M${64 + (i * 37) % 112} ${30 + (i * 23) % 60}q${(i % 2 ? 7 : -7)} 8 0 16" stroke="${i % 3 ? c3 : '#8fa84a'}" stroke-width="3" fill="none" stroke-linecap="round"/>`)}</g>`;
    case 'bandanahead': return `<g><path d="M70 62Q120 44 170 62L170 74Q120 58 70 74Z" fill="${c}" ${S}/>${rep(6, (i) => `<circle cx="${84 + i * 14}" cy="${64 + (i % 2) * 3}" r="2.2" fill="${c2}"/>`)}<path d="M166 66L186 60L182 84L172 72Z" fill="${c}" ${S}/><path d="M166 70L182 90L170 84Z" fill="${dk(c, .85)}" ${S}/></g>`;
    case 'blockhead': { const f = FACES[a.e] || FACES.smile; return `<g><rect x="68" y="34" width="104" height="108" rx="3" fill="${c}" ${S}/><rect x="68" y="34" width="104" height="22" fill="${dk(c, .82)}"/>${f.map((row, j) => [...row].map((ch, i) => (ch === '#' ? `<rect x="${72 + i * 12}" y="${40 + j * 12.6}" width="12" height="12.6" fill="${c2}"/>` : '')).join('')).join('')}<path d="M68 34H172V142H68Z" fill="none" stroke="${dk(c, .45)}" stroke-width="2.4"/>${rep(6, (i) => `<rect x="${72 + (i * 31) % 90}" y="${44 + (i * 17) % 80}" width="8" height="8" fill="#fff" opacity=".1"/>`)}</g>`; }
    case 'blockhelm': return `<g><path d="M66 94V30H174V94H158V62H82V94Z" fill="${c}" ${S}/>${rep(5, (i) => `<rect x="${70 + i * 20}" y="34" width="14" height="14" fill="${i % 2 ? c3 : dk(c, .85)}" opacity=".7"/>`)}<rect x="82" y="56" width="76" height="8" fill="${dk(c, .6)}"/><path d="M72 36H116" stroke="#fff" stroke-opacity=".5" stroke-width="4"/></g>`;
    case 'visorhelm': return `<g><path d="M64 96Q60 22 120 20Q180 22 176 96Q176 112 160 112H80Q64 112 64 96Z" fill="${c}" ${S}/><rect x="76" y="62" width="88" height="48" rx="22" fill="${c2}" opacity=".88" stroke="${dk(c, .4)}" stroke-width="3"/><path d="M86 72Q104 66 128 70" stroke="#fff" stroke-opacity=".75" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M82 38Q104 28 128 30" stroke="#fff" stroke-opacity=".4" stroke-width="3" fill="none" stroke-linecap="round"/></g>`;
    case 'hornhelm': return `<g><path d="M70 70Q70 28 120 26Q170 28 170 70Q120 62 70 70Z" fill="${c}" ${S}/><path d="M72 56Q48 52 50 22Q64 38 80 42Z" fill="#f2e8d0" stroke="#8a7a58" stroke-width="2"/><path d="M168 56Q192 52 190 22Q176 38 160 42Z" fill="#f2e8d0" stroke="#8a7a58" stroke-width="2"/><path d="M116 32V82L120 90L124 82V32Z" fill="${dk(c, .8)}" ${S}/><path d="M74 58Q120 46 166 58" stroke="${c2}" stroke-width="5" fill="none"/></g>`;
    case 'aviator': return `<g><path d="M68 78Q66 28 120 26Q174 28 172 78Q170 64 160 60Q120 50 80 60Q70 64 68 78Z" fill="${c}" ${S}/><circle cx="98" cy="50" r="13" fill="${c3}" ${S}/><circle cx="142" cy="50" r="13" fill="${c3}" ${S}/><circle cx="98" cy="50" r="8" fill="rgba(160,220,255,.7)"/><circle cx="142" cy="50" r="8" fill="rgba(160,220,255,.7)"/><path d="M111 50H129" stroke="${dk(c, .5)}" stroke-width="4"/></g>`;
    case 'plantpot': return `<g><path d="M90 66L96 36H144L150 66Z" fill="#c8693c" stroke="#7a3d1e" stroke-width="2.2" stroke-linejoin="round"/><rect x="86" y="32" width="68" height="10" rx="3" fill="#d9794a" stroke="#7a3d1e" stroke-width="2"/><path d="M120 32Q116 12 104 8Q112 24 120 32ZM120 32Q124 8 140 6Q132 24 120 32Z" fill="#3cb55e" stroke="#1f7a3a" stroke-width="2"/></g>`;
    case 'pancakes': return `<g>${rep(3, (i) => `<ellipse cx="120" cy="${54 - i * 12}" rx="${42 - i * 3}" ry="9" fill="${i % 2 ? '#e0a64e' : '#efbb66'}" stroke="#8a5a1e" stroke-width="2"/>`)}<path d="M104 24Q120 14 136 24Q132 34 120 32Q108 34 104 24Z" fill="#fff5c0" stroke="#c8a830" stroke-width="2"/><path d="M92 36Q96 46 92 54M148 40Q152 48 148 56" stroke="#8a4a14" stroke-width="3" fill="none" stroke-linecap="round"/></g>`;
    case 'cheese': return `<g><path d="M70 64L162 36L170 64Z" fill="#ffd23f" stroke="#a37a00" stroke-width="2.4" stroke-linejoin="round"/><path d="M70 64H170V72H70Z" fill="#f0bd1a" stroke="#a37a00" stroke-width="2.4"/><circle cx="110" cy="58" r="4.4" fill="#e3a800"/><circle cx="140" cy="52" r="3.6" fill="#e3a800"/><circle cx="154" cy="62" r="3" fill="#e3a800"/></g>`;
    case 'cone': return `<g><path d="M96 62L118 6H122L144 62Z" fill="#ff7a1f" stroke="#a84a00" stroke-width="2.4" stroke-linejoin="round"/><path d="M104 40H136L132 28H108Z" fill="#fff"/><rect x="86" y="60" width="68" height="9" rx="3" fill="#ff7a1f" stroke="#a84a00" stroke-width="2.4"/></g>`;
    case 'bucket': return `<g><path d="M84 66L90 30H150L156 66Z" fill="${c}" ${S}/><ellipse cx="120" cy="30" rx="30" ry="6" fill="${dk(c, .75)}" ${S}/><path d="M96 38Q120 12 144 38" fill="none" stroke="#888fa2" stroke-width="3"/><path d="M92 44H148" stroke="${c2}" stroke-width="4"/></g>`;
    case 'banana': return `<g><path d="M72 62Q60 20 112 10Q150 4 170 30Q150 22 116 28Q86 36 90 64Z" fill="#ffe14a" stroke="#a88a00" stroke-width="2.4" stroke-linejoin="round"/><path d="M170 30L180 22" stroke="#6a4a00" stroke-width="5" stroke-linecap="round"/><path d="M86 48Q112 24 160 32" stroke="#fff" stroke-opacity=".45" stroke-width="3" fill="none" stroke-linecap="round"/></g>`;
    case 'eggshell': return `<g><path d="M76 66Q76 20 120 20Q164 20 164 66L152 58L140 70L128 58L116 70L104 58L92 70Z" fill="#fff6e4" stroke="#b9a07a" stroke-width="2.4" stroke-linejoin="round"/><path d="M92 34Q104 24 122 26" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/></g>`;
    case 'bowler': return `<g><path d="M80 62Q80 22 120 22Q160 22 160 62Z" fill="${c}" ${S}/><ellipse cx="120" cy="62" rx="52" ry="9" fill="${c}" ${S}/><rect x="82" y="50" width="76" height="8" fill="${c2}"/></g>`;
    case 'miner': return `<g><path d="M72 68Q72 28 120 26Q168 28 168 68Z" fill="${c}" ${S}/><rect x="66" y="62" width="108" height="10" rx="5" fill="${dk(c, .8)}" ${S}/><rect x="102" y="30" width="36" height="14" rx="5" fill="${c3}" ${S}/><circle cx="120" cy="52" r="10" fill="#fff6a8" stroke="#a88a00" stroke-width="2.4"/><circle cx="120" cy="52" r="5" fill="#ffd23f"/><path d="M84 40Q108 30 128 32" stroke="#fff" stroke-opacity=".4" stroke-width="3" fill="none" stroke-linecap="round"/></g>`;
    case 'cactus': return `<g><path d="M104 66V30Q104 20 114 20T124 30V66Z" fill="#3cb55e" stroke="#1f7a3a" stroke-width="2.4"/><path d="M104 46Q88 44 88 30M124 40Q142 38 142 24" fill="none" stroke="#3cb55e" stroke-width="9" stroke-linecap="round"/><path d="M104 46Q88 44 88 30M124 40Q142 38 142 24" fill="none" stroke="#1f7a3a" stroke-width="2" stroke-linecap="round"/><circle cx="114" cy="22" r="4" fill="#ff7ab8"/><rect x="92" y="62" width="56" height="10" rx="3" fill="#c8693c" stroke="#7a3d1e" stroke-width="2"/></g>`;
    default: return '';
  }
}

/* ---------- face wear: eyes at (97,90) and (143,90), mouth near y 118 ---------- */
export const FACES_WEAR = ['balaclava', 'gasmask', 'skullmask', 'bandanaface', 'tacvisor', 'goggles', 'ninjamask', 'pixelshades', 'neonvisor', 'cybereyes', 'respirator', 'gaiterface'];
export function drawFace(a) {
  const c = a.c || '#2b2b3a', c2 = a.c2 || '#ffffff', S = T(c);
  switch (a.v) {
    case 'balaclava': return `<g><path d="M70 96Q76 92 96 98Q120 94 144 98Q164 92 170 96V138Q120 158 70 138Z" fill="${c}" ${S}/><path d="M86 84Q97 78 108 84V96Q97 102 86 96ZM132 84Q143 78 154 84V96Q143 102 132 96Z" fill="#1b1240" opacity="0"/><path d="M82 126Q120 140 158 126" stroke="${dk(c, .6)}" stroke-width="2" fill="none"/></g>`;
    case 'gasmask': return `<g><path d="M76 82Q120 70 164 82V124Q164 140 120 148Q76 140 76 124Z" fill="${c}" ${S}/><circle cx="98" cy="96" r="14" fill="rgba(170,230,255,.55)" stroke="${dk(c, .4)}" stroke-width="3"/><circle cx="142" cy="96" r="14" fill="rgba(170,230,255,.55)" stroke="${dk(c, .4)}" stroke-width="3"/><circle cx="120" cy="132" r="13" fill="${dk(c, .75)}" ${S}/>${rep(3, (i) => `<path d="M${112 + i * 8} 124V140" stroke="${dk(c, .4)}" stroke-width="2"/>`)}</g>`;
    case 'skullmask': return `<g><path d="M82 100Q120 94 158 100V122Q158 142 120 148Q82 142 82 122Z" fill="${c2}" ${S}/>${rep(6, (i) => `<path d="M${94 + i * 10} 130V144" stroke="${dk(c2, .6)}" stroke-width="2.4"/>`)}<path d="M96 126H144" stroke="${dk(c2, .6)}" stroke-width="2.4"/><path d="M114 110L120 116L126 110Z" fill="${dk(c2, .5)}"/></g>`;
    case 'bandanaface': return `<g><path d="M72 98Q120 92 168 98L120 146Z" fill="${c}" ${S}/>${rep(5, (i) => `<circle cx="${96 + (i % 3) * 14}" cy="${106 + Math.floor(i / 3) * 14}" r="2.4" fill="${c2}"/>`)}<path d="M72 98L58 92L62 112Z" fill="${c}" ${S}/></g>`;
    case 'tacvisor': return `<g><path d="M70 78Q120 66 170 78V104Q120 112 70 104Z" fill="rgba(20,30,60,.82)" stroke="${c}" stroke-width="4" stroke-linejoin="round"/><path d="M82 82L112 100M104 78L132 100" stroke="#fff" stroke-opacity=".4" stroke-width="3" stroke-linecap="round"/><path d="M70 90H56M170 90H184" stroke="${c}" stroke-width="5" stroke-linecap="round"/></g>`;
    case 'goggles': return `<g><circle cx="97" cy="90" r="19" fill="rgba(160,220,255,.4)" stroke="${c}" stroke-width="6"/><circle cx="143" cy="90" r="19" fill="rgba(160,220,255,.4)" stroke="${c}" stroke-width="6"/><path d="M116 88H124" stroke="${c}" stroke-width="6"/><path d="M78 88L66 84M162 88L174 84" stroke="${c}" stroke-width="5"/><path d="M86 82Q96 76 106 80" stroke="#fff" stroke-opacity=".7" stroke-width="3" fill="none" stroke-linecap="round"/></g>`;
    case 'ninjamask': return `<g><path d="M70 100Q120 92 170 100V136Q120 156 70 136Z" fill="${c}" ${S}/><path d="M70 66Q120 54 170 66V76Q120 64 70 76Z" fill="${c}" ${S}/><path d="M74 118Q120 130 166 118" stroke="${c2}" stroke-width="2.4" fill="none"/></g>`;
    case 'pixelshades': return `<g><path d="M76 80H116V102H76ZM124 80H164V102H124Z" fill="${c}" stroke="${dk(c, .4)}" stroke-width="2.4"/><path d="M116 84H124" stroke="${c}" stroke-width="5"/><rect x="82" y="84" width="10" height="8" fill="${c2}" opacity=".6"/><rect x="130" y="84" width="10" height="8" fill="${c2}" opacity=".6"/></g>`;
    case 'neonvisor': return `<g><path d="M72 80Q120 70 168 80L164 100Q120 108 76 100Z" fill="rgba(10,20,40,.7)" stroke="${c}" stroke-width="3.6" stroke-linejoin="round"/><path d="M80 90H160" stroke="${c2}" stroke-width="5" stroke-linecap="round" opacity=".95"/><circle cx="164" cy="90" r="4" fill="${c2}"/></g>`;
    case 'cybereyes': return `<g><path d="M78 84H162V98H78Z" fill="rgba(10,20,40,.85)" stroke="${c}" stroke-width="3"/><circle cx="97" cy="91" r="5" fill="${c2}"/><circle cx="143" cy="91" r="5" fill="${c2}"/><path d="M104 91H136" stroke="${c2}" stroke-width="2" opacity=".6"/></g>`;
    case 'respirator': return `<g><path d="M82 104Q120 96 158 104V124Q158 138 120 144Q82 138 82 124Z" fill="${c}" ${S}/><circle cx="96" cy="124" r="9" fill="${dk(c, .7)}" ${S}/><circle cx="144" cy="124" r="9" fill="${dk(c, .7)}" ${S}/><path d="M92 124H100M140 124H148" stroke="${c2}" stroke-width="2"/><path d="M82 110L66 100M158 110L174 100" stroke="${dk(c, .6)}" stroke-width="4"/></g>`;
    case 'gaiterface': return `<g><path d="M72 104Q120 96 168 104V132Q120 150 72 132Z" fill="${c}" ${S}/>${rep(4, (i) => `<path d="M${78 + i * 22} 108Q${88 + i * 22} 128 ${78 + i * 22} 140" stroke="${c2}" stroke-width="2.6" fill="none" opacity=".7"/>`)}</g>`;
    default: return '';
  }
}

/* ---------- gloves: hands near (72, 231) and (168, 231) ---------- */
export const GLOVES = ['tacglove', 'fullglove', 'cyberglove', 'gauntlet', 'mitt', 'blockhand'];
export function drawGloves(a) {
  const c = a.c || '#2b2b3a', c2 = a.c2 || '#e63946', S = T(c);
  const one = (v) => ({
    tacglove: `<path d="M60 214H86V228Q86 246 74 248Q60 246 60 228Z" fill="${c}" ${S}/><path d="M60 214H86V222H60Z" fill="${dk(c, .7)}"/><rect x="62" y="228" width="22" height="7" rx="3" fill="${c2}" ${S}/><path d="M64 242Q72 248 82 242" stroke="${dk(c, .5)}" stroke-width="2" fill="none"/>`,
    fullglove: `<path d="M60 212H86V230Q88 250 74 252Q58 250 60 230Z" fill="${c}" ${S}/>${rep(3, (i) => `<path d="M${65 + i * 7} 238V250" stroke="${dk(c, .5)}" stroke-width="1.6"/>`)}<path d="M60 218H86" stroke="${c2}" stroke-width="4"/>`,
    cyberglove: `<path d="M60 212H86V230Q88 250 74 252Q58 250 60 230Z" fill="${c}" ${S}/><path d="M66 218V246M73 216V250M80 218V246" stroke="${c2}" stroke-width="2.4" stroke-linecap="round"/><circle cx="73" cy="226" r="3.4" fill="${c2}"/>`,
    gauntlet: `<path d="M56 196H90L88 226Q92 250 74 254Q56 250 58 226Z" fill="${c}" ${S}/><path d="M58 206H88M58 216H88" stroke="${dk(c, .55)}" stroke-width="2.4"/><rect x="62" y="238" width="24" height="9" rx="3" fill="${c2}" ${S}/>`,
    mitt: `<path d="M60 214H86V230Q88 250 74 252Q58 250 60 230Z" fill="${c}" ${S}/><path d="M66 244Q74 238 82 244" stroke="${dk(c, .55)}" stroke-width="2" fill="none"/><rect x="60" y="214" width="26" height="8" fill="${c2}"/>`,
    blockhand: `<rect x="60" y="214" width="26" height="38" fill="${c}" ${S}/><rect x="60" y="214" width="26" height="10" fill="${c2}"/>${rep(2, (i) => `<rect x="${62 + i * 12}" y="${232 + i * 6}" width="10" height="10" fill="${dk(c, .8)}" opacity=".6"/>`)}`,
  }[v] || '');
  const body = one(a.v);
  return body ? `<g>${body}<g transform="translate(240 0) scale(-1 1)">${body}</g></g>` : '';
}

/* ---------- boots, packs and neck pieces ---------- */
export const GEAR_SHOES = ['combat', 'tacboot', 'pixelboot', 'cyberboot', 'mechboot'];
export function gearShoe(a) {
  const c = a.c || '#2b2b3a', c2 = a.c2 || '#ffffff', S = T(c), pair = (f) => [88, 124].map((x) => f(x)).join('');
  switch (a.v) {
    case 'combat': return `<g>${pair((x) => `<path d="M${x} 268H${x + 28}L${x + 30} 300Q${x + 42} 304 ${x + 38} 318H${x - 4}L${x - 2} 296Z" fill="${c}" ${S}/><path d="M${x - 5} 314H${x + 42}V322H${x - 5}Z" fill="${dk(c, .55)}" ${S}/>${rep(5, (i) => `<path d="M${x + 4} ${274 + i * 6}H${x + 24}" stroke="${c2}" stroke-width="2"/>`)}`)}</g>`;
    case 'tacboot': return `<g>${pair((x) => `<path d="M${x} 262H${x + 28}L${x + 30} 300Q${x + 42} 304 ${x + 38} 318H${x - 4}L${x - 2} 296Z" fill="${c}" ${S}/><path d="M${x - 5} 314H${x + 42}V322H${x - 5}Z" fill="${dk(c, .5)}" ${S}/><rect x="${x + 4}" y="272" width="20" height="6" rx="2" fill="${c2}"/><rect x="${x + 4}" y="286" width="20" height="6" rx="2" fill="${c2}"/><path d="M${x + 26} 264V300" stroke="${dk(c, .5)}" stroke-width="2.4"/>`)}</g>`;
    case 'pixelboot': return `<g>${pair((x) => `<path d="M${x} 270H${x + 28}V298H${x + 38}V320H${x - 4}V270Z" fill="${c}" ${S}/>${rep(4, (i) => `<rect x="${x + (i % 2) * 14}" y="${274 + i * 10}" width="12" height="10" fill="${dk(c, .8)}" opacity=".6"/>`)}<rect x="${x - 4}" y="312" width="42" height="8" fill="${c2}" ${S}/>`)}</g>`;
    case 'cyberboot': return `<g>${pair((x) => `<path d="M${x} 280H${x + 28}L${x + 30} 300Q${x + 40} 304 ${x + 36} 316H${x - 4}L${x - 2} 296Z" fill="${c}" ${S}/><rect x="${x - 6}" y="314" width="46" height="9" rx="4" fill="${dk(c, .6)}" ${S}/><path d="M${x - 4} 319H${x + 38}" stroke="${c2}" stroke-width="3.4" stroke-linecap="round"/><path d="M${x + 6} 288V304M${x + 20} 288V300" stroke="${c2}" stroke-width="2.4" stroke-linecap="round"/>`)}</g>`;
    case 'mechboot': return `<g>${pair((x) => `<path d="M${x - 2} 270H${x + 30}L${x + 34} 300Q${x + 46} 304 ${x + 42} 320H${x - 6}L${x - 4} 296Z" fill="${c}" ${S}/><rect x="${x - 8}" y="312" width="52" height="12" rx="4" fill="${c2}" ${S}/><path d="M${x} 280H${x + 28}M${x + 2} 292H${x + 30}" stroke="${dk(c, .5)}" stroke-width="3"/><circle cx="${x + 14}" cy="304" r="4" fill="#5ef2ff"/>`)}</g>`;
    default: return '';
  }
}
export const GEAR_BACKS = ['tacpack', 'parachute', 'cubepack', 'crewpack'];
export function gearBack(a) {
  const c = a.c || '#4a5a3a', c2 = a.c2 || '#e63946', S = T(c);
  switch (a.v) {
    case 'tacpack': return `<g><rect x="72" y="150" width="96" height="92" rx="16" fill="${c}" ${S}/><rect x="84" y="206" width="30" height="30" rx="6" fill="${dk(c, .8)}" ${S}/><rect x="126" y="206" width="30" height="30" rx="6" fill="${dk(c, .8)}" ${S}/><path d="M92 150V176M148 150V176" stroke="${dk(c, .55)}" stroke-width="6"/><rect x="104" y="160" width="32" height="10" rx="3" fill="${c2}"/></g>`;
    case 'parachute': return `<g><rect x="76" y="152" width="88" height="80" rx="14" fill="${c}" ${S}/><path d="M92 152V150M148 152V150" stroke="${dk(c, .55)}" stroke-width="6"/><circle cx="120" cy="192" r="14" fill="${c2}" ${S}/><path d="M120 178V206M106 192H134" stroke="${dk(c2, .5)}" stroke-width="2.4"/></g>`;
    case 'cubepack': return `<g><rect x="76" y="156" width="88" height="86" fill="${c}" ${S}/>${rep(4, (i) => `<rect x="${80 + (i % 2) * 40}" y="${160 + Math.floor(i / 2) * 40}" width="32" height="32" fill="${dk(c, i % 3 ? .85 : .7)}" opacity=".7"/>`)}<path d="M92 156V150M148 156V150" stroke="${dk(c, .55)}" stroke-width="6"/></g>`;
    case 'crewpack': return `<g><path d="M146 162Q176 164 176 200Q176 236 148 238Z" fill="${c}" ${S}/><path d="M152 176Q168 180 168 198" stroke="#fff" stroke-opacity=".5" stroke-width="3" fill="none" stroke-linecap="round"/></g>`;
    default: return '';
  }
}
export const GEAR_NECKS = ['dogtag', 'gaiter'];
export function gearNeck(a) {
  const c = a.c || '#cfd6e6', c2 = a.c2 || '#2b2b3a';
  switch (a.v) {
    case 'dogtag': return `<g><path d="M104 148Q120 190 136 148" fill="none" stroke="${c}" stroke-width="3" stroke-dasharray="4 2.4"/><path d="M110 176h14l3 6-3 14h-14l-3-14z" fill="${c}" stroke="${dk(c, .5)}" stroke-width="2" stroke-linejoin="round"/><path d="M118 184h14l3 6-3 14h-14l-3-14z" fill="${dk(c, .9)}" stroke="${dk(c, .5)}" stroke-width="2" stroke-linejoin="round"/></g>`;
    case 'gaiter': return `<g><path d="M96 148Q120 138 144 148L146 166Q120 178 94 166Z" fill="${c2}" stroke="${dk(c2, .45)}" stroke-width="2.2" stroke-linejoin="round"/>${rep(4, (i) => `<path d="M${102 + i * 11} 150Q${104 + i * 11} 162 ${102 + i * 11} 170" stroke="${c}" stroke-width="2" fill="none" opacity=".7"/>`)}</g>`;
    default: return '';
  }
}
