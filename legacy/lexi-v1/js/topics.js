/* Topics offered when creating a custom session. A topic is either made of the ready-made decks (all four
   levels, see decks.js) or of a short list written for this project. As with the decks, the translations are
   unreviewed everyday vocabulary: check them with a teacher before using them for exams.
   Format of `words`: [English, Uzbek]; several Uzbek translations are separated by ";". */
VL.topics = [
  { id: 'daily', uz: 'Kundalik hayot', en: 'Daily life', ru: 'Повседневная жизнь', decks: ['daily'] },
  { id: 'family', uz: 'Oila va uy', en: 'Family and home', ru: 'Семья и дом', decks: ['family', 'home'] },
  { id: 'work', uz: 'Ish va kasblar', en: 'Work and jobs', ru: 'Работа и профессии', decks: ['work'] },
  { id: 'travel', uz: 'Sayohat', en: 'Travel', ru: 'Путешествия', decks: ['travel'] },
  { id: 'food', uz: 'Oziq-ovqat', en: 'Food and drink', ru: 'Еда и напитки', decks: ['food'] },
  {
    id: 'grammar', uz: 'Grammatika', en: 'Grammar', ru: 'Грамматика',
    words: [['noun', 'ot'], ['verb', "fe'l"], ['adjective', 'sifat'], ['adverb', 'ravish'], ['pronoun', 'olmosh'], ['preposition', "ko'makchi"], ['conjunction', "bog'lovchi"], ['article', 'artikl'], ['tense', 'zamon'], ['sentence', 'gap'], ['question', "so'roq gap; savol"], ['plural', "ko'plik"], ['singular', 'birlik'], ['subject', 'ega'], ['object', "to'ldiruvchi"]],
  },
  { id: 'verbs', uz: "Fe'llar", en: 'Verbs', ru: 'Глаголы', decks: ['verbs'] },
  { id: 'adjectives', uz: 'Sifatlar', en: 'Adjectives', ru: 'Прилагательные', decks: ['adjectives'] },
  {
    id: 'phrasal', uz: 'Phrasal verbs', en: 'Phrasal verbs', ru: 'Фразовые глаголы',
    words: [['give up', "taslim bo'lmoq; tashlamoq"], ['look after', "qaramoq; g'amxo'rlik qilmoq"], ['turn on', 'yoqmoq'], ['turn off', "o'chirmoq"], ['put on', 'kiymoq'], ['take off', 'yechmoq'], ['find out', 'bilib olmoq'], ['get up', 'turmoq'], ['sit down', "o'tirmoq"], ['stand up', "o'rnidan turmoq"], ['come back', 'qaytmoq'], ['look for', 'izlamoq'], ['run out of', 'tugab qolmoq'], ['set up', 'tashkil qilmoq'], ['carry on', 'davom etmoq']],
  },
  {
    id: 'ielts', uz: 'IELTS vocabulary', en: 'IELTS vocabulary', ru: 'Лексика IELTS',
    words: [['achieve', 'erishmoq'], ['benefit', 'foyda'], ['challenge', 'qiyinchilik; sinov'], ['environment', 'atrof-muhit'], ['significant', 'muhim; sezilarli'], ['increase', 'oshmoq; ko\'paymoq'], ['decrease', 'kamaymoq'], ['opportunity', 'imkoniyat'], ['society', 'jamiyat'], ['technology', 'texnologiya'], ['influence', "ta'sir"], ['solution', 'yechim'], ['contribute', "hissa qo'shmoq"], ['evidence', 'dalil; isbot'], ['consequence', 'oqibat'], ['approach', 'yondashuv']],
  },
  { id: 'own', uz: "O'zimning so'zlarim", en: 'My own words', ru: 'Мои слова', own: true },
];
VL.topicName = (tp) => tp[VL.i18n.lang] || tp.en;
