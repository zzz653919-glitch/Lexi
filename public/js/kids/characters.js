/* LEXIO KIDS: the learning friends (lion, fox, bunny, cat, dino, robot). Original cartoon characters drawn in SVG, with moods and accessories. */
import { h } from '../ui.js';

export const CHARACTERS = ['lion', 'fox', 'bunny', 'cat', 'dino', 'robot'];
export const MOODS = ['happy', 'cheer', 'oops', 'think', 'sleep'];
const INK = '#3b2314';

/* eyes + mouth + cheeks for a mood; the robot has a screen face */
function face(mood, robot) {
  if (robot) {
    const eyes = { happy: '<rect x="66" y="96" width="18" height="18" rx="6" fill="#5ef2ff"/><rect x="116" y="96" width="18" height="18" rx="6" fill="#5ef2ff"/>',
      cheer: '<path d="M64 112q11-20 22 0M114 112q11-20 22 0" stroke="#5ef2ff" stroke-width="7" fill="none" stroke-linecap="round"/>',
      oops: '<rect x="66" y="100" width="18" height="12" rx="4" fill="#ffd166"/><rect x="116" y="100" width="18" height="12" rx="4" fill="#ffd166"/>',
      think: '<rect x="66" y="96" width="18" height="18" rx="6" fill="#5ef2ff"/><rect x="116" y="102" width="18" height="8" rx="4" fill="#5ef2ff"/>',
      sleep: '<path d="M64 108h22M114 108h22" stroke="#5ef2ff" stroke-width="6" stroke-linecap="round"/>' }[mood];
    const mouth = { happy: '<path d="M80 134q20 14 40 0" stroke="#5ef2ff" stroke-width="6" fill="none" stroke-linecap="round"/>', cheer: '<path d="M78 128q22 26 44 0z" fill="#5ef2ff"/>',
      oops: '<path d="M84 142q16-12 32 0" stroke="#ffd166" stroke-width="6" fill="none" stroke-linecap="round"/>', think: '<path d="M88 138h24" stroke="#5ef2ff" stroke-width="6" stroke-linecap="round"/>', sleep: '<circle cx="100" cy="138" r="5" fill="#5ef2ff"/>' }[mood];
    return `<g class="k-eyes">${eyes}</g>${mouth}`;
  }
  const eyes = { happy: `<g class="k-eyes" fill="${INK}"><ellipse cx="76" cy="104" rx="9" ry="12"/><ellipse cx="124" cy="104" rx="9" ry="12"/><circle cx="79" cy="99" r="3.6" fill="#fff"/><circle cx="127" cy="99" r="3.6" fill="#fff"/></g>`,
    cheer: `<g fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"><path d="M64 108q12-18 24 0"/><path d="M112 108q12-18 24 0"/></g>`,
    oops: `<g class="k-eyes" fill="${INK}"><ellipse cx="76" cy="106" rx="8" ry="10"/><ellipse cx="124" cy="106" rx="8" ry="10"/></g><path d="M64 90l22 6M136 90l-22 6" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M146 84q6 10 0 16q-6-6 0-16z" fill="#7dd3fc"/>`,
    think: `<g class="k-eyes" fill="${INK}"><ellipse cx="76" cy="104" rx="9" ry="12"/><ellipse cx="124" cy="106" rx="8" ry="6"/><circle cx="79" cy="99" r="3.6" fill="#fff"/></g><path d="M112 92l24-5" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`,
    sleep: `<g fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"><path d="M64 108h24"/><path d="M112 108h24"/></g><text x="146" y="86" font-size="22" fill="#6a5a96" font-family="sans-serif" font-weight="700">z</text>` }[mood];
  const mouth = { happy: `<path d="M84 132q16 14 32 0" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`, cheer: `<path d="M80 126q20 30 40 0z" fill="#7a1f2b" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M90 140q10-8 20 0q-10 8-20 0z" fill="#ff7a93"/>`,
    oops: `<path d="M86 142q14-12 28 0" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`, think: `<path d="M90 136h20" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`, sleep: `<ellipse cx="100" cy="138" rx="6" ry="5" fill="${INK}"/>` }[mood];
  return `${eyes}${mouth}<g fill="#ff6f91" opacity=".5"><ellipse cx="58" cy="128" rx="11" ry="7"/><ellipse cx="142" cy="128" rx="11" ry="7"/></g>`;
}
const HEADS = {
  lion: `<g stroke="#7a3e00" stroke-width="5" stroke-linejoin="round"><circle cx="100" cy="104" r="84" fill="#ff9a1f"/><circle cx="38" cy="52" r="24" fill="#ffb84d"/><circle cx="162" cy="52" r="24" fill="#ffb84d"/><circle cx="100" cy="112" r="64" fill="#ffd166"/><ellipse cx="100" cy="132" rx="30" ry="22" fill="#fff3d6"/></g><circle cx="38" cy="52" r="11" fill="#ff8aa8"/><circle cx="162" cy="52" r="11" fill="#ff8aa8"/><path d="M91 120q9-9 18 0q-9 11-18 0z" fill="#3b2314"/>`,
  fox: `<g stroke="#8a3b00" stroke-width="5" stroke-linejoin="round"><path d="M30 20l50 40-40 40z" fill="#ff8a1f"/><path d="M170 20l-50 40 40 40z" fill="#ff8a1f"/><ellipse cx="100" cy="116" rx="72" ry="66" fill="#ff8a1f"/><path d="M28 120q30 50 72 56q42-6 72-56q-30 8-72 4q-42 4-72-4z" fill="#fff"/></g><path d="M44 30l22 20-18 20z" fill="#3b2314" opacity=".85"/><path d="M156 30l-22 20 18 20z" fill="#3b2314" opacity=".85"/><path d="M92 124q8-8 16 0q-8 9-16 0z" fill="#3b2314"/>`,
  bunny: `<g stroke="#5b3b7a" stroke-width="5" stroke-linejoin="round"><ellipse cx="68" cy="52" rx="19" ry="48" fill="#f3e8ff"/><ellipse cx="132" cy="52" rx="19" ry="48" fill="#f3e8ff"/><circle cx="100" cy="124" r="64" fill="#f3e8ff"/></g><ellipse cx="68" cy="56" rx="8" ry="32" fill="#ffb3d1"/><ellipse cx="132" cy="56" rx="8" ry="32" fill="#ffb3d1"/><path d="M93 124q7-7 14 0q-7 8-14 0z" fill="#ff6f91"/>`,
  cat: `<g stroke="#4a4a5a" stroke-width="5" stroke-linejoin="round"><path d="M34 30l16 56 40-30z" fill="#a8b2c8"/><path d="M166 30l-16 56-40-30z" fill="#a8b2c8"/><ellipse cx="100" cy="116" rx="72" ry="64" fill="#bcc6dc"/><ellipse cx="100" cy="138" rx="30" ry="22" fill="#eef1f8"/></g><path d="M44 44l8 24 18-12z" fill="#ffb3d1"/><path d="M156 44l-8 24-18-12z" fill="#ffb3d1"/><path d="M92 122q8-6 16 0q-8 8-16 0z" fill="#ff6f91"/><g stroke="#4a4a5a" stroke-width="3" stroke-linecap="round"><path d="M46 126l-26-6M46 134l-26 4M154 126l26-6M154 134l26 4"/></g>`,
  dino: `<g stroke="#1b5e20" stroke-width="5" stroke-linejoin="round"><path d="M70 36l10-22 12 22zM94 30l8-26 10 26zM118 36l12-22 10 22z" fill="#ffd166"/><ellipse cx="100" cy="116" rx="74" ry="66" fill="#5ed17a"/><ellipse cx="100" cy="142" rx="38" ry="22" fill="#b6f0c2"/></g><circle cx="86" cy="140" r="4" fill="#1b5e20"/><circle cx="114" cy="140" r="4" fill="#1b5e20"/><g fill="#3fae5e"><circle cx="52" cy="96" r="8"/><circle cx="148" cy="92" r="9"/><circle cx="60" cy="150" r="6"/></g>`,
  robot: `<g stroke="#34456b" stroke-width="5" stroke-linejoin="round"><path d="M100 28v-14" /><circle cx="100" cy="12" r="9" fill="#ff5fa2"/><rect x="26" y="96" width="14" height="40" rx="7" fill="#9fb4e8"/><rect x="160" y="96" width="14" height="40" rx="7" fill="#9fb4e8"/><rect x="36" y="30" width="128" height="124" rx="34" fill="#c7d4f6"/><rect x="52" y="62" width="96" height="76" rx="22" fill="#1b2a4e"/></g>`,
};
const ACCESSORIES = {
  hat: '<g stroke="#2a2a3a" stroke-width="5" stroke-linejoin="round"><rect x="62" y="6" width="76" height="46" rx="6" fill="#3a3a55"/><rect x="48" y="46" width="104" height="12" rx="6" fill="#3a3a55"/><rect x="62" y="34" width="76" height="9" fill="#ff5fa2" stroke="none"/></g>',
  glasses: '<g fill="rgba(255,255,255,.35)" stroke="#2a2a3a" stroke-width="5"><circle cx="76" cy="105" r="19"/><circle cx="124" cy="105" r="19"/><path d="M95 105h10" fill="none"/></g>',
  bow: '<g stroke="#a3195b" stroke-width="4" stroke-linejoin="round"><path d="M142 40l-30 14 8 24z" fill="#ff5fa2"/><path d="M142 40l32 8-12 24z" fill="#ff5fa2"/><circle cx="142" cy="44" r="9" fill="#ff8fc0"/></g>',
  scarf: '<g stroke="#8a1c1c" stroke-width="5" stroke-linejoin="round"><path d="M44 168q56 22 112 0l-6 22q-50 18-100 0z" fill="#ff5d5d"/><path d="M128 176l16 28 14-8-8-26z" fill="#ff8a8a"/></g>',
  headphones: '<g stroke="#2a2a3a" stroke-width="6" stroke-linecap="round" fill="none"><path d="M24 104q0-86 76-86t76 86"/></g><g fill="#35a7ff" stroke="#2a2a3a" stroke-width="5"><rect x="12" y="92" width="26" height="42" rx="10"/><rect x="162" y="92" width="26" height="42" rx="10"/></g>',
  crown: '<g stroke="#8a6200" stroke-width="5" stroke-linejoin="round"><path d="M56 40l12-30 22 20 10-28 10 28 22-20 12 30z" fill="#ffd23f"/><circle cx="100" cy="30" r="6" fill="#ff5fa2" stroke="none"/></g>',
};

