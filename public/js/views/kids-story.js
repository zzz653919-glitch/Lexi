/* LEXIO KIDS storybook reader: illustrated pages, English text with Uzbek translation, narration with highlighted words, questions at the end. */
import { h, toast } from '../ui.js';
import { get, post } from '../api.js';
import { t } from '../i18n.js';
import { initKids, profile, soundOn, sayText, confetti, celebrate, leaveKids, flushListens, shuffle } from '../kids/common.js';
import { speak, canSpeak } from '../ui.js';
import { companion } from '../kids/characters.js';

const sceneEl = (scene) => h('div', { class: 'k-scene bg-' + scene[0], role: 'img', 'aria-hidden': 'true' }, h('div', { class: 'k-ground' }), scene[1].map(([emoji, x, y, size, motion]) => h('span', { class: 'k-prop' + (motion ? ' m-' + motion : ''), style: { left: x + '%', top: y + '%', fontSize: size + 'rem' } }, emoji)));

export default async function kidsStory({ params }) {
  await initKids();
  const story = await get('/kids/stories/' + encodeURIComponent(params.slug));
  const started = Date.now(), young = profile().age === 'young';
  const friend = companion({ character: profile().character, accessory: profile().accessory, size: 78, bubble: true, label: t('kids.my_friend') });
  const stage = h('main', { class: 'k-stage k-story-stage', id: 'k-main', tabindex: '-1', 'aria-live': 'polite' });
  const root = h('div', { class: 'kids kids-lesson kids-story', style: { '--c': story.color }, 'data-story': story.slug });
  let page = 0, timers = [], correct = 0;
  const stopNarration = () => { timers.forEach(clearTimeout); timers = []; if (canSpeak()) window.speechSynthesis.cancel(); stage.querySelectorAll('.k-w.hl').forEach((w) => w.classList.remove('hl')); };
  const setStage = (...nodes) => { stage.replaceChildren(...nodes); stage.classList.remove('k-in'); void stage.offsetWidth; stage.classList.add('k-in'); window.scrollTo(0, 0); };

  /* read the sentence aloud while its words light up one by one */
  function narrate(words, text) {
    stopNarration();
    if (soundOn() && canSpeak()) speak({ text }, young);
    let at = 200;
    words.forEach((w) => { timers.push(setTimeout(() => { words.forEach((x) => x.classList.remove('hl')); w.classList.add('hl'); }, at)); at += (young ? 620 : 430) + w.textContent.length * (young ? 55 : 38); });
    timers.push(setTimeout(() => words.forEach((x) => x.classList.remove('hl')), at + 200));
  }
  function show() {
    const p = story.pages[page], last = page === story.pages.length - 1;
    const words = p.en.split(/\s+/).map((w) => h('button', { class: 'k-w', type: 'button', lang: 'en', onclick: () => { stopNarration(); sayText(w.replace(/[^\w'-]/g, ''), true); } }, w));
    const text = h('p', { class: 'k-story-text', 'data-page': String(page + 1) }, words.flatMap((w) => [w, ' ']));
    const say = () => narrate(words, p.en);
    friend.say(page === 0 ? t('kids.story_start', { title: story.title }) : '');
    setStage(sceneEl(p.scene), h('div', { class: 'k-story-card' }, text, h('p', { class: 'k-story-tr', lang: 'uz' }, p.tr)),
      h('div', { class: 'k-actions' },
        h('button', { class: 'k-big-btn me', type: 'button', id: 'k-prev', disabled: page === 0, 'aria-label': t('kids.prev'), onclick: () => { stopNarration(); page--; show(); } }, '◀'),
        h('button', { class: 'k-big-btn say', type: 'button', id: 'k-read', onclick: say }, '🔊 ', t('kids.read_to_me')),
        h('button', { class: 'k-big-btn go', type: 'button', id: 'k-next-page', onclick: () => { stopNarration(); if (last) questions(); else { page++; show(); } } }, last ? t('kids.questions') : t('kids.next'), ' ▶')),
      h('p', { class: 'k-count' }, `${page + 1} / ${story.pages.length}`));
    if (profile().narration !== false) setTimeout(say, 450);
  }
  function questions() {
    let q = 0;
    const ask = () => {
      const it = story.questions[q]; let missed = false;
      friend.say(t('kids.story_q'));
      const btns = it.options.map((o) => { const b = h('button', { class: 'k-answer', type: 'button', lang: 'en', 'data-correct': String(o === it.answer) }, o);
        b.onclick = () => { if (o === it.answer) { b.classList.add('right'); btns.forEach((x) => { x.disabled = true; }); friend.react('cheer'); if (!missed) correct++; setTimeout(() => (++q < story.questions.length ? ask() : finish()), 900); } else { missed = true; b.classList.add('wrong'); friend.react('oops'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); } }; return b; });
      setStage(h('div', { class: 'k-step-head' }, h('span', { class: 'k-step-icon', 'aria-hidden': 'true' }, '❓'), h('div', {}, h('h1', {}, t('kids.questions')), h('p', {}, t('kids.story_q')))),
        h('div', { class: 'k-quiz-card' }, h('span', { class: 'kpic kpic-emoji big', 'aria-hidden': 'true' }, story.emoji), h('h2', { class: 'k-prompt', lang: 'en' }, it.prompt), h('p', { class: 'k-tr', lang: 'uz' }, it.tr)),
        h('div', { class: 'k-answers' }, btns), h('p', { class: 'k-count' }, `${q + 1} / ${story.questions.length}`));
    };
    ask();
  }
  async function finish() {
    setStage(h('div', { class: 'k-result' }, h('p', {}, t('kids.saving'))));
    let r;
    try { r = await post(`/kids/stories/${story.slug}/complete`, { correct, total: story.questions.length, seconds: Math.round((Date.now() - started) / 1000) }); }
    catch (e) { toast(e.message || t('app.error_text'), 'error', 5000); r = { stars: 1, gained: 0, newRewards: [] }; }
    confetti(root); friend.react('cheer', 4000); friend.say(t('kids.say_done')); flushListens();
    setStage(h('div', { class: 'k-result', 'data-stars': String(r.stars), 'data-story': story.slug }, h('h1', {}, t('kids.story_end')),
      h('div', { class: 'k-big-stars' }, [1, 2, 3].map((i) => h('span', { class: 'k-bigstar' + (i <= r.stars ? ' on' : ''), style: { animationDelay: (i * 0.25) + 's' } }, '⭐'))),
      h('p', { class: 'k-score' }, t('kids.done_text', { correct, total: story.questions.length })), r.gained ? h('p', { class: 'k-gain' }, t('kids.new_stars', { n: r.gained })) : null,
      h('div', { class: 'k-actions' }, h('a', { class: 'k-big-btn go', id: 'k-again', href: '/kids/stories/' + story.slug }, '🔁 ', t('kids.read_again')), h('a', { class: 'k-big-btn me', id: 'k-shelf', href: '/kids/stories' }, '📖 ', t('kids.nav.stories')))));
    if (r.newRewards && r.newRewards.length) setTimeout(() => celebrate(r.newRewards, root), 900);
  }
  root.append(h('div', { class: 'k-sky', 'aria-hidden': 'true' }, h('span', { class: 'k-cloud c1' }, '☁️')),
    h('header', { class: 'k-top k-lesson-top' }, h('a', { class: 'k-back', href: '/kids/stories', 'aria-label': t('kids.nav.stories') }, '📖'), h('div', { class: 'k-lesson-title' }, h('span', { 'aria-hidden': 'true' }, story.emoji), ' ', h('b', { lang: 'en' }, story.title), h('small', { lang: 'uz' }, ' · ' + story.titleTr)), h('span', { class: 'k-gear-spacer' })),
    h('div', { class: 'k-friend-row' }, friend.el), stage);
  show();
  return { el: root, title: story.title + ' · ' + t('kids.brand'), nav: '', bare: true, cleanup: () => { stopNarration(); leaveKids(); } };
}
