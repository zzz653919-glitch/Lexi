/* Ready-made vocabulary decks: 4 levels x 9 topics x 8 words = 288 entries.
   Format: [English, Uzbek]; several Uzbek translations are separated by ";" (the first one is shown
   in multiple-choice answers, any of them is accepted when typing).
   Source: written for this project from common everyday English vocabulary. The levels are
   approximate (by how basic or advanced a word is) and are NOT taken from an official CEFR
   word list. A native-speaker review is recommended before using them for teaching. */
VL.deckTopics = {
  daily: { en: 'Daily life', uz: 'Kundalik hayot', ru: 'Повседневная жизнь' },
  family: { en: 'Family', uz: 'Oila', ru: 'Семья' },
  food: { en: 'Food and drink', uz: 'Oziq-ovqat', ru: 'Еда и напитки' },
  home: { en: 'Home and objects', uz: 'Uy va buyumlar', ru: 'Дом и вещи' },
  school: { en: 'School and education', uz: "Maktab va ta'lim", ru: 'Школа и образование' },
  work: { en: 'Work and jobs', uz: 'Ish va kasblar', ru: 'Работа и профессии' },
  travel: { en: 'Travel', uz: 'Sayohat', ru: 'Путешествия' },
  verbs: { en: 'Verbs', uz: "Fe'llar", ru: 'Глаголы' },
  adjectives: { en: 'Adjectives', uz: 'Sifatlar', ru: 'Прилагательные' },
};

VL.deckLevels = [
  { id: 'A1', name: { en: 'Beginner', uz: "Boshlang'ich", ru: 'Начальный' } },
  { id: 'A2', name: { en: 'Elementary', uz: "Boshlang'ichdan yuqori", ru: 'Элементарный' } },
  { id: 'B1', name: { en: 'Intermediate', uz: "O'rta", ru: 'Средний' } },
  { id: 'B2', name: { en: 'Upper-Intermediate', uz: "O'rtadan yuqori", ru: 'Выше среднего' } },
];

