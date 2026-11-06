/* LEXIO KIDS mini games. Each game gets a context (stage, helpers, card pool) and calls ctx.finish({ correct, total, ids }) when it is over. */
import { h } from '../ui.js';
import { t } from '../i18n.js';
import { shuffle, sample, picture, say, sayText } from './common.js';

const BODY = (c) => c.en;
const ANIMAL_SOUNDS = { cat: 'Meow, meow', dog: 'Woof, woof', lion: 'Roar', elephant: 'Pawoooo', rabbit: 'Sniff, sniff', monkey: 'Ooh ooh, aah aah', bear: 'Grrr, grrr', horse: 'Neigh, neigh', cow: 'Moo, moo', duck: 'Quack, quack', fish: 'Blub, blub', tiger: 'Grrraaawr', bird: 'Tweet, tweet' };
/* objects of the colour hunt: [emoji, colour name (English, as in the colours lesson), spoken name] */
const OBJECTS = [['🍎', 'Red', 'Apple'], ['🍅', 'Red', 'Tomato'], ['🚒', 'Red', 'Fire truck'], ['🍌', 'Yellow', 'Banana'], ['🌻', 'Yellow', 'Sunflower'], ['🐥', 'Yellow', 'Chick'], ['🐸', 'Green', 'Frog'], ['🥦', 'Green', 'Broccoli'], ['🌲', 'Green', 'Tree'],
  ['🚙', 'Blue', 'Car'], ['🐳', 'Blue', 'Whale'], ['🧢', 'Blue', 'Cap'], ['🍊', 'Orange', 'Orange'], ['🥕', 'Orange', 'Carrot'], ['🎃', 'Orange', 'Pumpkin'], ['🍇', 'Purple', 'Grapes'], ['☂️', 'Purple', 'Umbrella'], ['🍆', 'Purple', 'Eggplant'],
  ['🌸', 'Pink', 'Flower'], ['🐷', 'Pink', 'Pig'], ['🧁', 'Pink', 'Cupcake'], ['🐻', 'Brown', 'Bear'], ['🌰', 'Brown', 'Nut'], ['🍫', 'Brown', 'Chocolate'], ['🐈‍⬛', 'Black', 'Black cat'], ['🎱', 'Black', 'Ball'], ['⛄', 'White', 'Snowman'], ['🥚', 'White', 'Egg'], ['☁️', 'White', 'Cloud']];

const wordsOnly = (pool) => pool.filter((c) => c.kind !== 'sentences' && c.kind !== 'letters' && c.en.length <= 12);
const letterWords = (pool, max = 8) => pool.filter((c) => /^[A-Za-z]{3,}$/.test(c.en) && c.en.length <= max && c.kind !== 'letters' && !c.image);
const options = (c, pool, n) => shuffle([c, ...sample(pool.filter((x) => x.id !== c.id && x.en !== c.en), Math.max(1, n - 1))]);
const lab = (c) => BODY(c);
const nextQ = (ctx, i, total, go) => setTimeout(() => (i + 1 < total ? go(i + 1) : ctx.finish()), 950);
const count = (ctx, i, total) => h('p', { class: 'k-count' }, `${i + 1} / ${total}`);

