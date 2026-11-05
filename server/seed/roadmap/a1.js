/* A1 — Beginner: the topics (four lessons each) and the extra examination items (listening, reading, writing). */
const part1 = require('./a1-part1');
const part2 = require('./a1-part2');
const part3 = require('./a1-part3');
const { mc, listen, read, tfng } = require('./helpers');

const topics = part1.concat(part2).map((t) => ({ ...t, lessons: t.lessons.concat(part3[t.title] || []) }));
const P1 = 'Maria is twenty-two and she lives in London. Every morning she gets up at half past six and eats bread and an apple. She goes to work by bus. In the evening she cooks dinner and reads a book. At the weekend she plays tennis with her sister.';
const P2 = 'Our new flat is near the park. There is a big kitchen and two bedrooms. My brother and I have one room, and my parents have the other. We have no garden, but there is a small balcony. The shops are far, so we go there by car.';

const extras = [
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


module.exports = { topics, extras };
