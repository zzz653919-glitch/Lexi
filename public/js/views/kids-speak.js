/* LEXIO KIDS speaking and listening: repeat words, greetings, animal names, sentences; match a spoken word with its picture.
   Speech recognition is optional and OFF until a parent allows it; a wrong or missing answer is never punished. */
import { h, toast } from '../ui.js';
import { get, post } from '../api.js';
import { t } from '../i18n.js';
import { initKids, profile, shuffle, sample, picture, say, sayText, confetti, celebrate, leaveKids, flushListens, labelOf, choices } from '../kids/common.js';
import { companion } from '../kids/characters.js';
import { kidsPage, kidsView } from '../kids/shell.js';

const MODES = [['words', '🗣️', '#35a7ff'], ['greetings', '👋', '#ffbe0b'], ['animals', '🦁', '#fb8500'], ['sentences', '💬', '#3a86ff'], ['listen', '👂', '#2ec27e']];
const norm = (s) => String(s).toLowerCase().replace(/[^a-z ]/g, '').trim();
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
/* a close match counts: children are not expected to sound perfect */
export const closeEnough = (heard, want) => { const a = norm(heard), b = norm(want); return !!a && (a.includes(b) || b.includes(a) || lev(a, b) <= Math.max(1, Math.floor(b.length / 4))); };
const Recognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

