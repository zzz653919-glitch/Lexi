/* IELTS level final examination (original items): format knowledge, strategy, language accuracy and short skill checks. */
const opts = (c, w) => [{ text: c, is_correct: true }].concat(w.map((text) => ({ text, is_correct: false })));
const mc = (q, c, w1, w2, module) => ({ type: 'multiple_choice', status: 'published', difficulty: 3, module, prompt: q, options: opts(c, [w1, w2]) });
const listen = (text, q, c, w1, w2) => ({ type: 'listen_choice', status: 'published', difficulty: 3, module: 'listening', prompt: q, audio_text: text, options: opts(c, [w1, w2]) });
const note = (text, sentence, answer) => ({ type: 'fill_blank', status: 'published', difficulty: 3, module: 'listening', prompt: 'Write NO MORE THAN TWO WORDS OR A NUMBER.', audio_text: text, sentence, answer });
const read = (passage, q, c, w1, w2) => ({ type: 'reading', status: 'published', difficulty: 3, module: 'reading', passage, prompt: q, options: opts(c, [w1, w2]) });
const tfng = (passage, st, a) => read(passage, 'True, False or Not Given? ' + st, a, ...['True', 'False', 'Not Given'].filter((x) => x !== a));
const writing = (prompt, answer, min, model) => ({ type: 'writing', status: 'published', difficulty: 4, module: 'writing', prompt, answer, min_words: min, translation: model });
const speaking = (prompt, model) => ({ type: 'speaking', status: 'published', difficulty: 3, module: 'speaking', prompt, translation: model });

const BUS = 'Clerk: Good afternoon, City Transport. Caller: I’d like to buy a monthly bus pass. Clerk: A monthly pass costs thirty-two pounds, and students receive a twenty per cent discount if they show a student card. Caller: How long does it take to get the pass? Clerk: You can collect it from the office in the main station the same day, but you need a passport-size photograph.';
const BRIDGE = 'The Millbrook Bridge, completed in 1894, was for decades the only crossing over the river in the town. Built from local stone, it carried carts, then cars, until a new road bridge opened in 1975. Since then the old bridge has been closed to traffic and now serves as a footpath. A recent restoration project, funded partly by donations from residents, replaced damaged stones and installed lighting. Local historians say that the bridge is a symbol of the town’s identity, although some residents have complained that the lighting is too bright at night.';

module.exports = [
  mc('How many questions are there in each of the Listening and Reading tests?', '40', '30', '60', 'reading'),
  mc('Which Writing task carries more weight in the Writing score?', 'Task 2', 'Task 1', 'They are equal', 'writing'),
  mc('What is the minimum word count for Task 2?', '250 words', '150 words', '400 words', 'writing'),
  mc('What should an overview in Task 1 contain?', 'The main trends or differences', 'Your opinion', 'Every single number', 'writing'),
  mc('Which Speaking part is a monologue of one to two minutes?', 'Part 2', 'Part 1', 'Part 3', 'speaking'),
  mc('Which marking criterion is NOT used in Speaking?', 'Task achievement', 'Fluency and coherence', 'Pronunciation', 'speaking'),
  mc('In True / False / Not Given, “Not Given” means that…', 'The text says nothing about the statement', 'The statement is false', 'The statement is probably true', 'reading'),
  mc('A student writes 180 words in Task 2. What is the likely result?', 'A penalty for under-length', 'A bonus for conciseness', 'No effect', 'writing'),
  mc('Which linker introduces a contrast?', 'whereas', 'therefore', 'for instance', 'writing'),
  mc('Which sentence is the most formal?', 'It is widely believed that the policy has failed.', 'Everyone thinks the policy flopped.', 'The policy is rubbish.', 'writing'),
  mc('Choose the correct sentence.', 'The number of visitors rose sharply.', 'The number of visitors raised sharply.', 'The number of visitor rose sharp.', 'writing'),
  mc('Which phrase gains time in Speaking Part 3?', 'That’s an interesting question; let me think…', 'No idea.', 'Next, please.', 'speaking'),
  mc('What is the best way to use the last five minutes of Reading?', 'Return to skipped questions and guess', 'Stop and wait', 'Rewrite the answers', 'reading'),
  mc('Which tense is most useful for describing a process in Task 1?', 'The Present Simple passive', 'The Future Perfect', 'The Past Continuous', 'writing'),
  mc('When a speaker corrects himself in Listening, you should…', 'Write the corrected information', 'Write the first information', 'Write both', 'listening'),
  mc('Which paraphrase of “the number of cars increased” is correct?', 'There was a rise in the number of cars.', 'The cars number rise.', 'It increases cars.', 'writing'),
  mc('What does a Band 7.0 essay show more than a Band 6.5 essay?', 'Greater range and accuracy of language', 'Longer paragraphs only', 'A memorised introduction', 'writing'),
  mc('Which is a typical mistake in Listening?', 'Writing more words than the limit', 'Reading the questions first', 'Checking spelling', 'listening'),
  listen(BUS, 'How much does a monthly pass cost?', '£32', '£23', '£20'),
  listen(BUS, 'What discount do students receive?', '20 per cent', '10 per cent', '32 per cent'),
  note(BUS, 'You need a passport-size ____.', 'photograph|photo'),
  note(BUS, 'The pass can be collected from the main ____.', 'station'),
  read(BRIDGE, 'Why was the old bridge closed to traffic?', 'A new road bridge opened', 'It collapsed', 'It was too narrow for people'),
  tfng(BRIDGE, 'The Millbrook Bridge was built from local stone.', 'True'),
  tfng(BRIDGE, 'The restoration was paid for entirely by the government.', 'False'),
  tfng(BRIDGE, 'The bridge is the oldest in the country.', 'Not Given'),
  read(BRIDGE, 'What complaint have some residents made?', 'The lighting is too bright at night', 'The bridge is too crowded', 'The restoration took too long', 'The bridge is unsafe'),
  writing('Task 2 (short form): In 120–150 words give your opinion: “Learning English is more useful than learning any other language.” Include a clear opinion and one example.', 'in my opinion|for example|because', 100, 'In my opinion, learning English is more useful than learning other languages because it is widely used in business, science and the internet. For example, most academic research is published in English. Nevertheless, knowing a local language is valuable for personal and cultural reasons. Overall, English offers more opportunities.'),
  speaking('Describe a skill you would like to improve and explain why it matters to you (about one minute).', 'I would like to improve my speaking because I want to study abroad. It matters to me because communication is essential in university. I plan to practise with friends every day and record myself.'),
];
