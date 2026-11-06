/* LEXIO KIDS rules shared by the learner and administrator routes: lesson parts, stars and badges. */
const MAX_PART = 10;            // a lesson part has at most this many picture cards
const MAX_QUESTIONS = 60;

/* a category with n cards is split into equal-sized parts of at most 10 cards (26 letters → 3 parts of 9, 9, 8) */
function split(n) { const parts = Math.max(1, Math.ceil(n / MAX_PART)); return { parts, size: Math.max(1, Math.ceil(n / parts)) }; }
const starsFor = (pct) => (pct >= 90 ? 3 : pct >= 60 ? 2 : 1);   // finishing a lesson always earns at least one star

const BADGES = [
  { code: 'first_lesson', emoji: '🌟', test: (c) => c.lessonsDone >= 1 },
  { code: 'three_stars', emoji: '🥇', test: (c) => c.threeStar >= 1 },
  { code: 'five_lessons', emoji: '🚀', test: (c) => c.lessonsDone >= 5 },
  { code: 'stars_25', emoji: '💫', test: (c) => c.stars >= 25 },
  { code: 'stars_60', emoji: '👑', test: (c) => c.stars >= 60 },
  { code: 'alphabet', emoji: '🔤', test: (c) => c.done.alphabet },
  { code: 'animals', emoji: '🦁', test: (c) => c.done.animals },
  { code: 'colors', emoji: '🌈', test: (c) => c.done.colors },
  { code: 'numbers', emoji: '🔢', test: (c) => c.done.numbers },
  { code: 'streak3', emoji: '🔥', test: (c) => c.streak >= 3 },
  { code: 'all_rounder', emoji: '🏆', test: (c) => c.allDone },
];

/* pick the right language of a text; falls back to English / Uzbek */
const pickTitle = (c, lang) => (lang === 'uz' && c.title_uz) || (lang === 'ru' && c.title_ru) || c.title_en;
const pickWord = (w, lang) => (lang === 'ru' && w.ru) || w.uz || w.ru || '';

module.exports = { MAX_PART, MAX_QUESTIONS, split, starsFor, BADGES, pickTitle, pickWord };
