/* Extra words so that every level (Pre-A1 … C2) has enough vocabulary for the personalised daily lessons.
   Entry: [english, uzbek, russian, part of speech, example sentence]. */
const POOL = {
  A0: [
    ['cat', 'mushuk', 'кошка', 'noun', 'The cat is on the chair.'], ['dog', 'it', 'собака', 'noun', 'I have a dog.'], ['book', 'kitob', 'книга', 'noun', 'This is my book.'], ['red', 'qizil', 'красный', 'adjective', 'The apple is red.'],
    ['big', 'katta', 'большой', 'adjective', 'The house is big.'], ['small', 'kichik', 'маленький', 'adjective', 'The cup is small.'], ['one', 'bir', 'один', 'number', 'I have one brother.'], ['two', 'ikki', 'два', 'number', 'She has two cats.'],
    ['boy', "o'g'il bola", 'мальчик', 'noun', 'The boy is happy.'], ['girl', 'qiz bola', 'девочка', 'noun', 'The girl reads a book.'], ['man', 'erkak', 'мужчина', 'noun', 'The man is tall.'], ['woman', 'ayol', 'женщина', 'noun', 'The woman is a doctor.'],
    ['happy', 'xursand', 'счастливый', 'adjective', 'I am happy today.'], ['sun', 'quyosh', 'солнце', 'noun', 'The sun is hot.'], ['door', 'eshik', 'дверь', 'noun', 'Open the door, please.'], ['eat', 'yemoq', 'есть', 'verb', 'We eat lunch at noon.'],
  ],
  A2: [
    ['journey', 'sayohat', 'путешествие', 'noun', 'The journey took three hours.'], ['weather', "ob-havo", 'погода', 'noun', 'The weather is cold today.'], ['expensive', 'qimmat', 'дорогой', 'adjective', 'This phone is too expensive.'], ['borrow', 'qarzga olmoq', 'занимать', 'verb', 'Can I borrow your pen?'],
    ['invite', 'taklif qilmoq', 'приглашать', 'verb', 'She invited us to her party.'], ['crowded', 'gavjum', 'многолюдный', 'adjective', 'The bus was very crowded.'], ['ticket', 'chipta', 'билет', 'noun', 'I bought a ticket online.'], ['comfortable', 'qulay', 'удобный', 'adjective', 'This chair is comfortable.'],
    ['decide', 'qaror qilmoq', 'решать', 'verb', 'We decided to stay at home.'], ['holiday', 'ta\'til', 'отпуск', 'noun', 'We spent our holiday by the sea.'],
  ],
  B1: [
    ['achieve', 'erishmoq', 'достигать', 'verb', 'She worked hard to achieve her goal.'], ['environment', 'atrof-muhit', 'окружающая среда', 'noun', 'We must protect the environment.'], ['opportunity', 'imkoniyat', 'возможность', 'noun', 'This job is a great opportunity.'], ['experience', 'tajriba', 'опыт', 'noun', 'He has ten years of experience.'],
    ['suggest', 'taklif qilmoq', 'предлагать', 'verb', 'I suggest taking a taxi.'], ['reliable', 'ishonchli', 'надёжный', 'adjective', 'He is a reliable friend.'], ['improve', 'yaxshilamoq', 'улучшать', 'verb', 'I want to improve my English.'], ['consider', "o'ylab ko'rmoq", 'обдумывать', 'verb', 'Please consider my offer.'],
    ['argue', 'bahslashmoq', 'спорить', 'verb', 'They often argue about money.'], ['develop', 'rivojlantirmoq', 'развивать', 'verb', 'The company develops software.'], ['community', 'jamiyat', 'сообщество', 'noun', 'Our community is very friendly.'], ['prefer', 'afzal ko\'rmoq', 'предпочитать', 'verb', 'I prefer tea to coffee.'],
  ],
  B2: [
    ['substantial', 'sezilarli', 'существенный', 'adjective', 'There was a substantial increase in prices.'], ['reluctant', 'istamaydigan', 'неохотный', 'adjective', 'He was reluctant to leave.'], ['contribute', "hissa qo'shmoq", 'вносить вклад', 'verb', 'Everyone should contribute to the project.'], ['assume', 'taxmin qilmoq', 'предполагать', 'verb', 'I assume you have already eaten.'],
    ['significant', 'muhim', 'значительный', 'adjective', 'This is a significant discovery.'], ['evidence', 'dalil', 'доказательство', 'noun', 'There is no evidence for this claim.'], ['approach', 'yondashuv', 'подход', 'noun', 'We need a new approach to the problem.'], ['overcome', 'yengmoq', 'преодолевать', 'verb', 'She overcame many difficulties.'],
    ['obvious', 'ravshan', 'очевидный', 'adjective', 'The answer is obvious.'], ['tend', 'moyil bo\'lmoq', 'иметь тенденцию', 'verb', 'Prices tend to rise in summer.'], ['abandon', 'tark etmoq', 'бросать', 'verb', 'They abandoned the plan.'], ['rely', 'tayanmoq', 'полагаться', 'verb', 'You can rely on me.'],
  ],
  C1: [
    ['ambiguous', 'ikki ma\'noli', 'двусмысленный', 'adjective', 'The contract language was ambiguous.'], ['mitigate', 'yumshatmoq', 'смягчать', 'verb', 'New rules mitigate the risk.'], ['meticulous', 'puxta', 'тщательный', 'adjective', 'She is meticulous about details.'], ['inevitable', 'muqarrar', 'неизбежный', 'adjective', 'Change is inevitable.'],
    ['scrutinise', 'sinchiklab tekshirmoq', 'тщательно изучать', 'verb', 'Auditors scrutinise every report.'], ['undermine', 'putur yetkazmoq', 'подрывать', 'verb', 'Rumours undermined his authority.'], ['coherent', 'izchil', 'связный', 'adjective', 'He gave a coherent explanation.'], ['allocate', 'ajratmoq', 'выделять', 'verb', 'The city allocated funds for schools.'],
    ['plausible', 'ishonarli', 'правдоподобный', 'adjective', 'That sounds like a plausible excuse.'], ['inherent', 'xos', 'присущий', 'adjective', 'Risk is inherent in any investment.'], ['advocate', 'himoya qilmoq', 'отстаивать', 'verb', 'She advocates for children\'s rights.'], ['pragmatic', 'amaliy', 'прагматичный', 'adjective', 'We need a pragmatic solution.'],
  ],
  C2: [
    ['ubiquitous', 'hamma joyda uchraydigan', 'вездесущий', 'adjective', 'Smartphones are ubiquitous today.'], ['ephemeral', 'o\'tkinchi', 'мимолётный', 'adjective', 'Fame can be ephemeral.'], ['exacerbate', 'chuqurlashtirmoq', 'усугублять', 'verb', 'Stress can exacerbate the problem.'], ['juxtapose', 'yonma-yon qo\'ymoq', 'сопоставлять', 'verb', 'The film juxtaposes wealth and poverty.'],
    ['equivocal', 'noaniq', 'неоднозначный', 'adjective', 'The results were equivocal.'], ['perfunctory', 'yuzaki', 'поверхностный', 'adjective', 'He gave a perfunctory nod.'], ['obfuscate', 'chalkashtirmoq', 'запутывать', 'verb', 'The report seems to obfuscate the facts.'], ['magnanimous', 'olijanob', 'великодушный', 'adjective', 'She was magnanimous in victory.'],
    ['conundrum', 'jumboq', 'головоломка', 'noun', 'The case presented a real conundrum.'], ['recalcitrant', 'qaysar', 'непокорный', 'adjective', 'The recalcitrant student refused to listen.'], ['sycophant', 'xushomadgo\'y', 'подхалим', 'noun', 'The king was surrounded by sycophants.'], ['unequivocal', 'aniq', 'недвусмысленный', 'adjective', 'He gave an unequivocal answer.'],
  ],
};
module.exports = { POOL };