export const GAMES = {
  /* Word Catcher: clouds with words fall; tap the one that matches the picture */
  catcher(ctx) {
    const rounds = sample(wordsOnly(ctx.pool), ctx.young ? 5 : 7); let i = 0;
    const play = (k) => {
      const c = rounds[k], lanes = shuffle(options(c, wordsOnly(ctx.pool), ctx.choices)); let settled = false, missed = false;
      const field = h('div', { class: 'k-field' });
      const settle = (ok) => { if (settled) return; settled = true; ctx.record(ok && !missed, c.id); field.querySelectorAll('button').forEach((b) => { b.disabled = true; }); ctx.tell(ok ? 'kids.say_right' : 'kids.say_wrong'); nextQ(ctx, k, rounds.length, play); };
      lanes.forEach((o, n) => {
        const b = h('button', { class: 'k-fallword', type: 'button', 'data-correct': String(o.id === c.id), lang: 'en', style: { left: (4 + n * (92 / lanes.length)) + '%', animationDuration: (ctx.young ? 11 : 8.5) + 's', animationDelay: (n * 0.9) + 's' } }, h('span', {}, '☁️'), h('b', {}, lab(o)));
        b.onclick = () => { if (o.id === c.id) { b.classList.add('caught'); ctx.cheer(); say(c, 'words'); settle(true); } else { missed = true; b.classList.add('wrong'); ctx.shake(b); } };
        b.addEventListener('animationend', () => { if (o.id === c.id && !settled) settle(false); });
        field.append(b);
      });
      ctx.setStage(ctx.head('🧺', t('kids.game.catcher'), t('kids.catcher_hint')), h('div', { class: 'k-target' }, picture(c, 'big'), h('div', { class: 'k-tr' }, c.tr)), field, count(ctx, k, rounds.length));
    };
    play(0);
  },

  /* Picture Match: pairs of words and pictures */
  match(ctx) {
    const pool = sample(wordsOnly(ctx.pool), ctx.young ? 4 : 6); let left = pool.length, mistakes = 0, picked = null;
    const pics = shuffle(pool).map((c) => h('button', { class: 'k-tile pic', type: 'button', 'data-id': c.id, 'aria-label': c.tr }, picture(c)));
    const words = shuffle(pool).map((c) => h('button', { class: 'k-tile word', type: 'button', 'data-id': c.id, lang: 'en' }, lab(c)));
    const choose = (b, side) => {
      if (b.classList.contains('matched')) return;
      if (picked && picked.dataset.side === side) { picked.classList.remove('picked'); picked = null; }
      if (!picked) { picked = b; b.classList.add('picked'); if (side === 'word') sayText(b.textContent, true); return; }
      const a = picked; picked = null; a.classList.remove('picked');
      if (a.dataset.id === b.dataset.id) { [a, b].forEach((x) => { x.classList.add('matched'); x.disabled = true; }); const c = pool.find((x) => String(x.id) === a.dataset.id); say(c, 'words'); ctx.cheer(); ctx.record(true, c.id, true); if (--left === 0) setTimeout(() => ctx.finish({ extraMiss: mistakes }), 900); }
      else { mistakes++; ctx.shake(a); ctx.shake(b); }
    };
    pics.forEach((b) => { b.dataset.side = 'pic'; b.onclick = () => choose(b, 'pic'); }); words.forEach((b) => { b.dataset.side = 'word'; b.onclick = () => choose(b, 'word'); });
    ctx.setStage(ctx.head('🧩', t('kids.game.match'), t('kids.match_hint')), h('div', { class: 'k-match big' }, h('div', { class: 'k-col' }, pics), h('div', { class: 'k-col' }, words)));
  },

  /* Bubble Pop: pop the bubble with the right word */
  bubbles(ctx) {
    const rounds = sample(wordsOnly(ctx.pool), ctx.young ? 6 : 8);
    const ask = (k) => {
      const c = rounds[k]; let missed = false;
      const bubs = options(c, wordsOnly(ctx.pool), ctx.choices + 1).map((o, n) => { const b = h('button', { class: 'k-bubble-opt', type: 'button', 'data-correct': String(o.id === c.id), lang: 'en', style: { animationDelay: (n * 0.7) + 's', '--hue': (n * 67 + 180) % 360 } }, h('span', {}, lab(o)));
        b.onclick = () => { if (o.id === c.id) { b.classList.add('popped'); bubs.forEach((x) => { x.disabled = true; }); ctx.cheer(); say(c, 'words'); ctx.record(!missed, c.id); nextQ(ctx, k, rounds.length, ask); } else { missed = true; b.classList.add('wobble'); setTimeout(() => b.classList.remove('wobble'), 500); ctx.shake(b); } }; return b; });
      ctx.setStage(ctx.head('🫧', t('kids.game.bubbles'), t('kids.bubbles_hint')), h('div', { class: 'k-target' }, picture(c, 'big'), h('div', { class: 'k-tr' }, c.tr), h('button', { class: 'k-big-btn say small', type: 'button', onclick: () => say(c, 'words') }, '🔊')), h('div', { class: 'k-bubble-field' }, bubs), count(ctx, k, rounds.length));
      setTimeout(() => say(c, 'words'), 250);
    };
    ask(0);
  },

  /* Memory Cards: find the word and its picture */
  memory(ctx) {
    const pool = sample(wordsOnly(ctx.pool), ctx.young ? 4 : 6);
    const deck = shuffle(pool.flatMap((c) => [{ c, kind: 'word' }, { c, kind: 'pic' }]));
    let open = [], pairs = 0, fails = 0, lock = false;
    const cards = deck.map((d) => { const b = h('button', { class: 'k-mem', type: 'button', 'data-id': d.c.id, 'data-kind': d.kind, 'aria-label': t('kids.memory_card') }, h('span', { class: 'k-mem-front', 'aria-hidden': 'true' }, '❓'), h('span', { class: 'k-mem-back' }, d.kind === 'word' ? h('b', { lang: 'en' }, lab(d.c)) : picture(d.c)));
      b.onclick = () => {
        if (lock || b.classList.contains('open') || b.classList.contains('done')) return;
        b.classList.add('open'); open.push({ b, d }); if (d.kind === 'word') sayText(lab(d.c), true);
        if (open.length === 2) {
          lock = true; const [x, y] = open; open = [];
          if (x.d.c.id === y.d.c.id && x.d.kind !== y.d.kind) { setTimeout(() => { [x.b, y.b].forEach((e) => { e.classList.add('done'); }); lock = false; pairs++; ctx.cheer(); ctx.record(true, x.d.c.id, true); if (pairs === pool.length) setTimeout(() => ctx.finish({ extraMiss: Math.max(0, fails - Math.floor(pool.length / 2)) }), 800); }, 450); }
          else { fails++; setTimeout(() => { [x.b, y.b].forEach((e) => e.classList.remove('open')); lock = false; ctx.friend.react('think', 900); }, 900); }
        }
      }; return b; });
    ctx.setStage(ctx.head('🃏', t('kids.game.memory'), t('kids.memory_hint')), h('div', { class: 'k-mem-grid cols-' + (deck.length > 8 ? 4 : 4) }, cards));
  },

  /* Animal Sounds: listen, then choose the English name */
  sounds(ctx) {
    const animals = ctx.pool.filter((c) => c.cat === 'animals'), rounds = sample(animals, Math.min(ctx.young ? 5 : 7, animals.length)); let i = 0;
    const play = (c) => { const sound = c.sound || ANIMAL_SOUNDS[c.en.toLowerCase()] || c.en; if (c.audio) say(c, 'words'); else sayText(sound, true); };
    const ask = (k) => {
      const c = rounds[k]; let missed = false;
      const btns = options(c, animals, ctx.choices).map((o) => { const b = h('button', { class: 'k-answer', type: 'button', 'data-correct': String(o.id === c.id), lang: 'en' }, lab(o));
        b.onclick = () => { if (o.id === c.id) { b.classList.add('right'); btns.forEach((x) => { x.disabled = true; }); ctx.cheer(); ctx.record(!missed, c.id); h0.classList.add('reveal'); h0.replaceChildren(picture(c, 'big')); nextQ(ctx, k, rounds.length, ask); } else { missed = true; b.classList.add('wrong'); ctx.shake(b); } }; return b; });
      const h0 = h('div', { class: 'k-mystery' }, h('span', { class: 'k-mystery-q', 'aria-hidden': 'true' }, '❓'));
      ctx.setStage(ctx.head('🔊', t('kids.game.sounds'), t('kids.sounds_hint')), h('div', { class: 'k-target' }, h0, h('button', { class: 'k-big-btn say', type: 'button', id: 'k-play-sound', onclick: () => play(c) }, '🔊 ', t('kids.play_sound'))), h('div', { class: 'k-answers' }, btns), count(ctx, k, rounds.length));
      setTimeout(() => play(c), 350);
    };
    ask(0);
  },

  /* Color Hunt: find the objects of one colour */
  colorhunt(ctx) {
    const colors = sample([...new Set(OBJECTS.map((o) => o[1]))], ctx.young ? 4 : 6);
    const swatch = { Red: '#ef4444', Yellow: '#facc15', Green: '#22c55e', Blue: '#2f7bff', Orange: '#fb923c', Purple: '#a855f7', Pink: '#ff7ab8', Brown: '#8b5a2b', Black: '#1f2937', White: '#ffffff' };
    const hunt = (k) => {
      const color = colors[k], mine = sample(OBJECTS.filter((o) => o[1] === color), 3), other = sample(OBJECTS.filter((o) => o[1] !== color), ctx.young ? 6 : 9); let found = 0, missed = false;
      const all = shuffle([...mine, ...other]);
      const grid = h('div', { class: 'k-hunt' }, all.map((o) => { const b = h('button', { class: 'k-obj', type: 'button', 'data-match': String(o[1] === color), 'aria-label': o[2] }, o[0]);
        b.onclick = () => { sayText(o[2], true); if (o[1] === color) { if (b.classList.contains('found')) return; b.classList.add('found'); b.disabled = true; found++; ctx.cheer(); if (found === mine.length) { ctx.record(!missed, null); grid.querySelectorAll('button').forEach((x) => { x.disabled = true; }); nextQ(ctx, k, colors.length, hunt); } } else { missed = true; b.classList.add('wrong'); ctx.shake(b); setTimeout(() => b.classList.remove('wrong'), 600); } }; return b; }));
      ctx.setStage(ctx.head('🔍', t('kids.game.colorhunt'), t('kids.colorhunt_hint', { n: mine.length })), h('div', { class: 'k-hunt-target' }, h('span', { class: 'k-hunt-swatch', style: { background: swatch[color] } }), h('b', { lang: 'en' }, color), h('button', { class: 'k-big-btn say small', type: 'button', onclick: () => sayText(color, true) }, '🔊')), grid, count(ctx, k, colors.length));
      setTimeout(() => sayText(color, true), 300);
    };
    hunt(0);
  },

  /* Letter Builder: build the word under the picture */
  builder(ctx) {
    const rounds = sample(letterWords(ctx.pool, ctx.young ? 5 : 7), ctx.young ? 4 : 5);
    const build = (k) => {
      const c = rounds[k], target = [...c.en.toUpperCase()]; let pos = 0, missed = false;
      const slots = target.map(() => h('span', { class: 'k-slot', 'aria-hidden': 'true' }));
      const tiles = shuffle(target.map((x, n) => ({ x, n }))).map((o) => { const b = h('button', { class: 'k-letter-tile', type: 'button', lang: 'en' }, o.x);
        b.onclick = () => { if (b.disabled) return; if (o.x === target[pos]) { slots[pos].textContent = o.x; slots[pos].classList.add('filled'); b.disabled = true; b.classList.add('used'); pos++; if (pos === target.length) { ctx.cheer(); say(c, 'words'); ctx.record(!missed, c.id); nextQ(ctx, k, rounds.length, build); } } else { missed = true; ctx.shake(b); } }; return b; });
      const hint = h('button', { class: 'k-big-btn me small', type: 'button', onclick: () => { missed = true; const right = tiles.find((b) => !b.disabled && b.textContent === target[pos]); if (right) { right.classList.add('hint'); setTimeout(() => right.classList.remove('hint'), 1200); } } }, '💡 ', t('kids.hint'));
      ctx.setStage(ctx.head('🔤', t('kids.game.builder'), t('kids.builder_hint')), h('div', { class: 'k-spell-pic' }, picture(c, 'big'), h('div', { class: 'k-tr' }, c.tr), h('button', { class: 'k-big-btn say small', type: 'button', onclick: () => say(c, 'words') }, '🔊')),
        h('div', { class: 'k-slots', 'data-answer': target.join('') }, slots), h('div', { class: 'k-tiles' }, tiles), hint, count(ctx, k, rounds.length));
      setTimeout(() => say(c, 'words'), 250);
    };
    build(0);
  },

  /* Word Puzzle: complete the word */
  puzzle(ctx) {
    const rounds = sample(letterWords(ctx.pool, 8), ctx.young ? 6 : 8);
    const ask = (k) => {
      const c = rounds[k], word = c.en.toUpperCase(), idx = Math.floor(Math.random() * word.length), right = word[idx]; let missed = false;
      const shown = [...word].map((ch, n) => (n === idx ? '_' : ch)).join(' ');
      const pool = shuffle([...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].filter((x) => x !== right)).slice(0, ctx.choices - 1);
      const btns = shuffle([right, ...pool]).map((L) => { const b = h('button', { class: 'k-answer letter', type: 'button', 'data-correct': String(L === right), lang: 'en' }, L);
        b.onclick = () => { if (L === right) { b.classList.add('right'); btns.forEach((x) => { x.disabled = true; }); word2.textContent = [...word].join(' '); ctx.cheer(); say(c, 'words'); ctx.record(!missed, c.id); nextQ(ctx, k, rounds.length, ask); } else { missed = true; b.classList.add('wrong'); ctx.shake(b); } }; return b; });
      const word2 = h('div', { class: 'k-puzzle-word', lang: 'en', 'data-word': word }, shown);
      ctx.setStage(ctx.head('🧠', t('kids.game.puzzle'), t('kids.puzzle_hint')), h('div', { class: 'k-quiz-card' }, picture(c, 'big'), h('div', { class: 'k-tr' }, c.tr), word2), h('div', { class: 'k-answers four' }, btns), count(ctx, k, rounds.length));
      setTimeout(() => say(c, 'words'), 250);
    };
    ask(0);
  },
};