VL.decks = {
  A1: {
    daily: [['wake up', "uyg'onmoq"], ['sleep', 'uxlamoq'], ['morning', 'ertalab; tong'], ['evening', 'kechqurun; kech'], ['today', 'bugun'], ['tomorrow', 'ertaga'], ['time', 'vaqt'], ['day', 'kun']],
    family: [['mother', 'ona; oyi'], ['father', 'ota; dada'], ['sister', 'opa; singil'], ['brother', 'aka; uka'], ['son', "o'g'il"], ['daughter', 'qiz'], ['grandmother', 'buvi'], ['baby', 'chaqaloq']],
    food: [['bread', 'non'], ['water', 'suv'], ['milk', 'sut'], ['egg', 'tuxum'], ['rice', 'guruch'], ['meat', "go'sht"], ['apple', 'olma'], ['tea', 'choy']],
    home: [['house', 'uy'], ['door', 'eshik'], ['window', 'deraza'], ['table', 'stol'], ['chair', 'stul'], ['bed', "to'shak; karavot"], ['kitchen', 'oshxona'], ['room', 'xona']],
    school: [['book', 'kitob'], ['pen', 'ruchka'], ['teacher', "o'qituvchi"], ['student', "o'quvchi; talaba"], ['school', 'maktab'], ['lesson', 'dars'], ['desk', 'parta'], ['notebook', 'daftar']],
    work: [['office', 'ofis; idora'], ['doctor', 'shifokor; doktor'], ['driver', 'haydovchi'], ['cook', 'oshpaz'], ['farmer', 'dehqon'], ['worker', 'ishchi'], ['boss', 'boshliq'], ['money', 'pul']],
    travel: [['car', 'mashina'], ['bus', 'avtobus'], ['train', 'poyezd'], ['airplane', 'samolyot'], ['ticket', 'chipta'], ['map', 'xarita'], ['hotel', 'mehmonxona'], ['street', "ko'cha"]],
    verbs: [['eat', 'yemoq'], ['drink', 'ichmoq'], ['go', 'bormoq'], ['come', 'kelmoq'], ['read', "o'qimoq"], ['write', 'yozmoq'], ['see', "ko'rmoq"], ['speak', 'gapirmoq']],
    adjectives: [['big', 'katta'], ['small', 'kichik'], ['good', 'yaxshi'], ['bad', 'yomon'], ['new', 'yangi'], ['old', 'eski; qari'], ['hot', 'issiq'], ['cold', 'sovuq']],
  },
  A2: {
    daily: [['breakfast', 'nonushta'], ['lunch', 'tushlik'], ['dinner', 'kechki ovqat'], ['weekend', 'dam olish kunlari'], ['shower', 'dush'], ['clothes', 'kiyim'], ['shopping', 'xarid'], ['birthday', "tug'ilgan kun"]],
    family: [['husband', 'er; turmush o\'rtog\'i'], ['wife', 'xotin; rafiqa'], ['uncle', 'amaki; tog\'a'], ['aunt', 'xola; amma'], ['cousin', 'amakivachcha; xolavachcha'], ['parents', 'ota-ona'], ['relative', 'qarindosh'], ['neighbour', "qo'shni"]],
    food: [['vegetable', 'sabzavot'], ['fruit', 'meva'], ['cheese', 'pishloq'], ['butter', "sariyog'"], ['sugar', 'shakar'], ['salt', 'tuz'], ['soup', "sho'rva"], ['chicken', 'tovuq']],
    home: [['bathroom', 'hammom; vannaxona'], ['bedroom', 'yotoqxona'], ['garden', "bog'"], ['stairs', 'zina'], ['floor', 'pol'], ['wall', 'devor'], ['roof', 'tom'], ['fridge', 'muzlatgich']],
    school: [['homework', 'uy vazifasi'], ['exam', 'imtihon'], ['question', 'savol'], ['answer', 'javob'], ['subject', 'fan'], ['university', 'universitet'], ['dictionary', "lug'at"], ['mistake', 'xato']],
    work: [['manager', 'rahbar; menejer'], ['salary', 'maosh; oylik'], ['meeting', "yig'ilish"], ['company', 'kompaniya'], ['customer', 'mijoz'], ['engineer', 'muhandis'], ['nurse', 'hamshira'], ['lawyer', 'advokat; huquqshunos']],
    travel: [['airport', 'aeroport'], ['passport', 'pasport'], ['luggage', 'yuk; bagaj'], ['tourist', 'sayyoh; turist'], ['journey', 'sayohat; safar'], ['station', 'bekat; vokzal'], ['holiday', "ta'til"], ['island', 'orol']],
    verbs: [['buy', 'sotib olmoq'], ['sell', 'sotmoq'], ['open', 'ochmoq'], ['close', 'yopmoq'], ['wait', 'kutmoq'], ['help', 'yordam bermoq'], ['learn', "o'rganmoq"], ['ask', "so'ramoq"]],
    adjectives: [['easy', 'oson'], ['difficult', 'qiyin; murakkab'], ['cheap', 'arzon'], ['expensive', 'qimmat'], ['fast', 'tez'], ['slow', 'sekin'], ['clean', 'toza'], ['dirty', 'iflos; kir']],
  },
  B1: {
    daily: [['routine', 'kundalik tartib'], ['habit', 'odat'], ['schedule', 'jadval'], ['neighbourhood', 'mahalla'], ['fashion', 'moda'], ['health', 'salomatlik; sog\'liq'], ['exercise', 'mashq; jismoniy mashq'], ['hobby', 'sevimli mashg\'ulot; hobbi']],
    family: [['relationship', 'munosabat'], ['generation', 'avlod'], ['marriage', 'nikoh; turmush'], ['childhood', 'bolalik'], ['teenager', "o'smir"], ['grandparents', 'bobo-buvi'], ['behaviour', 'xulq-atvor'], ['support', "qo'llab-quvvatlash; yordam"]],
    food: [['recipe', 'retsept'], ['ingredient', 'masalliq; ingredient'], ['flavour', "ta'm"], ['diet', 'parhez'], ['snack', 'gazak; yengil taom'], ['nutrition', 'ovqatlanish'], ['delicious', 'mazali'], ['spicy', 'achchiq']],
    home: [['furniture', 'mebel'], ['apartment', 'kvartira'], ['rent', 'ijara'], ['decorate', 'bezatmoq'], ['electricity', 'elektr; elektr energiyasi'], ['heating', 'isitish'], ['appliance', 'maishiy texnika'], ['balcony', 'balkon']],
    school: [['education', "ta'lim"], ['degree', 'diplom; ilmiy daraja'], ['scholarship', 'stipendiya'], ['research', 'tadqiqot'], ['knowledge', 'bilim'], ['skill', "ko'nikma; mahorat"], ['lecture', "ma'ruza"], ['deadline', 'oxirgi muddat; muddat']],
    work: [['employee', 'xodim'], ['employer', 'ish beruvchi'], ['career', 'martaba; karyera'], ['experience', 'tajriba'], ['interview', 'suhbat; intervyu'], ['colleague', 'hamkasb'], ['opportunity', 'imkoniyat'], ['unemployed', 'ishsiz']],
    travel: [['destination', 'manzil'], ['reservation', 'bron'], ['passenger', "yo'lovchi"], ['delay', 'kechikish'], ['customs', 'bojxona'], ['excursion', 'ekskursiya; sayr'], ['accommodation', 'turar joy'], ['abroad', 'chet elda; xorijda']],
    verbs: [['improve', 'yaxshilamoq'], ['suggest', 'taklif qilmoq'], ['decide', 'qaror qilmoq'], ['achieve', 'erishmoq'], ['manage', 'uddalamoq; boshqarmoq'], ['avoid', "chetlab o'tmoq; qochmoq"], ['require', 'talab qilmoq'], ['recommend', 'tavsiya qilmoq']],
    adjectives: [['available', 'mavjud'], ['responsible', "mas'uliyatli"], ['confident', "o'ziga ishongan"], ['patient', 'sabrli'], ['honest', 'halol'], ['creative', 'ijodkor'], ['polite', 'xushmuomala; odobli'], ['reliable', 'ishonchli']],
  },
  B2: {
    daily: [['lifestyle', 'turmush tarzi'], ['priority', 'ustuvorlik'], ['stress', 'stress; asab zo\'riqishi'], ['balance', 'muvozanat'], ['trend', 'tendensiya; yo\'nalish'], ['awareness', 'xabardorlik'], ['commitment', 'majburiyat; sadoqat'], ['wellbeing', 'farovonlik']],
    family: [['upbringing', 'tarbiya'], ['sibling', 'aka-uka yoki opa-singil'], ['heritage', 'meros'], ['ancestor', 'ajdod'], ['guardian', 'vasiy; homiy'], ['tradition', "an'ana"], ['bond', 'rishta; bog\'liqlik'], ['household', 'xonadon; oila xo\'jaligi']],
    food: [['cuisine', 'milliy taomlar; oshpazlik'], ['nutritious', "to'yimli"], ['organic', 'organik'], ['consume', "iste'mol qilmoq"], ['appetite', 'ishtaha'], ['seasoning', 'ziravor'], ['famine', 'ocharchilik'], ['ferment', 'achitmoq']],
    home: [['renovate', "ta'mirlamoq"], ['mortgage', 'ipoteka'], ['landlord', 'uy egasi'], ['tenant', 'ijarachi'], ['insulation', 'izolyatsiya'], ['utilities', 'kommunal xizmatlar'], ['suburb', 'shahar atrofi'], ['spacious', 'keng; katta']],
    school: [['curriculum', "o'quv dasturi"], ['assessment', 'baholash'], ['tuition', "o'qish haqi"], ['thesis', 'dissertatsiya; diplom ishi'], ['enrol', "o'qishga yozilmoq"], ['graduate', 'bitirmoq'], ['plagiarism', 'plagiat'], ['academic', 'akademik; ilmiy']],
    work: [['negotiate', 'muzokara qilmoq'], ['promotion', "lavozimga ko'tarilish"], ['resign', "iste'foga chiqmoq"], ['budget', 'byudjet'], ['workload', 'ish yuki'], ['recruit', 'ishga yollamoq'], ['profit', 'foyda'], ['stakeholder', 'manfaatdor tomon']],
    travel: [['itinerary', 'sayohat rejasi'], ['souvenir', "esdalik sovg'a; suvenir"], ['currency', 'valyuta; pul birligi'], ['visa', 'viza'], ['guide', "gid; yo'lboshchi"], ['overseas', 'xorijda; chet elda'], ['commute', 'qatnamoq; har kuni qatnash'], ['cruise', 'kruiz; dengiz sayohati']],
    verbs: [['accomplish', 'bajarmoq; amalga oshirmoq'], ['acknowledge', 'tan olmoq'], ['assume', 'taxmin qilmoq'], ['contribute', "hissa qo'shmoq"], ['emphasize', "ta'kidlamoq"], ['overcome', "yengib o'tmoq"], ['persuade', 'ishontirmoq'], ['tackle', 'hal qilmoq; bartaraf etmoq']],
    adjectives: [['reluctant', 'istamaydigan; istaksiz'], ['ambitious', 'intiluvchan; shuhratparast'], ['flexible', 'moslashuvchan'], ['accurate', 'aniq; to\'g\'ri'], ['reasonable', 'oqilona; mantiqli'], ['stubborn', "o'jar"], ['generous', "saxiy; bag'ri keng"], ['cautious', 'ehtiyotkor']],
  },
};
