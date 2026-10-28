/* Uzbek / Russian versions of the sample content.
   NAV: titles and descriptions shown in the course path (they follow the INTERFACE language; English is the base text).
   RU_WORDS: Russian translation + Russian example for each sample word (they follow the learner's TRANSLATION language; Uzbek is the base text).
   RU_SENTENCES: Russian translation of the sample "arrange the words" sentences. */
const NAV = {
  'English Foundations': { uz: ['Ingliz tili asoslari', 'Boshlang‘ichdan yuqori darajagacha bosqichma-bosqich ingliz tili kursi. Namuna kontent: admin panelida tahrirlang yoki kengaytiring.'], ru: ['Основы английского', 'Пошаговый курс английского от начального до продвинутого уровня. Пример содержимого: изменяйте и расширяйте его в панели администратора.'] },
  'IELTS Starter Practice': { uz: ['IELTS boshlang‘ich mashq', 'Akademik imtihon uslubidagi lug‘at va o‘qish mashqlari. Bu faqat mashq materiali, rasmiy IELTS baholash yoki ball bashorati emas.'], ru: ['Начальная практика IELTS', 'Лексика и задания на чтение в стиле академических экзаменов. Это только учебный материал, а не официальная оценка IELTS и не прогноз балла.'] },
  Beginner: { uz: ['Boshlang‘ich', 'Birinchi so‘zlar va oddiy gaplar.'], ru: ['Начальный', 'Первые слова и простые предложения.'] },
  Elementary: { uz: ['Elementar', 'Kundalik vaziyatlar.'], ru: ['Элементарный', 'Повседневные ситуации.'] },
  Intermediate: { uz: ['O‘rta', 'Ish, o‘qish va rejalar.'], ru: ['Средний', 'Работа, учёба и планы.'] },
  'Upper intermediate': { uz: ['O‘rtadan yuqori', 'Fikrlar va bahslar.'], ru: ['Выше среднего', 'Мнения и споры.'] },
  Advanced: { uz: ['Ilg‘or', 'Aniq va nozik ifodalar.'], ru: ['Продвинутый', 'Точная и тонкая речь.'] },
  'Academic basics': { uz: ['Akademik asoslar', 'Diagramma va tendensiyalarni tasvirlash.'], ru: ['Основы академического письма', 'Описание диаграмм и тенденций.'] },
  'Hello and me': { uz: ['Salom va men haqimda', 'Odamlar bilan salomlashing, o‘zingiz va oilangiz haqida gapiring.'], ru: ['Привет и обо мне', 'Здоровайтесь, рассказывайте о себе и своей семье.'] },
  'Food and daily life': { uz: ['Ovqat va kundalik hayot', 'Ovqat, ichimliklar va kuningiz.'], ru: ['Еда и повседневная жизнь', 'Еда, напитки и ваш день.'] },
  Places: { uz: ['Joylar', 'Shahardagi joylar.'], ru: ['Места', 'Места в городе.'] },
  'Everyday life': { uz: ['Kundalik hayot', 'Xarid qilish va sayohat.'], ru: ['Повседневная жизнь', 'Покупки и путешествия.'] },
  'Work and study': { uz: ['Ish va o‘qish', 'Kasbingiz va maqsadlaringiz haqida gapiring.'], ru: ['Работа и учёба', 'Говорите о своей работе и целях.'] },
  'Society and ideas': { uz: ['Jamiyat va g‘oyalar', 'Fikrni bildiring va himoya qiling.'], ru: ['Общество и идеи', 'Высказывайте и отстаивайте мнение.'] },
  'Academic language': { uz: ['Akademik til', 'Hisobotlar va muhokamalar uchun til.'], ru: ['Академический язык', 'Язык для отчётов и обсуждений.'] },
  'Describing data': { uz: ['Ma’lumotlarni tasvirlash', 'Diagramma va grafiklar uchun so‘zlar.'], ru: ['Описание данных', 'Слова для диаграмм и графиков.'] },
  Greetings: { uz: ['Salomlashish', 'Salom ayting va xushmuomala bo‘ling.'], ru: ['Приветствия', 'Здоровайтесь и будьте вежливы.'] },
  'About me': { uz: ['Men haqimda', 'O‘zingiz kimligingizni ayting.'], ru: ['Обо мне', 'Расскажите, кто вы.'] },
  'My family': { uz: ['Mening oilam', 'Oilangiz a’zolari haqida gapiring.'], ru: ['Моя семья', 'Расскажите о членах вашей семьи.'] },
  'At the table': { uz: ['Dasturxon atrofida', 'Oddiy ovqat va ichimliklarni nomlang.'], ru: ['За столом', 'Назовите привычные блюда и напитки.'] },
  'Daily routine': { uz: ['Kundalik tartib', 'Har kuni nima qilishingizni tasvirlang.'], ru: ['Распорядок дня', 'Опишите, что вы делаете каждый день.'] },
  'Around town': { uz: ['Shahar bo‘ylab', 'Narsalar qayerda ekanini ayting.'], ru: ['По городу', 'Говорите, где что находится.'] },
  Shopping: { uz: ['Xarid qilish', 'Narxlarni so‘rang va to‘lang.'], ru: ['Покупки', 'Спрашивайте цены и платите.'] },
  Travel: { uz: ['Sayohat', 'Poyezdlar, chiptalar va mehmonxonalar.'], ru: ['Путешествия', 'Поезда, билеты и отели.'] },
  'Work life': { uz: ['Ish hayoti', 'Ish joyi uchun lug‘at.'], ru: ['Рабочая жизнь', 'Лексика для рабочего места.'] },
  Opinions: { uz: ['Fikrlar', 'Rozi bo‘ling, e’tiroz bildiring va taklif qiling.'], ru: ['Мнения', 'Соглашайтесь, возражайте и предлагайте.'] },
  Nuance: { uz: ['Nozik ma’no', 'Aniq ma’no ifodalovchi so‘zlar.'], ru: ['Нюансы', 'Слова для точного выражения смысла.'] },
  'Task vocabulary': { uz: ['Topshiriq lug‘ati', 'Tendensiyani tasvirlang.'], ru: ['Лексика заданий', 'Опишите тенденцию.'] },
};

