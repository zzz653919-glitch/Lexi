/* B1 — Intermediate: ten topics (four lessons each) and the extra examination items. */
const part1 = require('./b1-part1');
const part2 = require('./b1-part2');
const { listen, read, tfng } = require('./helpers');

const topics = part1.concat(part2);
const P1 = 'Many young people today change their jobs several times during their careers. Experts say that gaining different skills is an advantage, because the labour market changes quickly. However, frequent changes can also cause stress. A good plan, supportive colleagues and continuous learning help people to adapt. Employers increasingly value flexibility, communication and teamwork more than a single qualification.';
const P2 = 'The city council has announced a new programme to reduce air pollution. From next year, cars will not be allowed in the old town on weekends, and public transport will be free on Saturdays. The council hopes that fewer cars will mean cleaner air and quieter streets. Some shop owners are worried that they will lose customers, but surveys show that most residents support the idea.';

const extras = [
  listen('Man: Excuse me, I booked a double room with a sea view, but my window faces the car park. Receptionist: I’m very sorry, sir. I’ll check what is available. Man: I would also like breakfast to be included, as the website promised. Receptionist: I can offer you a room on the fifth floor and a free breakfast for two days.', 'What does the receptionist offer?', 'A room on the fifth floor and a free breakfast', 'A refund of the whole stay', 'A taxi to another hotel'),
  listen('Woman: I’ve been feeling really tired lately. Doctor: How many hours do you sleep? Woman: About five. I’m under a lot of pressure at work. Doctor: Lack of sleep leads to stress. I suggest that you go to bed earlier and do some exercise three times a week. If it doesn’t help, come back in a month.', 'What does the doctor suggest?', 'Go to bed earlier and exercise', 'Take a long holiday', 'Change her job'),
  listen('Presenter: Today we talk about recycling. In our city, residents sort rubbish into three bins: paper, glass and plastic. Since the programme started two years ago, the amount of waste going to landfill has fallen by thirty percent. Next year the city is going to add a fourth bin for food waste.', 'What will the city add next year?', 'A bin for food waste', 'A new factory', 'More buses'),
  listen('Student A: I’ve been learning English for four years. Student B: Have you ever taken an international exam? Student A: Not yet, but I’m going to take one in June. If I pass, I’ll apply to a university abroad. Student B: I’m sure you will pass if you keep practising.', 'When is Student A going to take the exam?', 'In June', 'Next week', 'Next year'),
  read(P1, 'What do employers value more than a single qualification?', 'Flexibility, communication and teamwork', 'Only a high salary', 'A long CV'),
  read(P1, 'What helps people to adapt to career changes?', 'A good plan, support and continuous learning', 'Staying in one job', 'Avoiding stress at all costs'),
  tfng(P1, 'Gaining different skills can be an advantage.', 'True'),
  tfng(P1, 'Changing jobs often always makes people unhappy.', 'False'),
  read(P2, 'When will cars not be allowed in the old town?', 'On weekends', 'Every day', 'Only in winter'),
  tfng(P2, 'Public transport will be free on Saturdays.', 'True'),
  tfng(P2, 'The council has already spent a million dollars.', 'Not Given'),
  { type: 'writing', status: 'published', difficulty: 3, module: 'writing', prompt: 'Write an opinion essay (120–150 words): “Technology makes our lives easier but also causes problems.” Give advantages, disadvantages and your conclusion.', answer: 'on the one hand|on the other hand|although|in conclusion', min_words: 100, translation: 'Nowadays technology is part of everyday life. On the one hand, it makes life easier because we can communicate and learn quickly. For example, we can search for information in a second. On the other hand, technology can be distracting and people may become dependent on it. Although it saves time, it can also make us isolated. In conclusion, technology is useful, but we should use it wisely.' },
];

module.exports = { topics, extras };