/* markup of one character; the accessory is drawn on top */
export function characterSvg(character = 'lion', mood = 'happy', accessory = '') {
  const c = HEADS[character] ? character : 'lion', m = MOODS.includes(mood) ? mood : 'happy';
  return `<svg viewBox="0 0 200 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${c}" focusable="false">${HEADS[c]}${face(m, c === 'robot')}${ACCESSORIES[accessory] || ''}</svg>`;
}

/* a living companion: moods change the face and trigger a little animation; say() shows a speech bubble */
export function companion({ character = 'lion', accessory = '', mood = 'happy', size = 120, bubble = false, label = '' } = {}) {
  const art = h('span', { class: 'k-ch k-ch-' + character }), speech = h('div', { class: 'k-speech', role: 'status', 'aria-live': 'polite', hidden: true });
  const state = { character, accessory, mood };
  const draw = () => { art.innerHTML = characterSvg(state.character, state.mood, state.accessory); art.dataset.mood = state.mood; };
  art.style.width = size + 'px'; art.style.height = Math.round(size * 1.05) + 'px';
  draw();
  const el = h('div', { class: 'k-companion' + (bubble ? ' with-bubble' : ''), 'data-character': character }, bubble ? speech : null, art, label ? h('span', { class: 'sr-only' }, label) : null);
  let moodTimer = 0, textTimer = 0;
  const api = {
    el,
    /* show a mood for a moment, then relax to happy */
    react(mood, ms = 1400) { state.mood = mood; draw(); art.classList.remove('k-react'); void art.offsetWidth; art.classList.add('k-react'); clearTimeout(moodTimer); if (mood !== 'happy') moodTimer = setTimeout(() => { state.mood = 'happy'; draw(); }, ms); },
    setMood(m) { state.mood = m; draw(); },
    set({ character: ch, accessory: ac }) { if (ch) { state.character = ch; el.dataset.character = ch; art.className = 'k-ch k-ch-' + ch; } if (ac !== undefined) state.accessory = ac; draw(); },
    say(text, ms = 0) { speech.textContent = text; speech.hidden = !text; clearTimeout(textTimer); if (ms) textTimer = setTimeout(() => { speech.hidden = true; }, ms); },
  };
  return api;
}