export default async function kidsSpeak() {
  await initKids();
  const [{ cards }, ov] = await Promise.all([get('/kids/cards'), get('/kids/overview')]);
  const micAllowed = !!(profile().mic && Recognition);
  const started = Date.now();
  const body = h('div', {});
  const friend = companion({ character: profile().character, accessory: profile().accessory, size: 90, bubble: true, label: t('kids.my_friend') });
  const page = kidsPage('games', h('h1', { class: 'k-h2' }, t('kids.speak_title')), h('div', { class: 'k-friend-row' }, friend.el), body);
  page.setStars(ov.stars);
  const poolFor = (mode) => (mode === 'greetings' ? cards.filter((c) => c.cat === 'everyday') : mode === 'animals' ? cards.filter((c) => c.cat === 'animals') : mode === 'sentences' ? cards.filter((c) => c.kind === 'sentences') : cards.filter((c) => c.kind !== 'sentences' && c.kind !== 'letters' && c.en.length <= 12));

  function menu() {
    friend.say(t('kids.speak_hi'));
    body.replaceChildren(h('p', { class: 'k-lead' }, t('kids.speak_intro')), h('p', { class: 'k-note', id: 'k-mic-note' }, micAllowed ? '🎤 ' + t('kids.mic_on') : '🔈 ' + t('kids.mic_off')),
      h('div', { class: 'k-tiles' }, MODES.map(([m, emoji, color]) => h('button', { class: 'k-tile-link', type: 'button', style: { '--c': color }, 'data-mode': m, onclick: () => run(m) }, h('span', { 'aria-hidden': 'true' }, emoji), h('b', {}, t('kids.speak.' + m))))));
  }
  const ids = new Set();
  function run(mode) {
    const items = sample(poolFor(mode), 5); let i = 0, practised = 0;
    const finish = async () => {
      let r = { newRewards: [] };
      try { r = await post('/kids/event', { kind: 'speak', wordIds: [...ids], seconds: Math.round((Date.now() - started) / 1000) }); } catch (e) { toast(e.message, 'error', 4000); }
      flushListens(); confetti(page.el); friend.react('cheer', 4000); friend.say(t('kids.say_done'));
      body.replaceChildren(h('div', { class: 'k-result', id: 'k-speak-done' }, h('h1', {}, t('kids.done_title')), h('p', { class: 'k-score' }, t('kids.speak_done', { n: practised })),
        h('div', { class: 'k-actions' }, h('button', { class: 'k-big-btn go', type: 'button', id: 'k-speak-again', onclick: menu }, '🔁 ', t('kids.play_again')), h('a', { class: 'k-big-btn me', href: '/kids/games' }, '🎮 ', t('kids.nav.games')))));
      if (r.newRewards && r.newRewards.length) setTimeout(() => celebrate(r.newRewards, page.el), 800);
    };
    const next = () => (++i < items.length ? show() : finish());
    function show() {
      const c = items[i], want = labelOf(c, 'words');
      if (mode === 'listen') return listenQ(c);
      let done = false;
      const fb = h('p', { class: 'k-feedback', id: 'k-feedback', role: 'status' });
      const nextBtn = h('button', { class: 'k-big-btn go', type: 'button', id: 'k-speak-next', disabled: true, onclick: next }, i + 1 < items.length ? t('kids.next') : t('kids.done'), ' ▶');
      const ok = (msg, mood) => { if (!done) { practised++; ids.add(c.id); } done = true; fb.textContent = msg; friend.react(mood, 1500); nextBtn.disabled = false; };
      const mic = h('button', { class: 'k-big-btn me', type: 'button', id: 'k-say-it', onclick: () => {
        if (!micAllowed) { ok(t('kids.great'), 'cheer'); return; }                         // no recognition: "I said it" is enough
        mic.disabled = true; fb.textContent = '🎤 ' + t('kids.listening');
        let rec; try { rec = new Recognition(); } catch (_) { mic.disabled = false; ok(t('kids.great'), 'cheer'); return; }
        rec.lang = 'en-US'; rec.maxAlternatives = 3; rec.interimResults = false;
        rec.onresult = (e) => { const heard = [...e.results[0]].map((a) => a.transcript).join(' | '); mic.disabled = false; closeEnough(heard, want) || [...e.results[0]].some((a) => closeEnough(a.transcript, want)) ? ok(t('kids.speak_great'), 'cheer') : ok(t('kids.speak_try'), 'think'); };
        rec.onerror = () => { mic.disabled = false; ok(t('kids.speak_skip'), 'happy'); };
        rec.onnomatch = () => { mic.disabled = false; ok(t('kids.speak_try'), 'think'); };
        rec.onend = () => { mic.disabled = false; };
        try { rec.start(); } catch (_) { mic.disabled = false; ok(t('kids.great'), 'cheer'); }
      } }, '🎤 ', micAllowed ? t('kids.say_it') : t('kids.said_it'));
      friend.say(t('kids.speak_repeat'));
      body.replaceChildren(h('div', { class: 'k-step-head' }, h('span', { class: 'k-step-icon', 'aria-hidden': 'true' }, '🗣️'), h('div', {}, h('h2', {}, t('kids.speak.' + mode)), h('p', {}, t('kids.speak_repeat')))),
        h('div', { class: 'k-flash', 'data-word': c.en }, picture(c, 'huge'), h('div', { class: 'k-word', lang: 'en' }, want)),
        h('div', { class: 'k-actions' }, h('button', { class: 'k-big-btn say', type: 'button', id: 'k-hear', onclick: () => say(c, 'words') }, '🔊 ', t('kids.listen')), mic, nextBtn), fb, h('p', { class: 'k-count' }, `${i + 1} / ${items.length}`));
      setTimeout(() => say(c, 'words'), 250);
    }
    function listenQ(c) {
      const opts = shuffle([c, ...sample(poolFor('words').filter((x) => x.id !== c.id), choices() - 1)]);
      friend.say(t('kids.speak_match'));
      const btns = opts.map((o) => h('button', { class: 'k-option', type: 'button', 'data-correct': String(o.id === c.id), 'aria-label': o.en, onclick: (e) => {
        const b = e.currentTarget;
        if (o.id === c.id) { b.classList.add('right'); btns.forEach((x) => { x.disabled = true; }); friend.react('cheer', 1200); practised++; ids.add(c.id); setTimeout(next, 900); }
        else { b.classList.add('soft'); friend.react('think', 1200); friend.say(t('kids.speak_try')); setTimeout(() => say(c, 'words'), 400); }       // a gentle hint, no penalty
      } }, picture(o)));
      body.replaceChildren(h('div', { class: 'k-step-head' }, h('span', { class: 'k-step-icon', 'aria-hidden': 'true' }, '👂'), h('div', {}, h('h2', {}, t('kids.speak.listen')), h('p', {}, t('kids.pick_hint')))),
        h('div', { class: 'k-ask' }, h('button', { class: 'k-big-btn say', type: 'button', id: 'k-hear', onclick: () => say(c, 'words') }, '🔊 ', t('kids.listen'))), h('div', { class: 'k-options' }, btns), h('p', { class: 'k-count' }, `${i + 1} / ${items.length}`));
      setTimeout(() => say(c, 'words'), 250);
    }
    show();
  }
  menu();
  return kidsView(page.el, t('kids.speak_title'), { cleanup: () => { leaveKids(); } });
}
