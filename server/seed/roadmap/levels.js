/* Builds the content of every level from its spec file (a1.js, a2.js …): converts the Uzbek texts to the new alphabet, adds the topic
   examination items and the level's own examination. */
const { convertText } = require('../../lib/uz-convert');
const { toNewUz: uzConv, wordsIn } = require('./uzfix');
const { LEVELS: CURRICULUM } = require('./curriculum');
const { mc } = require('./helpers');
const IELTS = require('./ielts');
const IELTS_EXAM = require('./ielts-exam');

const SPECS = {};
for (const code of ['A1', 'A2', 'B1', 'B2', 'C1']) { try { SPECS[code] = require('./' + code.toLowerCase()); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND' || !String(e.message).includes('/' + code.toLowerCase())) throw e; } }

function convertTopic(topic, base) {
  const out = JSON.parse(JSON.stringify(topic));
  out.uz = uzConv(topic.uz || '', base);
  for (const L of out.lessons) {
    const keep = new Set(base);
    for (const w of L.w) wordsIn(w[0] + ' ' + (w[4] || ''), keep);
    for (const e of L.eg) wordsIn(e[0], keep);
    L.t[1] = uzConv(L.t[1], keep); L.obj[0] = uzConv(L.obj[0], keep); L.ex[0] = uzConv(L.ex[0], keep);
    if (L.tip) L.tip[0] = uzConv(L.tip[0], keep);
    for (const e of L.eg) e[1] = uzConv(e[1], keep);
    for (const w of L.w) { w[1] = uzConv(w[1], keep); if (w[5]) w[5] = uzConv(w[5], keep); }
    for (const g of L.g) if (g[4]) g[4] = uzConv(g[4], keep);
  }
  return out;
}

const examContent = (code, base) => ({ objective: {
  en: `The ${code} final examination covers grammar, vocabulary, listening, reading and writing. Pass with 80% or more to unlock the next level. Each question has one try, and answers are shown after you finish.`,
  uz: uzConv(`${code} yakuniy imtihoni grammatika, lug‘at, tinglab tushunish, o‘qish va yozishni o‘z ichiga oladi. Keyingi darajani ochish uchun kamida 80% to‘plang. Har bir savolga bir marta javob beriladi, javoblar tugagandan keyin ko‘rsatiladi.`, base),
  ru: `Итоговый экзамен ${code} охватывает грамматику, лексику, аудирование, чтение и письмо. Для открытия следующего уровня нужно набрать не менее 80%. На каждый вопрос одна попытка, ответы показываются в конце.` }, explanation: { en: '', uz: '' }, examples: [], vocabulary: [] });

function content(base) {
  const levels = {};
  for (const [code, spec] of Object.entries(SPECS)) {
    const topics = spec.topics.map((t) => convertTopic(t, base));
    levels[code] = { topics: topics.map((t) => ({ title: t.title, lessons: t.lessons })),
      exam: topics.every((t) => t.lessons.length === 4) && spec.topics.length === 10 ? { content: examContent(code, base), items: topics.flatMap((t) => (t.exam || []).map((q) => mc(q[0], q[1], q[2], q[3], q[4]))).concat(spec.extras || []) } : undefined };
  }
  levels.IELTS = { topics: CURRICULUM.find((l) => l.code === 'IELTS').topics.map((tp) => ({ title: tp.title[0], test: false, lessons: IELTS.lessons.filter((L) => tp.lessons.some((x) => x[0] === L.t[0])) })) };
  levels.IELTS.exam = { content: examContent('IELTS', base), items: IELTS_EXAM };
  return { levels };
}
module.exports = { content };
