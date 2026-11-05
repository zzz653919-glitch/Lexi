/* A2 — Elementary: ten topics (four lessons each) and the extra examination items. */
const part1 = require('./a2-part1');
const part2 = require('./a2-part2');
const { listen, read, tfng } = require('./helpers');

const topics = part1.concat(part2);
const P1 = 'Last summer Dilnoza visited her uncle in Samarkand. She travelled by train and the journey took three hours. She stayed for a week, saw the Registan and tried local bread. The weather was hot, so she drank a lot of water. She is going to visit again next spring.';
const P2 = 'The new library in our town is bigger and more modern than the old one. It has a quiet reading room and a café on the ground floor. Visitors mustn’t eat in the reading room, but they can buy a drink in the café. It is open every day except Monday.';

const extras = [
  listen('Receptionist: Good morning, Blue Hotel. Man: Hello, I’d like to book a room for two nights from Friday. Receptionist: A single or a double? Man: A double, please, with breakfast. Receptionist: That will be ninety dollars a night.', 'How much is the room per night?', 'Ninety dollars', 'Nineteen dollars', 'Nine dollars'),
  listen('Doctor: What’s the matter? Girl: I have a bad headache and a sore throat. Doctor: How long have you had them? Girl: Since Monday. Doctor: You should rest, drink warm tea and take these tablets twice a day.', 'What should the girl do?', 'Rest and drink warm tea', 'Go to school', 'Eat cold food'),
  listen('Boy: Are you going to the party on Saturday? Girl: I’d love to, but I can’t. I have to help my mother at home. Boy: What a pity! Girl: Thanks for the invitation, though. Maybe next time.', 'Why can’t the girl go to the party?', 'She has to help her mother', 'She is ill', 'She has an exam'),
  listen('Waiter: Are you ready to order? Woman: Yes, I’ll have the chicken soup, then the fish. Waiter: Anything to drink? Woman: Just water, please. And could I have the bill later?', 'What does the woman order to drink?', 'Water', 'Tea', 'Juice'),
  read(P1, 'How did Dilnoza travel?', 'By train', 'By plane', 'By car'),
  read(P1, 'How long did she stay?', 'A week', 'A month', 'Three days'),
  tfng(P1, 'The weather was cold.', 'False'),
  tfng(P1, 'Her uncle is a teacher.', 'Not Given'),
  read(P2, 'When is the library closed?', 'On Monday', 'On Sunday', 'It is never closed'),
  tfng(P2, 'Visitors mustn’t eat in the reading room.', 'True'),
  { type: 'writing', status: 'published', difficulty: 3, module: 'writing', prompt: 'Write 6–8 sentences about your last holiday or weekend: where you went, what you did and what you are going to do next time.', answer: 'went|was|saw|going to', min_words: 40, translation: 'Last weekend I went to my grandmother’s village. The weather was sunny. I helped in the garden and we cooked plov. In the evening we watched a film. It was a great weekend. Next time I am going to take my brother with me.' },
];

module.exports = { topics, extras };
