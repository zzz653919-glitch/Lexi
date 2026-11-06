/* LEXIO KIDS colouring pages: original outline drawings made of tappable regions (viewBox 0 0 200 200). */
const petals = Array.from({ length: 5 }, (_, i) => `<ellipse cx="100" cy="48" rx="19" ry="28" transform="rotate(${i * 72} 100 90)"/>`);
export const PICTURES = {
  apple: { emoji: '🍎', en: 'Apple', regions: ['<path d="M100 56C60 36 22 66 30 118C38 170 80 188 100 176C120 188 162 170 170 118C178 66 140 36 100 56Z"/>', '<path d="M104 52C112 22 140 14 156 22C150 46 128 58 104 52Z"/>', '<rect x="96" y="30" width="9" height="30" rx="4"/>'] },
  cat: { emoji: '🐱', en: 'Cat', regions: ['<circle cx="100" cy="112" r="62"/>', '<path d="M48 70L56 22L92 52Z"/>', '<path d="M152 70L144 22L108 52Z"/>', '<path d="M92 118q8-8 16 0q-8 10-16 0z"/>', '<path d="M100 178l-26-12v26zM100 178l26-12v26z"/>'] },
  fish: { emoji: '🐟', en: 'Fish', regions: ['<ellipse cx="90" cy="100" rx="64" ry="40"/>', '<path d="M146 100L190 66V134Z"/>', '<path d="M80 62Q100 30 120 60Z"/>', '<circle cx="58" cy="90" r="8"/>'] },
  ball: { emoji: '⚽', en: 'Ball', regions: ['<path d="M100 100L100 30A70 70 0 0 1 170 100Z"/>', '<path d="M100 100L170 100A70 70 0 0 1 100 170Z"/>', '<path d="M100 100L100 170A70 70 0 0 1 30 100Z"/>', '<path d="M100 100L30 100A70 70 0 0 1 100 30Z"/>'] },
  car: { emoji: '🚗', en: 'Car', regions: ['<rect x="20" y="96" width="160" height="46" rx="14"/>', '<path d="M56 96L76 56H128L152 96Z"/>', '<path d="M72 92L86 64H108V92Z"/>', '<circle cx="58" cy="146" r="20"/>', '<circle cx="142" cy="146" r="20"/>'] },
  house: { emoji: '🏠', en: 'House', regions: ['<rect x="40" y="90" width="120" height="86"/>', '<path d="M26 94L100 32L174 94Z"/>', '<rect x="86" y="126" width="30" height="50" rx="4"/>', '<rect x="56" y="104" width="24" height="24" rx="3"/>', '<rect x="122" y="104" width="24" height="24" rx="3"/>'] },
  flower: { emoji: '🌸', en: 'Flower', regions: [...petals, '<circle cx="100" cy="90" r="22"/>', '<rect x="95" y="112" width="10" height="76" rx="4"/>', '<path d="M105 160Q140 130 164 150Q140 176 105 160Z"/>'] },
  teddy: { emoji: '🧸', en: 'Teddy bear', regions: ['<circle cx="100" cy="86" r="48"/>', '<circle cx="62" cy="48" r="20"/>', '<circle cx="138" cy="48" r="20"/>', '<ellipse cx="100" cy="102" rx="22" ry="16"/>', '<ellipse cx="100" cy="162" rx="50" ry="36"/>'] },
};
export const PALETTE = [['Red', '#ef4444'], ['Orange', '#fb923c'], ['Yellow', '#facc15'], ['Green', '#22c55e'], ['Blue', '#2f7bff'], ['Purple', '#a855f7'], ['Pink', '#ff7ab8'], ['Brown', '#8b5a2b'], ['Black', '#1f2937'], ['White', '#ffffff']];
export const svgOf = (code, fills = {}) => {
  const p = PICTURES[code];
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${p.en}" class="k-art-svg"><g stroke="#3b2a63" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">${p.regions.map((r, i) => r.replace(/^<(\w+)/, `<$1 class="k-region" data-r="${i}" tabindex="0" role="button" aria-label="${p.en} ${i + 1}" fill="${fills[i] || '#ffffff'}"`)).join('')}</g></svg>`;
};
