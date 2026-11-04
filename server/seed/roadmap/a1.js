/* A1 — Beginner: ten topics (two lessons and a topic test each) and the final examination. */
const { convertText } = require('../../lib/uz-convert');
const part1 = require('./a1-part1');
const part2 = require('./a1-part2');

const topics = part1.concat(part2);
const opts = (c, w) => [{ text: c, is_correct: true }].concat(w.map((text) => ({ text, is_correct: false })));
const mc = (q, c, w1, w2, module) => ({ type: 'multiple_choice', status: 'published', difficulty: 2, module, prompt: q, options: opts(c, [w1, w2]) });
const listen = (text, q, c, w1, w2) => ({ type: 'listen_choice', status: 'published', difficulty: 2, module: 'listening', prompt: q, audio_text: text, options: opts(c, [w1, w2]) });
const read = (passage, q, c, w1, w2) => ({ type: 'reading', status: 'published', difficulty: 2, module: 'reading', passage, prompt: q, options: opts(c, [w1, w2]) });
const tfng = (passage, statement, answer) => read(passage, 'True, False or Not Given? ' + statement, answer, ...['True', 'False', 'Not Given'].filter((x) => x !== answer));

const P1 = 'Maria is twenty-two and she lives in London. Every morning she gets up at half past six and eats bread and an apple. She goes to work by bus. In the evening she cooks dinner and reads a book. At the weekend she plays tennis with her sister.';
const P2 = 'Our new flat is near the park. There is a big kitchen and two bedrooms. My brother and I have one room, and my parents have the other. We have no garden, but there is a small balcony. The shops are far, so we go there by car.';

const EXAM_EXTRA = [
  listen('Anna: Good morning, Tom. How are you? Tom: I am fine, thanks. And you? Anna: Very well. What time is the lesson? Tom: It is at half past nine.', 'What time is the lesson?', 'At half past nine', 'At nine', 'At half past ten'),
  listen('Man: Excuse me, is there a bank near here? Woman: Yes. Go straight on and turn right at the park. The bank is next to the library. Man: Thank you very much.', 'Where is the bank?', 'Next to the library', 'Next to the park', 'Next to the station'),
  listen('Shopkeeper: Can I help you? Girl: Yes, how much is this red dress? Shopkeeper: It is thirty dollars. Girl: Can I pay by card? Shopkeeper: Of course.', 'How does the girl want to pay?', 'By card', 'In cash', 'She does not buy it'),
  listen('Boy: What do you like doing in your free time? Girl: I like swimming and drawing. I can’t play football. Boy: I can play football, but I can’t swim.', 'What can the boy do?', 'Play football', 'Swim', 'Draw'),
  read(P1, 'What time does Maria get up?', 'At half past six', 'At seven', 'At six'),
  read(P1, 'How does Maria go to work?', 'By bus', 'By car', 'On foot'),
  tfng(P1, 'Maria cooks dinner in the evening.', 'True'),
  tfng(P1, 'Maria has a brother.', 'Not Given'),
  read(P2, 'Where is the flat?', 'Near the park', 'Near the shops', 'Far from the park'),
  tfng(P2, 'The flat has a big garden.', 'False'),
  { type: 'writing', status: 'published', difficulty: 3, module: 'writing', prompt: 'Write 4–5 sentences about your family: who is in it, how old they are and what they do.', answer: 'my|family|is|years old', min_words: 20, translation: 'I have a small family. My father is forty-five and he is a driver. My mother is forty and she is a nurse. I have one brother. He is ten years old.' },
];

/* Uzbek texts are authored in the old spelling; English inside “quotes” and every English word of the lesson stays as written */
function toNewUz(text, keep) {
  return String(text).split(/(“[^”]*”)/).map((part, i) => (i % 2 ? part : convertText(part, keep))).join('');
}
const wordsIn = (s, set) => { for (const w of String(s || '').split(/[^A-Za-z]+/)) if (w) set.add(w.toLowerCase()); return set; };
function convertTopic(topic, base) {
  const out = JSON.parse(JSON.stringify(topic));
  out.uz = toNewUz(topic.uz, base);
  for (const L of out.lessons) {
    const keep = new Set(base);
    for (const w of L.w) { wordsIn(w[0] + ' ' + w[4], keep); }
    for (const e of L.eg) wordsIn(e[0], keep);
    L.t[1] = toNewUz(L.t[1], keep); L.obj[0] = toNewUz(L.obj[0], keep); L.ex[0] = toNewUz(L.ex[0], keep);
    if (L.tip) L.tip[0] = toNewUz(L.tip[0], keep);
    for (const e of L.eg) e[1] = toNewUz(e[1], keep);
    for (const w of L.w) { w[1] = toNewUz(w[1], keep); w[5] = w[5] ? toNewUz(w[5], keep) : w[5]; }
    for (const g of L.g) if (g[4]) g[4] = toNewUz(g[4], keep);
  }
  return out;
}

function content(baseKeep) {
  const base = baseKeep || new Set();
  const conv = topics.map((t) => convertTopic(t, base));
  const topicTitles = { A1: Object.fromEntries(conv.map((t) => [t.title, [t.uz, t.ru]])) };
  return {
    topicTitles,
    levels: {
      A1: {
        topics: conv.map((t) => ({ title: t.title, lessons: t.lessons })),
        exam: {
          content: { objective: { en: 'The A1 final examination covers grammar, vocabulary, listening, reading and writing. Pass with 80% or more to unlock level A2. Each question has one try, and answers are shown after you finish.', uz: toNewUz('A1 yakuniy imtihoni grammatika, lug‘at, tinglab tushunish, o‘qish va yozishni o‘z ichiga oladi. A2 darajasini ochish uchun kamida 80% to‘plang. Har bir savolga bir marta javob beriladi, javoblar tugagandan keyin ko‘rsatiladi.', base), ru: 'Итоговый экзамен A1 охватывает грамматику, лексику, аудирование, чтение и письмо. Для открытия A2 нужно набрать не менее 80%. На каждый вопрос одна попытка, ответы показываются в конце.' }, explanation: { en: '', uz: '' }, examples: [], vocabulary: [] },
          items: topics.flatMap((t) => t.exam.map((q) => mc(q[0], q[1], q[2], q[3], q[4]))).concat(EXAM_EXTRA),
        },
      },
    },
  };
}
module.exports = { content, topics, toNewUz };