const RU_WORDS = {
  hello: ['привет; здравствуйте', 'Здравствуйте, меня зовут Анна.'], goodbye: ['до свидания', 'До свидания, увидимся завтра.'], please: ['пожалуйста', 'Пожалуйста, садитесь.'], 'thank you': ['спасибо', 'Спасибо за вашу помощь.'], yes: ['да', 'Да, я люблю чай.'], morning: ['утро', 'Доброе утро, учитель.'],
  name: ['имя', 'Меня зовут Омар.'], student: ['студент', 'Я студент.'], teacher: ['учитель', 'Она учитель.'], friend: ['друг', 'Он мой друг.'], country: ['страна', 'Моя страна прекрасна.'], age: ['возраст', 'Сколько вам лет?'],
  mother: ['мама', 'Моя мама работает в школе.'], father: ['папа', 'Мой папа водит автобус.'], sister: ['сестра', 'У моей сестры есть кошка.'], brother: ['брат', 'Мой брат играет в футбол.'], grandmother: ['бабушка', 'Моя бабушка рассказывает истории.'], family: ['семья', 'Я люблю свою семью.'],
  water: ['вода', 'Можно мне немного воды?'], bread: ['хлеб', 'На завтрак мы едим хлеб.'], apple: ['яблоко', 'Она ест яблоко каждый день.'], tea: ['чай', 'Я пью чай с сахаром.'], milk: ['молоко', 'Малыш пьёт молоко.'], rice: ['рис', 'Рис — моё любимое блюдо.'],
  'wake up': ['просыпаться', 'Я просыпаюсь в семь часов.'], eat: ['есть; кушать', 'Мы ужинаем вместе.'], go: ['идти; ехать', 'Я езжу в школу на автобусе.'], sleep: ['спать', 'Дети рано ложатся спать.'], work: ['работать', 'Мой отец работает в банке.'], study: ['учить; изучать', 'Я учу английский каждый вечер.'],
  house: ['дом', 'Мы живём в маленьком доме.'], school: ['школа', 'Школа открывается в восемь.'], shop: ['магазин', 'В магазине продают свежий хлеб.'], park: ['парк', 'Дети играют в парке.'], street: ['улица', 'Наша улица тихая.'], city: ['город', 'Самарканд — старинный город.'],
  price: ['цена', 'Сколько стоит эта сумка?'], cheap: ['дешёвый', 'Эти туфли дешёвые.'], expensive: ['дорогой', 'Этот телефон слишком дорогой.'], buy: ['покупать', 'Я хочу купить новую куртку.'], pay: ['платить', 'Вы можете заплатить картой.'], money: ['деньги', 'У меня недостаточно денег.'],
  ticket: ['билет', 'Мне нужен билет до Бухары.'], train: ['поезд', 'Поезд отправляется в девять.'], airport: ['аэропорт', 'Мы рано приехали в аэропорт.'], luggage: ['багаж', 'Мой багаж очень тяжёлый.'], journey: ['поездка; путешествие', 'Поездка заняла три часа.'], hotel: ['гостиница; отель', 'Отель находится рядом с вокзалом.'],
  deadline: ['крайний срок', 'Крайний срок сдачи отчёта — пятница.'], colleague: ['коллега', 'Мой коллега помог мне с проектом.'], meeting: ['встреча; совещание', 'У нас совещание в десять часов.'], salary: ['зарплата', 'Её зарплату выплачивают каждый месяц.'], improve: ['улучшать', 'Я хочу улучшить навыки разговорной речи.'], experience: ['опыт', 'У него пять лет опыта.'],
  opinion: ['мнение', 'По моему мнению, план реалистичен.'], agree: ['соглашаться', 'Я согласен с вашим предложением.'], argue: ['спорить', 'Они часто спорят о политике.'], evidence: ['доказательство', 'Явных доказательств этого утверждения нет.'], suggest: ['предлагать', 'Я предлагаю перенести встречу.'], convince: ['убеждать', 'Она пыталась убедить его остаться.'],
  reluctant: ['неохотный', 'Он неохотно делился своими результатами.'], significant: ['значительный; существенный', 'Исследование выявило значительную разницу между группами.'], comprehensive: ['всесторонний; исчерпывающий', 'Отчёт даёт всесторонний обзор рынка.'], mitigate: ['смягчать', 'Новые правила могут смягчить последствия кризиса.'], ambiguous: ['неоднозначный', 'В договоре есть неоднозначный пункт.'], substantial: ['значительный; крупный', 'Компания получила значительную прибыль.'],
  graph: ['график', 'График показывает число посетителей.'], increase: ['расти; увеличиваться', 'Продажи растут каждое лето.'], decrease: ['уменьшаться', 'Число пользователей начало уменьшаться в мае.'], proportion: ['доля; пропорция', 'Значительная доля студентов учится за границей.'], trend: ['тенденция', 'Эта тенденция сохранялась пять лет.'], significantly: ['значительно', 'Цены значительно выросли в прошлом году.'],
};

const RU_SENTENCES = {
  'Nice to meet you.': 'Приятно познакомиться.', 'I am a student.': 'Я студент.', 'We have a big family.': 'У нас большая семья.', 'I drink tea every morning.': 'Я пью чай каждое утро.', 'She wakes up at six.': 'Она просыпается в шесть.',
  'The park is near my house.': 'Парк находится рядом с моим домом.', 'How much does this shirt cost?': 'Сколько стоит эта рубашка?', 'Where can I buy a ticket?': 'Где можно купить билет?', 'We need to finish the report today.': 'Сегодня нам нужно закончить отчёт.',
  'I completely agree with you.': 'Я полностью с вами согласен.', 'The results were not entirely clear.': 'Результаты были не совсем ясны.', 'The chart shows a clear upward trend.': 'Диаграмма показывает чёткую тенденцию к росту.',
};

module.exports = { NAV, RU_WORDS, RU_SENTENCES };
