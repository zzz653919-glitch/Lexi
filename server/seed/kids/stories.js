/* LEXIO KIDS storybooks (original stories, simple English). Uzbek in the new alphabet. Each page: a scene (emoji art on a painted background),
   one or two short sentences with translations; after the story two small questions (first option is the right one; the app shuffles them).
   scene: [background, [[emoji, left %, top %, size (rem), motion?], ...]] */
const STORIES = [
  { slug: 'bunny', emoji: '🐰', color: '#ff8fab', en: 'The Little Bunny', uz: 'Kichkina quyon', ru: 'Маленький кролик', pages: [
    { scene: ['meadow', [['🐰', 50, 52, 8, 'bob'], ['🌼', 15, 78, 3], ['🌼', 84, 80, 3]]], en: 'This is Bobo. Bobo is a little bunny.', uz: 'Bu Bobo. Bobo kichkina quyon.', ru: 'Это Бобо. Бобо — маленький кролик.' },
    { scene: ['meadow', [['🐰', 40, 55, 7, 'bob'], ['🥕', 78, 60, 5, 'pulse']]], en: 'Bobo is hungry. He wants a carrot.', uz: 'Bobo och. U sabzi xohlaydi.', ru: 'Бобо голоден. Он хочет морковку.' },
    { scene: ['garden', [['🐰', 25, 62, 6, 'hop'], ['🌳', 78, 45, 8], ['🌷', 55, 80, 3]]], en: 'He hops to the garden.', uz: 'U bogʻga sakraydi.'.replace('ʻ', "'"), ru: 'Он прыгает в сад.' },
    { scene: ['garden', [['🥕', 52, 62, 7, 'pulse'], ['🦋', 22, 28, 3, 'fly'], ['🌷', 85, 80, 3]]], en: 'Bobo sees a big orange carrot.', uz: 'Bobo katta zarğaldoq sabzini kŏradi.', ru: 'Бобо видит большую оранжевую морковку.' },
    { scene: ['garden', [['🐰', 40, 58, 7, 'bob'], ['🥕', 70, 66, 4], ['😋', 40, 22, 3, 'pulse']]], en: 'He eats it. Yum, yum!', uz: 'U uni yeydi. Mazali!', ru: 'Он её ест. Ням-ням!' },
    { scene: ['night', [['🐰', 50, 62, 7, 'bob'], ['🌙', 78, 22, 5, 'pulse'], ['⭐', 20, 24, 3, 'pulse']]], en: 'Now Bobo is happy. Good night, Bobo!', uz: 'Endi Bobo xursand. Xayrli tun, Bobo!', ru: 'Теперь Бобо счастлив. Спокойной ночи, Бобо!' },
  ], questions: [
    { en: 'What does Bobo want?', uz: 'Bobo nima xohlaydi?', ru: 'Что хочет Бобо?', options: ['A carrot', 'A cake', 'Milk'] },
    { en: 'Is Bobo big or little?', uz: 'Bobo kattami yoki kichikmi?', ru: 'Бобо большой или маленький?', options: ['Little', 'Big', 'Tall'] },
  ] },
  { slug: 'zoo', emoji: '🦁', color: '#fb8500', en: 'A Day at the Zoo', uz: 'Hayvonot bogʻida bir kun'.replace('ʻ', "'"), ru: 'День в зоопарке', pages: [
    { scene: ['zoo', [['🚌', 50, 62, 7, 'bob'], ['☀️', 82, 18, 4, 'pulse'], ['🌳', 12, 60, 6]]], en: 'We go to the zoo by bus.', uz: 'Biz avtobusda hayvonot bogʻiga boramiz.'.replace('ʻ', "'"), ru: 'Мы едем в зоопарк на автобусе.' },
    { scene: ['zoo', [['🐘', 50, 55, 9, 'bob'], ['🌴', 14, 55, 6], ['🌴', 88, 58, 6]]], en: 'I see a big elephant.', uz: 'Men katta fil kŏraman.', ru: 'Я вижу большого слона.' },
    { scene: ['zoo', [['🐵', 50, 45, 8, 'hop'], ['🍌', 22, 68, 4, 'pulse'], ['🌴', 86, 52, 6]]], en: 'The monkey is funny.', uz: 'Maymun kulgili.', ru: 'Обезьяна смешная.' },
    { scene: ['zoo', [['🦁', 50, 55, 9, 'bob'], ['💬', 78, 25, 4, 'pulse']]], en: 'The lion says roar!', uz: 'Sher “gr-r-r” deydi!', ru: 'Лев говорит «р-р-р»!' },
    { scene: ['zoo', [['🦒', 52, 50, 9, 'bob'], ['🍃', 25, 28, 3, 'fly']]], en: 'The giraffe is very tall.', uz: 'Jirafa juda baland.', ru: 'Жираф очень высокий.' },
    { scene: ['zoo', [['👧', 30, 62, 6, 'bob'], ['🐘', 66, 56, 6], ['❤️', 50, 22, 4, 'pulse']]], en: 'I love the zoo. Goodbye, animals!', uz: 'Men hayvonot bogʻini yaxşi kŏraman. Xayr, hayvonlar!'.replace('ʻ', "'"), ru: 'Я люблю зоопарк. До свидания, животные!' },
  ], questions: [
    { en: 'How do they go to the zoo?', uz: 'Ular hayvonot bogʻiga qanday borishadi?'.replace('ʻ', "'"), ru: 'Как они едут в зоопарк?', options: ['By bus', 'By train', 'By boat'] },
    { en: 'Who is very tall?', uz: 'Kim juda baland?', ru: 'Кто очень высокий?', options: ['The giraffe', 'The monkey', 'The lion'] },
  ] },
  { slug: 'garden', emoji: '🌸', color: '#06d6a0', en: 'The Magic Garden', uz: 'Sehrli bogʻ'.replace('ʻ', "'"), ru: 'Волшебный сад', pages: [
    { scene: ['garden', [['👧', 36, 62, 7, 'bob'], ['🌱', 72, 72, 3], ['🌷', 88, 80, 3]]], en: 'Mia has a small garden.', uz: 'Miyaning kichkina bogʻi bor.'.replace('ʻ', "'"), ru: 'У Мии есть маленький сад.' },
    { scene: ['garden', [['👧', 30, 60, 6, 'bob'], ['✨', 66, 55, 5, 'pulse'], ['🌱', 70, 74, 3]]], en: 'She plants a magic seed.', uz: 'U sehrli urugʻ ekadi.'.replace('ʻ', "'"), ru: 'Она сажает волшебное семечко.' },
    { scene: ['garden', [['🌱', 40, 70, 4, 'pulse'], ['🌿', 55, 62, 6, 'pulse'], ['💧', 75, 30, 3, 'fly']]], en: 'The seed grows and grows.', uz: 'Urugʻ ŏsadi va ŏsadi.'.replace('ʻ', "'"), ru: 'Семечко растёт и растёт.' },
    { scene: ['garden', [['🌸', 50, 55, 10, 'pulse'], ['🌿', 50, 82, 4]]], en: 'A pink flower opens.', uz: 'Pushti gul ochiladi.'.replace('Pushti', 'Puşti').replace('ochiladi', 'oçiladi'), ru: 'Распускается розовый цветок.' },
    { scene: ['garden', [['🌸', 40, 58, 8], ['🦋', 66, 36, 6, 'fly']]], en: 'A butterfly sits on it.', uz: 'Uning ustiga kapalak qŏnadi.', ru: 'На него садится бабочка.' },
    { scene: ['garden', [['🌈', 50, 30, 10, 'pulse'], ['👧', 30, 68, 5, 'bob'], ['🌸', 72, 70, 5]]], en: 'The garden is magic!', uz: 'Bogʻ sehrli!'.replace('ʻ', "'"), ru: 'Сад волшебный!' },
  ], questions: [
    { en: 'What does Mia plant?', uz: 'Miya nima ekadi?', ru: 'Что сажает Мия?', options: ['A magic seed', 'A tree', 'A carrot'] },
    { en: 'What color is the flower?', uz: 'Gul qanday rangda?', ru: 'Какого цвета цветок?', options: ['Pink', 'Blue', 'Black'] },
  ] },
  { slug: 'school', emoji: '🏫', color: '#3a86ff', en: 'My First School', uz: 'Mening birinçi maktabim', ru: 'Моя первая школа', pages: [
    { scene: ['school', [['🏫', 50, 52, 10], ['☀️', 82, 16, 4, 'pulse']]], en: 'Today is my first day at school.', uz: 'Bugun maktabdagi birinçi kunim.', ru: 'Сегодня мой первый день в школе.' },
    { scene: ['school', [['🎒', 50, 56, 8, 'bob'], ['⭐', 22, 26, 3, 'pulse']]], en: 'I have a red bag.', uz: 'Mening qizil sumkam bor.', ru: 'У меня красный рюкзак.' },
    { scene: ['school', [['👩‍🏫', 62, 56, 8, 'bob'], ['👦', 28, 64, 5]]], en: 'I meet my teacher.', uz: 'Men ŏqituvçim bilan tanişaman.', ru: 'Я знакомлюсь с учительницей.' },
    { scene: ['school', [['🎵', 30, 30, 4, 'fly'], ['🎶', 70, 26, 4, 'fly'], ['👧', 38, 66, 5, 'bob'], ['👦', 62, 66, 5, 'bob']]], en: 'We sing a song.', uz: 'Biz qŏşiq aytamiz.', ru: 'Мы поём песню.' },
    { scene: ['school', [['🖍️', 30, 62, 5], ['☀️', 62, 46, 8, 'pulse']]], en: 'I draw a sun.', uz: 'Men quyoş çizaman.', ru: 'Я рисую солнце.' },
    { scene: ['school', [['😀', 50, 46, 9, 'pulse'], ['📚', 24, 74, 4], ['🏫', 80, 70, 5]]], en: 'I like school.', uz: 'Menga maktab yoqadi.', ru: 'Мне нравится школа.' },
  ], questions: [
    { en: 'What color is the bag?', uz: 'Sumka qanday rangda?', ru: 'Какого цвета рюкзак?', options: ['Red', 'Green', 'Yellow'] },
    { en: 'What do they do together?', uz: 'Ular birga nima qilishadi?', ru: 'Что они делают вместе?', options: ['Sing a song', 'Sleep', 'Run'] },
  ] },
  { slug: 'puppy', emoji: '🐶', color: '#c77dff', en: 'The Lost Puppy', uz: 'Yŏqolgan kuçuk', ru: 'Потерявшийся щенок', pages: [
    { scene: ['home', [['🐶', 50, 58, 8, 'bob'], ['🏠', 82, 48, 6]]], en: 'Max is a little puppy.', uz: 'Maks kichkina kuçuk.', ru: 'Макс — маленький щенок.' },
    { scene: ['park', [['🐶', 30, 62, 6, 'hop'], ['🌳', 74, 48, 8], ['🌳', 14, 50, 6]]], en: 'Max is lost in the park.', uz: 'Maks parkda yŏqolib qoldi.', ru: 'Макс потерялся в парке.' },
    { scene: ['park', [['🐶', 50, 60, 7], ['😢', 50, 24, 4, 'pulse']]], en: 'He is sad.', uz: 'U xafa.', ru: 'Ему грустно.' },
    { scene: ['park', [['👧', 30, 60, 7, 'bob'], ['🐶', 68, 66, 5], ['❓', 50, 22, 4, 'pulse']]], en: 'A girl sees Max.', uz: 'Bir qiz Maksni kŏradi.', ru: 'Девочка видит Макса.' },
    { scene: ['home', [['👧', 36, 60, 6, 'bob'], ['🐶', 56, 66, 5, 'bob'], ['🏠', 84, 48, 6]]], en: 'She takes him home.', uz: 'U uni uyiga olib boradi.', ru: 'Она ведёт его домой.' },
    { scene: ['home', [['🐶', 40, 60, 7, 'hop'], ['❤️', 62, 30, 5, 'pulse'], ['🦴', 74, 74, 4]]], en: 'Max is happy again.', uz: 'Maks yana xursand.', ru: 'Макс снова счастлив.' },
  ], questions: [
    { en: 'Where is Max lost?', uz: 'Maks qayerda yŏqoldi?', ru: 'Где потерялся Макс?', options: ['In the park', 'At school', 'In the zoo'] },
    { en: 'Who sees Max?', uz: 'Maksni kim kŏradi?', ru: 'Кто видит Макса?', options: ['A girl', 'A bird', 'A lion'] },
  ] },
  { slug: 'moon', emoji: '🚀', color: '#9b5de5', en: 'A Trip to the Moon', uz: 'Oyga sayohat', ru: 'Путешествие на Луну', pages: [
    { scene: ['night', [['🚀', 50, 56, 9, 'bob'], ['⭐', 18, 24, 3, 'pulse'], ['⭐', 84, 30, 3, 'pulse']]], en: 'Leo has a rocket.', uz: 'Leoning raketasi bor.', ru: 'У Лео есть ракета.' },
    { scene: ['night', [['🚀', 50, 56, 9, 'pulse'], ['3️⃣', 20, 30, 5], ['2️⃣', 50, 22, 5], ['1️⃣', 80, 30, 5]]], en: 'Three, two, one, go!', uz: 'Uç, ikki, bir, ketdik!', ru: 'Три, два, один, поехали!' },
    { scene: ['space', [['🚀', 50, 44, 8, 'fly'], ['☁️', 20, 80, 5], ['⭐', 80, 20, 3, 'pulse']]], en: 'The rocket flies up.', uz: 'Raketa yuqoriga uçadi.', ru: 'Ракета летит вверх.' },
    { scene: ['space', [['🌟', 24, 30, 4, 'pulse'], ['⭐', 70, 24, 5, 'pulse'], ['✨', 50, 60, 5, 'pulse'], ['🪐', 82, 62, 5]]], en: 'Leo sees the stars.', uz: 'Leo yulduzlarni kŏradi.', ru: 'Лео видит звёзды.' },
    { scene: ['space', [['🌙', 50, 66, 10], ['🚀', 50, 34, 6, 'bob']]], en: 'He lands on the moon.', uz: 'U oyga qŏnadi.', ru: 'Он приземляется на Луну.' },
    { scene: ['space', [['👨‍🚀', 40, 56, 7, 'bob'], ['🌍', 76, 28, 6, 'pulse'], ['👋', 56, 34, 3, 'pulse']]], en: 'He waves to the earth.', uz: 'U Yerga qŏl silkitadi.', ru: 'Он машет Земле.' },
  ], questions: [
    { en: 'What does Leo have?', uz: 'Leoda nima bor?', ru: 'Что есть у Лео?', options: ['A rocket', 'A boat', 'A bike'] },
    { en: 'Where does Leo land?', uz: 'Leo qayerga qŏnadi?', ru: 'Куда приземляется Лео?', options: ['On the moon', 'In a garden', 'At school'] },
  ] },
];
/* the Uzbek texts above may be written in the old spelling: they are converted to the new alphabet (converting twice changes nothing) */
const { convertText } = require('../../lib/uz-convert');
const nu = (x) => convertText(x, new Set());
for (const st of STORIES) { st.uz = nu(st.uz); for (const p of st.pages) p.uz = nu(p.uz); for (const q of st.questions) q.uz = nu(q.uz); }
module.exports = { STORIES };
