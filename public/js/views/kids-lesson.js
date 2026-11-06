/* LEXIO KIDS game: look & listen → match → tap the picture → spell → quiz → stars. Every step is a button game for small hands. */
import { h, toast } from '../ui.js';
import { get, post } from '../api.js';
import { navigate } from '../app.js';
import { t } from '../i18n.js';
import { initKids, profile, choices, shuffle, sample, labelOf, badgeOf, picture, say, sayText, confetti, celebrate, leaveKids, flushListens, soundOn, setSound } from '../kids/common.js';
import { companion } from '../kids/characters.js';
import { kidsPage, kidsView, breakCard } from '../kids/shell.js';

export default async function kidsLesson({ params, query }) {
  await initKids();
  if (profile().limitReached) { const pg = kidsPage('lessons', breakCard()); return kidsView(pg.el, t('kids.nav.lessons')); }
  const started = Date.now();
  const data = await get('/kids/categories/' + encodeURIComponent(params.slug));
  const { category: cat, cards: all, questions } = data;
  const part = Math.min(cat.parts, Math.max(1, Number(query.get('part')) || 1));
  const cards = all.filter((c) => c.part === part);
  const kind = cat.kind;
  const lab = (c) => labelOf(c, kind);
  const canPlay = all.length >= 2 && cards.length >= 1;

  let score = 0, total = 0;
  const root = h('div', { class: 'kids kids-lesson', style: { '--c': cat.color } });
  const stage = h('main', { class: 'k-stage', id: 'k-main', tabindex: '-1', 'aria-live': 'polite' });
  const dots = h('div', { class: 'k-dots', 'aria-hidden': 'true' });
  const friend = companion({ character: profile().character, accessory: profile().accessory, size: 92, bubble: true, label: t('kids.my_friend') });
  const tell = (key, params) => friend.say(t(key + '.' + (1 + Math.floor(Math.random() * 2)), params));
  const soundBtn = h('button', { class: 'k-gear', type: 'button', 'aria-pressed': String(soundOn()), 'aria-label': t('kids.sound'), title: t('kids.sound'), onclick: () => { const on = !soundOn(); setSound(on); soundBtn.textContent = on ? '🔊' : '🔇'; soundBtn.setAttribute('aria-pressed', String(on)); } }, soundOn() ? '🔊' : '🔇');
  root.append(h('div', { class: 'k-sky', 'aria-hidden': 'true' }, h('span', { class: 'k-cloud c1' }, '☁️'), h('span', { class: 'k-cloud c2' }, '☁️')),
    h('header', { class: 'k-top k-lesson-top' }, h('a', { class: 'k-back', href: '/kids/lessons', 'aria-label': t('kids.nav.lessons') }, '📚'), h('div', { class: 'k-lesson-title' }, h('span', { 'aria-hidden': 'true' }, cat.emoji), ' ', h('b', {}, cat.title), cat.parts > 1 ? h('small', {}, ' · ' + t('kids.part', { n: part })) : null), soundBtn), h('div', { class: 'k-friend-row' }, friend.el), dots, stage);

  const steps = [];
  const setStage = (...nodes) => { stage.replaceChildren(...nodes); stage.classList.remove('k-in'); void stage.offsetWidth; stage.classList.add('k-in'); };
  const mark = (i) => { dots.replaceChildren(...steps.map((s, j) => h('span', { class: 'k-dot' + (j < i ? ' done' : j === i ? ' now' : ''), title: s.name }))); };
  let at = -1;
  const advance = () => { at++; if (at >= steps.length) return finish(); mark(at); steps[at].run(); window.scrollTo(0, 0); };
  const heading = (icon, text, sub) => h('div', { class: 'k-step-head' }, h('span', { class: 'k-step-icon', 'aria-hidden': 'true' }, icon), h('div', {}, h('h1', {}, text), sub ? h('p', {}, sub) : null));
  const cheer = () => { friend.react('cheer'); tell('kids.say_right'); const b = h('div', { class: 'k-cheer', 'aria-hidden': 'true' }, ['🎉', '⭐', '👏', '🌟'][Math.floor(Math.random() * 4)]); root.append(b); setTimeout(() => b.remove(), 900); };
  const wrongShake = (el) => { friend.react('oops'); tell('kids.say_wrong'); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };
  const countQ = (first) => { total++; if (first) score++; };

  /* ---- 1. look, listen, repeat ---- */
  steps.push({ name: t('kids.learn_title'), run() {
    friend.say(t('kids.say_start', { title: cat.title }));
    let i = 0, said = false;
    const show = () => {
      const c = cards[i]; said = false;
      const badge = badgeOf(c, kind);
      const heard = h('button', { class: 'k-big-btn say', type: 'button', onclick: () => say(c, kind) }, '🔊 ', t('kids.listen'));
      const mine = h('button', { class: 'k-big-btn me', type: 'button', onclick: () => { said = true; mine.classList.add('ok'); mine.textContent = '✅ ' + t('kids.great'); cheer(); nextBtn.disabled = false; } }, '🎤 ', t('kids.said_it'));
      const nextBtn = h('button', { class: 'k-big-btn go', type: 'button', disabled: true, onclick: () => { if (++i < cards.length) show(); else advance(); } }, i + 1 < cards.length ? t('kids.next') : t('kids.lets_play'), ' ▶');
      setStage(heading('👀', t('kids.learn_title'), t('kids.repeat')),
        h('div', { class: 'k-flash', 'data-word': c.en }, badge ? h('div', { class: 'k-letter', lang: 'en' }, kind === 'letters' ? badge + badge.toLowerCase() : badge) : null, picture(c, 'huge'),
          h('div', { class: 'k-word', lang: 'en' }, lab(c)), h('div', { class: 'k-tr' }, c.tr)),
        h('div', { class: 'k-actions' }, heard, mine, nextBtn), h('p', { class: 'k-count' }, `${i + 1} / ${cards.length}`));
      setTimeout(() => say(c, kind), 250);
    };
    show();
  } });

  /* ---- 2. match pictures with words ---- */
  if (canPlay) steps.push({ name: t('kids.match_title'), run() {
    friend.say(t('kids.say_match'));
    const pool = sample(cards, Math.min(4, cards.length)), missed = new Set();
    let picked = null, left = pool.length;
    const pics = shuffle(pool).map((c) => h('button', { class: 'k-tile pic', type: 'button', 'data-id': c.id, 'aria-label': c.tr || c.en }, picture(c)));
    const words = shuffle(pool).map((c) => h('button', { class: 'k-tile word', type: 'button', 'data-id': c.id, lang: 'en' }, lab(c)));
    const clearPick = () => { picked && picked.classList.remove('picked'); picked = null; };
    const choose = (btn, side) => {
      if (btn.classList.contains('matched')) return;
      if (picked && picked.dataset.side === side) { clearPick(); }
      if (!picked) { picked = btn; btn.dataset.side = side; btn.classList.add('picked'); if (side === 'word') sayText(btn.textContent, true); return; }
      const a = picked, id = a.dataset.id; btn.dataset.side = side;
      if (id === btn.dataset.id) {
        [a, btn].forEach((x) => { x.classList.remove('picked'); x.classList.add('matched'); x.disabled = true; }); picked = null;
        const c = pool.find((x) => String(x.id) === id); say(c, kind); cheer();
        countQ(!missed.has(id));
        if (--left === 0) setTimeout(advance, 900);
      } else { missed.add(a.dataset.id); missed.add(btn.dataset.id); [a, btn].forEach((x) => { wrongShake(x); x.classList.remove('picked'); }); picked = null; }
    };
    pics.forEach((b) => { b.dataset.side = 'pic'; b.onclick = () => choose(b, 'pic'); });
    words.forEach((b) => { b.dataset.side = 'word'; b.onclick = () => choose(b, 'word'); });
    setStage(heading('🧩', t('kids.match_title'), t('kids.match_hint')), h('div', { class: 'k-match' }, h('div', { class: 'k-col' }, pics), h('div', { class: 'k-col' }, words)));
  } });

  /* ---- 3. hear the word, tap the right picture ---- */
  if (canPlay) steps.push({ name: t('kids.pick_title'), run() {
    friend.say(t('kids.say_pick'));
    const qs = sample(cards, Math.min(5, cards.length)); let q = 0;
    const ask = () => {
      const c = qs[q]; let missed = false;
      const opts = shuffle([c, ...sample(all.filter((x) => x.id !== c.id), Math.min(choices() - 1, all.length - 1))]);
      const hear = h('button', { class: 'k-big-btn say', type: 'button', onclick: () => say(c, kind) }, '🔊 ', t('kids.listen'));
      const buttons = opts.map((o) => { const b = h('button', { class: 'k-option', type: 'button', 'data-correct': String(o.id === c.id), 'aria-label': o.tr || o.en }, picture(o)); b.onclick = () => {
        if (o.id === c.id) { b.classList.add('right'); buttons.forEach((x) => { x.disabled = true; }); cheer(); countQ(!missed); setTimeout(() => (++q < qs.length ? ask() : advance()), 900); }
        else { missed = true; wrongShake(b); b.classList.add('wrong'); }
      }; return b; });
      setStage(heading('👂', t('kids.pick_title'), t('kids.pick_hint')), h('div', { class: 'k-ask' }, hear), h('div', { class: 'k-options' }, buttons), h('p', { class: 'k-count' }, `${q + 1} / ${qs.length}`));
      setTimeout(() => say(c, kind), 250);
    };
    ask();
  } });

  /* ---- 4. spelling (letters) / word order (phrases and sentences) ---- */
  const spellable = cards.filter((c) => { const w = lab(c).replace(/[.!?]$/, ''); return !/\s/.test(w) ? /^[A-Za-z]{2,8}$/.test(w) : w.split(/\s+/).length <= 7; });
  if (spellable.length) steps.push({ name: t('kids.spell_title'), run() {
    friend.say(t('kids.say_spell'));
    const qs = sample(spellable, Math.min(3, spellable.length)); let q = 0;
    const ask = () => {
      const c = qs[q], text = lab(c).replace(/[.!?]$/, ''), order = /\s/.test(text);
      const target = order ? text.split(/\s+/) : [...text.toUpperCase()];
      const norm = (x) => (order ? x : x);
      let pos = 0, missed = false;
      const slots = target.map(() => h('span', { class: 'k-slot' + (order ? ' wide' : ''), 'aria-hidden': 'true' }));
      const tiles = shuffle(target.map((x, i) => ({ x, i }))).map((o) => {
        const b = h('button', { class: 'k-letter-tile' + (order ? ' word' : ''), type: 'button', lang: 'en' }, o.x);
        b.onclick = () => {
          if (b.disabled) return;
          if (norm(o.x) === norm(target[pos])) { slots[pos].textContent = o.x; slots[pos].classList.add('filled'); b.disabled = true; b.classList.add('used'); pos++;
            if (pos === target.length) { cheer(); say(c, kind); countQ(!missed); tiles.forEach((x) => { x.disabled = true; }); setTimeout(() => (++q < qs.length ? ask() : advance()), 1100); } }
          else { missed = true; wrongShake(b); }
        };
        return b;
      });
      setStage(heading(order ? '🔀' : '🔤', order ? t('kids.order_title') : t('kids.spell_title'), t('kids.spell_hint')),
        h('div', { class: 'k-spell-pic' }, picture(c, 'big'), h('div', { class: 'k-tr' }, c.tr), h('button', { class: 'k-big-btn say small', type: 'button', onclick: () => say(c, kind) }, '🔊')),
        h('div', { class: 'k-slots', 'data-answer': target.join(order ? ' ' : '') }, slots), h('div', { class: 'k-tiles' }, tiles), h('p', { class: 'k-count' }, `${q + 1} / ${qs.length}`));
      setTimeout(() => say(c, kind), 250);
    };
    ask();
  } });

  /* ---- 5. quiz ---- */
  if (canPlay) steps.push({ name: t('kids.quiz_title'), run() {
    friend.say(t('kids.say_quiz'));
    const list = [];
    const base = shuffle(cards);
    for (let i = 0; i < Math.min(5, cards.length); i++) {
      const c = base[i % base.length], others = sample(all.filter((x) => x.id !== c.id), choices() - 1);
      const form = kind === 'letters' ? (i % 2 ? 'letter' : 'what') : i % 2 ? 'tr' : 'what';
      if (form === 'letter') list.push({ prompt: t('kids.quiz_letter'), card: c, options: shuffle([c, ...others]).map((o) => ({ label: o.en, ok: o.id === c.id })), say: c });
      else if (form === 'tr') list.push({ prompt: t('kids.quiz_tr', { word: c.tr }), text: c.tr, options: shuffle([c, ...others]).map((o) => ({ label: lab(o), ok: o.id === c.id })), say: null, card: null });
      else list.push({ prompt: t('kids.quiz_what'), card: c, options: shuffle([c, ...others]).map((o) => ({ label: lab(o), ok: o.id === c.id })), say: c });
    }
    for (const x of sample(questions, 2)) list.push({ prompt: x.prompt, custom: x, options: shuffle([x.correct, ...x.wrong]).map((o) => ({ label: o, ok: o === x.correct })) });
    let q = 0;
    const ask = () => {
      const it = list[q]; let missed = false;
      const media = it.card ? picture(it.card, 'big') : it.custom ? picture({ pic: it.custom.pic, image: it.custom.image }, 'big') : null;
      const buttons = it.options.map((o) => { const b = h('button', { class: 'k-answer', type: 'button', lang: 'en', 'data-correct': String(o.ok) }, o.label); b.onclick = () => {
        if (o.ok) { b.classList.add('right'); buttons.forEach((x) => { x.disabled = true; }); cheer(); countQ(!missed); if (it.say) say(it.say, kind); else if (it.custom && it.custom.audio) say({ audio: it.custom.audio, en: '' }, kind); setTimeout(() => (++q < list.length ? ask() : advance()), 1000); }
        else { missed = true; wrongShake(b); b.classList.add('wrong'); }
      }; return b; });
      setStage(heading('🎯', t('kids.quiz_title')), h('div', { class: 'k-quiz-card' }, media, h('h2', { class: 'k-prompt' }, it.prompt)), h('div', { class: 'k-answers' }, buttons), h('p', { class: 'k-count' }, `${q + 1} / ${list.length}`));
      if (it.say) setTimeout(() => say(it.say, kind), 250);
    };
    if (list.length) ask(); else advance();
  } });

  /* ---- result ---- */
  async function finish() {
    mark(steps.length);
    if (!total) { total = 1; score = 1; }
    setStage(h('div', { class: 'k-result' }, h('p', {}, t('kids.saving'))));
    let r;
    try { r = await post(`/kids/categories/${encodeURIComponent(cat.slug)}/complete`, { part, correct: score, total, seconds: Math.round((Date.now() - started) / 1000) }); }
    catch (e) { toast(e.message || t('app.error_text'), 'error', 5000); r = { stars: score / total >= .9 ? 3 : score / total >= .6 ? 2 : 1, gained: 0, totalStars: null, newBadges: [], newRewards: [] }; }
    confetti(root); friend.react('cheer', 4000); friend.say(t('kids.say_done')); flushListens();
    const nextPart = part < cat.parts ? part + 1 : 0;
    setStage(h('div', { class: 'k-result', 'data-stars': String(r.stars) },
      h('h1', {}, t('kids.done_title')),
      h('div', { class: 'k-big-stars', 'aria-label': t('kids.stars_of', { n: r.stars, max: 3 }) }, [1, 2, 3].map((i) => h('span', { class: 'k-bigstar' + (i <= r.stars ? ' on' : ''), style: { animationDelay: (i * 0.25) + 's' } }, '⭐'))),
      h('p', { class: 'k-score' }, t('kids.done_text', { correct: score, total })),
      r.gained ? h('p', { class: 'k-gain' }, t('kids.new_stars', { n: r.gained })) : null,
      (r.newBadges || []).map((b) => h('div', { class: 'k-newbadge', 'data-code': b.code }, h('span', { 'aria-hidden': 'true' }, b.emoji), h('div', {}, h('small', {}, t('kids.new_badge')), h('b', {}, t('kids.badge.' + b.code))))),
      h('div', { class: 'k-actions' },
        nextPart ? h('a', { class: 'k-big-btn go', id: 'k-next-part', href: `/kids/learn/${cat.slug}?part=${nextPart}` }, t('kids.next_part'), ' ▶') : null,
        h('a', { class: 'k-big-btn say', id: 'k-again', href: `/kids/learn/${cat.slug}?part=${part}` }, '🔁 ', t('kids.play_again')),
        h('a', { class: 'k-big-btn me', id: 'k-home', href: '/kids' }, '🏠 ', t('kids.back_home')))));
    if (r.newRewards && r.newRewards.length) setTimeout(() => celebrate(r.newRewards, root), 900);
  }

  if (!cards.length) setStage(h('div', { class: 'k-result' }, h('p', {}, t('kids.empty')), h('a', { class: 'k-big-btn go', href: '/kids' }, t('kids.back_home'))));
  else advance();
  return { el: root, title: cat.title + ' · ' + t('kids.brand'), nav: '', bare: true, cleanup: leaveKids };
}
